import { pool } from './db.js';
import { enqueueJob } from './jobs.js';
import { createTrackingRun } from './tracking.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import { scheduleDueRecurringMonitoringRuns } from './recurring-monitoring.js';
import { reconcileArticleFulfillmentReadiness, scheduleDueMonthlyFulfillmentItems } from './monthly-fulfillment.js';

export async function getSchedulableBrands({ database = pool } = {}) {
  const result = await database.query(
    `SELECT b.id, b.name, c.plan_code
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE c.status = 'active'
       AND c.tenant_class = 'customer'
     ORDER BY b.name`
  );
  return result.rows;
}

export function shouldStopAfterRecurringMonitoring({ recurringOnly = false, recurring = {} } = {}) {
  return recurringOnly || Boolean(recurring.scheduled?.length || recurring.skipped?.length);
}

export async function recoverStaleTrackingRuns({ database = pool, staleAfterMinutes = 120 } = {}) {
  const timeoutMinutes = Math.max(5, Math.min(1440, Math.round(Number(staleAfterMinutes) || 120)));
  const result = await database.query(
    `UPDATE tracking_runs
     SET status = 'failed',
         finished_at = COALESCE(finished_at, NOW()),
         run_payload = COALESCE(run_payload, '{}'::jsonb) || jsonb_build_object(
           'recovery_reason', 'tracking_run_timeout',
           'recovered_at', NOW(),
           'previous_status', status
         )
     WHERE status IN ('queued', 'running')
       AND created_at < NOW() - ($1::int * INTERVAL '1 minute')
     RETURNING id, brand_id, status, finished_at`,
    [timeoutMinutes]
  );
  return { recovered_count: result.rowCount, runs: result.rows };
}

export async function scheduleTrackingRuns({
  redis,
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  recurring_only = false
}) {
  assertPaidProviderAllowed({ provider_mode, allow_paid_provider });
  const stale_recovery = await recoverStaleTrackingRuns();
  const fulfillment_reconciliation = await reconcileArticleFulfillmentReadiness();
  const recurring = await scheduleDueRecurringMonitoringRuns({ redis });
  const monthly_fulfillment = await scheduleDueMonthlyFulfillmentItems({ redis });
  if (shouldStopAfterRecurringMonitoring({ recurringOnly: recurring_only, recurring })) {
    return {
      mode: 'recurring_monitoring',
      ...recurring,
      stale_recovery,
      fulfillment_reconciliation,
      monthly_fulfillment
    };
  }

  const brands = await getSchedulableBrands();
  const scheduled = [];
  const skipped = [];

  for (const brand of brands) {
    const run = await createTrackingRun({
      brand_id: brand.id,
      run_type: 'scheduled'
    });

    if (!run.was_created) {
      skipped.push({
        brand_id: brand.id,
        brand_name: brand.name,
        tracking_run_id: run.id,
        reason: 'duplicate_scheduled_run'
      });
      continue;
    }

    const job = {
      id: run.id,
      type: 'tracking.run',
      tracking_run_id: run.id,
      provider_mode,
      allow_paid_provider,
      created_at: new Date().toISOString()
    };
    await enqueueJob(redis, job);
    scheduled.push({
      brand_id: brand.id,
      brand_name: brand.name,
      tracking_run_id: run.id,
      job
    });
  }

  return {
    stale_recovery,
    fulfillment_reconciliation,
    monthly_fulfillment,
    scheduled,
    skipped,
    total_brands: brands.length
  };
}
