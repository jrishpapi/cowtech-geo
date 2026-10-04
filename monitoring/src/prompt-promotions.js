import { pool } from './db.js';
import { discoverOpportunityPrompts, listOpportunityPrompts } from './opportunity-prompts.js';

function toNumber(value) {
  return Number(value || 0);
}

function promotionReason(prompt) {
  return `Promoted from ${prompt.prompt_source} with opportunity prompt score ${Number(prompt.opportunity_prompt_score).toFixed(2)}.`;
}

function normalizePromotionRow(row) {
  return {
    ...row,
    opportunity_prompt_score: toNumber(row.opportunity_prompt_score)
  };
}

export async function listPromptPromotions(trackingRunId) {
  const result = await pool.query(
    `SELECT pp.*,
            op.prompt_text AS opportunity_prompt_text,
            op.prompt_source,
            op.prompt_category,
            ps.version_number AS target_version_number,
            p.prompt_text AS promoted_prompt_text
     FROM prompt_promotions pp
     JOIN opportunity_prompts op ON op.id = pp.opportunity_prompt_id
     JOIN prompt_sets ps ON ps.id = pp.target_prompt_set_id
     JOIN prompts p ON p.id = pp.promoted_prompt_id
     WHERE pp.tracking_run_id = $1
     ORDER BY pp.opportunity_prompt_score DESC, pp.created_at ASC`,
    [trackingRunId]
  );

  return result.rows.map(normalizePromotionRow);
}

async function loadPromotionContext(client, trackingRunId) {
  const run = await client.query(
    `SELECT tr.id,
            tr.brand_id,
            tr.prompt_set_id,
            b.name AS brand_name,
            ps.name AS prompt_set_name,
            ps.version_number
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN prompt_sets ps ON ps.id = tr.prompt_set_id
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  if (run.rowCount !== 1) {
    throw new Error(`tracking run not found for prompt promotion: ${trackingRunId}`);
  }
  return run.rows[0];
}

export async function promoteOpportunityPrompts(
  trackingRunId,
  { score_threshold = 75, max_promotions = 5, change_reason = 'Promote validated opportunity prompts' } = {}
) {
  let prompts = await listOpportunityPrompts(trackingRunId);
  if (!prompts.length) {
    const discovered = await discoverOpportunityPrompts(trackingRunId);
    prompts = discovered.prompts;
  }

  const promotable = prompts
    .filter((prompt) => prompt.status === 'validated')
    .filter((prompt) => toNumber(prompt.opportunity_prompt_score) >= score_threshold)
    .filter((prompt) => !prompt.promoted_prompt_id)
    .sort((a, b) => toNumber(b.opportunity_prompt_score) - toNumber(a.opportunity_prompt_score))
    .slice(0, Math.max(0, Number(max_promotions) || 0));

  if (!promotable.length) {
    return {
      tracking_run_id: trackingRunId,
      promoted_count: 0,
      target_prompt_set: null,
      promotions: []
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const context = await loadPromotionContext(client, trackingRunId);
    const nextVersion = Number(context.version_number || 1) + 1;

    const targetPromptSet = await client.query(
      `INSERT INTO prompt_sets (
         brand_id,
         name,
         status,
         version_number,
         parent_prompt_set_id,
         change_reason,
         promoted_from_run_id,
         activated_at
       )
       VALUES ($1, $2, 'active', $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        context.brand_id,
        `${context.brand_name} prompt set v${nextVersion}`,
        nextVersion,
        context.prompt_set_id,
        change_reason,
        trackingRunId
      ]
    );

    await client.query(
      `UPDATE prompt_sets
       SET status = 'superseded'
       WHERE id = $1`,
      [context.prompt_set_id]
    );

    await client.query(
      `INSERT INTO prompts (
         prompt_set_id,
         category,
         prompt_text,
         locale,
         status,
         priority,
         prompt_source,
         opportunity_prompt_id
       )
       SELECT $1,
              category,
              prompt_text,
              locale,
              status,
              priority,
              prompt_source,
              opportunity_prompt_id
       FROM prompts
       WHERE prompt_set_id = $2 AND COALESCE(status, 'active') = 'active'
       ORDER BY priority DESC, created_at ASC`,
      [targetPromptSet.rows[0].id, context.prompt_set_id]
    );

    const promotions = [];
    for (const prompt of promotable) {
      const insertedPrompt = await client.query(
        `INSERT INTO prompts (
           prompt_set_id,
           category,
           prompt_text,
           locale,
           status,
           priority,
           prompt_source,
           opportunity_prompt_id
         )
         VALUES ($1, $2, $3, 'en', 'active', 90, 'opportunity_promoted', $4)
         RETURNING *`,
        [targetPromptSet.rows[0].id, prompt.prompt_category, prompt.prompt_text, prompt.id]
      );

      const insertedPromotion = await client.query(
        `INSERT INTO prompt_promotions (
           tracking_run_id,
           brand_id,
           opportunity_prompt_id,
           source_prompt_set_id,
           target_prompt_set_id,
           promoted_prompt_id,
           opportunity_prompt_score,
           promotion_reason,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'promoted')
         RETURNING *`,
        [
          trackingRunId,
          context.brand_id,
          prompt.id,
          context.prompt_set_id,
          targetPromptSet.rows[0].id,
          insertedPrompt.rows[0].id,
          prompt.opportunity_prompt_score,
          promotionReason(prompt)
        ]
      );

      await client.query(
        `UPDATE opportunity_prompts
         SET status = 'promoted',
             promoted_prompt_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [prompt.id, insertedPrompt.rows[0].id]
      );

      promotions.push(normalizePromotionRow(insertedPromotion.rows[0]));
    }

    await client.query('COMMIT');

    return {
      tracking_run_id: trackingRunId,
      promoted_count: promotions.length,
      target_prompt_set: {
        id: targetPromptSet.rows[0].id,
        name: targetPromptSet.rows[0].name,
        version_number: targetPromptSet.rows[0].version_number,
        parent_prompt_set_id: targetPromptSet.rows[0].parent_prompt_set_id
      },
      promotions
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
