import { randomUUID } from 'node:crypto';
import { heartbeatCollectionTask } from './collection-queue.js';

export class Phase1LeaseHeartbeatError extends Error {
  constructor(message = 'Phase 1 collection lease heartbeat failed', cause = undefined) {
    super(message, cause ? { cause } : undefined);
    this.name = 'Phase1LeaseHeartbeatError';
    this.code = 'phase1_collection_lease_heartbeat_failed';
  }
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function nonEmptyString(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

/**
 * Keep one collection-task lease alive while local work is in progress.
 *
 * The supplied work must call fenceForCommit immediately before its terminal
 * database transition.  A heartbeat failure aborts the signal and makes that
 * fence fail, so stale work cannot reach the finalizer after losing its lease.
 */
export async function runWithCollectionLeaseHeartbeat(
  {
    pool,
    taskId,
    leaseToken,
    fencingToken,
    workerId,
    leaseSeconds,
    heartbeatMs,
    parentSignal = null
  } = {},
  work,
  { heartbeat = heartbeatCollectionTask } = {}
) {
  if (typeof work !== 'function') throw new TypeError('work must be a function');
  if (typeof heartbeat !== 'function') throw new TypeError('heartbeat must be a function');
  const normalizedTaskId = nonEmptyString(taskId, 'taskId');
  const normalizedLeaseToken = nonEmptyString(leaseToken, 'leaseToken');
  const normalizedWorkerId = nonEmptyString(workerId, 'workerId');
  const normalizedFencingToken = positiveInteger(Number(fencingToken), 'fencingToken');
  const normalizedLeaseSeconds = positiveInteger(leaseSeconds, 'leaseSeconds');
  const normalizedHeartbeatMs = positiveInteger(heartbeatMs, 'heartbeatMs');
  if (normalizedHeartbeatMs >= normalizedLeaseSeconds * 1000) {
    throw new RangeError('heartbeatMs must be less than the collection lease duration');
  }

  const controller = new AbortController();
  let timer = null;
  let heartbeatFailure = null;
  let heartbeatInFlight = null;
  let commitFenceCalled = false;
  let stopped = false;

  const abortFor = (error) => {
    if (!controller.signal.aborted) controller.abort(error);
  };
  const onParentAbort = () => abortFor(parentSignal.reason || new Error('parent operation aborted'));
  if (parentSignal) {
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  const performHeartbeat = async (phase) => {
    if (heartbeatFailure) throw heartbeatFailure;
    try {
      return await heartbeat(
        {
          taskId: normalizedTaskId,
          leaseToken: normalizedLeaseToken,
          fencingToken: normalizedFencingToken,
          workerId: normalizedWorkerId,
          leaseSeconds: normalizedLeaseSeconds,
          heartbeatId: `${normalizedFencingToken}:${phase}:${randomUUID()}`
        },
        { pool }
      );
    } catch (error) {
      heartbeatFailure = error instanceof Phase1LeaseHeartbeatError
        ? error
        : new Phase1LeaseHeartbeatError('Phase 1 collection lease heartbeat failed', error);
      abortFor(heartbeatFailure);
      throw heartbeatFailure;
    }
  };

  const heartbeatNow = async (phase = 'manual') => {
    if (stopped) throw new Phase1LeaseHeartbeatError('Phase 1 collection lease heartbeat is stopped');
    if (heartbeatInFlight) await heartbeatInFlight;
    heartbeatInFlight = performHeartbeat(phase);
    try {
      return await heartbeatInFlight;
    } finally {
      heartbeatInFlight = null;
    }
  };

  const periodicHeartbeat = () => {
    if (stopped || heartbeatInFlight || heartbeatFailure) return;
    heartbeatInFlight = performHeartbeat('periodic');
    void heartbeatInFlight
      .catch(() => undefined)
      .finally(() => {
        heartbeatInFlight = null;
      });
  };

  const fenceForCommit = async () => {
    if (commitFenceCalled) throw new Error('fenceForCommit may only be called once');
    commitFenceCalled = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (heartbeatInFlight) await heartbeatInFlight;
    if (heartbeatFailure) throw heartbeatFailure;
    if (controller.signal.aborted) {
      throw controller.signal.reason || new Phase1LeaseHeartbeatError('Phase 1 collection work was aborted');
    }
    await performHeartbeat('before-commit');
    stopped = true;
  };

  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    await heartbeatNow('claimed');
    timer = setInterval(periodicHeartbeat, normalizedHeartbeatMs);
    const result = await work({ signal: controller.signal, heartbeatNow, fenceForCommit });
    if (!commitFenceCalled) {
      throw new Error('Phase 1 collection work returned without a final lease fence');
    }
    if (heartbeatFailure) throw heartbeatFailure;
    return result;
  } finally {
    stopped = true;
    if (timer) clearInterval(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
    if (heartbeatInFlight) await heartbeatInFlight.catch(() => undefined);
  }
}
