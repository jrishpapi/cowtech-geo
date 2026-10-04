import { randomUUID } from 'node:crypto';
import { withTransaction } from './db-transaction.js';
import { heartbeatCollectionTask } from './collection-queue.js';
import { recordPhase1RuntimeHeartbeat } from './phase1-activation-health.js';

export const DEFAULT_EVIDENCE_RECOVERY_LEASE_SECONDS = 60;
export const DEFAULT_EVIDENCE_RECOVERY_DEADLINE_SECONDS = 3600;

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

function json(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return JSON.stringify(value);
}

function jsonArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return JSON.stringify(value);
}

/**
 * Moves a post-transport native attempt onto the evidence-only lane.  The
 * immutable provider result candidate is persisted before the collection
 * lease is released, so this state can never be claimed by a transport worker
 * and can never issue the supplier request a second time.
 */
export async function scheduleObservationEvidenceRecovery({
  task,
  attempt,
  leaseToken,
  fencingToken,
  actor,
  candidate,
  evidenceErrors = [],
  delaySeconds = 60,
  deadlineSeconds = DEFAULT_EVIDENCE_RECOVERY_DEADLINE_SECONDS,
  eventId = randomUUID()
} = {}, transaction = {}) {
  const taskId = requireText(task?.id, 'task.id');
  const attemptId = requireText(attempt?.id, 'attempt.id');
  const lease = requireText(leaseToken, 'leaseToken');
  const worker = requireText(actor, 'actor');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  positiveInteger(delaySeconds, 'delaySeconds', 86400);
  positiveInteger(deadlineSeconds, 'deadlineSeconds', 604800);
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('candidate must be an object');
  }
  const outcome = requireText(candidate.outcome, 'candidate.outcome');
  const acquisitionMode = requireText(candidate.acquisition_mode, 'candidate.acquisition_mode');
  const resultHash = requireText(candidate.result_hash, 'candidate.result_hash');
  if (!/^[0-9a-f]{64}$/.test(resultHash)) throw new TypeError('candidate.result_hash must be a sha256 hex digest');

  return withTransaction(transaction, async (client) => {
    const lockedTask = await client.query(
      `SELECT *
         FROM collection_tasks
        WHERE id = $1
          AND status = 'leased'
          AND work_kind = 'collect'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
        FOR UPDATE`,
      [taskId, lease, fence, worker]
    );
    if (!lockedTask.rows[0]) throw new Error('active collection lease is required for evidence recovery');

    const lockedAttempt = await client.query(
      `SELECT *
         FROM observation_attempts
        WHERE id = $1
          AND collection_task_id = $2
          AND lease_token = $3
          AND lease_fencing_token = $4
          AND lease_owner = $5
        FOR UPDATE`,
      [attemptId, taskId, lease, fence, worker]
    );
    const currentAttempt = lockedAttempt.rows[0];
    if (!currentAttempt) throw new Error('current observation attempt is missing or fenced');
    if (currentAttempt.provenance_class !== 'native_supplier' || !currentAttempt.transport_started_at) {
      throw new Error('only a started native supplier attempt may enter evidence recovery');
    }
    if (currentAttempt.metadata?.synthetic === true || currentAttempt.supplier === 'phase1_mock') {
      throw new Error('synthetic attempts cannot enter native evidence recovery');
    }

    const candidateWrite = await client.query(
      `INSERT INTO observation_finalization_candidates (
         collection_task_id, observation_attempt_id, outcome, acquisition_mode,
         answer_text, normalized_answer, citations, requested_geo, actual_geo,
         adapter_version, parser_version, structured_validation_passed,
         result_hash, evidence_errors, next_recovery_at, recovery_deadline_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
         $10, $11, $12, $13, $14::jsonb,
         NOW() + ($15::integer * INTERVAL '1 second'),
         NOW() + ($16::integer * INTERVAL '1 second')
       )
       ON CONFLICT (collection_task_id) DO UPDATE
         SET evidence_errors = EXCLUDED.evidence_errors,
             next_recovery_at = LEAST(
               observation_finalization_candidates.next_recovery_at,
               EXCLUDED.next_recovery_at
             ),
             updated_at = NOW()
       WHERE observation_finalization_candidates.observation_attempt_id = EXCLUDED.observation_attempt_id
         AND observation_finalization_candidates.outcome = EXCLUDED.outcome
         AND observation_finalization_candidates.acquisition_mode = EXCLUDED.acquisition_mode
         AND observation_finalization_candidates.answer_text IS NOT DISTINCT FROM EXCLUDED.answer_text
         AND observation_finalization_candidates.normalized_answer IS NOT DISTINCT FROM EXCLUDED.normalized_answer
         AND observation_finalization_candidates.citations = EXCLUDED.citations
         AND observation_finalization_candidates.requested_geo = EXCLUDED.requested_geo
         AND observation_finalization_candidates.actual_geo IS NOT DISTINCT FROM EXCLUDED.actual_geo
         AND observation_finalization_candidates.adapter_version IS NOT DISTINCT FROM EXCLUDED.adapter_version
         AND observation_finalization_candidates.parser_version IS NOT DISTINCT FROM EXCLUDED.parser_version
         AND observation_finalization_candidates.structured_validation_passed = EXCLUDED.structured_validation_passed
         AND observation_finalization_candidates.result_hash = EXCLUDED.result_hash
         AND observation_finalization_candidates.status = 'evidence_pending'
       RETURNING *`,
      [
        taskId,
        attemptId,
        outcome,
        acquisitionMode,
        candidate.answer_text ?? null,
        json(candidate.normalized_answer, 'candidate.normalized_answer'),
        jsonArray(candidate.citations || [], 'candidate.citations'),
        json(candidate.requested_geo, 'candidate.requested_geo'),
        json(candidate.actual_geo, 'candidate.actual_geo'),
        candidate.adapter_version ?? null,
        candidate.parser_version ?? null,
        candidate.structured_validation_passed === true,
        resultHash,
        jsonArray(evidenceErrors, 'evidenceErrors'),
        delaySeconds,
        deadlineSeconds
      ]
    );
    if (!candidateWrite.rows[0]) throw new Error('evidence recovery candidate idempotency conflict');

    const attemptWrite = await client.query(
      `UPDATE observation_attempts
          SET status = 'evidence_pending',
              finished_at = COALESCE(finished_at, NOW()),
              error_taxonomy = 'evidence_pending',
              error_code = 'valid_evidence_manifest_required',
              error_details = error_details || $6::jsonb,
              updated_at = NOW()
        WHERE id = $1
          AND collection_task_id = $2
          AND lease_token = $3
          AND lease_fencing_token = $4
          AND lease_owner = $5
          AND status IN ('transport_started', 'reconciliation_pending', 'evidence_pending')
        RETURNING *`,
      [attemptId, taskId, lease, fence, worker, JSON.stringify({ evidence_errors: evidenceErrors })]
    );
    if (!attemptWrite.rows[0]) throw new Error('observation attempt cannot enter evidence recovery');

    const taskWrite = await client.query(
      `UPDATE collection_tasks
          SET status = 'retry_wait',
              work_kind = 'evidence_recovery',
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              lease_heartbeat_at = NULL,
              next_attempt_at = NOW() + ($2::integer * INTERVAL '1 second'),
              last_error_taxonomy = 'evidence_pending',
              last_error_code = 'valid_evidence_manifest_required',
              last_error_details = $3::jsonb,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [taskId, delaySeconds, JSON.stringify({ evidence_errors: evidenceErrors, supplier_transport_replay_allowed: false })]
    );

    await client.query(
      `INSERT INTO collection_task_events (
         collection_task_id, observation_attempt_id, event_type, from_status,
         to_status, lease_token, fencing_token, idempotency_key, actor, reason, details
       ) VALUES ($1, $2, 'retry_scheduled', 'leased', 'retry_wait', $3, $4, $5, $6,
                 'evidence_verification_pending', $7::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        taskId,
        attemptId,
        lease,
        fence,
        `collection-task:${taskId}:evidence-recovery:${eventId}`,
        worker,
        JSON.stringify({ evidence_errors: evidenceErrors, work_kind: 'evidence_recovery' })
      ]
    );

    return Object.freeze({
      status: 'evidence_pending',
      task: taskWrite.rows[0],
      attempt: attemptWrite.rows[0],
      candidate: candidateWrite.rows[0]
    });
  });
}

export async function claimObservationEvidenceRecovery({
  workerId,
  leaseSeconds = DEFAULT_EVIDENCE_RECOVERY_LEASE_SECONDS
} = {}, transaction = {}) {
  const worker = requireText(workerId, 'workerId');
  positiveInteger(leaseSeconds, 'leaseSeconds', 86400);

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `WITH candidate AS (
         SELECT task.id, task.status AS previous_status
           FROM collection_tasks AS task
           JOIN observation_finalization_candidates AS finalization
             ON finalization.collection_task_id = task.id
          WHERE task.status IN ('queued', 'retry_wait')
            AND task.work_kind = 'evidence_recovery'
            AND task.next_attempt_at <= NOW()
            AND finalization.status = 'evidence_pending'
            AND finalization.next_recovery_at <= NOW()
          ORDER BY finalization.next_recovery_at, task.created_at, task.id
          FOR UPDATE OF task SKIP LOCKED
          LIMIT 1
       )
       UPDATE collection_tasks AS task
          SET status = 'leased',
              lease_owner = $1,
              lease_token = gen_random_uuid(),
              lease_fencing_token = task.lease_fencing_token + 1,
              lease_until = clock_timestamp() + ($2::integer * INTERVAL '1 second'),
              lease_heartbeat_at = clock_timestamp(),
              updated_at = NOW()
         FROM candidate
        WHERE task.id = candidate.id
       RETURNING task.*, candidate.previous_status`,
      [worker, leaseSeconds]
    );
    if (!result.rows[0]) return null;
    const claimed = result.rows[0];
    await client.query(
      `INSERT INTO collection_task_events (
         collection_task_id, event_type, from_status, to_status, lease_token,
         fencing_token, idempotency_key, actor, reason, details
       ) VALUES ($1, 'claimed', $2, 'leased', $3, $4, $5, $6,
                 'durable_evidence_recovery_claim', '{"supplier_transport_allowed":false}'::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        claimed.id,
        claimed.previous_status,
        claimed.lease_token,
        claimed.lease_fencing_token,
        `collection-task:${claimed.id}:evidence-claimed:${claimed.lease_fencing_token}`,
        worker
      ]
    );
    return claimed;
  });
}

export async function sweepExpiredObservationEvidenceRecoveryLeases({
  limit = 100
} = {}, transaction = {}) {
  positiveInteger(limit, 'limit', 1000);
  return withTransaction(transaction, async (client) => {
    const expired = await client.query(
      `WITH candidates AS (
         SELECT id
           FROM collection_tasks
          WHERE status = 'leased'
            AND work_kind = 'evidence_recovery'
            AND lease_until <= clock_timestamp()
          ORDER BY lease_until, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
       )
       UPDATE collection_tasks AS task
          SET status = 'retry_wait',
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              lease_heartbeat_at = NULL,
              next_attempt_at = NOW(),
              last_error_taxonomy = 'evidence_recovery_worker_crash',
              last_error_code = 'evidence_recovery_lease_expired',
              last_error_details = '{"supplier_transport_replay_allowed":false}'::jsonb,
              updated_at = NOW()
         FROM candidates
        WHERE task.id = candidates.id
       RETURNING task.*`,
      [limit]
    );
    if (expired.rows.length > 0) {
      await client.query(
        `UPDATE observation_finalization_candidates
            SET recovery_attempt_count = recovery_attempt_count + 1,
                evidence_errors = evidence_errors || '["evidence_recovery_lease_expired"]'::jsonb,
                next_recovery_at = NOW(),
                updated_at = NOW()
          WHERE collection_task_id = ANY($1::uuid[])
            AND status = 'evidence_pending'`,
        [expired.rows.map((task) => task.id)]
      );
    }
    return expired.rows;
  });
}

export async function loadClaimedObservationEvidenceRecovery({
  taskId,
  leaseToken,
  fencingToken,
  workerId
} = {}, transaction = {}) {
  const task = requireText(taskId, 'taskId');
  const lease = requireText(leaseToken, 'leaseToken');
  const fence = positiveInteger(Number(fencingToken), 'fencingToken');
  const worker = requireText(workerId, 'workerId');
  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `SELECT to_jsonb(task) AS task,
              to_jsonb(candidate) AS candidate,
              to_jsonb(attempt) AS attempt
         FROM collection_tasks AS task
         JOIN observation_finalization_candidates AS candidate
           ON candidate.collection_task_id = task.id
         JOIN observation_attempts AS attempt
           ON attempt.id = candidate.observation_attempt_id
          AND attempt.collection_task_id = task.id
        WHERE task.id = $1
          AND task.status = 'leased'
          AND task.work_kind = 'evidence_recovery'
          AND task.lease_token = $2
          AND task.lease_fencing_token = $3
          AND task.lease_owner = $4
          AND task.lease_until > clock_timestamp()
          AND candidate.status = 'evidence_pending'
          AND attempt.status = 'evidence_pending'`,
      [task, lease, fence, worker]
    );
    if (!result.rows[0]) throw new Error('claimed evidence recovery context is missing or fenced');
    return result.rows[0];
  });
}

function compactError(error) {
  return {
    code: error?.code || 'evidence_verification_failed',
    message: String(error?.message || error || 'unknown evidence verification failure').slice(0, 500)
  };
}

export async function runObservationEvidenceRecoveryCycle({
  database,
  verifier,
  workerId,
  instanceId = workerId,
  releaseRevision = null,
  enabled = false,
  leaseSeconds = DEFAULT_EVIDENCE_RECOVERY_LEASE_SECONDS,
  sweepExpired = sweepExpiredObservationEvidenceRecoveryLeases,
  claim = claimObservationEvidenceRecovery,
  load = loadClaimedObservationEvidenceRecovery,
  heartbeatTask = heartbeatCollectionTask,
  recordHeartbeat = recordPhase1RuntimeHeartbeat,
  finalize = null
} = {}) {
  const worker = requireText(workerId, 'workerId');
  const instance = requireText(instanceId, 'instanceId');
  positiveInteger(leaseSeconds, 'leaseSeconds', 86400);
  if (enabled !== true) {
    return Object.freeze({ operation: 'evidence_recovery_cycle', enabled: false, status: 'disabled' });
  }
  if (!database) throw new TypeError('database is required');
  if (typeof verifier !== 'function') throw new TypeError('verifier must be a function');

  await recordHeartbeat({
    database,
    component: 'evidence_recovery',
    instanceId: instance,
    releaseRevision,
    details: { state: 'sweeping', supplier_transport_allowed: false }
  });
  const swept = await sweepExpired({}, { pool: database });
  const task = await claim({ workerId: worker, leaseSeconds }, { pool: database });
  if (!task) {
    await recordHeartbeat({
      database,
      component: 'evidence_recovery',
      instanceId: instance,
      releaseRevision,
      details: { state: 'idle', swept_expired_leases: swept.length, supplier_transport_allowed: false }
    });
    return Object.freeze({
      operation: 'evidence_recovery_cycle',
      enabled: true,
      status: 'idle',
      swept_expired_leases: swept.length
    });
  }

  const context = await load({
    taskId: task.id,
    leaseToken: task.lease_token,
    fencingToken: task.lease_fencing_token,
    workerId: worker
  }, { pool: database });
  const heartbeat = async (state = 'verifying') => {
    await heartbeatTask({
      taskId: task.id,
      leaseToken: task.lease_token,
      fencingToken: task.lease_fencing_token,
      workerId: worker,
      leaseSeconds
    }, { pool: database });
    await recordHeartbeat({
      database,
      component: 'evidence_recovery',
      instanceId: instance,
      releaseRevision,
      details: {
        state,
        collection_task_id: task.id,
        candidate_id: context.candidate.id,
        supplier_transport_allowed: false
      }
    });
  };

  const deadlineExpired = new Date(context.candidate.recovery_deadline_at).getTime() <= Date.now();
  let verification;
  if (deadlineExpired) {
    verification = {
      status: 'failed',
      reason: 'evidence_recovery_deadline_exceeded',
      details: { deadline_at: context.candidate.recovery_deadline_at }
    };
  } else {
    try {
      await heartbeat('verifying');
      verification = await verifier({
        task: context.task,
        candidate: context.candidate,
        attempt: context.attempt,
        heartbeat,
        supplier_transport_allowed: false,
        create_attempt_allowed: false
      });
      if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
        throw new TypeError('verifier must return an object');
      }
      if (!['verified', 'failed'].includes(verification.status)) {
        throw new RangeError("verifier status must be 'verified' or 'failed'");
      }
    } catch (error) {
      verification = {
        status: 'failed',
        reason: 'evidence_verifier_exception',
        details: compactError(error)
      };
    }
  }
  await heartbeat('finalizing');
  const finalizeRecovery = finalize || (await import('./observation-finalizer.js')).finalizeObservationEvidenceRecovery;
  const result = await finalizeRecovery({
    pool: database,
    task_id: task.id,
    candidate_id: context.candidate.id,
    lease_token: task.lease_token,
    fencing_token: task.lease_fencing_token,
    actor: worker,
    verification,
    enabled: true
  });
  await recordHeartbeat({
    database,
    component: 'evidence_recovery',
    instanceId: instance,
    releaseRevision,
    details: {
      state: 'completed_cycle',
      collection_task_id: task.id,
      result_status: result.status,
      supplier_transport_allowed: false
    }
  });
  return Object.freeze({
    operation: 'evidence_recovery_cycle',
    enabled: true,
    status: result.status,
    swept_expired_leases: swept.length,
    result
  });
}
