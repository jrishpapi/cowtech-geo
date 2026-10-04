import { pool } from './db.js';
import { cycleMonth } from './monthly-fulfillment.js';

const ADDONS = {
  credits_1000: { unit_type: 'credits', units: 1000 },
  article_extra: { unit_type: 'article', units: 1 },
  competitor_extra: { unit_type: 'competitor', units: 1 }
};

function normalizeAddon(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'extra_credits_1000') return 'credits_1000';
  if (normalized === 'extra_article') return 'article_extra';
  if (normalized === 'extra_competitor') return 'competitor_extra';
  return ADDONS[normalized] ? normalized : '';
}

function positiveInt(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeBillingStatus(value = '') {
  const normalized = String(value || 'active').trim().toLowerCase();
  if (normalized === 'paid') return 'active';
  if (['payment_failed', 'failed'].includes(normalized)) return 'past_due';
  if (normalized === 'suspended') return 'paused';
  if (['cancelled', 'expired'].includes(normalized)) return 'canceled';
  return ['active', 'trial', 'past_due', 'paused', 'canceled'].includes(normalized) ? normalized : 'active';
}

function allocationKey(input, billingPeriod, cycle) {
  const provider = String(input.payment_provider || 'paypal').trim().toLowerCase() || 'paypal';
  const subscriptionId = String(input.subscription_id || input.provider_subscription_id || '').trim();
  const transactionId = String(input.transaction_id || input.provider_transaction_id || '').trim();
  const orderId = String(input.order_id || input.provider_order_id || '').trim();
  if (billingPeriod === 'monthly' && subscriptionId) {
    return `${provider}:subscription:${subscriptionId}:${cycle}`;
  }
  if (transactionId) return `${provider}:transaction:${transactionId}`;
  if (orderId) return `${provider}:order:${orderId}`;
  if (subscriptionId) return `${provider}:subscription:${subscriptionId}:${cycle}`;

  const error = new Error('provider order, transaction, or subscription reference is required');
  error.code = 'customer_addon_provider_reference_required';
  throw error;
}

async function resolveCustomer({ external_customer_id, email }) {
  const predicates = [];
  const values = [];
  if (external_customer_id) {
    values.push(external_customer_id);
    predicates.push(`external_customer_id = $${values.length}`);
  }
  if (email) {
    values.push(String(email).trim().toLowerCase());
    predicates.push(`LOWER(email) = $${values.length}`);
  }
  if (!predicates.length) return null;
  const result = await pool.query(
    `SELECT id, external_customer_id, email, plan_code
     FROM customers
     WHERE ${predicates.join(' OR ')}
     ORDER BY updated_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function customerBrand(customerId) {
  const result = await pool.query(
    `SELECT b.id AS brand_id,
            b.name AS brand_name,
            tr.id AS tracking_run_id
     FROM brands b
     LEFT JOIN tracking_runs tr ON tr.brand_id = b.id
     WHERE b.customer_id = $1
     ORDER BY tr.created_at DESC NULLS LAST, b.created_at DESC
     LIMIT 1`,
    [customerId]
  );
  return result.rows[0] || null;
}

export async function applyCustomerAddon(input = {}) {
  const addonCode = normalizeAddon(input.addon_code || input.pkg);
  if (!addonCode) {
    const error = new Error('valid addon_code is required');
    error.code = 'invalid_addon_code';
    throw error;
  }

  const addon = ADDONS[addonCode];
  const customer = await resolveCustomer({
    external_customer_id: input.external_customer_id,
    email: input.email
  });
  if (!customer) {
    const error = new Error('customer addon target not found');
    error.code = 'customer_addon_target_not_found';
    throw error;
  }

  const units = positiveInt(input.units, addon.units);
  const billingStatus = normalizeBillingStatus(input.billing_status || input.status);
  const billingPeriod = String(input.billing_period || (addonCode === 'competitor_extra' ? 'monthly' : 'one_time')).trim().toLowerCase();
  const cycle = input.cycle_month || cycleMonth();
  const key = allocationKey(input, billingPeriod, cycle);
  const metadata = {
    payment_provider: input.payment_provider || 'paypal',
    provider_order_id: input.order_id || input.provider_order_id || null,
    provider_subscription_id: input.subscription_id || input.provider_subscription_id || null,
    provider_transaction_id: input.transaction_id || input.provider_transaction_id || null,
    billing_period: billingPeriod,
    source: input.source || 'paypal_addon_bridge'
  };

  const result = await pool.query(
    `INSERT INTO customer_addon_allocations (
       customer_id, addon_code, unit_type, units, billing_status, source, cycle_month, allocation_key, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (customer_id, addon_code, allocation_key)
     DO UPDATE SET
       unit_type = EXCLUDED.unit_type,
       units = EXCLUDED.units,
       billing_status = EXCLUDED.billing_status,
       source = EXCLUDED.source,
       cycle_month = EXCLUDED.cycle_month,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      customer.id,
      addonCode,
      addon.unit_type,
      units,
      billingStatus,
      metadata.source,
      cycle,
      key,
      JSON.stringify(metadata)
    ]
  );

  if (addonCode === 'article_extra') {
    const brand = await customerBrand(customer.id);
    if (brand?.brand_id && brand?.tracking_run_id) {
      const activeUnitsResult = await pool.query(
        `SELECT COALESCE(SUM(units), 0)::int AS units
         FROM customer_addon_allocations
         WHERE customer_id = $1
           AND addon_code = 'article_extra'
           AND cycle_month = $2
           AND billing_status IN ('active', 'trial')`,
        [customer.id, cycle]
      );
      const activeUnits = Number(activeUnitsResult.rows[0]?.units || 0);
      if (activeUnits > 0) {
        await pool.query(
          `INSERT INTO customer_monthly_fulfillment_items (
           brand_id, tracking_run_id, cycle_month, plan_code, item_type, item_label,
           quota_units, status, scheduled_for, job_type, job_payload
         )
         VALUES ($1, $2, $3, $4, 'article_drafts_addon', $5, $6, 'scheduled', NOW(), 'tracking.article_drafts', $7)
         ON CONFLICT (brand_id, cycle_month, item_type)
         DO UPDATE SET
           quota_units = EXCLUDED.quota_units,
           item_label = EXCLUDED.item_label,
           job_payload = EXCLUDED.job_payload,
           status = CASE
             WHEN customer_monthly_fulfillment_items.status IN ('blocked', 'failed', 'scheduled', 'pending_operator') THEN 'scheduled'
             ELSE customer_monthly_fulfillment_items.status
           END,
           last_error = CASE
             WHEN customer_monthly_fulfillment_items.status IN ('blocked', 'failed', 'scheduled', 'pending_operator') THEN NULL
             ELSE customer_monthly_fulfillment_items.last_error
           END,
           updated_at = NOW()`,
          [
            brand.brand_id,
            brand.tracking_run_id,
            cycle,
            customer.plan_code || 'starter',
            'Extra AIVGL-certified GEO article draft add-on',
            activeUnits,
            JSON.stringify({
              tracking_run_id: brand.tracking_run_id,
              source: 'customer_addon',
              article_quota: activeUnits
            })
          ]
        );
      } else {
        await pool.query(
          `UPDATE customer_monthly_fulfillment_items
           SET quota_units = 0,
               status = 'blocked',
               queued_at = NULL,
               last_error = 'addon_inactive',
               updated_at = NOW()
           WHERE brand_id = $1
             AND cycle_month = $2
             AND item_type = 'article_drafts_addon'
             AND status IN ('scheduled', 'queued', 'pending_operator', 'failed')`,
          [brand.brand_id, cycle]
        );
      }
    }
  }

  return {
    status: 'synced',
    allocation: result.rows[0],
    customer,
    effective_addons: await getCustomerAddonSummary({ customer_id: customer.id })
  };
}

export async function applyCustomerEntitlement(input = {}) {
  const customer = await resolveCustomer({
    external_customer_id: input.external_customer_id,
    email: input.email
  });
  if (!customer) {
    return { status: 'pending_first_run' };
  }

  const planCode = String(input.plan_code || input.plan || '').trim().toLowerCase();
  const status = normalizeBillingStatus(input.status || input.billing_status);
  const allowedPlans = new Set(['starter', 'pro', 'god']);

  if (!allowedPlans.has(planCode)) {
    return { status: 'not_aivgl_subscription_plan' };
  }

  const result = await pool.query(
    `UPDATE customers
     SET plan_code = $2,
         status = $3,
         live_provider_enabled = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, external_customer_id, email, plan_code, status, live_provider_enabled`,
    [
      customer.id,
      planCode,
      status === 'trial' ? 'trialing' : status,
      ['active', 'trial'].includes(status)
    ]
  );

  return {
    status: 'synced',
    customer: result.rows[0]
  };
}

export async function getCustomerAddonSummary({ customer_id, external_customer_id, email, cycle_month = cycleMonth() } = {}) {
  let customerId = customer_id;
  if (!customerId) {
    const customer = await resolveCustomer({ external_customer_id, email });
    customerId = customer?.id;
  }
  if (!customerId) return null;

  let result;
  try {
    result = await pool.query(
      `SELECT unit_type, addon_code, billing_status, COALESCE(SUM(units), 0)::int AS units
       FROM customer_addon_allocations
       WHERE customer_id = $1
         AND cycle_month = $2
         AND billing_status IN ('active', 'trial')
       GROUP BY unit_type, addon_code, billing_status
       ORDER BY addon_code ASC`,
      [customerId, cycle_month]
    );
  } catch (error) {
    if (error?.code !== '42P01') throw error;
    result = { rows: [] };
  }
  const totals = { credits: 0, article: 0, competitor: 0 };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(totals, row.unit_type)) {
      totals[row.unit_type] += Number(row.units || 0);
    }
  }
  return {
    schema_version: 'customer-addons-v1',
    customer_id: customerId,
    cycle_month,
    totals,
    items: result.rows
  };
}
