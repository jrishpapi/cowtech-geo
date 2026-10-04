import { getConfig } from './config.js';
import { createRedisClient } from './redis.js';
import {
  createAnomalySlaDigestGenerationJob,
  createHealthcheckJob,
  createReplaySlaAlertDigestGenerationJob,
  createReplaySlaAlertGenerationJob,
  enqueueJob
} from './jobs.js';
import { logger } from './logger.js';
import { scheduleTrackingRuns } from './scheduling.js';
import { schedulePhase1ShadowIntake } from './phase1-scheduling.js';
import { recordPhase1RuntimeHeartbeat } from './phase1-activation-health.js';

const config = getConfig();
let shouldStop = false;

process.on('SIGINT', () => {
  shouldStop = true;
});

process.on('SIGTERM', () => {
  shouldStop = true;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHASE1_SCHEDULER_HEARTBEAT_INTERVAL_MS = 30000;

async function writePhase1SchedulerHeartbeat(details = {}) {
  return recordPhase1RuntimeHeartbeat({
    component: 'scheduler',
    instanceId: `phase1-shadow-scheduler:${process.pid}`,
    details: {
      mode: 'phase1_shadow_intake',
      external_transport_allowed: false,
      ...details
    }
  });
}

/**
 * Preserve the configured scheduling cadence while refreshing liveness often
 * enough for the 120-second activation readiness window.  This avoids turning
 * a five-minute scheduler interval into a repeating readiness outage.
 */
export async function waitForNextSchedulerCycle({
  intervalMs,
  phase1ShadowMode,
  sleepFn = sleep,
  heartbeatFn = writePhase1SchedulerHeartbeat,
  shouldContinue = () => !shouldStop
} = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive integer');
  }
  let remainingMs = intervalMs;
  while (remainingMs > 0 && shouldContinue()) {
    const waitMs = phase1ShadowMode
      ? Math.min(PHASE1_SCHEDULER_HEARTBEAT_INTERVAL_MS, remainingMs)
      : remainingMs;
    await sleepFn(waitMs);
    remainingMs -= waitMs;
    if (phase1ShadowMode && shouldContinue()) {
      await heartbeatFn({ state: 'waiting', next_cycle_in_ms: remainingMs });
    }
  }
}

export async function runScheduler() {
  const redis = createRedisClient();

  try {
    if (!config.schedulerEnabled) {
      logger.warn('scheduler disabled');
      return;
    }

    logger.info({ intervalMs: config.schedulerIntervalMs }, 'scheduler started');
    while (!shouldStop) {
      if (config.schedulerJobMode === 'phase1_shadow_intake') {
        const result = await schedulePhase1ShadowIntake({
          redis: config.phase1RedisWakeupEnabled ? redis : null
        });
        await writePhase1SchedulerHeartbeat({
          state: result.status,
          scheduled_count: result.scheduled_count
        });
        logger.info(result, 'scheduled Phase 1 shadow intake');
      } else if (config.schedulerJobMode === 'tracking' || config.schedulerJobMode === 'recurring_monitoring') {
        const result = await scheduleTrackingRuns({
          redis,
          provider_mode: config.schedulerProviderMode,
          allow_paid_provider: config.schedulerAllowPaidProvider,
          recurring_only: config.schedulerJobMode === 'recurring_monitoring'
        });
        logger.info(result, 'scheduled tracking runs');
      } else if (config.schedulerJobMode === 'replay_sla_alerts' || config.schedulerReplaySlaAlertsEnabled) {
        const job = createReplaySlaAlertGenerationJob('scheduler');
        await enqueueJob(redis, job);
        logger.info({ jobId: job.id }, 'scheduled replay SLA alert generation');
        if (config.schedulerReplaySlaDigestsEnabled) {
          const digestJob = createReplaySlaAlertDigestGenerationJob('scheduler');
          await enqueueJob(redis, digestJob);
          logger.info({ jobId: digestJob.id }, 'scheduled replay SLA alert digest generation');
        }
        if (config.schedulerAnomalySlaDigestsEnabled) {
          const anomalyDigestJob = createAnomalySlaDigestGenerationJob('scheduler');
          await enqueueJob(redis, anomalyDigestJob);
          logger.info({ jobId: anomalyDigestJob.id }, 'scheduled anomaly SLA digest generation');
        }
      } else if (config.schedulerJobMode === 'replay_sla_digest' || config.schedulerReplaySlaDigestsEnabled) {
        const job = createReplaySlaAlertDigestGenerationJob('scheduler');
        await enqueueJob(redis, job);
        logger.info({ jobId: job.id }, 'scheduled replay SLA alert digest generation');
      } else if (config.schedulerJobMode === 'anomaly_sla_digest' || config.schedulerAnomalySlaDigestsEnabled) {
        const job = createAnomalySlaDigestGenerationJob('scheduler');
        await enqueueJob(redis, job);
        logger.info({ jobId: job.id }, 'scheduled anomaly SLA digest generation');
      } else {
        const job = createHealthcheckJob('scheduler');
        await enqueueJob(redis, job);
        logger.info({ jobId: job.id }, 'scheduled healthcheck job');
      }
      await waitForNextSchedulerCycle({
        intervalMs: config.schedulerIntervalMs,
        phase1ShadowMode: config.schedulerJobMode === 'phase1_shadow_intake'
      });
    }
  } finally {
    await redis.quit();
    logger.info('scheduler stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScheduler().catch((error) => {
    logger.error({ error }, 'scheduler failed');
    process.exit(1);
  });
}
