import { pool } from './db.js';
import { getConfig } from './config.js';
import { createProviderError } from './errors.js';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isLiveProviderMode(providerMode = 'unconfigured') {
  return String(providerMode || 'unconfigured') !== 'mock';
}

export function requiredSecretForProvider(providerMode = 'unconfigured') {
  return {
    openrouter: 'openrouterApiKey',
    perplexity: 'perplexityApiKey',
    google_ai_overview: 'serpapiApiKey',
    chatgpt_api_like: 'openaiApiKey',
    gemini_api_like: 'geminiApiKey',
    claude_api_like: 'anthropicApiKey',
    grok_api_like: 'xaiApiKey'
  }[providerMode] || null;
}

export async function getProviderUsageWindow({ customer_id, now = new Date() }) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(units) FILTER (WHERE created_at >= $2), 0)::int AS daily_calls,
       COALESCE(SUM(cost_estimate_usd) FILTER (WHERE created_at >= $2), 0)::numeric AS daily_cost_usd,
       COALESCE(SUM(units) FILTER (WHERE created_at >= $3), 0)::int AS monthly_calls,
       COALESCE(SUM(cost_estimate_usd) FILTER (WHERE created_at >= $3), 0)::numeric AS monthly_cost_usd
     FROM usage_ledger
     WHERE customer_id = $1
       AND event_type IN ('provider_call', 'provider_call_failed')
       AND COALESCE(metadata->>'provider_mode', '') <> 'mock'`,
    [customer_id, dayStart(now).toISOString(), monthStart(now).toISOString()]
  );
  const row = result.rows[0] || {};
  return {
    daily_calls: numberValue(row.daily_calls),
    daily_cost_usd: numberValue(row.daily_cost_usd),
    monthly_calls: numberValue(row.monthly_calls),
    monthly_cost_usd: numberValue(row.monthly_cost_usd)
  };
}

export function buildLiveProviderGate({
  customer,
  plan = {},
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  requested_calls = 1,
  estimated_cost_usd = 0,
  usage = {},
  config = getConfig()
} = {}) {
  const providerMode = String(provider_mode || 'unconfigured');
  const liveMode = isLiveProviderMode(providerMode);
  const calls = Math.max(1, numberValue(requested_calls, 1));
  const estimatedCost = Math.max(0, numberValue(estimated_cost_usd));
  const dailyCallLimit = numberValue(plan.daily_provider_call_limit);
  const monthlyCallLimit = numberValue(plan.monthly_provider_call_limit);
  const runCostLimit = numberValue(plan.monitoring_run_cost_limit_usd);
  const dailyCostLimit = numberValue(plan.daily_provider_cost_limit_usd);
  const monthlyCostLimit = numberValue(plan.monthly_provider_cost_limit_usd);
  const requiredSecret = requiredSecretForProvider(providerMode);
  const secretPresent = requiredSecret ? Boolean(config[requiredSecret]) : providerMode === 'mock';
  const externalSpendAllowed = config.externalSpendMode === 'allow';

  const blockers = liveMode
    ? [
        !externalSpendAllowed ? 'external_spend_mode_denied' : null,
        !boolValue(plan.live_provider_enabled) ? 'plan_live_provider_not_enabled' : null,
        !boolValue(customer?.live_provider_enabled) ? 'customer_live_provider_not_enabled' : null,
        !boolValue(allow_paid_provider) ? 'allow_paid_provider_flag_missing' : null,
        !secretPresent ? `${providerMode}_secret_missing` : null,
        runCostLimit <= 0 ? 'monitoring_run_cost_limit_missing' : null,
        dailyCostLimit <= 0 ? 'daily_provider_cost_limit_missing' : null,
        monthlyCostLimit <= 0 ? 'monthly_provider_cost_limit_missing' : null,
        runCostLimit > 0 && estimatedCost > runCostLimit
          ? 'monitoring_run_cost_limit_exceeded'
          : null,
        dailyCostLimit > 0 && numberValue(usage.daily_cost_usd) + estimatedCost > dailyCostLimit
          ? 'daily_provider_cost_limit_exceeded'
          : null,
        dailyCallLimit > 0 && numberValue(usage.daily_calls) + calls > dailyCallLimit
          ? 'daily_provider_call_limit_exceeded'
          : null,
        monthlyCallLimit > 0 && numberValue(usage.monthly_calls) + calls > monthlyCallLimit
          ? 'monthly_provider_call_limit_exceeded'
          : null,
        monthlyCostLimit > 0 && numberValue(usage.monthly_cost_usd) + estimatedCost > monthlyCostLimit
          ? 'monthly_provider_cost_limit_exceeded'
          : null
      ].filter(Boolean)
    : [];

  return {
    schema_version: 'live-provider-gate-v1',
    mode: liveMode ? 'live_provider_gate' : 'mock_provider',
    status: blockers.length ? 'blocked' : liveMode ? 'eligible' : 'mock_only',
    live_provider_requested: liveMode,
    live_provider_allowed: liveMode && blockers.length === 0,
    provider_mode: providerMode,
    customer: {
      id: customer?.id || null,
      status: customer?.status || 'unknown',
      plan_code: customer?.plan_code || plan?.id || null,
      live_provider_enabled: boolValue(customer?.live_provider_enabled)
    },
    plan: {
      id: plan?.id || null,
      live_provider_enabled: boolValue(plan.live_provider_enabled),
      live_provider_status: plan?.live_provider_status || 'mock_only',
      daily_provider_call_limit: dailyCallLimit || null,
      monthly_provider_call_limit: monthlyCallLimit || null,
      monitoring_run_cost_limit_usd: runCostLimit || null,
      daily_provider_cost_limit_usd: dailyCostLimit || null,
      monthly_provider_cost_limit_usd: monthlyCostLimit || null
    },
    request: {
      allow_paid_provider: boolValue(allow_paid_provider),
      requested_calls: calls,
      estimated_cost_usd: estimatedCost
    },
    usage: {
      daily_calls: numberValue(usage.daily_calls),
      daily_cost_usd: numberValue(usage.daily_cost_usd),
      monthly_calls: numberValue(usage.monthly_calls),
      monthly_cost_usd: numberValue(usage.monthly_cost_usd)
    },
    provider_config: {
      required_secret: requiredSecret,
      secret_present: secretPresent,
      external_spend_mode: config.externalSpendMode || 'deny',
      secret_value_exposed: false
    },
    blockers,
    fallback_provider_mode: blockers.length ? 'unconfigured' : providerMode,
    customer_message: blockers.length
      ? 'Live provider calls are blocked by budget, plan, or secret gates; monitoring is paused and no observations are generated until access is configured and permitted.'
      : liveMode
        ? 'Live provider calls are allowed for this request.'
        : 'Mock validation is active and no paid provider call is requested.'
  };
}

export async function getLiveProviderGateForCustomer({
  customer_id,
  customer = {},
  plan,
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  requested_calls = 1,
  estimated_cost_usd = 0,
  now = new Date(),
  config = getConfig()
}) {
  const usage = await getProviderUsageWindow({ customer_id, now });
  return buildLiveProviderGate({
    customer: { ...customer, id: customer_id, plan_code: plan?.id },
    plan,
    provider_mode,
    allow_paid_provider,
    requested_calls,
    estimated_cost_usd,
    usage,
    config
  });
}

export function assertLiveProviderGateAllowed(gate) {
  if (!gate.live_provider_requested || gate.live_provider_allowed) return gate;
  throw createProviderError({
    code: 'live_provider_gate_blocked',
    message: `Live provider gate blocked: ${gate.blockers[0] || 'unknown'}`,
    retryable: false,
    details: gate
  });
}
