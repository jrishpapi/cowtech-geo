import { randomUUID } from 'node:crypto';
import { withTransaction } from './db-transaction.js';
import { recordPhase1RuntimeHeartbeat } from './phase1-activation-health.js';

export const DEFAULT_DOWNSTREAM_LEASE_SECONDS = 60;
export const DEFAULT_DOWNSTREAM_RETRY_DELAY_SECONDS = 30;
export const PHASE1_DOWNSTREAM_STAGES = Object.freeze(['parse', 'score', 'plan', 'alerts']);

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

function objectJson(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return JSON.stringify(value);
}

export async function enqueuePhase1DownstreamCompletion({
  trackingRunId,
  generationNo,
  terminalStatus,
  counts,
  stage = 'post_observation_pipeline'
} = {}, transaction = {}) {
  const runId = requireText(trackingRunId, 'trackingRunId');
  const generation = positiveInteger(Number(generationNo), 'generationNo');
  const status = requireText(terminalStatus, 'terminalStatus');
  const downstreamStage = requireText(stage, 'stage');
  const payload = {
    tracking_run_id: runId,
    observation_generation: generation,
    terminal_status: status,
    counts: counts || {}
  };

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `INSERT INTO phase1_downstream_outbox (
         tracking_run_id, generation_no, stage, status, payload
       ) VALUES ($1, $2, $3, 'queued', $4::jsonb)
       ON CONFLICT (tracking_run_id, generation_no, stage) DO UPDATE
         SET updated_at = phase1_downstream_outbox.updated_at
       WHERE phase1_downstream_outbox.payload = EXCLUDED.payload
       RETURNING *`,
      [runId, generation, downstreamStage, JSON.stringify(payload)]
    );
    if (!result.rows[0]) {
      throw new Error('downstream outbox identity already exists with a different immutable payload');
    }
    return result.rows[0];
  });
}

export async function claimPhase1DownstreamWork({
  workerId,
  leaseSeconds = DEFAULT_DOWNSTREAM_LEASE_SECONDS
} = {}, transaction = {}) {
  const worker = requireText(workerId, 'workerId');
  positiveInteger(leaseSeconds, 'leaseSeconds', 86400);

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `WITH candidate AS (
         SELECT id
           FROM phase1_downstream_outbox
          WHERE status IN ('queued', 'retry_wait')
            AND next_attempt_at <= NOW()
            AND attempt_count < max_attempts
          ORDER BY next_attempt_at, created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE phase1_downstream_outbox AS work
          SET status = 'leased',
              lease_owner = $1,
              lease_token = gen_random_uuid(),
              lease_fencing_token = work.lease_fencing_token + 1,
              lease_until = clock_timestamp() + ($2::integer * INTERVAL '1 second'),
              heartbeat_at = clock_timestamp(),
              attempt_count = work.attempt_count + 1,
              updated_at = NOW()
         FROM candidate
        WHERE work.id = candidate.id
       RETURNING work.*`,
      [worker, leaseSeconds]
    );
    return result.rows[0] || null;
  });
}

export async function heartbeatPhase1DownstreamWork({
  outboxId,
  leaseToken,
  fencingToken,
  workerId,
  leaseSeconds = DEFAULT_DOWNSTREAM_LEASE_SECONDS
} = {}, transaction = {}) {
  const id = requireText(outboxId, 'outboxId');
  const token = requireText(leaseToken, 'leaseToken');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  const worker = requireText(workerId, 'workerId');
  positiveInteger(leaseSeconds, 'leaseSeconds', 86400);

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `UPDATE phase1_downstream_outbox
          SET lease_until = clock_timestamp() + ($5::integer * INTERVAL '1 second'),
              heartbeat_at = clock_timestamp(),
              updated_at = NOW()
        WHERE id = $1
          AND status = 'leased'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
        RETURNING *`,
      [id, token, fence, worker, leaseSeconds]
    );
    if (!result.rows[0]) throw new Error('downstream outbox lease is missing, expired, or fenced');
    return result.rows[0];
  });
}

export async function completePhase1DownstreamWork({
  outboxId,
  leaseToken,
  fencingToken,
  workerId
} = {}, transaction = {}) {
  const id = requireText(outboxId, 'outboxId');
  const token = requireText(leaseToken, 'leaseToken');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  const worker = requireText(workerId, 'workerId');

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `UPDATE phase1_downstream_outbox
          SET status = 'completed',
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              heartbeat_at = NULL,
              completed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
          AND status = 'leased'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
        RETURNING *`,
      [id, token, fence, worker]
    );
    if (!result.rows[0]) throw new Error('downstream outbox lease is missing, expired, or fenced');
    return result.rows[0];
  });
}

export async function checkpointPhase1DownstreamStage({
  outboxId,
  leaseToken,
  fencingToken,
  workerId,
  stage,
  expectedCompletedStages,
  result
} = {}, transaction = {}) {
  const id = requireText(outboxId, 'outboxId');
  const token = requireText(leaseToken, 'leaseToken');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  const worker = requireText(workerId, 'workerId');
  const stageName = requireText(stage, 'stage');
  if (!PHASE1_DOWNSTREAM_STAGES.includes(stageName)) throw new RangeError(`unsupported downstream stage: ${stageName}`);
  if (!Array.isArray(expectedCompletedStages)) throw new TypeError('expectedCompletedStages must be an array');
  const expectedIndex = PHASE1_DOWNSTREAM_STAGES.indexOf(stageName);
  if (
    expectedCompletedStages.length !== expectedIndex ||
    expectedCompletedStages.some((completed, index) => completed !== PHASE1_DOWNSTREAM_STAGES[index])
  ) {
    throw new Error('downstream stage checkpoint is out of order');
  }
  const stageResult = result === undefined ? null : result;
  let resultJson;
  try {
    resultJson = JSON.stringify(stageResult);
  } catch {
    throw new TypeError('downstream stage result must be JSON serializable');
  }
  if (resultJson === undefined) throw new TypeError('downstream stage result must be JSON serializable');

  return withTransaction(transaction, async (client) => {
    const update = await client.query(
      `UPDATE phase1_downstream_outbox
          SET completed_stages = completed_stages || to_jsonb($5::text),
              stage_results = stage_results || jsonb_build_object($5::text, $6::jsonb),
              heartbeat_at = clock_timestamp(),
              updated_at = NOW()
        WHERE id = $1
          AND status = 'leased'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
          AND completed_stages = $7::jsonb
          AND NOT (completed_stages ? $5::text)
        RETURNING *`,
      [id, token, fence, worker, stageName, resultJson, JSON.stringify(expectedCompletedStages)]
    );
    if (!update.rows[0]) throw new Error('downstream stage checkpoint is stale, out of order, or fenced');
    return update.rows[0];
  });
}

export async function retryPhase1DownstreamWork({
  outboxId,
  leaseToken,
  fencingToken,
  workerId,
  error,
  delaySeconds = DEFAULT_DOWNSTREAM_RETRY_DELAY_SECONDS,
  retryId = randomUUID()
} = {}, transaction = {}) {
  const id = requireText(outboxId, 'outboxId');
  const token = requireText(leaseToken, 'leaseToken');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  const worker = requireText(workerId, 'workerId');
  positiveInteger(delaySeconds, 'delaySeconds', 86400);
  const details = {
    ...(error && typeof error === 'object' && !Array.isArray(error) ? error : { message: String(error || 'unknown') }),
    retry_id: String(retryId)
  };

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `UPDATE phase1_downstream_outbox
          SET status = CASE WHEN attempt_count >= max_attempts THEN 'dead_letter' ELSE 'retry_wait' END,
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              heartbeat_at = NULL,
              next_attempt_at = CASE
                WHEN attempt_count >= max_attempts THEN next_attempt_at
                ELSE NOW() + ($5::integer * INTERVAL '1 second')
              END,
              last_error = $6::jsonb,
              dead_lettered_at = CASE WHEN attempt_count >= max_attempts THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1
          AND status = 'leased'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
        RETURNING *`,
      [id, token, fence, worker, delaySeconds, objectJson(details, 'error')]
    );
    if (!result.rows[0]) throw new Error('downstream outbox lease is missing, expired, or fenced');
    return result.rows[0];
  });
}

export async function sweepExpiredPhase1DownstreamLeases({ limit = 100 } = {}, transaction = {}) {
  positiveInteger(limit, 'limit', 1000);
  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `WITH expired AS (
         SELECT id
           FROM phase1_downstream_outbox
          WHERE status = 'leased'
            AND lease_until <= clock_timestamp()
          ORDER BY lease_until, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
       )
       UPDATE phase1_downstream_outbox AS work
          SET status = CASE WHEN attempt_count >= max_attempts THEN 'dead_letter' ELSE 'retry_wait' END,
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              heartbeat_at = NULL,
              next_attempt_at = NOW(),
              last_error = jsonb_build_object('code', 'lease_expired'),
              dead_lettered_at = CASE WHEN attempt_count >= max_attempts THEN NOW() ELSE NULL END,
              updated_at = NOW()
         FROM expired
        WHERE work.id = expired.id
       RETURNING work.*`,
      [limit]
    );
    return result.rows;
  });
}

function compactError(error) {
  return {
    code: error?.code || 'phase1_downstream_stage_failed',
    message: String(error?.message || error || 'unknown downstream failure').slice(0, 500)
  };
}

export async function runPhase1DownstreamCycle({
  database,
  handlers,
  workerId,
  instanceId = workerId,
  releaseRevision = null,
  enabled = false,
  leaseSeconds = DEFAULT_DOWNSTREAM_LEASE_SECONDS,
  retryDelaySeconds = DEFAULT_DOWNSTREAM_RETRY_DELAY_SECONDS,
  sweepExpired = sweepExpiredPhase1DownstreamLeases,
  claim = claimPhase1DownstreamWork,
  heartbeatWork = heartbeatPhase1DownstreamWork,
  checkpoint = checkpointPhase1DownstreamStage,
  complete = completePhase1DownstreamWork,
  retry = retryPhase1DownstreamWork,
  recordHeartbeat = recordPhase1RuntimeHeartbeat
} = {}) {
  const worker = requireText(workerId, 'workerId');
  const instance = requireText(instanceId, 'instanceId');
  positiveInteger(leaseSeconds, 'leaseSeconds', 86400);
  positiveInteger(retryDelaySeconds, 'retryDelaySeconds', 86400);
  if (enabled !== true) {
    return Object.freeze({ operation: 'phase1_downstream_cycle', enabled: false, status: 'disabled' });
  }
  if (!database) throw new TypeError('database is required');
  if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) {
    throw new TypeError('handlers must be an object');
  }
  for (const stage of PHASE1_DOWNSTREAM_STAGES) {
    if (typeof handlers[stage] !== 'function') throw new TypeError(`handlers.${stage} must be a function`);
  }

  await recordHeartbeat({
    database,
    component: 'downstream',
    instanceId: instance,
    releaseRevision,
    details: { state: 'sweeping' }
  });
  const swept = await sweepExpired({}, { pool: database });
  let work = await claim({ workerId: worker, leaseSeconds }, { pool: database });
  if (!work) {
    await recordHeartbeat({
      database,
      component: 'downstream',
      instanceId: instance,
      releaseRevision,
      details: { state: 'idle', swept_expired_leases: swept.length }
    });
    return Object.freeze({
      operation: 'phase1_downstream_cycle',
      enabled: true,
      status: 'idle',
      swept_expired_leases: swept.length
    });
  }

  const completedStages = Array.isArray(work.completed_stages) ? [...work.completed_stages] : [];
  const stageResults = work.stage_results && typeof work.stage_results === 'object' && !Array.isArray(work.stage_results)
    ? { ...work.stage_results }
    : {};
  try {
    for (const stage of PHASE1_DOWNSTREAM_STAGES) {
      if (completedStages.includes(stage)) continue;
      const expectedStage = PHASE1_DOWNSTREAM_STAGES[completedStages.length];
      if (stage !== expectedStage) throw new Error('persisted downstream stage order is invalid');
      await heartbeatWork({
        outboxId: work.id,
        leaseToken: work.lease_token,
        fencingToken: work.lease_fencing_token,
        workerId: worker,
        leaseSeconds
      }, { pool: database });
      await recordHeartbeat({
        database,
        component: 'downstream',
        instanceId: instance,
        releaseRevision,
        details: { state: 'processing', outbox_id: work.id, stage }
      });
      const stageResult = await handlers[stage]({
        tracking_run_id: work.tracking_run_id,
        generation_no: Number(work.generation_no),
        payload: work.payload,
        stage_results: Object.freeze({ ...stageResults }),
        idempotency_key: `phase1-downstream:${work.id}:${stage}`,
        stage
      });
      work = await checkpoint({
        outboxId: work.id,
        leaseToken: work.lease_token,
        fencingToken: work.lease_fencing_token,
        workerId: worker,
        stage,
        expectedCompletedStages: completedStages,
        result: stageResult
      }, { pool: database });
      completedStages.push(stage);
      stageResults[stage] = stageResult === undefined ? null : stageResult;
    }
    const completed = await complete({
      outboxId: work.id,
      leaseToken: work.lease_token,
      fencingToken: work.lease_fencing_token,
      workerId: worker
    }, { pool: database });
    await recordHeartbeat({
      database,
      component: 'downstream',
      instanceId: instance,
      releaseRevision,
      details: { state: 'completed_cycle', outbox_id: work.id }
    });
    return Object.freeze({
      operation: 'phase1_downstream_cycle',
      enabled: true,
      status: 'completed',
      outbox_id: work.id,
      completed_stages: Object.freeze([...completedStages]),
      swept_expired_leases: swept.length,
      work: completed
    });
  } catch (error) {
    const failed = await retry({
      outboxId: work.id,
      leaseToken: work.lease_token,
      fencingToken: work.lease_fencing_token,
      workerId: worker,
      error: compactError(error),
      delaySeconds: retryDelaySeconds
    }, { pool: database });
    await recordHeartbeat({
      database,
      component: 'downstream',
      instanceId: instance,
      releaseRevision,
      details: {
        state: failed.status,
        outbox_id: work.id,
        completed_stages: completedStages,
        error: compactError(error)
      }
    });
    return Object.freeze({
      operation: 'phase1_downstream_cycle',
      enabled: true,
      status: failed.status,
      outbox_id: work.id,
      completed_stages: Object.freeze([...completedStages]),
      swept_expired_leases: swept.length,
      error: compactError(error),
      work: failed
    });
  }
}
