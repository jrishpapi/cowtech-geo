import { pool } from './db.js';
import { getCustomerAddonSummary } from './customer-addons.js';

export const QUOTA_BRIDGE_SCHEMA = 'r10-2-quota-enforcement-usage-ledger-bridge-v1';
export const QUOTA_EVENT_SCHEMA = 'r10-2-customer-safe-usage-event-v1';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addonBonus(addons, quotaType) {
  const totals = addons?.totals || {};
  const bonuses = {
    provider_call: numberValue(totals.credits),
    competitor_count: numberValue(totals.competitor),
    article_draft: numberValue(totals.article)
  };
  return bonuses[quotaType] || 0;
}

function quotaLimit(plan, quotaType, addons = null) {
  const limits = {
    prompt_count: numberValue(plan?.monthly_prompt_limit),
    model_count: numberValue(plan?.model_limit),
    competitor_count: numberValue(plan?.competitor_limit),
    scheduled_run: numberValue(plan?.weekly_runs_per_month, 4),
    manual_retest: numberValue(plan?.included_full_retests),
    content_opportunity: numberValue(plan?.content_opportunities_max),
    article_draft: numberValue(plan?.article_drafts_max),
    provider_call: numberValue(plan?.monthly_provider_call_limit)
  };
  return (limits[quotaType] ?? 0) + addonBonus(addons, quotaType);
}

function quotaBaseLimit(plan, quotaType) {
  return quotaLimit(plan, quotaType, null);
}

async function loadCustomerAddons(customerId) {
  if (!customerId) return null;
  try {
    return await getCustomerAddonSummary({ customer_id: customerId });
  } catch {
    return null;
  }
}

function quotaEntry(plan, quotaType, used, addons = null) {
  const base_limit = quotaBaseLimit(plan, quotaType);
  const addon_bonus = addonBonus(addons, quotaType);
  return {
    limit: quotaLimit(plan, quotaType, addons),
    base_limit,
    addon_bonus,
    used: numberValue(used)
  };
}

export function buildCustomerSafeUsageEvent({
  event_type,
  quota_type,
  units = 1,
  cost_estimate_usd = 0,
  status = 'recorded',
  customer_id = null,
  brand_id = null,
  metadata = {},
  created_at = new Date().toISOString()
}) {
  return {
    schema_version: QUOTA_EVENT_SCHEMA,
    event_type,
    quota_type,
    units: numberValue(units, 1),
    status,
    customer_id,
    brand_id,
    created_at,
    metadata: {
      source: metadata.source || null,
      run_type: metadata.run_type || null,
      quota_limit: metadata.quota_limit ?? null,
      current_usage: metadata.current_usage ?? null,
      requested_units: metadata.requested_units ?? null,
      projected_usage: metadata.projected_usage ?? null,
      override: Boolean(metadata.override),
      override_actor: metadata.override_actor || null,
      override_reason: metadata.override_reason || null,
      provider_mode: metadata.provider_mode || null,
      result_status: metadata.result_status || null,
      source_tracking_run_id: metadata.source_tracking_run_id || null,
      retest_schedule_id: metadata.retest_schedule_id || null
    }
  };
}

export async function recordQuotaUsageEvent({
  customer_id,
  brand_id = null,
  event_type = 'quota_event',
  quota_type,
  units = 1,
  cost_estimate_usd = 0,
  status = 'recorded',
  metadata = {}
}) {
  const safe = buildCustomerSafeUsageEvent({
    event_type,
    quota_type,
    units,
    status,
    customer_id,
    brand_id,
    metadata
  });
  const result = await pool.query(
    `INSERT INTO usage_ledger (customer_id, brand_id, event_type, units, cost_estimate_usd, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [
      customer_id || null,
      brand_id || null,
      event_type,
      numberValue(units, 1),
      Math.max(0, numberValue(cost_estimate_usd)),
      JSON.stringify(safe)
    ]
  );
  return {
    ...safe,
    id: result.rows[0].id,
    created_at: result.rows[0].created_at
  };
}

async function currentUsage({ customer_id, brand_id, quota_type, now = new Date(), metadata = {} }) {
  const start = monthStart(now).toISOString();
  if (quota_type === 'scheduled_run') {
    const result = await pool.query(
      `SELECT COALESCE(SUM(units), 0)::int AS used
       FROM usage_ledger
       WHERE customer_id = $1
         AND event_type = 'quota_checked'
         AND metadata->>'quota_type' = 'scheduled_run'
         AND created_at >= $2`,
      [customer_id, start]
    );
    return numberValue(result.rows[0]?.used);
  }
  if (quota_type === 'manual_retest') {
    const values = [customer_id, start];
    let sourceFilter = '';
    if (metadata.source_tracking_run_id) {
      values.push(metadata.source_tracking_run_id);
      sourceFilter = `AND metadata->'metadata'->>'source_tracking_run_id' = $${values.length}`;
    }
    const result = await pool.query(
      `SELECT COALESCE(SUM(units), 0)::int AS used
       FROM usage_ledger
       WHERE customer_id = $1
         AND event_type = 'quota_checked'
         AND metadata->>'quota_type' = 'manual_retest'
         AND created_at >= $2
         ${sourceFilter}`,
      values
    );
    return numberValue(result.rows[0]?.used);
  }
  if (quota_type === 'provider_call') {
    const result = await pool.query(
      `SELECT COALESCE(SUM(units), 0)::int AS used
       FROM usage_ledger
       WHERE customer_id = $1
         AND event_type = 'provider_call'
         AND COALESCE(metadata->>'provider_mode', '') <> 'mock'
         AND created_at >= $2`,
      [customer_id, start]
    );
    return numberValue(result.rows[0]?.used);
  }
  if (quota_type === 'content_opportunity') {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS used
       FROM content_opportunities co
       JOIN tracking_runs tr ON tr.id = co.tracking_run_id
       JOIN brands b ON b.id = tr.brand_id
       WHERE b.customer_id = $1
         AND ($2::uuid IS NULL OR b.id = $2)
         AND co.created_at >= $3`,
      [customer_id, brand_id || null, start]
    );
    return numberValue(result.rows[0]?.used);
  }
  if (quota_type === 'article_draft') {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS used
       FROM article_drafts ad
       JOIN tracking_runs tr ON tr.id = ad.tracking_run_id
       JOIN brands b ON b.id = tr.brand_id
       WHERE b.customer_id = $1
         AND ($2::uuid IS NULL OR b.id = $2)
         AND ad.created_at >= $3`,
      [customer_id, brand_id || null, start]
    );
    return numberValue(result.rows[0]?.used);
  }
  return 0;
}

function quotaDecision({ quota_type, limit, current_usage, requested_units, override = null }) {
  const requested = numberValue(requested_units, 1);
  const projected = numberValue(current_usage) + requested;
  const unlimited = !limit || limit <= 0;
  const overLimit = !unlimited && projected > limit;
  const overrideAllowed = Boolean(override?.allowed && override.actor && override.reason);
  return {
    schema_version: QUOTA_BRIDGE_SCHEMA,
    quota_type,
    status: overLimit && !overrideAllowed ? 'blocked' : overrideAllowed && overLimit ? 'allowed_with_override' : 'allowed',
    allowed: !overLimit || overrideAllowed,
    limit: unlimited ? null : limit,
    current_usage: numberValue(current_usage),
    requested_units: requested,
    projected_usage: projected,
    remaining_after: unlimited ? null : Math.max(limit - projected, 0),
    override: overrideAllowed
      ? {
          allowed: true,
          actor: override.actor,
          reason: override.reason
        }
      : {
          allowed: false
        },
    customer_safe_event: buildCustomerSafeUsageEvent({
      event_type: overLimit && !overrideAllowed ? 'quota_blocked' : 'quota_checked',
      quota_type,
      units: requested,
      status: overLimit && !overrideAllowed ? 'blocked' : 'allowed',
      metadata: {
        quota_limit: unlimited ? null : limit,
        current_usage,
        requested_units: requested,
        projected_usage: projected,
        override: overrideAllowed,
        override_actor: override?.actor,
        override_reason: override?.reason
      }
    })
  };
}

export function assertStaticPlanLimit({ plan, quota_type, current_usage, requested_units = 0, override = null }) {
  const decision = quotaDecision({
    quota_type,
    limit: quotaLimit(plan, quota_type),
    current_usage,
    requested_units,
    override
  });
  if (!decision.allowed) {
    const error = new Error(`${quota_type} quota exceeded: ${decision.projected_usage}/${decision.limit}`);
    error.code = `${quota_type}_quota_exceeded`;
    error.details = decision;
    throw error;
  }
  return decision;
}

export async function assertMonthlyQuotaAllowed({
  customer_id,
  brand_id = null,
  plan,
  quota_type,
  requested_units = 1,
  override = null,
  metadata = {}
}) {
  const used = await currentUsage({ customer_id, brand_id, quota_type, metadata });
  const addons = await loadCustomerAddons(customer_id);
  const decision = quotaDecision({
    quota_type,
    limit: quotaLimit(plan, quota_type, addons),
    current_usage: used,
    requested_units,
    override
  });
  const status = decision.allowed ? 'allowed' : 'blocked';
  await recordQuotaUsageEvent({
    customer_id,
    brand_id,
    event_type: decision.allowed ? 'quota_checked' : 'quota_blocked',
    quota_type,
    units: requested_units,
    status,
    metadata: {
      ...metadata,
      quota_limit: decision.limit,
      current_usage: used,
      requested_units,
      projected_usage: decision.projected_usage,
      override: decision.override.allowed,
      override_actor: decision.override.actor,
      override_reason: decision.override.reason
    }
  });
  if (!decision.allowed) {
    const error = new Error(`${quota_type} quota exceeded: ${decision.projected_usage}/${decision.limit}`);
    error.code = `${quota_type}_quota_exceeded`;
    error.details = decision;
    throw error;
  }
  return decision;
}

export function buildQuotaBridgeSummary({ plan, usage = {}, addons = null }) {
  return {
    schema_version: QUOTA_BRIDGE_SCHEMA,
    mode: 'quota_enforcement_usage_ledger_bridge',
    status: 'active',
    enforcement_active: true,
    addons: addons
      ? {
          schema_version: addons.schema_version,
          cycle_month: addons.cycle_month,
          totals: addons.totals,
          applied_to_quota: {
            credits: 'provider_call',
            competitor: 'competitor_count',
            article: 'article_draft'
          }
        }
      : {
          totals: { credits: 0, competitor: 0, article: 0 },
          applied_to_quota: {
            credits: 'provider_call',
            competitor: 'competitor_count',
            article: 'article_draft'
          }
        },
    quotas: {
      prompt_count: quotaEntry(plan, 'prompt_count', usage.prompt_count, addons),
      model_count: quotaEntry(plan, 'model_count', usage.model_count, addons),
      competitor_count: quotaEntry(plan, 'competitor_count', usage.competitor_count, addons),
      scheduled_run: quotaEntry(plan, 'scheduled_run', usage.scheduled_runs_used, addons),
      manual_retest: quotaEntry(plan, 'manual_retest', usage.manual_retests_used, addons),
      content_opportunity: quotaEntry(plan, 'content_opportunity', usage.content_opportunities_used, addons),
      article_draft: quotaEntry(plan, 'article_draft', usage.article_drafts_used, addons),
      provider_call: quotaEntry(plan, 'provider_call', usage.provider_calls_used, addons)
    },
    usage_ledger: {
      customer_safe_events: true,
      failed_provider_calls_tracked_separately: true,
      raw_provider_payload_exposed: false,
      monthly_reset: 'calendar_month_utc'
    },
    gates: {
      payment_provider_connected: false,
      auth_behavior_changed: false,
      production_billing_mutation_allowed: false,
      webhook_email_allowed: false,
      paid_provider_allowed: false
    },
    guardrails: [
      'R10.2 enforces product quota at local state-machine boundaries.',
      'R10.2 records customer-safe usage ledger events and does not expose raw provider payloads.',
      'R10.2 does not connect a payment provider or change auth/session behavior.'
    ]
  };
}
