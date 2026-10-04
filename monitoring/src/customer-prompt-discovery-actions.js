import { pool } from './db.js';
import { getPromptDiscoveryPayload } from './prompt-discovery.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

export const CUSTOMER_PROMPT_DISCOVERY_ACTIONS = ['select', 'edit', 'reject', 'confirm'];
export const CUSTOMER_PROMPT_DISCOVERY_ACTION_SCHEMA_VERSION = 'pd5-customer-prompt-discovery-action-v1';
export const CUSTOMER_PROMPT_DISCOVERY_CONFIRM_SCHEMA_VERSION = 'pd5-customer-prompt-discovery-confirm-v1';

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

function nonEmptyString(value) {
  const text = String(value || '').trim();
  return text.length ? text : null;
}

function assertActionAllowed(action) {
  if (!CUSTOMER_PROMPT_DISCOVERY_ACTIONS.includes(action)) {
    throw errorWithCode('customer_prompt_discovery_action_not_allowed', `customer prompt discovery action is not allowed: ${action}`);
  }
}

function assertEditableText(text) {
  const clean = nonEmptyString(text);
  if (!clean) {
    throw errorWithCode('customer_prompt_discovery_edit_text_required', 'edited prompt text is required');
  }
  if (clean.length < 12) {
    throw errorWithCode('customer_prompt_discovery_edit_text_too_short', 'edited prompt text is too short');
  }
  if (clean.length > 500) {
    throw errorWithCode('customer_prompt_discovery_edit_text_too_long', 'edited prompt text is too long');
  }
  return clean;
}

function eventTypeForAction(action) {
  return action === 'select' ? 'shortlist' : action;
}

function statusForAction(action) {
  const map = {
    select: 'shortlisted',
    edit: 'edited',
    reject: 'rejected'
  };
  return map[action] || null;
}

async function loadCandidate(candidateId, client = pool) {
  const result = await client.query(
    `SELECT pc.*, pdr.status AS discovery_status, pdr.provider_mode, pdr.source_mode
     FROM prompt_candidates pc
     JOIN prompt_discovery_runs pdr ON pdr.id = pc.discovery_run_id
     JOIN brands b ON b.id = pc.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE pc.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
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
     WHERE b.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
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

async function recordSelectionEvent(
  client,
  { brand_id, prompt_candidate_id, prompt_id = null, event_type, actor = 'customer_dashboard', event_payload = {}, idempotency_key = null }
) {
  const result = await client.query(
    `INSERT INTO prompt_selection_events (
       brand_id, prompt_candidate_id, prompt_id, event_type, actor_type, actor_id, event_payload, idempotency_key
     )
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7)
     ON CONFLICT (idempotency_key) DO UPDATE SET
       event_payload = prompt_selection_events.event_payload
     RETURNING *`,
    [brand_id, prompt_candidate_id, prompt_id, event_type, actor, JSON.stringify(event_payload), idempotency_key]
  );
  return result.rows[0];
}

async function updateCandidateStatus({ candidateId, action, actor, note, editedText, idempotencyKey }) {
  assertActionAllowed(action);
  if (action === 'confirm') {
    return confirmPromptCandidates({ candidate_ids: [candidateId], actor, note, idempotency_key: idempotencyKey });
  }

  const status = statusForAction(action);
  const cleanEditedText = action === 'edit' ? assertEditableText(editedText) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const candidate = await loadCandidate(candidateId, client);
    if (!candidate) {
      throw errorWithCode('customer_prompt_candidate_not_found', `prompt candidate not found: ${candidateId}`);
    }
    if (candidate.status === 'confirmed') {
      throw errorWithCode('customer_prompt_candidate_already_confirmed', 'confirmed prompt candidates cannot be changed');
    }

    const updateResult = await client.query(
      `UPDATE prompt_candidates
       SET status = $2,
           candidate_text = COALESCE($3, candidate_text),
           normalized_text = COALESCE($4, normalized_text),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [candidateId, status, cleanEditedText, cleanEditedText ? normalizeText(cleanEditedText) : null]
    );
    const updated = updateResult.rows[0];
    const event = await recordSelectionEvent(client, {
      brand_id: updated.brand_id,
      prompt_candidate_id: updated.id,
      event_type: eventTypeForAction(action),
      actor,
      event_payload: {
        action,
        status,
        note: note || null,
        edited_text: action === 'edit',
        customer_safe: true
      },
      idempotency_key: idempotencyKey
    });

    await client.query('COMMIT');
    return {
      schema_version: CUSTOMER_PROMPT_DISCOVERY_ACTION_SCHEMA_VERSION,
      status: 'accepted',
      action,
      candidate: {
        id: updated.id,
        status: updated.status,
        candidate_text: updated.candidate_text
      },
      event: {
        id: event.id,
        event_type: event.event_type,
        actor_type: event.actor_type,
        created_at: event.created_at
      },
      guardrails: [
        'Customer selection actions only mutate prompt discovery candidate state.',
        'Selecting, editing, or rejecting a candidate does not create tracking prompts or consume prompt quota.',
        'Only confirmation creates active prompts for the existing tracking engine.'
      ]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createConfirmedPrompt(client, { candidate, context, actor, note, idempotencyKey }) {
  const existingLink = await client.query(
    `SELECT cpl.*, p.prompt_text, p.status AS prompt_status
     FROM confirmed_prompt_links cpl
     JOIN prompts p ON p.id = cpl.prompt_id
     WHERE cpl.prompt_candidate_id = $1 AND cpl.status = 'active'
     LIMIT 1`,
    [candidate.id]
  );
  if (existingLink.rowCount) {
    return {
      prompt_id: existingLink.rows[0].prompt_id,
      candidate_id: candidate.id,
      status: 'already_confirmed',
      prompt_text: existingLink.rows[0].prompt_text
    };
  }

  if (!context.prompt_set_id) {
    throw errorWithCode('customer_prompt_discovery_prompt_set_not_found', 'active prompt set not found for prompt confirmation');
  }

  const confirmedCount = await countConfirmedPrompts(candidate.brand_id, client);
  const planLimit = Number(context.monthly_prompt_limit || 0);
  if (planLimit > 0 && confirmedCount + 1 > planLimit) {
    throw errorWithCode('customer_prompt_discovery_quota_exceeded', 'confirmed prompt limit would be exceeded');
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
      actor || 'customer_dashboard'
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
      actor || 'customer_dashboard',
      JSON.stringify({
        source: 'customer_dashboard',
        note: note || null,
        quota_unit: 1
      })
    ]
  );
  await client.query(
    `UPDATE prompt_candidates
     SET status = 'confirmed', updated_at = NOW()
     WHERE id = $1`,
    [candidate.id]
  );
  await recordSelectionEvent(client, {
    brand_id: candidate.brand_id,
    prompt_candidate_id: candidate.id,
    prompt_id: prompt.id,
    event_type: 'confirm',
    actor,
    event_payload: {
      action: 'confirm',
      note: note || null,
      quota_unit: 1,
      customer_safe: true
    },
    idempotency_key: idempotencyKey
  });

  return {
    prompt_id: prompt.id,
    candidate_id: candidate.id,
    status: 'confirmed',
    prompt_text: prompt.prompt_text
  };
}

export async function performCustomerPromptDiscoveryAction({
  candidate_id: candidateId,
  action,
  actor = 'customer_dashboard',
  note,
  edited_text: editedText,
  idempotency_key: idempotencyKey
} = {}) {
  if (!candidateId) {
    throw errorWithCode('customer_prompt_candidate_id_required', 'prompt candidate id is required');
  }
  return updateCandidateStatus({ candidateId, action, actor, note, editedText, idempotencyKey });
}

export async function confirmPromptCandidates({
  candidate_ids: candidateIds = [],
  discovery_run_id: discoveryRunId = null,
  brand_id: brandId = null,
  brand_name: brandName = null,
  actor = 'customer_dashboard',
  note,
  idempotency_key: idempotencyKey
} = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [];
    if (!ids.length) {
      const values = [];
      const filters = [`pc.status IN ('shortlisted', 'approved', 'edited')`];
      if (discoveryRunId) {
        values.push(discoveryRunId);
        filters.push(`pc.discovery_run_id = $${values.length}`);
      }
      if (brandId) {
        values.push(brandId);
        filters.push(`pc.brand_id = $${values.length}`);
      }
      if (brandName) {
        values.push(brandName);
        filters.push(`LOWER(b.name) = LOWER($${values.length})`);
      }
      const selectedResult = await client.query(
        `SELECT pc.id
         FROM prompt_candidates pc
         JOIN brands b ON b.id = pc.brand_id
         JOIN customers c ON c.id = b.customer_id
         WHERE ${customerVisibleTenantPredicate('c')}
           AND ${filters.join(' AND ')}
         ORDER BY pc.updated_at ASC, pc.created_at ASC`,
        values
      );
      ids = selectedResult.rows.map((row) => row.id);
    }

    if (!ids.length) {
      throw errorWithCode('customer_prompt_discovery_confirm_candidates_required', 'at least one candidate is required for confirmation');
    }

    const confirmed = [];
    let context = null;
    let discoveryRunIdForPayload = discoveryRunId;
    let resolvedBrandId = brandId;

    for (const candidateId of ids) {
      const candidate = await loadCandidate(candidateId, client);
      if (!candidate) {
        throw errorWithCode('customer_prompt_candidate_not_found', `prompt candidate not found: ${candidateId}`);
      }
      if (candidate.status === 'rejected' || candidate.status === 'archived') {
        throw errorWithCode('customer_prompt_candidate_not_confirmable', 'rejected or archived prompt candidates cannot be confirmed');
      }
      if (context && context.brand_id !== candidate.brand_id) {
        throw errorWithCode('customer_prompt_discovery_mixed_brand_confirmation', 'prompt candidates must belong to one brand');
      }
      context = context || (await loadPromptDiscoveryContextByBrand(candidate.brand_id, client));
      if (!context) {
        throw errorWithCode('customer_prompt_discovery_context_not_found', 'prompt discovery confirmation context not found');
      }
      discoveryRunIdForPayload = discoveryRunIdForPayload || candidate.discovery_run_id;
      resolvedBrandId = resolvedBrandId || candidate.brand_id;
      const perCandidateKey = idempotencyKey ? `${idempotencyKey}:${candidate.id}` : null;
      confirmed.push(
        await createConfirmedPrompt(client, {
          candidate,
          context,
          actor,
          note,
          idempotencyKey: perCandidateKey
        })
      );
    }

    await client.query('COMMIT');
    const prompt_discovery = await getPromptDiscoveryPayload({
      discovery_run_id: discoveryRunIdForPayload,
      brand_id: resolvedBrandId,
      customer_visible_only: true
    });
    return {
      schema_version: CUSTOMER_PROMPT_DISCOVERY_CONFIRM_SCHEMA_VERSION,
      status: 'accepted',
      confirmed,
      prompt_discovery,
      guardrails: [
        'Confirmed candidates are inserted into the existing active prompt set as active prompts.',
        'Confirmation is the only customer prompt discovery action that consumes prompt quota.',
        'This endpoint does not run tracking, call paid providers, or change dashboard UI behavior.'
      ]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
