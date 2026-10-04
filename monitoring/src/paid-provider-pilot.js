import { pool } from './db.js';
import { classifyProviderError } from './errors.js';
import { runOpenRouterSmoke } from './openrouter-smoke.js';
import { getPaidProviderPilotReadiness } from './paid-provider-pilot-readiness.js';

export const PAID_PROVIDER_PILOT_RESULT_SCHEMA = 'r11-2-paid-provider-pilot-result-v1';
export const PAID_PROVIDER_PILOT_LEDGER_SCHEMA = 'r11-2-paid-provider-pilot-ledger-v1';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function safeFixtureName(readiness, fixtureName = '') {
  if (fixtureName) return fixtureName;
  const brand = readiness.selection?.brand?.name || 'brand';
  const model = readiness.selection?.model_target?.model_id || 'model';
  return `r11-2-${brand}-${model}-${new Date().toISOString().slice(0, 10)}`;
}

async function findExistingPilot(idempotencyKey) {
  if (!idempotencyKey) return null;
  const result = await pool.query(
    `SELECT id, event_type, units, cost_estimate_usd, metadata, created_at
     FROM usage_ledger
     WHERE metadata->>'idempotency_key' = $1
       AND (
         metadata->>'source' = 'r11_paid_provider_pilot'
         OR metadata->'metadata'->>'source' = 'r11_paid_provider_pilot'
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [idempotencyKey]
  );
  return result.rows[0] || null;
}

function buildBlockedResult({ readiness, reason = null }) {
  return {
    schema_version: PAID_PROVIDER_PILOT_RESULT_SCHEMA,
    status: 'blocked',
    generated_at: new Date().toISOString(),
    provider_call_executed: false,
    paid_provider_call_count: 0,
    fixture_saved: false,
    fixture_path: null,
    readiness,
    blocker: reason || readiness.blockers?.[0] || 'paid_provider_pilot_blocked',
    response: null,
    ledger_event: null,
    guardrails: [
      'R11.2 executes at most one paid provider call.',
      'Blocked results do not create provider calls, fixtures, or provider usage ledger events.',
      'Scheduler paid-provider mode and continuous paid jobs remain disabled.'
    ]
  };
}

function buildDuplicateResult({ readiness, existing }) {
  return {
    schema_version: PAID_PROVIDER_PILOT_RESULT_SCHEMA,
    status: 'already_executed',
    generated_at: new Date().toISOString(),
    provider_call_executed: false,
    paid_provider_call_count: 0,
    fixture_saved: Boolean(existing.metadata?.fixture_path),
    fixture_path: existing.metadata?.fixture_path || null,
    readiness,
    blocker: 'idempotency_key_already_used',
    response: {
      provider_id: existing.metadata?.provider_id || null,
      model_id: existing.metadata?.model_id || null,
      provider_response_id: existing.metadata?.provider_response_id || null,
      answer_chars: existing.metadata?.answer_chars || null,
      usage: existing.metadata?.usage || null
    },
    ledger_event: {
      id: existing.id,
      event_type: existing.event_type,
      created_at: existing.created_at,
      cost_estimate_usd: numberValue(existing.cost_estimate_usd)
    },
    guardrails: [
      'Idempotency prevented a duplicate paid provider request.',
      'The existing R11.2 pilot ledger event is returned without re-calling OpenRouter.'
    ]
  };
}

async function recordSuccessLedger({ readiness, result, idempotencyKey }) {
  const cost = numberValue(
    result.response?.usage?.cost_estimate_usd,
    readiness.budget?.estimated_cost_usd || 0
  );
  const metadata = {
    schema_version: PAID_PROVIDER_PILOT_LEDGER_SCHEMA,
    source: 'r11_paid_provider_pilot',
    idempotency_key: idempotencyKey,
    provider_mode: 'openrouter',
    provider_id: result.response?.provider_id || 'openrouter',
    model_id: result.response?.model_id || readiness.selection?.model_target?.model_id || null,
    prompt_id: readiness.selection?.prompt?.id || null,
    prompt_category: readiness.selection?.prompt?.category || null,
    prompt_text: readiness.selection?.prompt?.prompt_text || null,
    brand_name: readiness.selection?.brand?.name || null,
    brand_website_url: readiness.selection?.brand?.website_url || null,
    brand_vertical: readiness.selection?.brand?.vertical || null,
    model_display_name: readiness.selection?.model_target?.display_name || null,
    provider_response_id: result.response?.provider_response_id || null,
    answer_chars: result.response?.answer_chars || 0,
    answer_preview: result.response?.answer_preview || null,
    usage: result.response?.usage || {},
    fixture_path: result.saved_fixture || null,
    estimated_cost_usd: readiness.budget?.estimated_cost_usd || 0,
    actual_cost_estimate_usd: cost,
    budget_max_estimated_cost_usd: readiness.budget?.max_estimated_cost_usd || 0,
    test_process: [
      'Selected one active brand, one active prompt, and one OpenRouter model.',
      'Checked entitlement, provider-call quota, OpenRouter key, budget, explicit execute flag, and scheduler safety gates.',
      'Executed exactly one OpenRouter call when all gates passed.',
      'Recorded provider response summary, token usage, cost estimate, ledger event, and fixture path without exposing provider secrets.'
    ],
    evaluation_criteria: [
      'provider_call_executed must be true only after explicit execute_live confirmation',
      'paid_provider_call_count must equal 1',
      'actual_cost_estimate_usd must be within the dashboard budget',
      'raw_provider_payload_exposed and openrouter_api_key_exposed must remain false',
      'answer_chars and provider_response_id must be present for completed calls'
    ],
    raw_provider_payload_exposed: false,
    openrouter_api_key_exposed: false
  };
  const ledger = await pool.query(
    `INSERT INTO usage_ledger (customer_id, brand_id, event_type, units, cost_estimate_usd, metadata)
     VALUES ($1, $2, 'provider_call', 1, $3, $4)
     RETURNING id, created_at, event_type, units, cost_estimate_usd`,
    [
      readiness.selection?.brand?.customer_id || readiness.selection?.brand?.customer_id === null
        ? readiness.selection.brand.customer_id
        : null,
      readiness.selection?.brand?.id || null,
      cost,
      JSON.stringify(metadata)
    ]
  );
  return {
    ...ledger.rows[0],
    metadata
  };
}

async function recordFailedLedger({ readiness, idempotencyKey, error }) {
  const classified = classifyProviderError(error);
  const metadata = {
    schema_version: PAID_PROVIDER_PILOT_LEDGER_SCHEMA,
    source: 'r11_paid_provider_pilot',
    idempotency_key: idempotencyKey,
    provider_mode: 'openrouter',
    provider_id: 'openrouter',
    model_id: readiness.selection?.model_target?.model_id || null,
    prompt_id: readiness.selection?.prompt?.id || null,
    result_status: classified.code,
    raw_provider_payload_exposed: false,
    openrouter_api_key_exposed: false
  };
  const result = await pool.query(
    `INSERT INTO usage_ledger (customer_id, brand_id, event_type, units, cost_estimate_usd, metadata)
     VALUES ($1, $2, 'provider_call_failed', 1, 0, $3)
     RETURNING id, created_at, event_type, units, cost_estimate_usd`,
    [readiness.selection?.brand?.customer_id || null, readiness.selection?.brand?.id || null, JSON.stringify(metadata)]
  );
  return {
    event: {
      ...result.rows[0],
      metadata
    },
    classified
  };
}

export async function runPaidProviderPilot({
  brand_name = '',
  prompt_index = 0,
  model_index = 0,
  approval_phrase = '',
  allow_paid_provider = false,
  execute_live = false,
  requested_calls = 1,
  max_estimated_cost_usd = 0.05,
  fixture_name = '',
  runtime_config,
  providerRunner = runOpenRouterSmoke,
  getReadiness = getPaidProviderPilotReadiness,
  findExisting = findExistingPilot,
  recordSuccess = recordSuccessLedger,
  recordFailure = recordFailedLedger
} = {}) {
  const readiness = await getReadiness({
    brand_name,
    prompt_index,
    model_index,
    approval_phrase,
    allow_paid_provider,
    execute_live,
    requested_calls,
    max_estimated_cost_usd,
    fixture_name,
    config: runtime_config
  });
  const idempotencyKey = readiness.request_plan?.idempotency_key;

  if (!readiness.live_execution_allowed) {
    return buildBlockedResult({ readiness });
  }
  if (readiness.gates?.allow_paid_provider !== true || !boolValue(execute_live)) {
    return buildBlockedResult({ readiness, reason: 'explicit_live_flags_missing' });
  }

  const existing = await findExisting(idempotencyKey);
  if (existing) {
    return buildDuplicateResult({ readiness, existing });
  }

  try {
    const result = await providerRunner({
      brand_name,
      prompt_index: numberValue(prompt_index),
      model_index: numberValue(model_index),
      execute: true,
      allow_paid_provider: true,
      save_fixture: true,
      fixture_name: safeFixtureName(readiness, fixture_name)
    });
    const ledger = await recordSuccess({ readiness, result, idempotencyKey });
    return {
      schema_version: PAID_PROVIDER_PILOT_RESULT_SCHEMA,
      status: 'completed',
      generated_at: new Date().toISOString(),
      provider_call_executed: true,
      paid_provider_call_count: 1,
      fixture_saved: Boolean(result.saved_fixture),
      fixture_path: result.saved_fixture || null,
      readiness: {
        ...readiness,
        provider_call_executed: true
      },
      blocker: null,
      response: result.response,
      ledger_event: {
        id: ledger.id,
        event_type: ledger.event_type,
        created_at: ledger.created_at,
        cost_estimate_usd: numberValue(ledger.cost_estimate_usd),
        metadata_schema_version: ledger.metadata.schema_version
      },
      guardrails: [
        'R11.2 completed one approved paid provider request.',
        'The provider response summary and fixture path were recorded without exposing provider secrets.',
        'Scheduler paid-provider mode and continuous paid jobs remain disabled.'
      ]
    };
  } catch (error) {
    const { event, classified } = await recordFailure({ readiness, idempotencyKey, error });
    return {
      schema_version: PAID_PROVIDER_PILOT_RESULT_SCHEMA,
      status: 'failed',
      generated_at: new Date().toISOString(),
      provider_call_executed: true,
      paid_provider_call_count: 1,
      fixture_saved: false,
      fixture_path: null,
      readiness: {
        ...readiness,
        provider_call_executed: true
      },
      blocker: classified.code,
      response: null,
      ledger_event: {
        id: event.id,
        event_type: 'provider_call_failed',
        created_at: event.created_at,
        cost_estimate_usd: 0,
        metadata_schema_version: event.metadata.schema_version
      },
      error: {
        code: classified.code,
        message: classified.message
      },
      guardrails: [
        'R11.2 attempted exactly one approved paid provider request.',
        'The failed provider call was recorded separately from successful provider usage.',
        'Scheduler paid-provider mode and continuous paid jobs remain disabled.'
      ]
    };
  }
}
