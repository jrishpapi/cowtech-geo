import { pool } from './db.js';
import { enqueueJob } from './jobs.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

const PLAN_CODES = new Set(['starter', 'pro', 'god']);
const GOD_REPORT_TYPES = new Set(['competitor_deep_report', 'strategy_memo']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function cycleMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function normalizePlanCode(value) {
  const plan = String(value || 'starter').trim().toLowerCase();
  return PLAN_CODES.has(plan) ? plan : 'starter';
}

function toPositiveInt(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.round(number);
}

function jobPayload(type, trackingRunId, extra = {}) {
  return {
    tracking_run_id: trackingRunId,
    source: 'monthly_fulfillment',
    ...extra
  };
}

export function buildMonthlyFulfillmentItems({
  plan_code = 'starter',
  plan_contract = {},
  tracking_run_id,
  scheduled_for = new Date().toISOString()
}) {
  const planCode = normalizePlanCode(plan_code);
  const articleQuota = toPositiveInt(plan_contract.article_quota, planCode === 'god' ? 8 : planCode === 'pro' ? 4 : 2);
  const items = [
    {
      item_type: 'article_drafts',
      item_label: `${articleQuota} AIVGL-certified GEO article draft${articleQuota === 1 ? '' : 's'}`,
      quota_units: articleQuota,
      status: 'scheduled',
      scheduled_for,
      job_type: 'tracking.article_drafts',
      job_payload: jobPayload('article_drafts', tracking_run_id, { article_quota: articleQuota })
    }
  ];

  if (planCode === 'pro' || planCode === 'god') {
    items.push(
      {
        item_type: 'monthly_growth_brief',
        item_label: 'Monthly GEO Growth Brief',
        quota_units: 1,
        status: 'scheduled',
        scheduled_for,
        job_type: 'tracking.monthly_report',
        job_payload: jobPayload('monthly_growth_brief', tracking_run_id)
      },
      {
        item_type: 'priority_retest',
        item_label: 'Priority post-publish retest queue',
        quota_units: 1,
        status: 'scheduled',
        scheduled_for,
        job_type: 'tracking.article_retests',
        job_payload: jobPayload('priority_retest', tracking_run_id)
      }
    );
  }

  if (planCode === 'god') {
    items.push(
      {
        item_type: 'competitor_deep_report',
        item_label: 'Monthly competitor deep report',
        quota_units: 1,
        status: 'scheduled',
        scheduled_for,
        job_type: 'tracking.competitor_deep_report',
        job_payload: jobPayload('competitor_deep_report', tracking_run_id)
      },
      {
        item_type: 'strategy_memo',
        item_label: 'GEO strategy memo',
        quota_units: 1,
        status: 'scheduled',
        scheduled_for,
        job_type: 'tracking.strategy_memo',
        job_payload: jobPayload('strategy_memo', tracking_run_id)
      }
    );
  }

  return items;
}

function normalizeRow(row) {
  return {
    ...row,
    quota_units: Number(row.quota_units || 0),
    job_payload: row.job_payload || {},
    result_payload: row.result_payload || {}
  };
}

export function sanitizeCustomerResultPayload(value) {
  if (Array.isArray(value)) return value.map(sanitizeCustomerResultPayload);
  if (!value || typeof value !== 'object') return value;

  const safe = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    const isExposureFlag = normalized.endsWith('_exposed');
    const forbidden =
      !isExposureFlag &&
      (normalized === 'raw_answer' ||
        normalized === 'raw_provider_payload' ||
        normalized === 'provider_payload' ||
        normalized === 'cost_estimate_usd' ||
        normalized === 'job_payload' ||
        normalized === 'last_error' ||
        normalized.includes('api_key') ||
        normalized.includes('secret') ||
        normalized === 'token' ||
        normalized.endsWith('_token') ||
        normalized.includes('access_token') ||
        normalized.includes('debug'));
    if (forbidden) continue;
    safe[key] = sanitizeCustomerResultPayload(child);
  }
  return safe;
}

function customerSafeRow(row) {
  return {
    id: row.id,
    cycle_month: row.cycle_month,
    plan_code: normalizePlanCode(row.plan_code),
    item_type: row.item_type,
    item_label: row.item_label,
    quota_units: Number(row.quota_units || 0),
    status: row.status,
    scheduled_for: row.scheduled_for,
    queued_at: row.queued_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    result_payload: sanitizeCustomerResultPayload(row.result_payload || {})
  };
}

function summaryFromItems(items) {
  const byStatus = items.reduce((memo, item) => {
    memo[item.status] = (memo[item.status] || 0) + 1;
    return memo;
  }, {});
  return {
    schema_version: 'monthly-fulfillment-summary-v1',
    item_count: items.length,
    scheduled_count: byStatus.scheduled || 0,
    queued_count: byStatus.queued || 0,
    generating_count: byStatus.generating || 0,
    completed_count: byStatus.completed || 0,
    blocked_count: byStatus.blocked || 0,
    pending_operator_count: byStatus.pending_operator || 0,
    failed_count: byStatus.failed || 0
  };
}

export async function assertCustomerMonthlyFulfillmentJobAllowed(job, { database = pool } = {}) {
  const itemId = String(job?.monthly_fulfillment_item_id || '');
  const trackingRunId = String(job?.tracking_run_id || '');
  const jobType = String(job?.type || '');
  if (!UUID_PATTERN.test(itemId) || !UUID_PATTERN.test(trackingRunId) || !jobType.startsWith('tracking.')) {
    const error = new Error('monthly fulfillment item not found');
    error.code = 'monthly_fulfillment_item_not_found';
    throw error;
  }

  const result = await database.query(
    `SELECT 1
     FROM customer_monthly_fulfillment_items AS item
     JOIN brands AS brand ON brand.id = item.brand_id
     JOIN customers AS customer ON customer.id = brand.customer_id
     JOIN tracking_runs AS tracking_run
       ON tracking_run.id = item.tracking_run_id
      AND tracking_run.brand_id = item.brand_id
     WHERE item.id = $1
       AND item.tracking_run_id = $2
       AND item.job_type = $3
       AND item.status = 'queued'
       AND customer.tenant_class = 'customer'
       AND customer.status IN ('active', 'trialing', 'comped')
     LIMIT 1`,
    [itemId, trackingRunId, jobType]
  );
  if (result.rowCount !== 1) {
    const error = new Error('monthly fulfillment item not found');
    error.code = 'monthly_fulfillment_item_not_found';
    throw error;
  }
  return true;
}

export async function markMonthlyFulfillmentItemGenerating(itemId) {
  if (!itemId) return null;
  const result = await pool.query(
    `UPDATE customer_monthly_fulfillment_items
     SET status = 'generating',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [itemId]
  );
  return result.rows[0] ? normalizeRow(result.rows[0]) : null;
}

export async function markMonthlyFulfillmentItemCompleted(itemId, resultPayload = {}) {
  if (!itemId) return null;
  const result = await pool.query(
    `UPDATE customer_monthly_fulfillment_items
     SET status = 'completed',
         completed_at = NOW(),
         result_payload = $2,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [itemId, JSON.stringify(resultPayload)]
  );
  return result.rows[0] ? normalizeRow(result.rows[0]) : null;
}

export async function markMonthlyFulfillmentItemPendingOperator(itemId, resultPayload = {}) {
  if (!itemId) return null;
  const result = await pool.query(
    `UPDATE customer_monthly_fulfillment_items
     SET status = 'pending_operator',
         completed_at = NULL,
         result_payload = $2,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [itemId, JSON.stringify(resultPayload)]
  );
  return result.rows[0] ? normalizeRow(result.rows[0]) : null;
}

export async function reconcileArticleFulfillmentReadiness({ database = pool } = {}) {
  const result = await database.query(
    `WITH readiness AS (
       SELECT item.id,
              item.quota_units,
              COUNT(DISTINCT production.article_draft_id) FILTER (
                WHERE production.status IN ('ready_for_external_production', 'submitted_to_geoflow', 'production_completed')
              )::int AS production_handoff_count,
              COUNT(DISTINCT review.article_draft_id) FILTER (WHERE review.status = 'approved_for_export')::int AS approved_count,
              COUNT(DISTINCT package.article_export_id) FILTER (WHERE package.status = 'ready_for_dashboard')::int AS packaged_count,
              COUNT(DISTINCT publish.id)::int AS publish_handoff_count,
              COUNT(DISTINCT retest.id)::int AS retest_schedule_count,
              COUNT(DISTINCT report.id)::int AS retest_report_count
       FROM customer_monthly_fulfillment_items item
       JOIN brands brand ON brand.id = item.brand_id
       JOIN customers customer ON customer.id = brand.customer_id
       LEFT JOIN article_quality_reviews review ON review.tracking_run_id = item.tracking_run_id
       LEFT JOIN article_production_handoffs production ON production.tracking_run_id = item.tracking_run_id
       LEFT JOIN article_exports export ON export.tracking_run_id = item.tracking_run_id
       LEFT JOIN article_export_packages package ON package.article_export_id = export.id
       LEFT JOIN article_publish_handoffs publish ON publish.tracking_run_id = item.tracking_run_id
       LEFT JOIN article_retest_schedules retest ON retest.tracking_run_id = item.tracking_run_id
       LEFT JOIN article_retest_reports report ON report.tracking_run_id = item.tracking_run_id
       WHERE item.item_type = 'article_drafts'
         AND item.status IN ('completed', 'generating', 'pending_operator', 'failed')
         AND customer.tenant_class = 'customer'
       GROUP BY item.id
     )
     UPDATE customer_monthly_fulfillment_items item
     SET status = CASE
           WHEN LEAST(readiness.approved_count, readiness.packaged_count) >= readiness.quota_units THEN 'completed'
           ELSE 'pending_operator'
         END,
         completed_at = CASE
           WHEN LEAST(readiness.approved_count, readiness.packaged_count) >= readiness.quota_units
             THEN COALESCE(item.completed_at, NOW())
           ELSE NULL
         END,
         result_payload = COALESCE(item.result_payload, '{}'::jsonb) || jsonb_build_object(
           'delivery_readiness', jsonb_build_object(
             'required_count', readiness.quota_units,
             'production_handoff_count', readiness.production_handoff_count,
             'approved_count', readiness.approved_count,
             'packaged_count', readiness.packaged_count,
             'publish_handoff_count', readiness.publish_handoff_count,
             'retest_schedule_count', readiness.retest_schedule_count,
             'retest_report_count', readiness.retest_report_count,
             'status', CASE
               WHEN LEAST(readiness.approved_count, readiness.packaged_count) >= readiness.quota_units
                 THEN 'ready_for_dashboard'
               ELSE 'review_required'
             END
           )
         ),
         updated_at = NOW()
     FROM readiness
     WHERE item.id = readiness.id
     RETURNING item.id, item.status, item.quota_units, item.completed_at, item.result_payload`
  );
  return { reconciled_count: result.rowCount, items: result.rows.map(normalizeRow) };
}

export async function markMonthlyFulfillmentItemFailed(itemId, error) {
  if (!itemId) return null;
  const result = await pool.query(
    `UPDATE customer_monthly_fulfillment_items
     SET status = 'failed',
         last_error = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [itemId, String(error?.message || error || 'monthly fulfillment job failed').slice(0, 1000)]
  );
  return result.rows[0] ? normalizeRow(result.rows[0]) : null;
}

async function resolveBrand({ run_id, brand_id, brand_name }) {
  const params = [];
  const predicates = [customerVisibleTenantPredicate('c')];
  if (run_id) {
    params.push(run_id);
    predicates.push(`tr.id = $${params.length}`);
  }
  if (brand_id) {
    params.push(brand_id);
    predicates.push(`b.id = $${params.length}`);
  }
  if (brand_name) {
    params.push(brand_name);
    predicates.push(`LOWER(b.name) = LOWER($${params.length})`);
  }
  if (!run_id && !brand_id && !brand_name) return null;

  const result = await pool.query(
    `SELECT b.id AS brand_id,
            b.name AS brand_name,
            c.plan_code,
            tr.id AS tracking_run_id
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN tracking_runs tr ON tr.brand_id = b.id
     WHERE ${predicates.join(' AND ')}
     ORDER BY tr.created_at DESC NULLS LAST
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

export async function configureMonthlyFulfillment({
  run_id,
  brand_id,
  brand_name,
  plan_code,
  plan_contract = {},
  scheduled_for = new Date().toISOString(),
  cycle_month = cycleMonth(new Date(scheduled_for))
}) {
  const brand = await resolveBrand({ run_id, brand_id, brand_name });
  if (!brand) {
    const error = new Error('monthly fulfillment brand not found');
    error.code = 'monthly_fulfillment_brand_not_found';
    throw error;
  }

  const trackingRunId = run_id || brand.tracking_run_id;
  if (!trackingRunId) {
    const error = new Error('monthly fulfillment tracking run not found');
    error.code = 'monthly_fulfillment_tracking_run_not_found';
    throw error;
  }

  const planCode = normalizePlanCode(plan_code || brand.plan_code);
  const planned = buildMonthlyFulfillmentItems({
    plan_code: planCode,
    plan_contract,
    tracking_run_id: trackingRunId,
    scheduled_for
  });

  const saved = [];
  for (const item of planned) {
    const result = await pool.query(
      `INSERT INTO customer_monthly_fulfillment_items (
         brand_id,
         tracking_run_id,
         cycle_month,
         plan_code,
         item_type,
         item_label,
         quota_units,
         status,
         scheduled_for,
         job_type,
         job_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (brand_id, cycle_month, item_type)
       DO UPDATE SET
         tracking_run_id = EXCLUDED.tracking_run_id,
         plan_code = EXCLUDED.plan_code,
         item_label = EXCLUDED.item_label,
         quota_units = EXCLUDED.quota_units,
         status = CASE
           WHEN customer_monthly_fulfillment_items.tracking_run_id IS DISTINCT FROM EXCLUDED.tracking_run_id
             THEN EXCLUDED.status
           WHEN customer_monthly_fulfillment_items.status IN ('scheduled', 'pending_operator')
             THEN EXCLUDED.status
           ELSE customer_monthly_fulfillment_items.status
         END,
         scheduled_for = EXCLUDED.scheduled_for,
         job_type = EXCLUDED.job_type,
         job_payload = EXCLUDED.job_payload,
         result_payload = CASE
           WHEN customer_monthly_fulfillment_items.tracking_run_id IS DISTINCT FROM EXCLUDED.tracking_run_id
             THEN '{}'::jsonb
           ELSE customer_monthly_fulfillment_items.result_payload
         END,
         queued_at = CASE
           WHEN customer_monthly_fulfillment_items.tracking_run_id IS DISTINCT FROM EXCLUDED.tracking_run_id
             THEN NULL
           ELSE customer_monthly_fulfillment_items.queued_at
         END,
         completed_at = CASE
           WHEN customer_monthly_fulfillment_items.tracking_run_id IS DISTINCT FROM EXCLUDED.tracking_run_id
             THEN NULL
           ELSE customer_monthly_fulfillment_items.completed_at
         END,
         last_error = CASE
           WHEN customer_monthly_fulfillment_items.tracking_run_id IS DISTINCT FROM EXCLUDED.tracking_run_id
             THEN NULL
           ELSE customer_monthly_fulfillment_items.last_error
         END,
         updated_at = NOW()
       RETURNING *`,
      [
        brand.brand_id,
        trackingRunId,
        cycle_month,
        planCode,
        item.item_type,
        item.item_label,
        item.quota_units,
        item.status,
        item.scheduled_for,
        item.job_type,
        JSON.stringify(item.job_payload)
      ]
    );
    saved.push(normalizeRow(result.rows[0]));
  }

  return {
    schema_version: 'monthly-fulfillment-config-v1',
    brand: {
      id: brand.brand_id,
      name: brand.brand_name,
      plan_code: planCode
    },
    tracking_run_id: trackingRunId,
    cycle_month,
    summary: summaryFromItems(saved),
    items: saved
  };
}

export async function getCustomerMonthlyFulfillmentPayload({ run_id, brand_id, brand_name }) {
  const brand = await resolveBrand({ run_id, brand_id, brand_name });
  if (!brand) return null;
  const trackingRunId = run_id || brand.tracking_run_id;

  const result = await pool.query(
    `WITH latest_cycle AS (
       SELECT MAX(cycle_month) AS cycle_month
       FROM customer_monthly_fulfillment_items
       WHERE brand_id = $1
         AND ($2::uuid IS NULL OR tracking_run_id = $2::uuid)
     )
     SELECT item.*
     FROM customer_monthly_fulfillment_items item
     JOIN latest_cycle latest ON latest.cycle_month = item.cycle_month
     WHERE item.brand_id = $1
       AND ($2::uuid IS NULL OR item.tracking_run_id = $2::uuid)
     ORDER BY item.created_at ASC`,
    [brand.brand_id, trackingRunId || null]
  );
  const items = result.rows.map(customerSafeRow);

  return {
    schema_version: 'monthly-fulfillment-payload-v2',
    brand: {
      id: brand.brand_id,
      name: brand.brand_name,
      plan_code: normalizePlanCode(brand.plan_code)
    },
    tracking_run_id: trackingRunId,
    cycle_month: items[0]?.cycle_month || cycleMonth(),
    summary: summaryFromItems(items),
    items
  };
}

export async function getCustomerGodReportItem({ item_id: itemId, tracking_run_id: trackingRunId } = {}) {
  if (!UUID_PATTERN.test(String(itemId || '')) || !UUID_PATTERN.test(String(trackingRunId || ''))) return null;

  const result = await pool.query(
    `SELECT item.*
     FROM customer_monthly_fulfillment_items item
     JOIN brands b ON b.id = item.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE item.id = $1
       AND item.tracking_run_id = $2
       AND item.plan_code = 'god'
       AND item.item_type = ANY($3::text[])
       AND item.status = 'completed'
       AND ${customerVisibleTenantPredicate('c')}
     LIMIT 1`,
    [itemId, trackingRunId, [...GOD_REPORT_TYPES]]
  );
  const row = result.rows[0];
  if (!row || row.result_payload?.deliverable_type !== row.item_type) return null;
  return customerSafeRow(row);
}

export async function scheduleDueMonthlyFulfillmentItems({ redis, limit = 25, now = new Date(), database = pool }) {
  const result = await database.query(
    `SELECT item.*
     FROM customer_monthly_fulfillment_items AS item
     JOIN brands AS brand ON brand.id = item.brand_id
     JOIN customers AS customer ON customer.id = brand.customer_id
     JOIN tracking_runs AS tracking_run
       ON tracking_run.id = item.tracking_run_id
      AND tracking_run.brand_id = item.brand_id
     WHERE item.status = 'scheduled'
       AND customer.tenant_class = 'customer'
       AND customer.status IN ('active', 'trialing', 'comped')
       AND item.job_type IS NOT NULL
       AND item.scheduled_for <= $1
     ORDER BY item.scheduled_for ASC, item.created_at ASC
     LIMIT $2`,
    [now.toISOString(), limit]
  );

  const queued = [];
  for (const row of result.rows) {
    const job = {
      ...(row.job_payload || {}),
      id: row.id,
      type: row.job_type,
      tracking_run_id: row.tracking_run_id,
      monthly_fulfillment_item_id: row.id,
      source: 'monthly_fulfillment',
      created_at: new Date().toISOString()
    };
    const update = await database.query(
      `UPDATE customer_monthly_fulfillment_items AS item
       SET status = 'queued',
           queued_at = NOW(),
           job_payload = $2,
           updated_at = NOW()
       FROM brands AS brand,
            customers AS customer,
            tracking_runs AS tracking_run
       WHERE item.id = $1
         AND item.status = 'scheduled'
         AND item.scheduled_for <= $3
         AND item.job_type = $4
         AND item.tracking_run_id = $5
         AND brand.id = item.brand_id
         AND customer.id = brand.customer_id
         AND customer.tenant_class = 'customer'
         AND customer.status IN ('active', 'trialing', 'comped')
         AND tracking_run.id = item.tracking_run_id
         AND tracking_run.brand_id = item.brand_id
       RETURNING item.*`,
      [row.id, JSON.stringify(job), now.toISOString(), row.job_type, row.tracking_run_id]
    );
    if (update.rowCount !== 1) continue;

    try {
      await enqueueJob(redis, job);
    } catch (error) {
      await database.query(
        `UPDATE customer_monthly_fulfillment_items
         SET status = 'scheduled',
             queued_at = NULL,
             updated_at = NOW()
         WHERE id = $1
           AND status = 'queued'
           AND job_payload->>'id' = $2`,
        [row.id, job.id]
      );
      throw error;
    }
    queued.push({ item: normalizeRow(update.rows[0]), job });
  }

  return {
    mode: 'monthly_fulfillment',
    queued,
    queued_count: queued.length,
    checked_count: result.rows.length
  };
}
