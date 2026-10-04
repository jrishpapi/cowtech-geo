import { getConfig } from './config.js';
import { buildGeoFlowConnectorRequest, dispatchGeoFlowProductionHandoff } from './geoflow-connector.js';
import { getArticleProductionHandoff } from './article-production-handoffs.js';

export const R8_3_LIVE_APPROVAL_PHRASE = 'APPROVE_R8_3_LIVE_GEOFLOW_DISPATCH';

function requestedPilotJobs(options) {
  const value = Number(options.requested_pilot_jobs ?? options.requestedPilotJobs ?? 1);
  return Number.isFinite(value) ? value : 1;
}

function requirement(ok, label, blocker) {
  return { ok, label, blocker: ok ? null : blocker };
}

function sanitizedRequestPlan(requestPlan) {
  return {
    schema_version: requestPlan.schema_version,
    provider: requestPlan.provider,
    dry_run: requestPlan.dry_run,
    method: requestPlan.method,
    endpoint: requestPlan.endpoint,
    create_job_path: requestPlan.create_job_path,
    idempotency_key: requestPlan.idempotency_key,
    timeout_ms: requestPlan.timeout_ms,
    max_retries: requestPlan.max_retries,
    headers: requestPlan.headers,
    body: {
      source: requestPlan.body.source,
      handoff_id: requestPlan.body.handoff_id,
      tracking_run_id: requestPlan.body.tracking_run_id,
      article_draft_id: requestPlan.body.article_draft_id,
      production_key: requestPlan.body.production_key,
      request_schema_version: requestPlan.body.request?.schema_version || null,
      callback_schema_version: requestPlan.body.callback_contract?.schema_version || null
    },
    live_gate: requestPlan.live_gate,
    guardrails: requestPlan.guardrails
  };
}

function buildRequirements({ handoff, config, requestPlan, options }) {
  const jobs = requestedPilotJobs(options);
  return {
    explicit_same_turn_approval: requirement(
      options.explicit_same_turn_approval === true,
      'Same-turn live GeoFlow approval recorded',
      'missing explicit_same_turn_approval=true'
    ),
    approval_phrase: requirement(
      options.approval_phrase === R8_3_LIVE_APPROVAL_PHRASE,
      'Exact R8.3 live dispatch approval phrase supplied',
      `missing approval_phrase=${R8_3_LIVE_APPROVAL_PHRASE}`
    ),
    allow_live_geoflow: requirement(
      options.allow_live_geoflow === true,
      'Live GeoFlow allow flag enabled',
      'missing allow_live_geoflow=true'
    ),
    execute_live: requirement(
      options.execute_live === true,
      'Caller requested execution instead of read-only gate evaluation',
      'missing execute_live=true'
    ),
    geoflow_dry_run_disabled: requirement(
      config.geoflowDryRun === false,
      'GEFLOW_DRY_RUN is disabled for a live pilot',
      'GEFLOW_DRY_RUN is still true'
    ),
    base_url_configured: requirement(
      Boolean(config.geoflowApiBaseUrl),
      'GEFLOW_API_BASE_URL is configured',
      'missing GEFLOW_API_BASE_URL'
    ),
    token_configured: requirement(Boolean(config.geoflowApiToken), 'GEFLOW_API_TOKEN is configured', 'missing GEFLOW_API_TOKEN'),
    ready_handoff_state: requirement(
      handoff.provider === 'geoflow' && handoff.status === 'ready_for_external_production',
      'Handoff is ready_for_external_production for GeoFlow',
      `handoff is ${handoff.provider || 'missing provider'}:${handoff.status || 'missing status'}`
    ),
    idempotency_key_present: requirement(
      Boolean(requestPlan.idempotency_key),
      'Stable idempotency key is present',
      'missing idempotency key'
    ),
    bounded_pilot: requirement(jobs === 1, 'Pilot is bounded to exactly one job', `requested pilot jobs is ${jobs}, not 1`)
  };
}

export function buildGeoFlowLiveDispatchGate(handoff, options = {}) {
  const config = options.config || getConfig();
  const requestPlan = buildGeoFlowConnectorRequest(handoff, {
    config,
    dry_run: false
  });
  const requirements = buildRequirements({ handoff, config, requestPlan, options });
  const requirementList = Object.values(requirements);
  const blockers = requirementList.filter((item) => !item.ok).map((item) => item.blocker);
  const executionBlockers = [
    requirements.explicit_same_turn_approval,
    requirements.approval_phrase,
    requirements.allow_live_geoflow,
    requirements.execute_live
  ]
    .filter((item) => !item.ok)
    .map((item) => item.blocker);
  const liveDispatchEligible = requirementList
    .filter((item) => ![requirements.execute_live].includes(item))
    .every((item) => item.ok);

  return {
    schema_version: 'r8-3-geoflow-live-dispatch-gate-v1',
    provider: 'geoflow',
    mode: 'controlled_live_pilot_gate',
    status: blockers.length ? 'blocked' : 'eligible_for_single_live_pilot',
    handoff_id: handoff.id,
    tracking_run_id: handoff.tracking_run_id,
    article_draft_id: handoff.article_draft_id,
    production_key: requestPlan.idempotency_key,
    handoff_status: handoff.status || null,
    requested_pilot_jobs: requestedPilotJobs(options),
    pilot_limit: 1,
    live_dispatch_eligible: liveDispatchEligible,
    live_dispatch_allowed: blockers.length === 0,
    live_dispatch_executed: false,
    approval_phrase_required: R8_3_LIVE_APPROVAL_PHRASE,
    requirements,
    blockers,
    execution_blockers: executionBlockers,
    token_present: Boolean(config.geoflowApiToken),
    token_exposed: false,
    raw_request_included: false,
    request_plan: sanitizedRequestPlan(requestPlan),
    guardrails: [
      'R8.3 permits at most one controlled live GeoFlow pilot job.',
      'Live execution requires same-turn approval, the exact approval phrase, allow_live_geoflow=true, execute_live=true, GEFLOW_DRY_RUN=false, endpoint config, token config, ready handoff state, and an idempotency key.',
      'The gate never publishes to CMS, sends webhooks or email, approves customer content, schedules retests, or marks visibility improved.',
      'GeoFlow output must return through R8.2 callback/import validation and human quality review.'
    ],
    generated_at: new Date().toISOString()
  };
}

export async function getGeoFlowLiveDispatchGateForHandoff(id, options = {}) {
  const handoff = await getArticleProductionHandoff(id);
  if (!handoff) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  return buildGeoFlowLiveDispatchGate(handoff, options);
}

export async function runGeoFlowLiveDispatchPilot(id, options = {}) {
  const handoff = await getArticleProductionHandoff(id);
  if (!handoff) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  const gate = buildGeoFlowLiveDispatchGate(handoff, options);
  if (!gate.live_dispatch_allowed) {
    return {
      schema_version: 'r8-3-geoflow-live-dispatch-pilot-result-v1',
      provider: 'geoflow',
      status: 'blocked',
      live_dispatched: false,
      handoff_id: id,
      gate,
      result: null,
      generated_at: new Date().toISOString()
    };
  }

  const result = await dispatchGeoFlowProductionHandoff(id, {
    config: options.config,
    dry_run: false,
    allow_live_geoflow: true,
    actor: options.actor || 'r8_3_live_pilot'
  });

  return {
    schema_version: 'r8-3-geoflow-live-dispatch-pilot-result-v1',
    provider: 'geoflow',
    status: result.ok ? 'submitted_to_geoflow' : 'dispatch_failed',
    live_dispatched: true,
    handoff_id: id,
    gate: {
      ...gate,
      live_dispatch_executed: true
    },
    result,
    generated_at: new Date().toISOString()
  };
}
