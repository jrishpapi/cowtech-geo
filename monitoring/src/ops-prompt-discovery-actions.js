import { pool } from './db.js';

export const OPS_PROMPT_DISCOVERY_ACTION_SCHEMA_VERSION = 'pd8-product-ops-prompt-discovery-action-v1';
export const OPS_PROMPT_DISCOVERY_ACTIONS = [
  'shortlist',
  'approve',
  'reject',
  'edit',
  'replace',
  'confirm',
  'block_confirmation',
  'override_quota'
];

function errorWithCode(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text.length ? text : null;
}

function assertPromptText(value, codePrefix = 'ops_prompt_discovery_edit') {
  const text = cleanText(value);
  if (!text) {
    throw errorWithCode(`${codePrefix}_text_required`, 'operator prompt text is required');
  }
  if (text.length < 12) {
    throw errorWithCode(`${codePrefix}_text_too_short`, 'operator prompt text is too short');
  }
  if (text.length > 500) {
    throw errorWithCode(`${codePrefix}_text_too_long`, 'operator prompt text is too long');
  }
  return text;
}

function assertActionAllowed(action) {
  if (!OPS_PROMPT_DISCOVERY_ACTIONS.includes(action)) {
    throw errorWithCode('ops_prompt_discovery_action_not_allowed', `ops prompt discovery action is not allowed: ${action}`);
  }
}

function assertActor(actor) {
  const value = cleanText(actor);
  if (!value) {
    throw errorWithCode('ops_prompt_discovery_actor_required', 'operator actor is required');
  }
  return value;
}

function assertReason(reason, code = 'ops_prompt_discovery_reason_required') {
  const value = cleanText(reason);
  if (!value) {
    throw errorWithCode(code, 'operator reason is required');
  }
  return value;
}

function statusForAction(action) {
  const map = {
    shortlist: 'shortlisted',
    approve: 'approved',
    reject: 'rejected',
    edit: 'edited',
    block_confirmation: 'archived',
    override_quota: 'approved'
  };
  return map[action] || null;
}

function eventTypeForAction(action) {
  if (action === 'block_confirmation' || action === 'override_quota') return 'operator_override';
  return action;
}

async function loadCandidate(candidateId, client = pool) {
  const result = await client.query(
    `SELECT pc.*, pdr.status AS discovery_status, pdr.provider_mode, pdr.source_mode
     FROM prompt_candidates pc
     JOIN prompt_discovery_runs pdr ON pdr.id = pc.discovery_run_id
     WHERE pc.id = $1`,
    [candidateId]
  );
  return result.rows[0] || null;
}

async function loadPromptDiscoveryContextByBrand(brandId, client = pool) {
  const result = await client.query(
    `SELECT b.id AS brand_id,
            b.name AS brand_name,
            c.id AS customer_id,
            c.plan_code,
            p.id AS plan_id,
            p.monthly_prompt_limit,
            ps.id AS prompt_set_id
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     JOIN plans p ON p.id = c.plan_code
     LEFT JOIN LATERAL (
       SELECT id
       FROM prompt_sets
       WHERE brand_id = b.id AND status = 'active'
       ORDER BY version_number DESC, created_at DESC
       LIMIT 1
     ) ps ON true
     WHERE b.id = $1`,
    [brandId]
  );
  return result.rows[0] || null;
}

async function countConfirmedPrompts(brandId, client = pool) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM confirmed_prompt_links cpl
     JOIN prompts p ON p.id = cpl.prompt_id
     WHERE cpl.brand_id = $1
       AND cpl.status = 'active'
       AND COALESCE(p.status, 'active') = 'active'`,
    [brandId]
  );
  return Number(result.rows[0]?.count || 0);
}

async function recordOperatorSelectionEvent(
  client,
  { brand_id, prompt_candidate_id, prompt_id = null, event_type, actor, event_payload = {}, idempotency_key = null }
) {
  const result = await client.query(
    `INSERT INTO prompt_selection_events (
       brand_id, prompt_candidate_id, prompt_id, event_type, actor_type, actor_id, event_payload, idempotency_key
     )
     VALUES ($1, $2, $3, $4, 'operator', $5, $6, $7)
     ON CONFLICT (idempotency_key) DO UPDATE SET
       event_payload = EXCLUDED.event_payload
     RETURNING *`,
    [brand_id, prompt_candidate_id, prompt_id, event_type, actor, JSON.stringify(event_payload), idempotency_key]
  );
  return result.rows[0];
}

async function createConfirmedPrompt(client, { candidate, context, actor, reason, note, idempotencyKey, overrideQuota }) {
  if (candidate.status === 'archived') {
    throw errorWithCode('ops_prompt_candidate_not_confirmable', 'archived prompt candidates cannot be confirmed');
  }

  const existingLink = await client.query(
    `SELECT cpl.*, p.prompt_text, p.status AS prompt_status
     FROM confirmed_prompt_links cpl
     JOIN prompts p ON p.id = cpl.prompt_id
     WHERE cpl.prompt_candidate_id = $1 AND cpl.status = 'active'
     LIMIT 1`,
    [candidate.id]
  );
  if (existingLink.rowCount) {
    const event = await recordOperatorSelectionEvent(client, {
      brand_id: candidate.brand_id,
      prompt_candidate_id: candidate.id,
      prompt_id: existingLink.rows[0].prompt_id,
      event_type: 'confirm',
      actor,
      event_payload: {
        action: 'confirm',
        status: 'already_confirmed',
        reason: reason || null,
        note: note || null,
        operator_safe: true,
        tracking_auto_run: false,
        paid_provider_call: false
      },
      idempotency_key: idempotencyKey
    });
    return {
      prompt_id: existingLink.rows[0].prompt_id,
      candidate_id: candidate.id,
      status: 'already_confirmed',
      prompt_text: existingLink.rows[0].prompt_text,
      event
    };
  }

  if (!context.prompt_set_id) {
    throw errorWithCode('ops_prompt_discovery_prompt_set_not_found', 'active prompt set not found for prompt confirmation');
  }

  const confirmedCount = await countConfirmedPrompts(candidate.brand_id, client);
  const planLimit = Number(context.monthly_prompt_limit || 0);
  if (planLimit > 0 && confirmedCount + 1 > planLimit && !overrideQuota) {
    throw errorWithCode('ops_prompt_discovery_quota_override_required', 'quota override reason is required to confirm over the plan limit');
  }

  const promptResult = await client.query(
    `INSERT INTO prompts (
       prompt_set_id, category, prompt_text, locale, status, priority, prompt_source,
       topic_id, intent, funnel_stage, market, confirmed_from_candidate_id, quota_unit,
       confirmed_at, confirmed_by
     )
     VALUES ($1, $2, $3, $4, 'active', 95, 'prompt_discovery', $5, $6, $7, $8, $9, 1, NOW(), $10)
     RETURNING *`,
    [
      context.prompt_set_id,
      candidate.intent || 'category-recommendation',
      candidate.candidate_text,
      candidate.language || 'en',
      candidate.topic_id || null,
      candidate.intent || null,
      candidate.funnel_stage || null,
      candidate.market || null,
      candidate.id,
      actor
    ]
  );
  const prompt = promptResult.rows[0];

  await client.query(
    `INSERT INTO confirmed_prompt_links (
       brand_id, prompt_candidate_id, prompt_set_id, prompt_id, confirmed_by, status, confirmation_payload
     )
     VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
    [
      candidate.brand_id,
      candidate.id,
      context.prompt_set_id,
      prompt.id,
      actor,
      JSON.stringify({
        source: 'ops_dashboard',
        reason: reason || null,
        note: note || null,
        quota_unit: 1,
        quota_override: Boolean(overrideQuota),
        tracking_auto_run: false,
        paid_provider_call: false
      })
    ]
  );
  await client.query(
    `UPDATE prompt_candidates
     SET status = 'confirmed', updated_at = NOW()
     WHERE id = $1`,
    [candidate.id]
  );
  const event = await recordOperatorSelectionEvent(client, {
    brand_id: candidate.brand_id,
    prompt_candidate_id: candidate.id,
    prompt_id: prompt.id,
    event_type: 'confirm',
    actor,
    event_payload: {
      action: 'confirm',
      reason: reason || null,
      note: note || null,
      quota_unit: 1,
      quota_override: Boolean(overrideQuota),
      operator_safe: true,
      tracking_auto_run: false,
      paid_provider_call: false
    },
    idempotency_key: idempotencyKey
  });

  return {
    prompt_id: prompt.id,
    candidate_id: candidate.id,
    status: 'confirmed',
    prompt_text: prompt.prompt_text,
    event
  };
}

async function replaceCandidate(client, { candidate, actor, reason, note, replacementText, idempotencyKey }) {
  const text = assertPromptText(replacementText, 'ops_prompt_discovery_replace');
  const replacement = await client.query(
    `INSERT INTO prompt_candidates (
       brand_id, discovery_run_id, primary_source_id, topic_id, candidate_text, normalized_text,
       language, market, intent, funnel_stage, gap_type, provenance, recommendation_reason,
       quota_impact, duplicate_key, duplicate_risk, status, edited_from_candidate_id, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'operator_manual', $12, 1, $6, 0, 'approved', $13, $14)
     RETURNING *`,
    [
      candidate.brand_id,
      candidate.discovery_run_id,
      candidate.primary_source_id,
      candidate.topic_id,
      text,
      normalizeText(text),
      candidate.language || 'en',
      candidate.market || null,
      candidate.intent || 'unknown',
      candidate.funnel_stage || 'unknown',
      candidate.gap_type || 'untested',
      `Operator replacement for candidate ${candidate.id}.`,
      candidate.id,
      actor
    ]
  );
  const replacementCandidate = replacement.rows[0];

  await client.query(
    `INSERT INTO prompt_candidate_tag_links (prompt_candidate_id, tag_id)
     SELECT $1, tag_id
     FROM prompt_candidate_tag_links
     WHERE prompt_candidate_id = $2
     ON CONFLICT DO NOTHING`,
    [replacementCandidate.id, candidate.id]
  );
  await client.query(
    `INSERT INTO prompt_candidate_scores (
       prompt_candidate_id, score_version, commercial_value_score, competitor_relevance_score,
       insight_value_score, tracking_value_score, gap_severity_score, source_opportunity_score,
       volume_signal_score, duplicate_penalty, priority_score, score_payload
     )
     SELECT $1, score_version, commercial_value_score, competitor_relevance_score,
            insight_value_score, tracking_value_score, gap_severity_score, source_opportunity_score,
            volume_signal_score, 0, priority_score, score_payload
     FROM prompt_candidate_scores
     WHERE prompt_candidate_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [replacementCandidate.id, candidate.id]
  );
  await client.query(
    `UPDATE prompt_candidates
     SET status = 'archived', updated_at = NOW()
     WHERE id = $1`,
    [candidate.id]
  );
  const event = await recordOperatorSelectionEvent(client, {
    brand_id: candidate.brand_id,
    prompt_candidate_id: candidate.id,
    event_type: 'replace',
    actor,
    event_payload: {
      action: 'replace',
      status: 'archived',
      replacement_candidate_id: replacementCandidate.id,
      reason: reason || null,
      note: note || null,
      operator_safe: true,
      tracking_auto_run: false,
      paid_provider_call: false
    },
    idempotency_key: idempotencyKey
  });

  return {
    candidate: replacementCandidate,
    event
  };
}

async function updateCandidate(client, { candidate, action, actor, reason, note, editedText, idempotencyKey }) {
  const status = statusForAction(action);
  const cleanEditedText = action === 'edit' ? assertPromptText(editedText) : null;
  const payload = {
    action,
    status,
    reason: reason || null,
    note: note || null,
    edited_text: action === 'edit',
    quota_override: action === 'override_quota',
    operator_safe: true,
    tracking_auto_run: false,
    paid_provider_call: false
  };
  const updated = await client.query(
    `UPDATE prompt_candidates
     SET status = $2,
         candidate_text = COALESCE($3, candidate_text),
         normalized_text = COALESCE($4, normalized_text),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [candidate.id, status, cleanEditedText, cleanEditedText ? normalizeText(cleanEditedText) : null]
  );
  const event = await recordOperatorSelectionEvent(client, {
    brand_id: candidate.brand_id,
    prompt_candidate_id: candidate.id,
    event_type: eventTypeForAction(action),
    actor,
    event_payload: payload,
    idempotency_key: idempotencyKey
  });
  return {
    candidate: updated.rows[0],
    event
  };
}

export async function performOpsPromptDiscoveryAction({
  candidate_id: candidateId,
  action,
  actor,
  reason,
  note,
  edited_text: editedText,
  replacement_text: replacementText,
  override_quota: overrideQuota = false,
  idempotency_key: idempotencyKey
} = {}) {
  if (!candidateId) {
    throw errorWithCode('ops_prompt_candidate_id_required', 'prompt candidate id is required');
  }
  assertActionAllowed(action);
  const operator = assertActor(actor);
  const cleanReason =
    action === 'block_confirmation' || action === 'override_quota' || overrideQuota
      ? assertReason(reason, 'ops_prompt_discovery_override_reason_required')
      : cleanText(reason);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const candidate = await loadCandidate(candidateId, client);
    if (!candidate) {
      throw errorWithCode('ops_prompt_candidate_not_found', `prompt candidate not found: ${candidateId}`);
    }
    if (candidate.status === 'confirmed' && action !== 'confirm') {
      throw errorWithCode('ops_prompt_candidate_already_confirmed', 'confirmed prompt candidates cannot be changed');
    }

    let actionResult;
    if (action === 'confirm') {
      const context = await loadPromptDiscoveryContextByBrand(candidate.brand_id, client);
      if (!context) {
        throw errorWithCode('ops_prompt_discovery_context_not_found', 'prompt discovery confirmation context not found');
      }
      actionResult = await createConfirmedPrompt(client, {
        candidate,
        context,
        actor: operator,
        reason: cleanReason,
        note,
        idempotencyKey,
        overrideQuota: Boolean(overrideQuota)
      });
    } else if (action === 'replace') {
      actionResult = await replaceCandidate(client, {
        candidate,
        actor: operator,
        reason: cleanReason,
        note,
        replacementText,
        idempotencyKey
      });
    } else {
      actionResult = await updateCandidate(client, {
        candidate,
        action,
        actor: operator,
        reason: cleanReason,
        note,
        editedText,
        idempotencyKey
      });
    }

    await client.query('COMMIT');
    return {
      schema_version: OPS_PROMPT_DISCOVERY_ACTION_SCHEMA_VERSION,
      status: 'accepted',
      action,
      actor: operator,
      candidate: {
        id: actionResult.candidate?.id || candidate.id,
        original_candidate_id: action === 'replace' ? candidate.id : null,
        status: actionResult.candidate?.status || actionResult.status,
        candidate_text: actionResult.candidate?.candidate_text || actionResult.prompt_text || candidate.candidate_text
      },
      prompt: actionResult.prompt_id
        ? {
            id: actionResult.prompt_id,
            status: actionResult.status,
            prompt_text: actionResult.prompt_text,
            quota_override: Boolean(overrideQuota)
          }
        : null,
      event: actionResult.event
        ? {
            id: actionResult.event.id,
            event_type: actionResult.event.event_type,
            actor_type: actionResult.event.actor_type,
            created_at: actionResult.event.created_at
          }
        : null,
      guardrails: [
        'PD8 Product Ops prompt discovery actions only mutate prompt discovery candidate or confirmation state.',
        'Confirmation inserts active prompts into the existing prompt set; it does not start tracking.',
        'Quota override requires explicit operator actor and reason metadata.',
        'This endpoint never calls paid providers, starts live tracking, deploys, sends CMS/webhook/email, or dispatches GeoFlow work.'
      ]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
