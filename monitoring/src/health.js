import { pingDb, pool } from './db.js';
import { pingRedis } from './redis.js';
import { collectPhase1ActivationHealth } from './phase1-activation-health.js';

export async function collectHealth(redis) {
  const checks = {
    service: 'ok',
    database: 'unknown',
    redis: 'unknown',
    phase1_activation: 'unknown',
    customer_delivery: 'unknown'
  };
  let phase1Activation = null;

  try {
    await pingDb();
    checks.database = 'ok';
  } catch (error) {
    checks.database = `error:${error.code || error.message}`;
  }

  try {
    const pong = await pingRedis(redis);
    checks.redis = pong === 'PONG' ? 'ok' : `unexpected:${pong}`;
  } catch (error) {
    checks.redis = `error:${error.code || error.message}`;
  }

  if (checks.database === 'ok') {
    try {
      phase1Activation = await collectPhase1ActivationHealth();
      checks.phase1_activation = phase1Activation.ok ? 'ok' : `blocked:${phase1Activation.reasons.join(',')}`;
    } catch (error) {
      checks.phase1_activation = `error:${error.code || error.message}`;
    }
    try {
      const delivery = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int
              FROM tracking_runs tr
             WHERE tr.status IN ('queued', 'running')
               AND tr.created_at < NOW() - INTERVAL '2 hours') AS stale_run_count,
           (SELECT COUNT(*)::int
              FROM brand_monitoring_surface_configs bmsc
              JOIN tracking_runs latest ON latest.id = bmsc.last_scheduled_run_id
             WHERE bmsc.status = 'active'
               AND (
                 latest.status IN ('failed', 'partial_failed')
                 OR EXISTS (
                   SELECT 1 FROM prompt_results failed_result
                    WHERE failed_result.tracking_run_id = latest.id
                      AND failed_result.status = 'failed'
                 )
               )) AS degraded_surface_count`
      );
      const deliveryRow = delivery.rows[0] || {};
      const staleRunCount = Number(deliveryRow.stale_run_count || 0);
      const degradedSurfaceCount = Number(deliveryRow.degraded_surface_count || 0);
      checks.customer_delivery = staleRunCount === 0 && degradedSurfaceCount === 0
        ? 'ok'
        : `blocked:stale_runs=${staleRunCount},degraded_surfaces=${degradedSurfaceCount}`;
    } catch (error) {
      checks.customer_delivery = `error:${error.code || error.message}`;
    }
  } else {
    checks.phase1_activation = 'blocked:database_unavailable';
    checks.customer_delivery = 'blocked:database_unavailable';
  }

  const ok = Object.values(checks).every((value) => value === 'ok');

  return {
    ok,
    checks,
    phase1_activation: phase1Activation,
    timestamp: new Date().toISOString()
  };
}
