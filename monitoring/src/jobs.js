import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';

export function createHealthcheckJob(source = 'manual') {
  return {
    id: randomUUID(),
    type: 'healthcheck',
    source,
    created_at: new Date().toISOString()
  };
}

export function createReplaySlaAlertGenerationJob(source = 'scheduler') {
  return {
    id: randomUUID(),
    type: 'ops.replay_sla_alerts.generate',
    source,
    created_at: new Date().toISOString()
  };
}

export function createReplaySlaAlertDigestGenerationJob(source = 'scheduler') {
  return {
    id: randomUUID(),
    type: 'ops.replay_sla_alert_digest.generate',
    source,
    created_at: new Date().toISOString()
  };
}

export function createAnomalySlaDigestGenerationJob(source = 'scheduler') {
  return {
    id: randomUUID(),
    type: 'ops.anomaly_sla_digest.generate',
    source,
    created_at: new Date().toISOString()
  };
}

export async function enqueueJob(redis, job) {
  const config = getConfig();
  await redis.rpush(config.jobQueueKey, JSON.stringify(job));
  return job;
}

export async function readJob(redis, timeoutSeconds = 5) {
  const config = getConfig();
  const result = await redis.blpop(config.jobQueueKey, timeoutSeconds);
  if (!result) return null;
  const [, rawJob] = result;
  return JSON.parse(rawJob);
}
