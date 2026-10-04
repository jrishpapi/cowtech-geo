import { randomUUID } from 'node:crypto';
import { withTransaction } from './db-transaction.js';
import {
  markPostStartSupplierReservationUnknownForAttempt,
  releaseUnstartedSupplierReservationForAttempt
} from './supplier-budget-ledger.js';

export const DEFAULT_COLLECTION_LEASE_SECONDS = 60;
export const DEFAULT_COLLECTION_RETRY_DELAY_SECONDS = 30;
export const DEFAULT_COLLECTION_RECONCILIATION_DELAY_SECONDS = 900;

export class CollectionQueueLeaseError extends Error {
  constructor(message = 'collection task lease is missing, expired, or fenced') {
    super(message);
    this.name = 'CollectionQueueLeaseError';
    this.code = 'collection_task_lease_invalid';
  }
}

export class CollectionQueueStateError extends Error {
  constructor(message, code = 'collection_task_state_invalid') {
    super(message);
    this.name = 'CollectionQueueStateError';
    this.code = code;
  }
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

function requireNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveFencingToken(value) {
  if (
    (Number.isSafeInteger(value) && value > 0) ||
    (typeof value === 'string' && /^[1-9]\d*$/.test(value))
  ) {
    return value;
  }
  throw new TypeError('fencingToken must be a positive integer or PostgreSQL bigint string');
}

function asJsonObject(value, name = 'details') {
  const normalized = value ?? {};
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new TypeError(`${name} must be an object`);
  }
  return JSON.stringify(normalized);
}

export function deriveObservationProvenanceClass({
  supplier,
  transportSupplier,
  acquisitionMode,
  attemptKind = 'native_initial',
  metadata = {}
} = {}) {
  const normalizedMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
  if (supplier === 'phase1_mock' || normalizedMetadata.synthetic === true) {
    return 'synthetic_shadow';
  }
  if (
    attemptKind === 'api_fallback' ||
    ['sonar_api', 'openrouter_api', 'other_api'].includes(acquisitionMode)
  ) {
    return 'api_auxiliary';
  }
  if (
    (acquisitionMode === 'web_ui' && supplier === 'bright_data' && transportSupplier === 'bright_data') ||
    (acquisitionMode === 'serpapi_aio' && supplier === 'serpapi' && transportSupplier === 'serpapi')
  ) {
    return 'native_supplier';
  }
  return 'unverified';
}

async function recordTaskEvent(
  client,
  {
    taskId,
    attemptId = null,
    eventType,
    fromStatus = null,
    toStatus = null,
    leaseToken = null,
    fencingToken = null,
    idempotencyKey,
    actor,
    reason = null,
    details = {}
  }
) {
  const result = await client.query(
    `INSERT INTO collection_task_events (
       collection_task_id,
       observation_attempt_id,
       event_type,
       from_status,
       to_status,
       lease_token,
       fencing_token,
       idempotency_key,
       actor,
       reason,
       details
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      taskId,
      attemptId,
      eventType,
      fromStatus,
      toStatus,
      leaseToken,
      fencingToken && Number(fencingToken) > 0 ? fencingToken : null,
      requireText(idempotencyKey, 'idempotencyKey'),
      requireText(actor, 'actor'),
      reason,
      asJsonObject(details)
    ]
  );
  return result.rows?.[0] || null;
}

async function lockActiveLease(client, { taskId, leaseToken, fencingToken }) {
  requireText(taskId, 'taskId');
  requireText(leaseToken, 'leaseToken');
  requirePositiveFencingToken(fencingToken);

  const result = await client.query(
    `SELECT *
     FROM collection_tasks
     WHERE id = $1
       AND status = 'leased'
       AND lease_token = $2
       AND lease_fencing_token = $3
       AND lease_until > clock_timestamp()
     FOR UPDATE`,
    [taskId, leaseToken, fencingToken]
  );

  if (!result.rowCount || !result.rows?.[0]) throw new CollectionQueueLeaseError();
  const stillActive = await client.query(
    `SELECT id
       FROM collection_tasks
      WHERE id = $1
        AND status = 'leased'
        AND lease_token = $2
        AND lease_fencing_token = $3
        AND lease_until > clock_timestamp()`,
    [taskId, leaseToken, fencingToken]
  );
  if (!stillActive.rowCount || !stillActive.rows?.[0]) throw new CollectionQueueLeaseError();
  return result.rows[0];
}

export async function claimCollectionTask(
  { workerId, leaseSeconds = DEFAULT_COLLECTION_LEASE_SECONDS } = {},
  transaction = {}
) {
  requireText(workerId, 'workerId');
  requirePositiveInteger(leaseSeconds, 'leaseSeconds', 86400);

  return withTransaction(transaction, async (client) => {
    const result = await client.query(
      `WITH candidate AS (
         SELECT task.id, task.status AS previous_status
         FROM collection_tasks AS task
         WHERE task.status IN ('queued', 'retry_wait')
           AND task.work_kind = 'collect'
           AND task.next_attempt_at <= NOW()
           AND NOT EXISTS (
             SELECT 1
             FROM observation_attempts AS pending_attempt
             WHERE pending_attempt.collection_task_id = task.id
               AND pending_attempt.status IN ('transport_started', 'unknown', 'reconciliation_pending')
           )
         ORDER BY task.next_attempt_at, task.created_at, task.id
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
      [workerId, leaseSeconds]
    );

    if (!result.rowCount) return null;
    const task = result.rows[0];
    await recordTaskEvent(client, {
      taskId: task.id,
      eventType: 'claimed',
      fromStatus: task.previous_status,
      toStatus: 'leased',
      leaseToken: task.lease_token,
      fencingToken: task.lease_fencing_token,
      idempotencyKey: `collection-task:${task.id}:claimed:${task.lease_fencing_token}`,
      actor: workerId,
      reason: 'durable_postgres_claim',
      details: { lease_seconds: leaseSeconds, redis_truth_source: false }
    });
    return task;
  });
}

export async function heartbeatCollectionTask(
  {
    taskId,
    leaseToken,
    fencingToken,
    workerId,
    leaseSeconds = DEFAULT_COLLECTION_LEASE_SECONDS,
    heartbeatId = randomUUID()
  } = {},
  transaction = {}
) {
  requireText(taskId, 'taskId');
  requireText(leaseToken, 'leaseToken');
  requirePositiveFencingToken(fencingToken);
  requireText(workerId, 'workerId');
  requirePositiveInteger(leaseSeconds, 'leaseSeconds', 86400);

  return withTransaction(transaction, async (client) => {
    const locked = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    if (locked.lease_owner !== workerId) throw new CollectionQueueLeaseError();
    const result = await client.query(
      `UPDATE collection_tasks
       SET lease_until = clock_timestamp() + ($5::integer * INTERVAL '1 second'),
           lease_heartbeat_at = clock_timestamp(),
           updated_at = NOW()
       WHERE id = $1
         AND status = 'leased'
         AND lease_token = $2
         AND lease_fencing_token = $3
         AND lease_owner = $4
         AND lease_until > clock_timestamp()
       RETURNING *`,
      [taskId, leaseToken, fencingToken, workerId, leaseSeconds]
    );
    if (!result.rowCount) throw new CollectionQueueLeaseError();

    const task = result.rows[0];
    await recordTaskEvent(client, {
      taskId,
      eventType: 'heartbeat',
      fromStatus: 'leased',
      toStatus: 'leased',
      leaseToken,
      fencingToken,
      idempotencyKey: `collection-task:${taskId}:heartbeat:${heartbeatId}`,
      actor: workerId,
      reason: 'lease_extended',
      details: { lease_seconds: leaseSeconds }
    });
    return task;
  });
}

export async function prepareObservationAttempt(
  {
    taskId,
    leaseToken,
    fencingToken,
    supplier,
    transportSupplier,
    route,
    acquisitionMode,
    attemptKind = 'native_initial',
    estimatedCostMicroUsd = null,
    metadata = {}
  } = {},
  transaction = {}
) {
  requireText(supplier, 'supplier');
  requireText(transportSupplier, 'transportSupplier');
  requireText(route, 'route');
  requireText(acquisitionMode, 'acquisitionMode');
  requireText(attemptKind, 'attemptKind');
  if (estimatedCostMicroUsd !== null) {
    requireNonNegativeInteger(estimatedCostMicroUsd, 'estimatedCostMicroUsd');
  }

  return withTransaction(transaction, async (client) => {
    const task = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    const provenanceClass = deriveObservationProvenanceClass({
      supplier,
      transportSupplier,
      acquisitionMode,
      attemptKind,
      metadata
    });
    const result = await client.query(
      `WITH next_attempt AS (
         SELECT COALESCE(MAX(attempt_ordinal), 0) + 1 AS attempt_ordinal
         FROM observation_attempts
         WHERE collection_task_id = $1
       )
       INSERT INTO observation_attempts (
         collection_task_id,
         lease_owner,
         lease_token,
         lease_fencing_token,
         attempt_ordinal,
         attempt_kind,
         supplier,
         transport_supplier,
         route,
         acquisition_mode,
         status,
         estimated_cost_micro_usd,
         cost_state,
         reconciliation_status,
         is_fallback,
         provenance_class,
         metadata
       )
       SELECT
         $1,
         $9,
         $10,
         $11,
         next_attempt.attempt_ordinal,
         $2,
         $3,
         $4,
         $5,
         $6,
         'created',
         $7,
         CASE WHEN $7::bigint IS NULL THEN 'unknown' ELSE 'estimated' END,
         'pending',
         $2 = 'api_fallback',
         $12,
         $8::jsonb
       FROM next_attempt
       ON CONFLICT (collection_task_id, lease_fencing_token) DO UPDATE
         SET updated_at = observation_attempts.updated_at
       WHERE observation_attempts.lease_owner = EXCLUDED.lease_owner
         AND observation_attempts.lease_token = EXCLUDED.lease_token
         AND observation_attempts.attempt_kind = EXCLUDED.attempt_kind
         AND observation_attempts.supplier = EXCLUDED.supplier
         AND observation_attempts.transport_supplier = EXCLUDED.transport_supplier
         AND observation_attempts.route = EXCLUDED.route
         AND observation_attempts.acquisition_mode = EXCLUDED.acquisition_mode
         AND observation_attempts.estimated_cost_micro_usd IS NOT DISTINCT FROM EXCLUDED.estimated_cost_micro_usd
         AND observation_attempts.provenance_class = EXCLUDED.provenance_class
         AND observation_attempts.metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        taskId,
        attemptKind,
        supplier,
        transportSupplier,
        route,
        acquisitionMode,
        estimatedCostMicroUsd,
        asJsonObject(metadata, 'metadata'),
        task.lease_owner,
        task.lease_token,
        task.lease_fencing_token,
        provenanceClass
      ]
    );
    if (!result.rows[0]) {
      throw new CollectionQueueStateError(
        'current task lease already has an observation attempt with different immutable terms',
        'observation_attempt_idempotency_conflict'
      );
    }
    await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    return result.rows[0];
  });
}

// This transition is only for synthetic/unbudgeted transports. Budgeted
// suppliers must use markSupplierTransportStarted so the permit, reservation,
// counters, attempt, and active lease advance atomically.
export async function markObservationAttemptTransportStarted(
  { taskId, attemptId, leaseToken, fencingToken, workerId } = {},
  transaction = {}
) {
  requireText(attemptId, 'attemptId');
  requireText(workerId, 'workerId');

  return withTransaction(transaction, async (client) => {
    await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    const result = await client.query(
      `UPDATE observation_attempts
       SET status = 'transport_started',
           transport_started_at = COALESCE(transport_started_at, NOW()),
           updated_at = NOW()
       WHERE id = $1
         AND collection_task_id = $2
         AND lease_token = $3
         AND lease_fencing_token = $4
         AND lease_owner = $5
         AND supplier = 'phase1_mock'
         AND metadata @> '{"external_transport_invoked": false}'::jsonb
         AND status IN ('created', 'transport_started')
       RETURNING *`,
      [attemptId, taskId, leaseToken, fencingToken, workerId]
    );
    if (!result.rowCount) {
      throw new CollectionQueueStateError(
        'observation attempt is missing or no longer startable',
        'observation_attempt_not_startable'
      );
    }
    await lockActiveLease(client, { taskId, leaseToken, fencingToken });

    const attempt = result.rows[0];
    await recordTaskEvent(client, {
      taskId,
      attemptId,
      eventType: 'attempt_started',
      fromStatus: 'leased',
      toStatus: 'leased',
      leaseToken,
      fencingToken,
      idempotencyKey: `collection-task:${taskId}:attempt:${attemptId}:transport-started`,
      actor: workerId,
      reason: 'attempt_persisted_before_transport',
      details: { transport_started: true }
    });
    return attempt;
  });
}

async function transitionToDeadLetter(
  client,
  task,
  { actor, reason, attemptId = null, errorDetails = {}, eventSuffix = randomUUID() }
) {
  const result = await client.query(
    `UPDATE collection_tasks
     SET status = 'dead_letter',
         lease_owner = NULL,
         lease_token = NULL,
         lease_until = NULL,
         lease_heartbeat_at = NULL,
         dead_letter_reason = $2,
         dead_lettered_at = NOW(),
         last_error_taxonomy = 'dead_letter',
         last_error_code = $2,
         last_error_details = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [task.id, reason, asJsonObject(errorDetails)]
  );
  const updated = result.rows[0];
  await recordTaskEvent(client, {
    taskId: task.id,
    attemptId,
    eventType: 'dead_lettered',
    fromStatus: task.status,
    toStatus: 'dead_letter',
    leaseToken: task.lease_token,
    fencingToken: task.lease_fencing_token,
    idempotencyKey: `collection-task:${task.id}:dead-letter:${eventSuffix}`,
    actor,
    reason,
    details: errorDetails
  });
  return updated;
}

async function lockCurrentLeaseAttempt(client, task, attemptId, operation) {
  const result = await client.query(
    `SELECT *
       FROM observation_attempts
      WHERE collection_task_id = $1
        AND lease_token = $2
        AND lease_fencing_token = $3
      ORDER BY attempt_ordinal
      FOR UPDATE`,
    [task.id, task.lease_token, task.lease_fencing_token]
  );
  await lockActiveLease(client, {
    taskId: task.id,
    leaseToken: task.lease_token,
    fencingToken: task.lease_fencing_token
  });
  if (result.rows.length === 0) {
    if (!attemptId) return null;
    throw new CollectionQueueStateError(
      `${operation} attempt is missing or fenced from the current task lease`,
      'observation_attempt_transition_fenced'
    );
  }
  if (!attemptId) {
    throw new CollectionQueueStateError(
      `${operation} requires attemptId because the current task lease already has an observation attempt`,
      'observation_attempt_id_required'
    );
  }
  const attempt = result.rows.find((row) => row.id === attemptId);
  if (!attempt) {
    throw new CollectionQueueStateError(
      `${operation} attempt is missing or fenced from the current task lease`,
      'observation_attempt_transition_fenced'
    );
  }
  return attempt;
}

async function resolveAttemptForExplicitRetry(client, task, attemptId, { reason, errorDetails }) {
  const attempt = await lockCurrentLeaseAttempt(client, task, attemptId, 'retry');
  if (!attempt) return { state: 'none', attempt: null };
  if (['succeeded', 'failed', 'crashed'].includes(attempt.status)) {
    return { state: 'terminal', attempt };
  }

  const transportMayHaveStarted =
    Boolean(attempt.transport_started_at) ||
    ['transport_started', 'unknown', 'reconciliation_pending'].includes(attempt.status);
  if (transportMayHaveStarted) {
    await markPostStartSupplierReservationUnknownForAttempt({
      client,
      observation_attempt_id: attempt.id,
      allocation_reason: 'explicit_retry_after_transport_started',
      metadata: { collection_task_id: task.id, lease_fencing_token: task.lease_fencing_token, reason }
    });
    await client.query(
      `UPDATE observation_attempts
          SET status = 'reconciliation_pending',
              finished_at = COALESCE(finished_at, NOW()),
              error_taxonomy = 'unknown_external_outcome',
              error_code = 'retry_requested_after_transport_started',
              error_details = error_details || $2::jsonb,
              retry_reason = 'awaiting_reconciliation',
              reconciliation_status = 'pending',
              updated_at = NOW()
        WHERE id = $1`,
      [attempt.id, asJsonObject({ ...errorDetails, original_reason: reason })]
    );
    return { state: 'reconciliation_pending', attempt };
  }

  await releaseUnstartedSupplierReservationForAttempt({
    client,
    observation_attempt_id: attempt.id,
    reason: 'explicit_retry_before_transport',
    metadata: { collection_task_id: task.id, lease_fencing_token: task.lease_fencing_token, reason }
  });
  await client.query(
    `UPDATE observation_attempts
        SET status = 'failed',
            finished_at = COALESCE(finished_at, NOW()),
            error_taxonomy = 'retryable',
            error_code = $2,
            error_details = error_details || $3::jsonb,
            retry_reason = $2,
            reconciliation_status = 'not_required',
            updated_at = NOW()
      WHERE id = $1
        AND transport_started_at IS NULL`,
    [attempt.id, reason, asJsonObject(errorDetails)]
  );
  return { state: 'pre_transport_failed', attempt };
}

export async function scheduleCollectionTaskRetry(
  {
    taskId,
    attemptId = null,
    leaseToken,
    fencingToken,
    actor,
    reason,
    budget = 'native',
    delaySeconds = DEFAULT_COLLECTION_RETRY_DELAY_SECONDS,
    errorTaxonomy = 'retryable',
    errorCode = reason,
    errorDetails = {},
    eventId = randomUUID()
  } = {},
  transaction = {}
) {
  requireText(actor, 'actor');
  requireText(reason, 'reason');
  requirePositiveInteger(delaySeconds, 'delaySeconds', 86400);
  if (!['native', 'fallback', 'none'].includes(budget)) {
    throw new TypeError("budget must be 'native', 'fallback', or 'none'");
  }

  return withTransaction(transaction, async (client) => {
    const task = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    const attemptResolution = await resolveAttemptForExplicitRetry(client, task, attemptId, {
      reason,
      errorDetails
    });
    if (attemptResolution.state === 'reconciliation_pending') {
      const result = await client.query(
        `UPDATE collection_tasks
            SET status = 'retry_wait',
                lease_owner = NULL,
                lease_token = NULL,
                lease_until = NULL,
                lease_heartbeat_at = NULL,
                next_attempt_at = NOW() + ($2::integer * INTERVAL '1 second'),
                last_error_taxonomy = 'unknown_external_outcome',
                last_error_code = 'retry_requested_after_transport_started',
                last_error_details = $3::jsonb,
                updated_at = NOW()
          WHERE id = $1
          RETURNING *`,
        [taskId, delaySeconds, asJsonObject({ ...errorDetails, reconciliation_required: true })]
      );
      await recordTaskEvent(client, {
        taskId,
        attemptId,
        eventType: 'retry_scheduled',
        fromStatus: 'leased',
        toStatus: 'retry_wait',
        leaseToken,
        fencingToken,
        idempotencyKey: `collection-task:${taskId}:retry:${eventId}`,
        actor,
        reason: 'transport_outcome_unknown',
        details: { ...errorDetails, budget: 'none', delay_seconds: delaySeconds, reconciliation_required: true }
      });
      return { action: 'reconciliation_pending', task: result.rows[0] };
    }
    const remaining =
      budget === 'native'
        ? Number(task.native_retry_budget)
        : budget === 'fallback'
          ? Number(task.fallback_attempt_budget)
          : Number.MAX_SAFE_INTEGER;

    if (remaining <= 0) {
      const deadLettered = await transitionToDeadLetter(client, task, {
        actor,
        reason: `retry_budget_exhausted:${reason}`,
        attemptId,
        errorDetails,
        eventSuffix: eventId
      });
      return { action: 'dead_letter', task: deadLettered };
    }

    const decrement =
      budget === 'native'
        ? 'native_retry_budget = native_retry_budget - 1,'
        : budget === 'fallback'
          ? 'fallback_attempt_budget = fallback_attempt_budget - 1,'
          : '';
    const result = await client.query(
      `UPDATE collection_tasks
       SET status = 'retry_wait',
           ${decrement}
           lease_owner = NULL,
           lease_token = NULL,
           lease_until = NULL,
           lease_heartbeat_at = NULL,
           next_attempt_at = NOW() + ($2::integer * INTERVAL '1 second'),
           last_error_taxonomy = $3,
           last_error_code = $4,
           last_error_details = $5::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, delaySeconds, errorTaxonomy, errorCode, asJsonObject(errorDetails)]
    );
    const updated = result.rows[0];
    await recordTaskEvent(client, {
      taskId,
      attemptId,
      eventType: 'retry_scheduled',
      fromStatus: 'leased',
      toStatus: 'retry_wait',
      leaseToken,
      fencingToken,
      idempotencyKey: `collection-task:${taskId}:retry:${eventId}`,
      actor,
      reason,
      details: { ...errorDetails, budget, delay_seconds: delaySeconds }
    });
    return { action: 'retry_wait', task: updated };
  });
}

export async function deadLetterCollectionTask(
  {
    taskId,
    attemptId = null,
    leaseToken,
    fencingToken,
    actor,
    reason,
    errorDetails = {},
    eventId = randomUUID()
  } = {},
  transaction = {}
) {
  requireText(actor, 'actor');
  requireText(reason, 'reason');

  return withTransaction(transaction, async (client) => {
    const task = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    await lockCurrentLeaseAttempt(client, task, attemptId, 'dead letter transition');
    return transitionToDeadLetter(client, task, {
      actor,
      reason,
      attemptId,
      errorDetails,
      eventSuffix: eventId
    });
  });
}

export async function completeCollectionTask(
  { taskId, attemptId = null, leaseToken, fencingToken, actor, eventId = randomUUID() } = {},
  transaction = {}
) {
  requireText(actor, 'actor');

  return withTransaction(transaction, async (client) => {
    const task = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    await lockCurrentLeaseAttempt(client, task, attemptId, 'completion');
    const result = await client.query(
      `UPDATE collection_tasks
       SET status = 'completed',
           lease_owner = NULL,
           lease_token = NULL,
           lease_until = NULL,
           lease_heartbeat_at = NULL,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId]
    );
    const updated = result.rows[0];
    await recordTaskEvent(client, {
      taskId,
      attemptId,
      eventType: 'completed',
      fromStatus: 'leased',
      toStatus: 'completed',
      leaseToken,
      fencingToken,
      idempotencyKey: `collection-task:${taskId}:completed:${eventId}`,
      actor,
      reason: 'collection_completed',
      details: {}
    });
    return updated;
  });
}

export async function markCollectionTaskUnavailable(
  {
    taskId,
    attemptId = null,
    leaseToken,
    fencingToken,
    actor,
    reason = 'surface_unavailable',
    errorDetails = {},
    eventId = randomUUID()
  } = {},
  transaction = {}
) {
  requireText(actor, 'actor');
  requireText(reason, 'reason');

  return withTransaction(transaction, async (client) => {
    const task = await lockActiveLease(client, { taskId, leaseToken, fencingToken });
    await lockCurrentLeaseAttempt(client, task, attemptId, 'unavailable transition');
    const result = await client.query(
      `UPDATE collection_tasks
       SET status = 'unavailable',
           lease_owner = NULL,
           lease_token = NULL,
           lease_until = NULL,
           lease_heartbeat_at = NULL,
           last_error_taxonomy = 'surface_unavailable',
           last_error_code = $2,
           last_error_details = $3::jsonb,
           unavailable_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, reason, asJsonObject(errorDetails)]
    );
    const updated = result.rows[0];
    await recordTaskEvent(client, {
      taskId,
      attemptId,
      eventType: 'unavailable',
      fromStatus: 'leased',
      toStatus: 'unavailable',
      leaseToken,
      fencingToken,
      idempotencyKey: `collection-task:${taskId}:unavailable:${eventId}`,
      actor,
      reason,
      details: errorDetails
    });
    return updated;
  });
}

export async function sweepExpiredCollectionTaskLeases(
  {
    actor = 'collection-lease-sweeper',
    limit = 100,
    retryDelaySeconds = DEFAULT_COLLECTION_RETRY_DELAY_SECONDS,
    reconciliationDelaySeconds = DEFAULT_COLLECTION_RECONCILIATION_DELAY_SECONDS
  } = {},
  transaction = {}
) {
  requireText(actor, 'actor');
  requirePositiveInteger(limit, 'limit', 1000);
  requirePositiveInteger(retryDelaySeconds, 'retryDelaySeconds', 86400);
  requirePositiveInteger(reconciliationDelaySeconds, 'reconciliationDelaySeconds', 604800);

  return withTransaction(transaction, async (client) => {
    const expired = await client.query(
      `SELECT
         task.*,
         latest_attempt.id AS attempt_id,
         latest_attempt.status AS attempt_status,
         latest_attempt.transport_started_at AS attempt_transport_started_at
       FROM collection_tasks AS task
       LEFT JOIN LATERAL (
         SELECT attempt.id, attempt.status, attempt.transport_started_at
         FROM observation_attempts AS attempt
         WHERE attempt.collection_task_id = task.id
           AND attempt.lease_token = task.lease_token
           AND attempt.lease_fencing_token = task.lease_fencing_token
         ORDER BY attempt.attempt_ordinal DESC
         LIMIT 1
       ) AS latest_attempt ON TRUE
       WHERE task.status = 'leased'
         AND task.lease_until <= clock_timestamp()
       ORDER BY task.lease_until, task.id
       FOR UPDATE OF task SKIP LOCKED
       LIMIT $1`,
      [limit]
    );

    const decisions = [];
    for (const task of expired.rows) {
      const transportMayHaveStarted =
        Boolean(task.attempt_transport_started_at) ||
        ['transport_started', 'unknown', 'reconciliation_pending'].includes(task.attempt_status);

      if (transportMayHaveStarted && task.attempt_id) {
        await markPostStartSupplierReservationUnknownForAttempt({
          client,
          observation_attempt_id: task.attempt_id,
          allocation_reason: 'worker_crash_after_transport_started',
          metadata: {
            lease_fencing_token: task.lease_fencing_token,
            collection_task_id: task.id
          }
        });
        await client.query(
          `UPDATE observation_attempts
           SET status = 'reconciliation_pending',
               finished_at = COALESCE(finished_at, NOW()),
               error_taxonomy = 'unknown_external_outcome',
               error_code = 'lease_expired_after_transport_started',
               error_details = error_details || $2::jsonb,
               retry_reason = 'awaiting_reconciliation',
               reconciliation_status = 'pending',
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            task.attempt_id,
            asJsonObject({ lease_fencing_token: task.lease_fencing_token, transport_outcome_unknown: true })
          ]
        );
        await client.query(
          `UPDATE collection_tasks
           SET status = 'retry_wait',
               lease_owner = NULL,
               lease_token = NULL,
               lease_until = NULL,
               lease_heartbeat_at = NULL,
               next_attempt_at = NOW() + ($2::integer * INTERVAL '1 second'),
               last_error_taxonomy = 'unknown_external_outcome',
               last_error_code = 'lease_expired_after_transport_started',
               last_error_details = $3::jsonb,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            task.id,
            reconciliationDelaySeconds,
            asJsonObject({ observation_attempt_id: task.attempt_id, reconciliation_required: true })
          ]
        );
        await recordTaskEvent(client, {
          taskId: task.id,
          attemptId: task.attempt_id,
          eventType: 'lease_expired',
          fromStatus: 'leased',
          toStatus: 'retry_wait',
          leaseToken: task.lease_token,
          fencingToken: task.lease_fencing_token,
          idempotencyKey: `collection-task:${task.id}:lease-expired:${task.lease_fencing_token}`,
          actor,
          reason: 'transport_outcome_unknown',
          details: { action: 'reconciliation_pending', automatic_reclaim_blocked: true }
        });
        decisions.push({
          task_id: task.id,
          attempt_id: task.attempt_id,
          action: 'reconciliation_pending'
        });
        continue;
      }

      if (task.attempt_id) {
        await releaseUnstartedSupplierReservationForAttempt({
          client,
          observation_attempt_id: task.attempt_id,
          reason: 'worker_crash_before_transport',
          metadata: {
            lease_fencing_token: task.lease_fencing_token,
            collection_task_id: task.id
          }
        });
        await client.query(
          `UPDATE observation_attempts
           SET status = 'crashed',
               finished_at = COALESCE(finished_at, NOW()),
               error_taxonomy = 'worker_crash_before_transport',
               error_code = 'lease_expired_before_transport_started',
               error_details = error_details || $2::jsonb,
               retry_reason = 'lease_expired_before_transport_started',
               reconciliation_status = 'not_required',
               updated_at = NOW()
           WHERE id = $1
             AND transport_started_at IS NULL
             AND status IN ('created', 'cost_reserved')
           RETURNING *`,
          [task.attempt_id, asJsonObject({ lease_fencing_token: task.lease_fencing_token })]
        );
      }

      if (Number(task.native_retry_budget) > 0) {
        await client.query(
          `UPDATE collection_tasks
           SET status = 'retry_wait',
               native_retry_budget = native_retry_budget - 1,
               lease_owner = NULL,
               lease_token = NULL,
               lease_until = NULL,
               lease_heartbeat_at = NULL,
               next_attempt_at = NOW() + ($2::integer * INTERVAL '1 second'),
               last_error_taxonomy = 'worker_crash_before_transport',
               last_error_code = 'lease_expired_before_transport_started',
               last_error_details = $3::jsonb,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            task.id,
            retryDelaySeconds,
            asJsonObject({ observation_attempt_id: task.attempt_id || null, transport_started: false })
          ]
        );
        await recordTaskEvent(client, {
          taskId: task.id,
          attemptId: task.attempt_id,
          eventType: 'lease_expired',
          fromStatus: 'leased',
          toStatus: 'retry_wait',
          leaseToken: task.lease_token,
          fencingToken: task.lease_fencing_token,
          idempotencyKey: `collection-task:${task.id}:lease-expired:${task.lease_fencing_token}`,
          actor,
          reason: 'worker_crash_before_transport',
          details: { action: 'retry_wait', transport_started: false }
        });
        await recordTaskEvent(client, {
          taskId: task.id,
          attemptId: task.attempt_id,
          eventType: 'retry_scheduled',
          fromStatus: 'leased',
          toStatus: 'retry_wait',
          leaseToken: task.lease_token,
          fencingToken: task.lease_fencing_token,
          idempotencyKey: `collection-task:${task.id}:retry-after-expiry:${task.lease_fencing_token}`,
          actor,
          reason: 'lease_expired_before_transport_started',
          details: { delay_seconds: retryDelaySeconds, transport_started: false }
        });
        decisions.push({ task_id: task.id, attempt_id: task.attempt_id || null, action: 'retry_wait' });
        continue;
      }

      await recordTaskEvent(client, {
        taskId: task.id,
        attemptId: task.attempt_id,
        eventType: 'lease_expired',
        fromStatus: 'leased',
        toStatus: 'dead_letter',
        leaseToken: task.lease_token,
        fencingToken: task.lease_fencing_token,
        idempotencyKey: `collection-task:${task.id}:lease-expired:${task.lease_fencing_token}`,
        actor,
        reason: 'worker_crash_retry_budget_exhausted',
        details: { action: 'dead_letter', transport_started: false }
      });
      await transitionToDeadLetter(client, task, {
        actor,
        reason: 'lease_expired_before_transport_retry_budget_exhausted',
        attemptId: task.attempt_id,
        errorDetails: { transport_started: false },
        eventSuffix: `lease-${task.lease_fencing_token}`
      });
      decisions.push({ task_id: task.id, attempt_id: task.attempt_id || null, action: 'dead_letter' });
    }

    return decisions;
  });
}

export async function replayCollectionTask(
  { taskId = null, collectionKey = null, actor, reason, eventId = randomUUID() } = {},
  transaction = {}
) {
  if (Boolean(taskId) === Boolean(collectionKey)) {
    throw new TypeError('provide exactly one of taskId or collectionKey');
  }
  requireText(actor, 'actor');
  requireText(reason, 'reason');
  const selector = taskId ? 'id' : 'collection_key';
  const selectorValue = taskId || collectionKey;

  return withTransaction(transaction, async (client) => {
    const locked = await client.query(
      `SELECT *
       FROM collection_tasks
       WHERE ${selector} = $1
       FOR UPDATE`,
      [selectorValue]
    );
    if (!locked.rowCount) {
      throw new CollectionQueueStateError(
        'collection task is missing',
        'collection_task_not_found'
      );
    }
    const previous = locked.rows[0];
    if (!['dead_letter', 'unavailable'].includes(previous.status)) {
      throw new CollectionQueueStateError(
        'collection task is not in a replayable queue state',
        'collection_task_not_replayable'
      );
    }
    const terminalState = await client.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM observation_results WHERE collection_task_id = $1
         ) AS has_terminal_result,
         EXISTS (
           SELECT 1
           FROM observation_demands
           WHERE collection_task_id = $1
             AND credit_state <> 'reserved'
         ) AS has_terminal_credit`,
      [previous.id]
    );
    if (terminalState.rows[0]?.has_terminal_result || terminalState.rows[0]?.has_terminal_credit) {
      throw new CollectionQueueStateError(
        'terminal result or credit state is immutable; replay requires a pre-result task',
        'collection_task_terminal_result_not_replayable'
      );
    }
    const result = await client.query(
      `UPDATE collection_tasks
       SET status = 'queued',
           lease_owner = NULL,
           lease_token = NULL,
           lease_until = NULL,
           lease_heartbeat_at = NULL,
           next_attempt_at = NOW(),
           replay_count = replay_count + 1,
           last_error_taxonomy = NULL,
           last_error_code = NULL,
           last_error_details = '{}'::jsonb,
           dead_letter_reason = NULL,
           completed_at = NULL,
           unavailable_at = NULL,
           dead_lettered_at = NULL,
           last_replayed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [previous.id]
    );
    const replayed = result.rows[0];
    await recordTaskEvent(client, {
      taskId: previous.id,
      eventType: 'replayed',
      fromStatus: previous.status,
      toStatus: 'queued',
      fencingToken: previous.lease_fencing_token,
      idempotencyKey: `collection-task:${previous.id}:replay:${eventId}`,
      actor,
      reason,
      details: {
        collection_key: previous.collection_key,
        same_task_id: replayed.id === previous.id,
        same_collection_key: replayed.collection_key === previous.collection_key
      }
    });
    return replayed;
  });
}
