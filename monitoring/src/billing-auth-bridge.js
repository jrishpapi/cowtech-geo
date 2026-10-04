import { pool } from './db.js';
import { buildAccountLifecycleBridge } from './account-lifecycle-bridge.js';
import { buildQuotaBridgeSummary } from './quota-bridge.js';
import { getCustomerAddonSummary } from './customer-addons.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';
import { buildPhase8Phase4PlanContract } from './phase8-commercialization.js';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function remaining(limit, used) {
  if (!limit) return null;
  return Math.max(numberValue(limit) - numberValue(used), 0);
}

function entitlementForStatus(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  if (['active', 'trialing', 'comped'].includes(normalized)) {
    return {
      state: 'entitled',
      customer_access: 'active',
      scheduled_jobs_allowed: true,
      reason: `${normalized}_customer`
    };
  }
  if (normalized === 'past_due') {
    return {
      state: 'restricted',
      customer_access: 'read_only',
      scheduled_jobs_allowed: false,
      reason: 'past_due_payment_requires_operator_review'
    };
  }
  if (['paused', 'canceled'].includes(normalized)) {
    return {
      state: 'blocked',
      customer_access: 'read_only',
      scheduled_jobs_allowed: false,
      reason: `${normalized}_subscription`
    };
  }
  return {
    state: 'blocked',
    customer_access: 'read_only',
    scheduled_jobs_allowed: false,
    reason: 'unknown_customer_status'
  };
}

function addonTotals(addons = null) {
  return addons?.totals || { credits: 0, article: 0, competitor: 0 };
}

function planLimits(plan = {}, addons = null) {
  const totals = addonTotals(addons);
  return {
    prompts: numberValue(plan.monthly_prompt_limit),
    models: numberValue(plan.model_limit),
    competitors: numberValue(plan.competitor_limit) + numberValue(totals.competitor),
    monthly_runs: numberValue(plan.weekly_runs_per_month, 4),
    included_full_retests: numberValue(plan.included_full_retests),
    monthly_provider_calls: numberValue(plan.monthly_provider_call_limit) + numberValue(totals.credits),
    retry_buffer_percent: numberValue(plan.retry_buffer_percent, 25),
    openrouter_reserve_usd: numberValue(plan.openrouter_reserve_usd),
    base: {
      competitors: numberValue(plan.competitor_limit),
      monthly_provider_calls: numberValue(plan.monthly_provider_call_limit)
    },
    addon_bonus: {
      competitors: numberValue(totals.competitor),
      monthly_provider_calls: numberValue(totals.credits)
    }
  };
}

function planDeliverables(plan = {}, addons = null) {
  const totals = addonTotals(addons);
  return {
    content_opportunities: {
      min: numberValue(plan.content_opportunities_min),
      max: numberValue(plan.content_opportunities_max)
    },
    article_drafts: {
      min: numberValue(plan.article_drafts_min),
      max: numberValue(plan.article_drafts_max) + numberValue(totals.article),
      base_max: numberValue(plan.article_drafts_max),
      addon_bonus: numberValue(totals.article)
    }
  };
}

export function buildBillingAuthEntitlement({ customer, brand = null, plan = null, usage = {}, addons = null }) {
  const limits = planLimits(plan || {}, addons);
  const entitlement = entitlementForStatus(customer?.status);
  const providerCallsUsed = numberValue(usage.provider_calls_used);
  const costEstimateUsd = numberValue(usage.cost_estimate_usd);
  const providerCallLimit = limits.monthly_provider_calls;
  const quotaStatus = providerCallLimit && providerCallsUsed > providerCallLimit ? 'over_quota' : 'within_quota';
  const accountLifecycle = buildAccountLifecycleBridge({
    customer,
    brand,
    plan,
    usage: { ...usage, quota_status: quotaStatus }
  });
  const blockers = [
    !customer?.id ? 'missing_customer' : null,
    !plan ? 'missing_plan' : null,
    entitlement.state === 'blocked' ? entitlement.reason : null,
    quotaStatus === 'over_quota' ? 'monthly_provider_call_quota_exceeded' : null,
    ...accountLifecycle.blockers.filter((blocker) => !['quota_exceeded'].includes(blocker))
  ].filter(Boolean);
  const warnings = [
    !customer?.external_customer_id ? 'missing_external_customer_id' : null,
    !customer?.email ? 'missing_customer_email' : null,
    'real_payment_provider_not_connected_in_r10_3',
    'auth_behavior_not_changed_in_r10_3'
  ].filter(Boolean);
  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const phase4ServiceContract = plan?.id && ['starter', 'pro', 'god'].includes(plan.id)
    ? buildPhase8Phase4PlanContract(plan.id)
    : null;

  return {
    schema_version: 'r10-3-billing-auth-account-lifecycle-v1',
    entitlement_schema_version: 'r10-1-billing-auth-entitlement-v1',
    quota_schema_version: 'r10-2-billing-auth-quota-bridge-v1',
    account_lifecycle_schema_version: accountLifecycle.schema_version,
    mode: 'account_lifecycle_entitlement_bridge',
    status: uniqueBlockers.length ? 'blocked' : uniqueWarnings.length ? 'active_with_warnings' : 'active',
    customer: {
      id: customer?.id || null,
      external_customer_id: customer?.external_customer_id || null,
      email: customer?.email || null,
      status: customer?.status || 'unknown'
    },
    brand: brand
      ? {
          id: brand.id,
          name: brand.name,
          website_url: brand.website_url || null
        }
      : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          status: plan.status || 'active',
          limits,
          deliverables: planDeliverables(plan, addons),
          addons: addons
            ? {
                schema_version: addons.schema_version,
                cycle_month: addons.cycle_month,
                totals: addons.totals
              }
            : {
                totals: { credits: 0, article: 0, competitor: 0 }
              },
          phase4_service_contract: phase4ServiceContract
        }
      : null,
    entitlement,
    usage: {
      period: 'current_month',
      provider_calls_used: providerCallsUsed,
      provider_calls_limit: providerCallLimit,
      provider_calls_remaining: remaining(providerCallLimit, providerCallsUsed),
      cost_estimate_usd: costEstimateUsd,
      quota_status: quotaStatus,
      usage_events: numberValue(usage.usage_events)
    },
    quota_bridge: buildQuotaBridgeSummary({ plan: plan || {}, usage, addons }),
    account_lifecycle: accountLifecycle,
    dashboard_auth_surface: accountLifecycle.dashboard_auth_surface,
    gates: {
      payment_provider_connected: false,
      subscription_webhook_connected: false,
      auth_behavior_changed: false,
      session_behavior_changed: false,
      quota_enforcement_active: true,
      job_pause_resume_allowed: false,
      production_auth_mutation_allowed: false,
      production_account_created: false,
      production_billing_mutation_allowed: false,
      webhook_email_allowed: false,
      paid_provider_allowed: false
    },
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    next_operator_action: uniqueBlockers.length
      ? `Resolve ${uniqueBlockers[0].replaceAll('_', ' ')}.`
      : uniqueWarnings.length
        ? `Review ${uniqueWarnings[0].replaceAll('_', ' ')}.`
        : 'No billing/auth bridge action required.',
    guardrails: [
      'R10.3 maps customer account lifecycle but does not connect a real payment provider.',
      'R10.3 does not change auth/session behavior.',
      'R10.3 does not pause, resume, enqueue, or cancel jobs.',
      'R10.3 does not create production customer accounts or mutate production billing data.'
    ]
  };
}

async function resolveBrandId({ brand_id, brand_name, run_id } = {}) {
  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (brand_id) {
    values.push(brand_id);
    filters.push(`b.id = $${values.length}`);
  }
  if (brand_name) {
    values.push(brand_name);
    filters.push(`LOWER(b.name) = LOWER($${values.length})`);
  }
  if (run_id) {
    values.push(run_id);
    filters.push(`tr.id = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT b.id
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN tracking_runs tr ON tr.brand_id = b.id
     WHERE ${filters.join(' AND ')}
     ORDER BY b.created_at ASC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getBillingAuthEntitlementPayload({ brand_id, brand_name, run_id } = {}) {
  const resolvedBrandId = await resolveBrandId({ brand_id, brand_name, run_id });
  if (!resolvedBrandId) return null;

  const result = await pool.query(
    `SELECT b.id AS brand_id,
            b.name AS brand_name,
            b.website_url,
            c.id AS customer_id,
            c.external_customer_id,
            c.email,
            c.status AS customer_status,
            c.plan_code,
            p.*
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN plans p ON p.id = c.plan_code
     WHERE b.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [resolvedBrandId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];

  const usage = await pool.query(
    `SELECT COALESCE(SUM(units), 0)::int AS provider_calls_used,
            COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost_estimate_usd,
            COUNT(*)::int AS usage_events,
            (SELECT COUNT(DISTINCT surface.surface_key)::int
             FROM brand_monitoring_surface_configs AS surface
             JOIN brands AS monitored_brand ON monitored_brand.id = surface.brand_id
             WHERE monitored_brand.customer_id = $1
               AND surface.status = 'active') AS model_count,
            (SELECT COUNT(*)::int
             FROM competitors AS competitor
             JOIN brands AS competitor_brand ON competitor_brand.id = competitor.brand_id
             WHERE competitor_brand.customer_id = $1) AS competitor_count
     FROM usage_ledger
     WHERE customer_id = $1
       AND event_type = 'provider_call'
       AND COALESCE(metadata->>'provider_mode', '') <> 'mock'
       AND created_at >= date_trunc('month', NOW())`,
    [row.customer_id]
  );
  const addons = await getCustomerAddonSummary({ customer_id: row.customer_id });

  return buildBillingAuthEntitlement({
    customer: {
      id: row.customer_id,
      external_customer_id: row.external_customer_id,
      email: row.email,
      status: row.customer_status,
      plan_code: row.plan_code
    },
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      website_url: row.website_url
    },
    plan: row.id ? row : null,
    usage: usage.rows[0] || {},
    addons
  });
}

export async function listBillingAuthEntitlements({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const result = await pool.query(
    `SELECT c.id AS customer_id,
            c.external_customer_id,
            c.email,
            c.status AS customer_status,
            c.plan_code,
            b.id AS brand_id,
            b.name AS brand_name,
            b.website_url,
            p.*,
            COALESCE(SUM(ul.units), 0)::int AS provider_calls_used,
            COALESCE(SUM(ul.cost_estimate_usd), 0)::numeric AS cost_estimate_usd,
            COUNT(ul.id)::int AS usage_events,
            (SELECT COUNT(DISTINCT surface.surface_key)::int
             FROM brand_monitoring_surface_configs AS surface
             JOIN brands AS monitored_brand ON monitored_brand.id = surface.brand_id
             WHERE monitored_brand.customer_id = c.id
               AND surface.status = 'active') AS model_count,
            (SELECT COUNT(*)::int
             FROM competitors AS competitor
             JOIN brands AS competitor_brand ON competitor_brand.id = competitor.brand_id
             WHERE competitor_brand.customer_id = c.id) AS competitor_count
     FROM customers c
     LEFT JOIN brands b ON b.customer_id = c.id
     LEFT JOIN plans p ON p.id = c.plan_code
     LEFT JOIN usage_ledger ul ON ul.customer_id = c.id
       AND ul.event_type = 'provider_call'
       AND COALESCE(ul.metadata->>'provider_mode', '') <> 'mock'
       AND ul.created_at >= date_trunc('month', NOW())
     GROUP BY c.id, b.id, p.id
     ORDER BY c.created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  return Promise.all(result.rows.map(async (row) =>
    buildBillingAuthEntitlement({
      customer: {
        id: row.customer_id,
        external_customer_id: row.external_customer_id,
        email: row.email,
        status: row.customer_status,
        plan_code: row.plan_code
      },
      brand: row.brand_id
        ? {
            id: row.brand_id,
            name: row.brand_name,
            website_url: row.website_url
          }
        : null,
      plan: row.id ? row : null,
      usage: row,
      addons: await getCustomerAddonSummary({ customer_id: row.customer_id })
    })
  ));
}

export function buildBillingAuthOverview(entitlements = []) {
  const blocked = entitlements.filter((item) => item.status === 'blocked');
  const warnings = entitlements.filter((item) => item.status === 'active_with_warnings');
  return {
    schema_version: 'r10-3-billing-auth-account-lifecycle-overview-v1',
    entitlement_schema_version: 'r10-1-billing-auth-overview-v1',
    quota_schema_version: 'r10-2-billing-auth-quota-overview-v1',
    account_lifecycle_schema_version: 'r10-3-account-lifecycle-bridge-v1',
    mode: 'account_lifecycle_entitlement_overview',
    status: blocked.length ? 'blocked' : warnings.length ? 'active_with_warnings' : 'active',
    totals: {
      customers: entitlements.length,
      blocked: blocked.length,
      warnings: warnings.length,
      entitled: entitlements.filter((item) => item.entitlement.state === 'entitled').length,
      restricted: entitlements.filter((item) => item.entitlement.state === 'restricted').length,
      lifecycle_blocked: entitlements.filter((item) => item.account_lifecycle?.status === 'blocked').length,
      dashboard_read_only: entitlements.filter(
        (item) => item.dashboard_auth_surface?.dashboard_access === 'read_only'
      ).length
    },
    items: entitlements,
    gates: {
      payment_provider_connected: false,
      subscription_webhook_connected: false,
      auth_behavior_changed: false,
      session_behavior_changed: false,
      quota_enforcement_active: true,
      job_pause_resume_allowed: false,
      production_auth_mutation_allowed: false,
      production_account_created: false,
      production_billing_mutation_allowed: false,
      webhook_email_allowed: false
    }
  };
}
