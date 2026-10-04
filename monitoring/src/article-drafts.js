import { pool } from './db.js';
import { generateContentBriefs, listContentBriefs } from './briefs.js';
import { recordQuotaUsageEvent } from './quota-bridge.js';
import { getCustomerAddonSummary } from './customer-addons.js';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function hasValidatedPromptLinks(brief) {
  return (brief.linked_opportunity_prompts || []).some((prompt) => prompt.status === 'validated');
}

function draftGuardrails(brief) {
  return uniqueValues([
    ...(brief.guardrails || []),
    'Do not publish this draft without human review.',
    'Do not add unsupported claims while expanding the skeleton into prose.',
    'Keep every section mapped to the linked validated opportunity prompts.'
  ]);
}

function sectionFromOutline(brief, heading, index) {
  const linkedPrompt = brief.linked_opportunity_prompts[index % brief.linked_opportunity_prompts.length];
  return {
    order: index + 1,
    heading,
    purpose: `Answer the brief objective for ${brief.content_type} while staying aligned with validated opportunity prompts.`,
    target_prompt: linkedPrompt?.prompt_text || null,
    required_facts: brief.must_include_facts || [],
    evidence_requirements: brief.evidence_requirements || [],
    draft_instruction: 'Expand this section with concise, factual, citation-ready copy during the article generation step.'
  };
}

function validationState(brief) {
  const linkedPromptCount = (brief.linked_opportunity_prompts || []).filter(
    (prompt) => prompt.status === 'validated'
  ).length;
  const blockers = [];

  if (brief.status !== 'draft') {
    blockers.push('content brief is not article-ready');
  }
  if (!linkedPromptCount) {
    blockers.push('no validated opportunity prompts linked to brief');
  }

  return {
    can_generate_draft: blockers.length === 0,
    blockers,
    linked_validated_prompt_count: linkedPromptCount,
    required_review_before_publish: true
  };
}

export function buildArticleDraft({ brief }) {
  const validation = validationState(brief);
  if (!validation.can_generate_draft) {
    return {
      status: 'blocked',
      content_brief_id: brief.id,
      title: brief.title,
      validation_state: validation
    };
  }

  const draftKey = `${brief.id}:${slugify(brief.title)}`;
  const linkedPrompts = brief.linked_opportunity_prompts.filter((prompt) => prompt.status === 'validated');
  const primaryPrompt = linkedPrompts.find((prompt) => prompt.link_role === 'primary') || linkedPrompts[0];

  return {
    schema_version: 'phase4-article-draft-v1',
    draft_key: draftKey,
    content_brief_id: brief.id,
    tracking_run_id: brief.tracking_run_id,
    content_type: brief.content_type,
    title: brief.title,
    status: 'draft_skeleton',
    objective: brief.objective,
    audience: brief.audience,
    primary_prompt: primaryPrompt?.prompt_text || null,
    target_prompts: linkedPrompts.map((prompt) => ({
      id: prompt.id,
      prompt_text: prompt.prompt_text,
      prompt_source: prompt.prompt_source,
      prompt_category: prompt.prompt_category,
      opportunity_prompt_score: prompt.opportunity_prompt_score,
      link_role: prompt.link_role
    })),
    outline: (brief.outline || []).map((heading, index) => sectionFromOutline(brief, heading, index)),
    must_include_facts: brief.must_include_facts || [],
    evidence_requirements: brief.evidence_requirements || [],
    internal_link_targets: brief.internal_link_targets || [],
    guardrails: draftGuardrails(brief),
    forbidden_claims: [
      'Do not invent customers.',
      'Do not invent rankings.',
      'Do not invent awards.',
      'Do not invent certifications.',
      'Do not invent pricing.',
      'Do not invent performance metrics.',
      'Do not claim AI visibility improved before retest.'
    ],
    retest_plan: brief.retest_plan || {},
    validation_state: validation
  };
}

function normalizeDraftRow(row) {
  return {
    ...row,
    draft_payload: row.draft_payload || {},
    linked_opportunity_prompts: row.linked_opportunity_prompts || [],
    validation_state: row.validation_state || {}
  };
}

export async function listArticleDrafts(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_drafts
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeDraftRow);
}

export async function generateArticleDrafts(trackingRunId) {
  let briefs = await listContentBriefs(trackingRunId);
  if (!briefs.length) {
    const generated = await generateContentBriefs(trackingRunId);
    briefs = generated.briefs;
  }

  const draftableBriefs = briefs.filter((brief) => brief.status === 'draft' && hasValidatedPromptLinks(brief));
  const planResult = await pool.query(
    `SELECT b.id AS brand_id,
            c.id AS customer_id,
            p.article_drafts_max
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     JOIN plans p ON p.id = c.plan_code
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  const plan = planResult.rows[0] || {};
  const addons = await getCustomerAddonSummary({ customer_id: plan.customer_id });
  const maxAllowed = Number(plan.article_drafts_max || 0) + Number(addons?.totals?.article || 0);
  const allowedDraftableBriefs = maxAllowed > 0 ? draftableBriefs.slice(0, maxAllowed) : draftableBriefs;
  const overQuotaBriefs =
    maxAllowed > 0
      ? draftableBriefs.slice(maxAllowed).map((brief) => ({
          status: 'blocked',
          content_brief_id: brief.id,
          title: brief.title,
          validation_state: {
            can_generate_draft: false,
            blockers: ['article draft quota exceeded'],
            required_review_before_publish: true
          }
        }))
      : [];
  if (plan.customer_id) {
    await recordQuotaUsageEvent({
      customer_id: plan.customer_id,
      brand_id: plan.brand_id,
      event_type: overQuotaBriefs.length ? 'quota_capped' : 'quota_checked',
      quota_type: 'article_draft',
      units: allowedDraftableBriefs.length,
      status: overQuotaBriefs.length ? 'capped' : 'allowed',
      metadata: {
        source: 'generate_article_drafts',
        quota_limit: maxAllowed || null,
        requested_units: draftableBriefs.length,
        projected_usage: allowedDraftableBriefs.length
      }
    });
  }
  const blockedBriefs = briefs
    .filter((brief) => brief.status !== 'draft' || !hasValidatedPromptLinks(brief))
    .map((brief) => buildArticleDraft({ brief }))
    .concat(overQuotaBriefs);

  const saved = [];
  for (const brief of allowedDraftableBriefs) {
    const draft = buildArticleDraft({ brief });
    const result = await pool.query(
      `INSERT INTO article_drafts (
         tracking_run_id,
         content_brief_id,
         draft_key,
         content_type,
         title,
         status,
         draft_payload,
         linked_opportunity_prompts,
         validation_state
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tracking_run_id, content_brief_id)
       DO UPDATE SET
         draft_key = EXCLUDED.draft_key,
         content_type = EXCLUDED.content_type,
         title = EXCLUDED.title,
         status = EXCLUDED.status,
         draft_payload = EXCLUDED.draft_payload,
         linked_opportunity_prompts = EXCLUDED.linked_opportunity_prompts,
         validation_state = EXCLUDED.validation_state,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        brief.id,
        draft.draft_key,
        brief.content_type,
        brief.title,
        draft.status,
        JSON.stringify(draft),
        JSON.stringify(draft.target_prompts),
        JSON.stringify(draft.validation_state)
      ]
    );
    saved.push(normalizeDraftRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    generated_count: saved.length,
    blocked_count: blockedBriefs.length,
    drafts: saved,
    blocked_briefs: blockedBriefs
  };
}
