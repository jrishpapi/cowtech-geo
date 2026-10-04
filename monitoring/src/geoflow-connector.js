import { getConfig } from './config.js';
import { pool } from './db.js';
import {
  generateArticleProductionHandoffs,
  getArticleProductionHandoff,
  listArticleProductionHandoffs,
  markArticleProductionHandoffSubmitted
} from './article-production-handoffs.js';

function trimSlash(value) {
  return String(value || '').replace(/\/+$/g, '');
}

function ensurePath(value) {
  const path = String(value || '').trim();
  if (!path) return '/api/internal/article-jobs';
  return path.startsWith('/') ? path : `/${path}`;
}

function redactedHeaders(config) {
  return {
    'content-type': 'application/json',
    'idempotency-key': null,
    authorization: config.geoflowApiToken ? 'Bearer [redacted]' : null
  };
}

function connectorEndpoint(config) {
  if (!config.geoflowApiBaseUrl) return null;
  return `${trimSlash(config.geoflowApiBaseUrl)}${ensurePath(config.geoflowCreateJobPath)}`;
}

function handoffContractChecks(handoff, requestPlan) {
  const checks = [
    {
      key: 'production_request_schema',
      ok: handoff.outbound_payload?.schema_version === 'phase4-geoflow-production-request-v1',
      expected: 'phase4-geoflow-production-request-v1',
      actual: handoff.outbound_payload?.schema_version || null
    },
    {
      key: 'callback_contract_schema',
      ok: handoff.callback_contract?.schema_version === 'phase4-geoflow-production-callback-v1',
      expected: 'phase4-geoflow-production-callback-v1',
      actual: handoff.callback_contract?.schema_version || null
    },
    {
      key: 'idempotency_key',
      ok: Boolean(requestPlan.idempotency_key),
      expected: 'stable production_key or handoff id',
      actual: requestPlan.idempotency_key || null
    },
    {
      key: 'dry_run_default',
      ok: requestPlan.dry_run === true,
      expected: true,
      actual: requestPlan.dry_run
    },
    {
      key: 'no_auto_publish',
      ok: true,
      expected: 'GeoFlow creates content only; publish confirmation remains external/manual.',
      actual: 'publish is not part of the connector request'
    }
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function sanitizedRequestSummary(requestPlan) {
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

export function buildGeoFlowReadiness(handoff, options = {}) {
  const config = options.config || getConfig();
  const requestPlan = buildGeoFlowConnectorRequest(handoff, {
    config,
    dry_run: true
  });
  const contract = handoffContractChecks(handoff, requestPlan);
  const blockers = [
    handoff.provider !== 'geoflow' ? `unsupported production provider: ${handoff.provider}` : null,
    handoff.status !== 'ready_for_external_production'
      ? `handoff is ${handoff.status || 'missing status'}, not ready_for_external_production`
      : null,
    ...requestPlan.live_gate.missing.map((key) => `missing ${key}`),
    ...contract.checks.filter((check) => !check.ok).map((check) => `contract check failed: ${check.key}`)
  ].filter(Boolean);

  const liveConfigReady = requestPlan.live_gate.ready;
  const liveDispatchEligible =
    handoff.provider === 'geoflow' && handoff.status === 'ready_for_external_production' && contract.ok && liveConfigReady;

  return {
    schema_version: 'r8-1-geoflow-readiness-v1',
    provider: 'geoflow',
    mode: 'dry_run_readiness',
    status: liveDispatchEligible ? 'live_config_ready_but_blocked' : blockers.length ? 'blocked' : 'dry_run_ready',
    handoff_id: handoff.id,
    tracking_run_id: handoff.tracking_run_id,
    article_draft_id: handoff.article_draft_id,
    production_key: requestPlan.idempotency_key,
    handoff_status: handoff.status || null,
    dry_run_default: true,
    dry_run_plan_ready: contract.ok,
    live_dispatch_eligible: liveDispatchEligible,
    live_dispatch_allowed: false,
    live_dispatch_blocked_reason: 'R8.1 is readiness and dry-run comparison only; R8.3 requires explicit same-turn approval.',
    blockers,
    missing_config: requestPlan.live_gate.missing,
    endpoint_ready: Boolean(requestPlan.endpoint),
    token_present: Boolean(config.geoflowApiToken),
    token_exposed: false,
    secret_redaction: {
      headers_authorization: requestPlan.headers.authorization,
      token_value: '[redacted]',
      raw_provider_payload_included: false
    },
    request_plan: sanitizedRequestSummary(requestPlan),
    contract_comparison: contract,
    guardrails: [
      'R8.1 never performs live GeoFlow dispatch.',
      'Dry-run request plans are read-only and do not mutate handoff state.',
      'Live dispatch stays blocked until R8.3 and explicit same-turn approval.',
      'GeoFlow output must return through callback/import validation and human quality review before customer-visible status changes.'
    ],
    generated_at: new Date().toISOString()
  };
}

export async function getGeoFlowReadinessForHandoff(id, options = {}) {
  const handoff = await getArticleProductionHandoff(id);
  if (!handoff) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  return buildGeoFlowReadiness(handoff, options);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

export function buildGeoFlowConnectorRequest(handoff, options = {}) {
  const config = options.config || getConfig();
  const dryRun = options.dry_run ?? config.geoflowDryRun;
  const endpoint = connectorEndpoint(config);
  const idempotencyKey = handoff.production_key || handoff.outbound_payload?.production_key || handoff.id;

  return {
    schema_version: 'phase4-geoflow-connector-request-v1',
    provider: 'geoflow',
    dry_run: dryRun,
    method: 'POST',
    endpoint,
    create_job_path: ensurePath(config.geoflowCreateJobPath),
    idempotency_key: idempotencyKey,
    timeout_ms: config.geoflowTimeoutMs,
    max_retries: config.geoflowMaxRetries,
    headers: {
      ...redactedHeaders(config),
      'idempotency-key': idempotencyKey
    },
    body: {
      source: 'ai_visibility_growth_loop',
      handoff_id: handoff.id,
      tracking_run_id: handoff.tracking_run_id,
      article_draft_id: handoff.article_draft_id,
      production_key: idempotencyKey,
      request: handoff.outbound_payload,
      callback_contract: handoff.callback_contract
    },
    live_gate: {
      ready: Boolean(endpoint && config.geoflowApiToken),
      missing: [
        !endpoint ? 'GEFLOW_API_BASE_URL' : null,
        !config.geoflowApiToken ? 'GEFLOW_API_TOKEN' : null
      ].filter(Boolean),
      requires_allow_live_geoflow: true
    },
    guardrails: [
      'Dry-run is enabled by default and must be explicitly disabled for live GeoFlow dispatch.',
      'Live dispatch requires allow_live_geoflow=true plus GEFLOW_API_BASE_URL and GEFLOW_API_TOKEN.',
      'The connector creates a production job only; it must not publish content or mark visibility improved.'
    ]
  };
}

async function postWithRetry({ requestPlan, token }) {
  let lastError = null;
  for (let attempt = 0; attempt <= requestPlan.max_retries; attempt += 1) {
    const abort = timeoutSignal(requestPlan.timeout_ms);
    try {
      const response = await fetch(requestPlan.endpoint, {
        method: requestPlan.method,
        headers: {
          'content-type': 'application/json',
          'idempotency-key': requestPlan.idempotency_key,
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestPlan.body),
        signal: abort.signal
      });
      const text = await response.text();
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text };
      }

      if (response.ok) {
        return {
          ok: true,
          attempt: attempt + 1,
          status_code: response.status,
          body
        };
      }

      lastError = new Error(`GeoFlow dispatch failed with HTTP ${response.status}`);
      lastError.response = { status_code: response.status, body };
    } catch (error) {
      lastError = error;
    } finally {
      abort.clear();
    }

    if (attempt < requestPlan.max_retries) {
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError;
}

async function saveDispatchFailure(handoff, requestPlan, error) {
  const providerResult = {
    ...(handoff.provider_result || {}),
    connector_request: requestPlan,
    dispatch_status: 'failed',
    dispatch_error: {
      name: error?.name || 'Error',
      message: error?.message || 'GeoFlow dispatch failed',
      response: error?.response || null
    },
    dispatched_at: new Date().toISOString()
  };
  const result = await pool.query(
    `UPDATE article_production_handoffs
     SET status = 'production_failed',
         provider_result = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [handoff.id, JSON.stringify(providerResult)]
  );
  return {
    ok: false,
    dry_run: requestPlan.dry_run,
    handoff: result.rows[0],
    error: providerResult.dispatch_error
  };
}

export async function dispatchGeoFlowProductionHandoff(id, options = {}) {
  const config = options.config || getConfig();
  const handoff = await getArticleProductionHandoff(id);
  if (!handoff) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  if (handoff.provider !== 'geoflow') {
    throw new Error(`unsupported production provider: ${handoff.provider}`);
  }
  if (handoff.status !== 'ready_for_external_production') {
    throw new Error(`article production handoff cannot be dispatched from status ${handoff.status}`);
  }

  const requestPlan = buildGeoFlowConnectorRequest(handoff, {
    config,
    dry_run: options.dry_run ?? config.geoflowDryRun
  });

  if (requestPlan.dry_run) {
    const submitted = await markArticleProductionHandoffSubmitted(id, {
      actor: options.actor || 'system',
      provider_job_id: `dry-run:${handoff.id}`,
      external_job_url: null,
      note: 'GeoFlow connector dry-run only; no request was sent.',
      provider_result: {
        connector_request: requestPlan,
        dispatch_status: 'dry_run',
        dry_run: true
      }
    });
    return {
      ok: true,
      dry_run: true,
      handoff: submitted,
      connector_request: requestPlan
    };
  }

  if (options.allow_live_geoflow !== true) {
    throw new Error('live GeoFlow dispatch requires allow_live_geoflow=true');
  }
  if (!requestPlan.live_gate.ready) {
    throw new Error(`live GeoFlow dispatch missing config: ${requestPlan.live_gate.missing.join(', ')}`);
  }

  try {
    const response = await postWithRetry({
      requestPlan,
      token: config.geoflowApiToken
    });
    const providerJobId = response.body?.job_id || response.body?.id || response.body?.data?.id || null;
    const submitted = await markArticleProductionHandoffSubmitted(id, {
      actor: options.actor || 'system',
      provider_job_id: providerJobId,
      external_job_url: response.body?.job_url || response.body?.url || null,
      note: 'GeoFlow connector live dispatch completed.',
      provider_result: {
        connector_request: requestPlan,
        dispatch_status: 'submitted',
        dispatch_response: response
      }
    });
    return {
      ok: true,
      dry_run: false,
      handoff: submitted,
      connector_request: requestPlan,
      response
    };
  } catch (error) {
    return saveDispatchFailure(handoff, requestPlan, error);
  }
}

export async function dispatchGeoFlowProductionHandoffsForRun(trackingRunId, options = {}) {
  let handoffs = await listArticleProductionHandoffs(trackingRunId);
  if (!handoffs.length) {
    await generateArticleProductionHandoffs(trackingRunId);
    handoffs = await listArticleProductionHandoffs(trackingRunId);
  }

  const dispatched = [];
  const skipped = [];
  for (const handoff of handoffs) {
    if (handoff.status !== 'ready_for_external_production') {
      skipped.push({
        id: handoff.id,
        status: handoff.status,
        reason: 'handoff is not ready_for_external_production'
      });
      continue;
    }
    dispatched.push(await dispatchGeoFlowProductionHandoff(handoff.id, options));
  }

  return {
    tracking_run_id: trackingRunId,
    provider: 'geoflow',
    dry_run: options.dry_run ?? getConfig().geoflowDryRun,
    dispatched_count: dispatched.length,
    skipped_count: skipped.length,
    dispatched,
    skipped
  };
}
