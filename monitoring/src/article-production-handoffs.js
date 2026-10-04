import { pool } from './db.js';
import { generateArticleDrafts, listArticleDrafts } from './article-drafts.js';

export const ARTICLE_PRODUCTION_HANDOFF_STATUSES = [
  'ready_for_external_production',
  'submitted_to_geoflow',
  'production_completed',
  'production_failed'
];

function nowIso() {
  return new Date().toISOString();
}

function payload(value) {
  return value || {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function callbackField(callback, key) {
  return callback && Object.prototype.hasOwnProperty.call(callback, key) ? callback[key] : undefined;
}

const CALLBACK_FORBIDDEN_FIELDS = [
  'publish_status',
  'published_url',
  'external_publish',
  'cms_publish',
  'webhook_url',
  'email_recipients',
  'score',
  'scoring',
  'score_delta',
  'retest_schedule',
  'retest_result',
  'customer_report',
  'visibility_improvement',
  'skip_human_review',
  'quality_review_status',
  'human_review_status'
];

function outputRequirements(draftPayload) {
  return {
    required_files: ['article.md', 'article.html', 'article.metadata.json'],
    required_metadata: [
      'title',
      'content_type',
      'primary_prompt',
      'target_prompts',
      'internal_link_targets',
      'retest_plan',
      'source_article_draft_id'
    ],
    full_body_required: true,
    preserve_prompt_lineage: true,
    preserve_retest_plan: Boolean(draftPayload.retest_plan)
  };
}

function articleInstruction(draftRow) {
  const draftPayload = payload(draftRow.draft_payload);
  return {
    title: draftRow.title,
    content_type: draftRow.content_type,
    objective: draftPayload.objective || null,
    audience: draftPayload.audience || null,
    primary_prompt: draftPayload.primary_prompt || null,
    target_prompts: draftPayload.target_prompts || [],
    outline: draftPayload.outline || [],
    must_include_facts: draftPayload.must_include_facts || [],
    evidence_requirements: draftPayload.evidence_requirements || [],
    internal_link_targets: draftPayload.internal_link_targets || [],
    guardrails: draftPayload.guardrails || [],
    forbidden_claims: draftPayload.forbidden_claims || [],
    retest_plan: draftPayload.retest_plan || {}
  };
}

function blockedHandoff(draftRow, blockers) {
  return {
    status: 'blocked',
    article_draft_id: draftRow?.id || null,
    provider: 'geoflow',
    blockers
  };
}

export function buildArticleProductionHandoff(draftRow, options = {}) {
  const provider = options.provider || 'geoflow';
  const draftPayload = payload(draftRow.draft_payload);
  const validation = payload(draftRow.validation_state);

  if (provider !== 'geoflow') {
    return blockedHandoff(draftRow, ['only geoflow provider contract is supported in Phase 4.12']);
  }

  if (draftRow.status !== 'draft_skeleton' || draftPayload.status !== 'draft_skeleton') {
    return blockedHandoff(draftRow, ['article draft is not a draft_skeleton']);
  }

  if (validation.can_generate_draft !== true) {
    return blockedHandoff(draftRow, ['article draft validation gate did not pass']);
  }

  if (!(draftPayload.target_prompts || []).length) {
    return blockedHandoff(draftRow, ['article draft has no validated target prompts']);
  }

  const productionKey = `${draftRow.id}:${provider}:production-request`;
  const outboundPayload = {
    schema_version: 'phase4-geoflow-production-request-v1',
    status: 'ready_for_external_production',
    provider,
    production_key: productionKey,
    created_at: nowIso(),
    tracking_run_id: draftRow.tracking_run_id,
    article_draft_id: draftRow.id,
    content_brief_id: draftRow.content_brief_id,
    brand: {
      id: draftRow.brand_id || null,
      name: draftRow.brand_name || null,
      website_url: draftRow.website_url || null
    },
    article_instruction: articleInstruction(draftRow),
    output_requirements: outputRequirements(draftPayload),
    production_controls: {
      external_auto_publish_allowed: false,
      cms_publish_allowed: false,
      human_review_required_before_publish: true,
      return_generated_content_only: true,
      preserve_growth_loop_lineage: true
    },
    downstream_contract: {
      expected_next_step: 'import_generated_content_for_quality_review',
      callback_schema_version: 'phase4-geoflow-production-callback-v1'
    },
    guardrails: [
      'GeoFlow must not publish this article automatically.',
      'GeoFlow must preserve validated prompt lineage in metadata.',
      'Generated content must stay within the draft guardrails and forbidden claims.',
      'Any visibility movement must be confirmed by Growth Loop retest, not claimed in the generated article.'
    ]
  };

  const callbackContract = {
    schema_version: 'phase4-geoflow-production-callback-v1',
    provider,
    callback_route: `/internal/article-production-handoffs/{handoff_id}/callback`,
    required_fields: [
      'provider_job_id',
      'status',
      'article_markdown',
      'article_html',
      'metadata',
      'production_notes'
    ],
    accepted_statuses: ['production_completed', 'production_failed'],
    required_metadata: outboundPayload.output_requirements.required_metadata,
    failure_fields: ['error_code', 'error_message'],
    guardrails: [
      'Callbacks must reference the original handoff id.',
      'Callbacks must not mark content as published.',
      'Callbacks must not overwrite tracking, scoring, retest, or customer report records.'
    ]
  };

  return {
    schema_version: 'phase4-article-production-handoff-v1',
    status: 'ready_for_external_production',
    provider,
    tracking_run_id: draftRow.tracking_run_id,
    article_draft_id: draftRow.id,
    content_brief_id: draftRow.content_brief_id,
    production_key: productionKey,
    outbound_payload: outboundPayload,
    callback_contract: callbackContract,
    provider_result: {},
    state: {
      current: 'ready_for_external_production',
      allowed_actions: ['submit_to_geoflow'],
      blocked_actions: ['auto_publish', 'skip_quality_review', 'claim_visibility_improvement'],
      next_step: 'submit_to_geoflow_when_integration_is_enabled'
    },
    audit_trail: [
      {
        at: outboundPayload.created_at,
        actor: 'system',
        action: 'create_geoflow_production_contract',
        status: 'ready_for_external_production'
      }
    ],
    guardrails: outboundPayload.guardrails
  };
}

function normalizeHandoffRow(row) {
  return {
    ...row,
    outbound_payload: row.outbound_payload || {},
    callback_contract: row.callback_contract || {},
    provider_result: row.provider_result || {}
  };
}

export function buildCustomerSafeProductionStatus(handoff = {}) {
  const status = handoff.status || handoff.production_handoff_status || 'not_started';
  const map = {
    ready_for_external_production: {
      status: 'content_generation_ready',
      label: 'Content generation ready',
      next_step: 'The production handoff is ready for the team to start content generation.'
    },
    submitted_to_geoflow: {
      status: 'content_generation_in_progress',
      label: 'Content generation in progress',
      next_step: 'The team is waiting for generated content to return for review.'
    },
    production_completed: {
      status: 'content_generation_returned_for_review',
      label: 'Generated content returned for review',
      next_step: 'Generated content must pass human quality review before customer approval or publishing.'
    },
    production_failed: {
      status: 'content_generation_needs_operator_review',
      label: 'Content generation needs review',
      next_step: 'The team is reviewing a generation issue before customer-facing review continues.'
    },
    not_started: {
      status: 'content_preparation_in_progress',
      label: 'Content preparation in progress',
      next_step: 'The article is still being prepared.'
    }
  };
  const entry = map[status] || map.not_started;
  return {
    schema_version: 'r8-2-customer-safe-production-status-v1',
    ...entry,
    source_status: status,
    customer_visible: true,
    guardrails: [
      'This status does not expose provider job ids, raw callbacks, tokens, or internal request payloads.',
      'Generated content is not customer-reviewable until human quality review and export packaging are complete.',
      'This status never means content was published or visibility improved.'
    ]
  };
}

export function validateArticleProductionCallback(handoff, callback = {}) {
  const callbackStatus = callback.status;
  const forbiddenFields = CALLBACK_FORBIDDEN_FIELDS.filter((field) => callbackField(callback, field) !== undefined);
  const missingFields = [];
  const metadata = payload(callback.metadata);
  const missingMetadata = [];
  const requiredFields = arrayValue(handoff.callback_contract?.required_fields);
  const requiredMetadata = arrayValue(handoff.callback_contract?.required_metadata);

  if (!['production_completed', 'production_failed'].includes(callbackStatus)) {
    missingFields.push('status');
  }

  if (callback.handoff_id && callback.handoff_id !== handoff.id) {
    forbiddenFields.push('handoff_id_mismatch');
  }
  if (callback.provider && callback.provider !== handoff.provider) {
    forbiddenFields.push('provider_mismatch');
  }

  if (callbackStatus === 'production_completed') {
    for (const field of requiredFields) {
      if (callbackField(callback, field) === undefined || callbackField(callback, field) === null || callbackField(callback, field) === '') {
        missingFields.push(field);
      }
    }
    for (const field of requiredMetadata) {
      if (metadata[field] === undefined || metadata[field] === null || metadata[field] === '') {
        missingMetadata.push(field);
      }
    }
  }

  if (callbackStatus === 'production_failed') {
    if (!callback.provider_job_id) missingFields.push('provider_job_id');
    if (!callback.error_code && !callback.error_message) missingFields.push('error_code_or_error_message');
  }

  const blockers = [
    handoff.provider !== 'geoflow' ? `unsupported callback provider: ${handoff.provider}` : null,
    !['submitted_to_geoflow', 'production_failed'].includes(handoff.status)
      ? `handoff is ${handoff.status}, not submitted_to_geoflow`
      : null,
    ...missingFields.map((field) => `missing required callback field: ${field}`),
    ...missingMetadata.map((field) => `missing required metadata field: ${field}`),
    ...forbiddenFields.map((field) => `forbidden callback field: ${field}`)
  ].filter(Boolean);

  return {
    schema_version: 'r8-2-geoflow-callback-validation-v1',
    provider: 'geoflow',
    handoff_id: handoff.id,
    callback_status: callbackStatus || null,
    ok: blockers.length === 0,
    blockers,
    missing_fields: [...new Set(missingFields)],
    missing_metadata: [...new Set(missingMetadata)],
    forbidden_fields: [...new Set(forbiddenFields)],
    accepted_statuses: ['production_completed', 'production_failed'],
    customer_safe_status: buildCustomerSafeProductionStatus({
      status: callbackStatus === 'production_completed' ? 'production_completed' : callbackStatus === 'production_failed' ? 'production_failed' : handoff.status
    }),
    import_gate: {
      import_allowed: callbackStatus === 'production_completed' && blockers.length === 0,
      human_quality_review_required: true,
      customer_review_allowed: false,
      publish_allowed: false,
      retest_allowed: false
    },
    guardrails: [
      'Callback validation accepts generated content or failure status only.',
      'Callbacks cannot publish content, schedule retests, alter scores, create customer reports, or skip human quality review.',
      'Customer-safe status mapping hides raw provider payloads, job ids, callbacks, and secrets.'
    ],
    validated_at: nowIso()
  };
}

export async function getArticleProductionHandoff(id) {
  const result = await pool.query(`SELECT * FROM article_production_handoffs WHERE id = $1`, [id]);
  if (!result.rowCount) return null;
  return normalizeHandoffRow(result.rows[0]);
}

async function draftRowsWithBrand(trackingRunId) {
  const result = await pool.query(
    `SELECT
       ad.*,
       b.id AS brand_id,
       b.name AS brand_name,
       b.website_url
     FROM article_drafts ad
     JOIN tracking_runs tr ON tr.id = ad.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     WHERE ad.tracking_run_id = $1
     ORDER BY ad.created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map((row) => ({
    ...row,
    draft_payload: row.draft_payload || {},
    validation_state: row.validation_state || {}
  }));
}

export async function listArticleProductionHandoffs(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_production_handoffs
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeHandoffRow);
}

export async function generateArticleProductionHandoffs(trackingRunId, options = {}) {
  let drafts = await draftRowsWithBrand(trackingRunId);
  if (!drafts.length) {
    await generateArticleDrafts(trackingRunId);
    drafts = await draftRowsWithBrand(trackingRunId);
  }

  const saved = [];
  const blocked = [];
  for (const draft of drafts) {
    const handoff = buildArticleProductionHandoff(draft, options);
    if (handoff.status !== 'ready_for_external_production') {
      blocked.push(handoff);
      continue;
    }

    const result = await pool.query(
      `INSERT INTO article_production_handoffs (
         tracking_run_id,
         article_draft_id,
         content_brief_id,
         provider,
         production_key,
         status,
         outbound_payload,
         callback_contract,
         provider_result
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (article_draft_id, provider)
       DO UPDATE SET
         production_key = EXCLUDED.production_key,
         status = EXCLUDED.status,
         outbound_payload = EXCLUDED.outbound_payload,
         callback_contract = EXCLUDED.callback_contract,
         provider_result = article_production_handoffs.provider_result,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        draft.id,
        draft.content_brief_id,
        handoff.provider,
        handoff.production_key,
        handoff.status,
        JSON.stringify(handoff.outbound_payload),
        JSON.stringify(handoff.callback_contract),
        JSON.stringify(handoff.provider_result)
      ]
    );
    saved.push(normalizeHandoffRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    provider: options.provider || 'geoflow',
    handoff_count: saved.length,
    blocked_count: blocked.length,
    handoffs: saved,
    blocked_handoffs: blocked
  };
}

export async function markArticleProductionHandoffSubmitted(id, options = {}) {
  const row = await getArticleProductionHandoff(id);
  if (!row) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  if (row.status !== 'ready_for_external_production') {
    throw new Error(`article production handoff cannot be submitted from status ${row.status}`);
  }

  const providerResult = {
    ...(row.provider_result || {}),
    ...(options.provider_result || {}),
    provider_job_id: options.provider_job_id || null,
    external_job_url: options.external_job_url || null,
    submitted_at: nowIso(),
    submitted_by: options.actor || 'system',
    note: options.note || null
  };

  const outboundPayload = {
    ...row.outbound_payload,
    status: 'submitted_to_geoflow',
    provider_job_id: providerResult.provider_job_id
  };

  const result = await pool.query(
    `UPDATE article_production_handoffs
     SET status = 'submitted_to_geoflow',
         outbound_payload = $2,
         provider_result = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(outboundPayload), JSON.stringify(providerResult)]
  );
  return normalizeHandoffRow(result.rows[0]);
}

export async function recordArticleProductionCallback(id, callback = {}) {
  const rowResult = await pool.query(`SELECT * FROM article_production_handoffs WHERE id = $1`, [id]);
  if (!rowResult.rowCount) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  const row = normalizeHandoffRow(rowResult.rows[0]);
  const status = callback.status;
  const validation = validateArticleProductionCallback(row, callback);
  if (!validation.ok) {
    const error = new Error(`article production callback validation failed: ${validation.blockers.join('; ')}`);
    error.code = 'article_production_callback_validation_failed';
    error.validation = validation;
    throw error;
  }

  const providerResult = {
    ...(row.provider_result || {}),
    callback_received_at: nowIso(),
    provider_job_id: callback.provider_job_id || row.provider_result?.provider_job_id || null,
    status,
    article_markdown: callback.article_markdown || null,
    article_html: callback.article_html || null,
    metadata: callback.metadata || {},
    production_notes: callback.production_notes || [],
    error_code: callback.error_code || null,
    error_message: callback.error_message || null,
    callback_validation: validation,
    customer_safe_status: buildCustomerSafeProductionStatus({ status })
  };

  const result = await pool.query(
    `UPDATE article_production_handoffs
     SET status = $2,
         provider_result = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, JSON.stringify(providerResult)]
  );
  return normalizeHandoffRow(result.rows[0]);
}
