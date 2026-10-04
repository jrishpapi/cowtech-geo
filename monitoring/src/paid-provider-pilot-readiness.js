import { getConfig } from './config.js';
import { buildOpenRouterSmokePlan } from './openrouter-smoke.js';
import { getBillingAuthEntitlementPayload } from './billing-auth-bridge.js';

export const PAID_PROVIDER_PILOT_READINESS_SCHEMA = 'r11-1-paid-provider-pilot-readiness-v1';
export const R11_PAID_PROVIDER_APPROVAL_PHRASE = 'APPROVE_R11_PAID_PROVIDER_PILOT';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function estimatedCost(plan = {}) {
  return numberValue(plan.estimate?.estimated_cost_usd);
}

function providerCallQuotaAllows({ billingAuth, requestedCalls }) {
  const quota = billingAuth?.quota_bridge?.quotas?.provider_call;
  if (!quota || !quota.limit) return true;
  return numberValue(quota.used) + requestedCalls <= numberValue(quota.limit);
}

export function buildPaidProviderPilotReadiness({
  plan,
  billingAuth,
  config = getConfig(),
  approval_phrase = '',
  allow_paid_provider = false,
  execute_live = false,
  requested_calls = 1,
  max_estimated_cost_usd = config.liveProviderTestingMaxEstimatedCostUsd || 0.05,
  fixture_name = ''
} = {}) {
  const calls = Math.max(numberValue(requested_calls, 1), 1);
  const budget = Math.max(numberValue(max_estimated_cost_usd, 0.05), 0);
  const cost = estimatedCost(plan);
  const approvalMatched = approval_phrase === R11_PAID_PROVIDER_APPROVAL_PHRASE;
  const defaultLiveTestingEnabled = config.liveProviderTestingEnabled === true;
  const paidAllowedFlag = defaultLiveTestingEnabled || boolValue(allow_paid_provider);
  const executeLiveFlag = boolValue(execute_live);
  const keyPresent = Boolean(config.openrouterApiKey);
  const entitlementState = billingAuth?.entitlement?.state || 'unknown';
  const quotaAllows = providerCallQuotaAllows({ billingAuth, requestedCalls: calls });
  const idempotencyKey = plan?.brand?.id && plan?.prompt?.id && plan?.model_target?.id
    ? `r11-paid-provider-pilot:${plan.brand.id}:${plan.prompt.id}:${plan.model_target.id}`
    : null;

  const blockers = [
    !defaultLiveTestingEnabled && !approvalMatched ? 'same_turn_approval_phrase_missing' : null,
    !paidAllowedFlag ? 'allow_paid_provider_flag_missing' : null,
    !executeLiveFlag ? 'execute_live_flag_missing' : null,
    !keyPresent ? 'openrouter_api_key_missing' : null,
    calls !== 1 ? 'pilot_must_request_exactly_one_call' : null,
    !idempotencyKey ? 'idempotency_key_missing' : null,
    cost > budget ? 'estimated_cost_exceeds_budget' : null,
    entitlementState !== 'entitled' ? 'customer_not_entitled' : null,
    !quotaAllows ? 'r10_provider_call_quota_blocked' : null,
    config.schedulerProviderMode !== 'mock' ? 'scheduler_provider_mode_not_mock' : null,
    config.schedulerAllowPaidProvider ? 'scheduler_paid_provider_gate_open' : null
  ].filter(Boolean);

  const eligible = blockers.length === 0;

  return {
    schema_version: PAID_PROVIDER_PILOT_READINESS_SCHEMA,
    mode: 'dry_run_budget_gate',
    status: eligible ? 'eligible_for_single_call_pilot' : 'blocked',
    generated_at: new Date().toISOString(),
    dry_run: true,
    provider_call_executed: false,
    live_execution_allowed: eligible,
    approval: {
      required_phrase: R11_PAID_PROVIDER_APPROVAL_PHRASE,
      same_turn_approval_present: approvalMatched,
      approval_phrase_echoed: approvalMatched ? R11_PAID_PROVIDER_APPROVAL_PHRASE : '[missing_or_invalid]',
      default_live_testing_enabled: defaultLiveTestingEnabled,
      approval_mode: defaultLiveTestingEnabled ? 'default_live_test_enabled' : 'same_turn_phrase_required'
    },
    request_plan: {
      provider_mode: 'openrouter',
      planned_calls: plan?.planned_calls || 1,
      requested_calls: calls,
      execute_live_requested: executeLiveFlag,
      allow_paid_provider_requested: boolValue(allow_paid_provider),
      allow_paid_provider_effective: paidAllowedFlag,
      idempotency_key: idempotencyKey,
      timeout_ms: 30000,
      max_retries: 0,
      fixture_name: fixture_name || `${plan?.brand?.name || 'brand'}-${plan?.model_target?.model_id || 'model'}`
    },
    selection: {
      brand: plan?.brand
        ? {
            id: plan.brand.id,
            customer_id: plan.brand.customer_id || null,
            name: plan.brand.name,
            website_url: plan.brand.website_url || null,
            vertical: plan.brand.vertical || null,
            locale: plan.brand.locale || null
          }
        : null,
      prompt: plan?.prompt
        ? {
            id: plan.prompt.id,
            category: plan.prompt.category,
            prompt_text: plan.prompt.prompt_text || '',
            prompt_chars: String(plan.prompt.prompt_text || '').length
          }
        : null,
      model_target: plan?.model_target
        ? {
            id: plan.model_target.id,
            model_id: plan.model_target.model_id,
            display_name: plan.model_target.display_name
          }
        : null
    },
    budget: {
      max_estimated_cost_usd: budget,
      estimated_cost_usd: cost,
      within_budget: cost <= budget,
      cost_source: 'cost-estimator'
    },
    entitlement: {
      schema_version: billingAuth?.schema_version || null,
      state: entitlementState,
      status: billingAuth?.status || 'unknown',
      plan_id: billingAuth?.plan?.id || null,
      quota_bridge_schema_version: billingAuth?.quota_bridge?.schema_version || null,
      provider_call_quota_allows: quotaAllows,
      provider_call_quota: billingAuth?.quota_bridge?.quotas?.provider_call || null
    },
    provider_config: {
      openrouter_api_key_present: keyPresent,
      openrouter_api_key_value: keyPresent ? '[redacted]' : null,
      openrouter_base_url_present: Boolean(config.openrouterBaseUrl),
      provider_secret_exposed: false
    },
    gates: {
      payment_provider_connected: false,
      quota_enforcement_active: billingAuth?.gates?.quota_enforcement_active === true,
      allow_paid_provider: paidAllowedFlag,
      live_provider_testing_enabled: defaultLiveTestingEnabled,
      execute_live: executeLiveFlag,
      scheduler_paid_provider_allowed: false,
      continuous_paid_jobs_allowed: false,
      deployment_allowed: false,
      live_geoflow_dispatch_allowed: false,
      cms_publish_allowed: false,
      webhook_email_allowed: false
    },
    blockers,
    next_operator_action: blockers.length
      ? `Resolve ${blockers[0].replaceAll('_', ' ')} before any paid provider pilot.`
      : 'Eligible for R11.2 single-call pilot if 晋 explicitly approves execution in this same turn.',
    guardrails: [
      'R11.1 is dry-run readiness only and must not call OpenRouter.',
      'Live provider testing is default-enabled for bounded local/internal pilots, but execution still requires execute_live=true.',
      'R10 entitlement and quota bridge remain authoritative before paid provider execution.',
      'Scheduler paid provider mode, deployment, CMS publish, webhook, email, and live GeoFlow remain blocked.'
    ]
  };
}

export async function getPaidProviderPilotReadiness({
  brand_name = '',
  prompt_index = 0,
  model_index = 0,
  approval_phrase = '',
  allow_paid_provider = false,
  execute_live = false,
  requested_calls = 1,
  max_estimated_cost_usd = 0.05,
  fixture_name = '',
  config = getConfig()
} = {}) {
  const plan = await buildOpenRouterSmokePlan({
    brand_name,
    prompt_index: numberValue(prompt_index),
    model_index: numberValue(model_index)
  });
  const billingAuth = await getBillingAuthEntitlementPayload({ brand_name });
  return buildPaidProviderPilotReadiness({
    plan,
    billingAuth,
    config,
    approval_phrase,
    allow_paid_provider,
    execute_live,
    requested_calls,
    max_estimated_cost_usd,
    fixture_name
  });
}
