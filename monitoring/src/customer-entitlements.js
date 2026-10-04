import { pool } from './db.js';
import { buildBillingAuthEntitlement, getBillingAuthEntitlementPayload } from './billing-auth-bridge.js';
import { getCustomerAddonSummary } from './customer-addons.js';
import { getCustomerMonthlyFulfillmentPayload } from './monthly-fulfillment.js';
import { getCustomerMonitoringPayload } from './recurring-monitoring.js';
import { buildPhase4Entitlement } from './phase4-repository.js';
import { buildPhase5SurfaceEntitlement } from './phase5-surface-contract.js';

function firstNonEmpty(...values) {
  return values.find((value) => String(value || '').trim() !== '') || '';
}

function customerStatus(snapshot = {}) {
  if (!snapshot.customer?.id) return 'not_found';
  const billingStatus = snapshot.billing_auth?.status || 'unknown';
  const monitoringMode = snapshot.monitoring?.fulfillment?.mode || null;
  const monthlySummary = snapshot.monthly_fulfillment?.summary || {};
  if (billingStatus === 'blocked') return 'blocked';
  if (monthlySummary.failed_count > 0) return 'needs_operator_review';
  if (['degraded', 'failed'].includes(monitoringMode)) return 'needs_operator_review';
  if (monitoringMode === 'pending_live_enablement') return 'pending_live_provider';
  if (!snapshot.workspace?.brand?.id) return 'pending_workspace';
  return 'ready';
}

function compactMonitoringPayload(monitoring = null) {
  if (!monitoring) return null;
  return {
    connected: true,
    fulfillment: monitoring.fulfillment || null,
    production_cycle: monitoring.production_cycle || null,
    readiness: monitoring.readiness || null,
    alerts: Array.isArray(monitoring.alerts) ? monitoring.alerts.slice(0, 10) : []
  };
}

export function buildCustomerEntitlementSnapshot({
  lookup = {},
  customer = null,
  plan = null,
  brand = null,
  tracking_run = null,
  billing_auth = null,
  addons = null,
  monthly_fulfillment = null,
  monitoring = null,
  phase4 = null,
  phase5 = null
} = {}) {
  const phase5Base = buildPhase5SurfaceEntitlement({
    planCode: customer?.plan_code,
    claudeAddonEnabled: phase5?.claude_addon_enabled === true
  });
  const snapshot = {
    schema_version: 'customer-entitlement-snapshot-v1',
    generated_at: new Date().toISOString(),
    lookup: {
      customer_id: lookup.customer_id || null,
      external_customer_id: lookup.external_customer_id || null,
      email: lookup.email || null,
      brand_id: lookup.brand_id || null,
      run_id: lookup.run_id || null
    },
    customer: customer
      ? {
          id: customer.id,
          external_customer_id: customer.external_customer_id || null,
          email: customer.email || null,
          plan_code: customer.plan_code || null,
          status: customer.status || 'unknown',
          created_at: customer.created_at || null,
          updated_at: customer.updated_at || null
        }
      : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name || plan.id,
          status: plan.status || 'active',
          live_provider_enabled: plan.live_provider_enabled === true,
          live_provider_status: plan.live_provider_status || null,
          daily_provider_call_limit: Number(plan.daily_provider_call_limit || 0),
          monthly_provider_call_limit: Number(plan.monthly_provider_call_limit || 0),
          monthly_provider_cost_limit_usd: Number(plan.monthly_provider_cost_limit_usd || 0)
        }
      : null,
    workspace: {
      connected: Boolean(brand?.id),
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            website_url: brand.website_url || null,
            vertical: brand.vertical || null,
            locale: brand.locale || null,
            created_at: brand.created_at || null,
            updated_at: brand.updated_at || null
          }
        : null,
      latest_tracking_run: tracking_run
        ? {
            id: tracking_run.id,
            status: tracking_run.status || 'unknown',
            run_type: tracking_run.run_type || null,
            provider_mode: tracking_run.provider_mode || null,
            region: tracking_run.region || null,
            language: tracking_run.language || null,
            created_at: tracking_run.created_at || null,
            started_at: tracking_run.started_at || null,
            finished_at: tracking_run.finished_at || null
          }
        : null
    },
    billing_auth,
    addons: addons || null,
    monitoring: compactMonitoringPayload(monitoring),
    monthly_fulfillment,
    phase4: buildPhase4Entitlement(phase4),
    phase5: {
      ...phase5Base,
      guest_surfaces: {
        gemini_ui: phase5?.gemini_guest_enabled ?? phase5Base.guest_surfaces.gemini_ui,
        grok_ui: phase5?.grok_guest_enabled ?? phase5Base.guest_surfaces.grok_ui,
        qwen_ui: phase5?.qwen_guest_enabled ?? phase5Base.guest_surfaces.qwen_ui
      },
      entitlement_source: phase5?.entitlement_source || 'plan'
    },
    operator_summary: {
      billing_status: billing_auth?.status || 'unknown',
      entitlement_state: billing_auth?.entitlement?.state || 'unknown',
      quota_status: billing_auth?.usage?.quota_status || 'unknown',
      live_monitoring_mode: monitoring?.fulfillment?.mode || 'not_configured',
      monthly_fulfillment_status: monthly_fulfillment?.summary
        ? monthly_fulfillment.summary.failed_count > 0
          ? 'failed_items'
          : monthly_fulfillment.summary.completed_count > 0
            ? 'in_progress_or_ready'
            : 'scheduled'
        : 'not_configured',
      next_operator_action:
        billing_auth?.next_operator_action ||
        (!brand?.id
          ? 'Customer exists but no AIVGL brand workspace is linked yet.'
          : 'No entitlement action required.')
    },
    guardrails: [
      'Read-only customer entitlement snapshot; does not mutate billing, quota, jobs, or provider configuration.',
      'Provider secrets and raw provider answers are intentionally excluded.',
      'Use POST customer-entitlements/customer-addons endpoints for explicit sync operations.'
    ]
  };
  return {
    ...snapshot,
    status: customerStatus(snapshot)
  };
}

async function resolveCustomer(input = {}) {
  const selectors = [
    ['customer_id', input.customer_id],
    ['external_customer_id', input.external_customer_id],
    ['email', input.email],
    ['brand_id', input.brand_id],
    ['run_id', input.run_id]
  ].filter(([, value]) => String(value || '').trim() !== '');
  if (!selectors.length) {
    const error = new Error('customer selector is required');
    error.code = 'customer_selector_required';
    throw error;
  }

  const [selector, value] = selectors[0];
  if (selector === 'customer_id') {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1 LIMIT 1', [value]);
    return result.rows[0] || null;
  }
  if (selector === 'external_customer_id') {
    const result = await pool.query('SELECT * FROM customers WHERE external_customer_id = $1 ORDER BY updated_at DESC LIMIT 1', [
      value
    ]);
    return result.rows[0] || null;
  }
  if (selector === 'email') {
    const result = await pool.query('SELECT * FROM customers WHERE LOWER(email) = LOWER($1) ORDER BY updated_at DESC LIMIT 1', [
      value
    ]);
    return result.rows[0] || null;
  }
  if (selector === 'brand_id') {
    const result = await pool.query(
      `SELECT c.*
       FROM customers c
       JOIN brands b ON b.customer_id = c.id
       WHERE b.id = $1
       LIMIT 1`,
      [value]
    );
    return result.rows[0] || null;
  }
  const result = await pool.query(
    `SELECT c.*
     FROM customers c
     JOIN brands b ON b.customer_id = c.id
     JOIN tracking_runs tr ON tr.brand_id = b.id
     WHERE tr.id = $1
     LIMIT 1`,
    [value]
  );
  return result.rows[0] || null;
}

async function latestBrand(customerId, brandId = '') {
  const values = [customerId];
  const brandPredicate = String(brandId || '').trim() ? 'AND id = $2' : '';
  if (brandPredicate) values.push(brandId);
  const result = await pool.query(
    `SELECT *
     FROM brands
     WHERE customer_id = $1
       ${brandPredicate}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function latestTrackingRun(brandId, runId = '') {
  if (!brandId) return null;
  const values = [brandId];
  const runPredicate = String(runId || '').trim() ? 'AND id = $2' : '';
  if (runPredicate) values.push(runId);
  const result = await pool.query(
    `SELECT *
     FROM tracking_runs
     WHERE brand_id = $1
       ${runPredicate}
     ORDER BY created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function currentUsage(customerId) {
  const result = await pool.query(
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
    [customerId]
  );
  return result.rows[0] || {};
}

export async function getCustomerEntitlementSnapshot(input = {}) {
  const customer = await resolveCustomer(input);
  if (!customer) return null;

  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1 LIMIT 1', [customer.plan_code]);
  const plan = planResult.rows[0] || null;
  const brand = await latestBrand(customer.id, input.brand_id);
  const trackingRun = await latestTrackingRun(brand?.id, input.run_id);
  const addons = await getCustomerAddonSummary({ customer_id: customer.id, cycle_month: input.cycle_month });
  const billingAuth = brand?.id
    ? await getBillingAuthEntitlementPayload({ brand_id: brand.id })
    : buildBillingAuthEntitlement({
        customer,
        brand: null,
        plan,
        usage: await currentUsage(customer.id),
        addons
      });
  const monthlyFulfillment = brand?.id
    ? await getCustomerMonthlyFulfillmentPayload({
        brand_id: brand.id,
        run_id: trackingRun?.id
      })
    : null;
  const monitoring = trackingRun?.id
    ? await getCustomerMonitoringPayload({
        run_id: trackingRun.id
      })
    : null;
  const phase4Result = await pool.query(
    `SELECT * FROM phase4_customer_entitlements WHERE customer_id=$1`,
    [customer.id]
  );
  const phase5Result = await pool.query(
    `SELECT * FROM phase5_customer_surface_entitlements WHERE customer_id=$1`,
    [customer.id]
  );

  return buildCustomerEntitlementSnapshot({
    lookup: {
      customer_id: input.customer_id || null,
      external_customer_id: input.external_customer_id || null,
      email: input.email || null,
      brand_id: input.brand_id || null,
      run_id: input.run_id || null,
      selector: firstNonEmpty(input.customer_id, input.external_customer_id, input.email, input.brand_id, input.run_id)
    },
    customer,
    plan,
    brand,
    tracking_run: trackingRun,
    billing_auth: billingAuth,
    addons,
    monthly_fulfillment: monthlyFulfillment,
    monitoring,
    phase4: phase4Result.rows[0] || null,
    phase5: phase5Result.rows[0] || null
  });
}

export async function cleanupSmokeCustomerEntitlement({ email = '' } = {}) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!/^smoke-onboarding-[^@\s]+@cowtech\.local$/.test(normalizedEmail)) {
    const error = new Error('cleanup requires a smoke-onboarding cowtech.local email');
    error.code = 'smoke_cleanup_selector_required';
    throw error;
  }

  const result = await pool.query(
    `DELETE FROM customers
     WHERE email = $1
     RETURNING id, email`,
    [normalizedEmail]
  );

  return {
    schema_version: 'customer-entitlement-smoke-cleanup-v1',
    email: normalizedEmail,
    customers_deleted: result.rowCount,
    deleted_customer_ids: result.rows.map((row) => row.id)
  };
}
