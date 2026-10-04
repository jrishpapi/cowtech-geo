import { classifyPhase7Failure } from './phase7-live-runner.js';

const TERMINAL = new Set(['completed', 'dlq', 'held']);

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
  return value;
}

export function createPhase7RecoveryState({
  itemKey,
  maxAttempts = 3,
  initialStatus = 'live_frozen'
} = {}) {
  if (!['live_frozen', 'planned'].includes(initialStatus)) {
    throw new RangeError('initialStatus must be live_frozen or planned');
  }
  return Object.freeze({
    schema_version: 'phase7-recovery-state-v1',
    item_key: required(itemKey, 'itemKey'),
    status: initialStatus,
    attempts: 0,
    max_attempts: positiveInteger(maxAttempts, 'maxAttempts'),
    lease_id: null,
    last_failure: null,
    replay_authority_ref: null,
    history: Object.freeze([])
  });
}

function transition(state, event, patch) {
  return Object.freeze({
    ...state,
    ...patch,
    history: Object.freeze([
      ...state.history,
      Object.freeze({
        sequence: state.history.length + 1,
        event: event.type,
        from: state.status,
        to: patch.status ?? state.status
      })
    ])
  });
}

export function applyPhase7RecoveryEvent(state, event = {}) {
  if (state?.schema_version !== 'phase7-recovery-state-v1') {
    throw new TypeError('invalid Phase 7 recovery state');
  }
  if (TERMINAL.has(state.status) && event.type !== 'replay_dlq') {
    throw new Error(`cannot apply ${event.type} to terminal state ${state.status}`);
  }
  switch (event.type) {
    case 'arm_fixture':
      if (state.status !== 'live_frozen') throw new Error('only live_frozen items can be fixture-armed');
      return transition(state, event, { status: 'planned' });
    case 'lease':
      if (!['planned', 'retryable'].includes(state.status)) {
        throw new Error(`cannot lease item in ${state.status}`);
      }
      if (state.attempts >= state.max_attempts) throw new Error('max attempts already reached');
      return transition(state, event, {
        status: 'leased',
        attempts: state.attempts + 1,
        lease_id: required(event.lease_id, 'event.lease_id')
      });
    case 'complete':
      if (state.status !== 'leased') throw new Error('only leased items can complete');
      return transition(state, event, { status: 'completed', lease_id: null });
    case 'worker_crash':
    case 'lease_timeout': {
      if (state.status !== 'leased') throw new Error(`${event.type} requires a leased item`);
      const exhausted = state.attempts >= state.max_attempts;
      return transition(state, event, {
        status: exhausted ? 'dlq' : 'retryable',
        lease_id: null,
        last_failure: event.type
      });
    }
    case 'attempt_failed': {
      if (state.status !== 'leased') throw new Error('attempt_failed requires a leased item');
      const failure = classifyPhase7Failure(required(event.code, 'event.code'));
      const exhausted = state.attempts >= state.max_attempts;
      return transition(state, event, {
        status: failure.retryable ? (exhausted ? 'dlq' : 'retryable') : 'held',
        lease_id: null,
        last_failure: failure.code,
        failure_classification: failure.classification
      });
    }
    case 'replay_dlq':
      if (state.status !== 'dlq') throw new Error('only DLQ items can be replayed');
      return transition(state, event, {
        status: 'planned',
        attempts: 0,
        lease_id: null,
        replay_authority_ref: required(event.authority_ref, 'event.authority_ref')
      });
    default:
      throw new RangeError(`unsupported Phase 7 recovery event: ${event.type}`);
  }
}

export function runPhase7RecoveryDrill() {
  let workerCrash = createPhase7RecoveryState({ itemKey: 'fixture-worker-crash' });
  workerCrash = applyPhase7RecoveryEvent(workerCrash, { type: 'arm_fixture' });
  workerCrash = applyPhase7RecoveryEvent(workerCrash, { type: 'lease', lease_id: 'lease-1' });
  workerCrash = applyPhase7RecoveryEvent(workerCrash, { type: 'worker_crash' });
  workerCrash = applyPhase7RecoveryEvent(workerCrash, { type: 'lease', lease_id: 'lease-2' });
  workerCrash = applyPhase7RecoveryEvent(workerCrash, { type: 'complete' });

  let dlqReplay = createPhase7RecoveryState({ itemKey: 'fixture-dlq', maxAttempts: 1 });
  dlqReplay = applyPhase7RecoveryEvent(dlqReplay, { type: 'arm_fixture' });
  dlqReplay = applyPhase7RecoveryEvent(dlqReplay, { type: 'lease', lease_id: 'lease-3' });
  dlqReplay = applyPhase7RecoveryEvent(dlqReplay, { type: 'attempt_failed', code: 'http_5xx' });
  dlqReplay = applyPhase7RecoveryEvent(dlqReplay, {
    type: 'replay_dlq',
    authority_ref: 'fixture:phase7-recovery-drill'
  });

  const recoverableFailures = {};
  for (const code of ['http_429', 'http_5xx', 'answer_timeout', 'supplier_disconnect']) {
    let state = createPhase7RecoveryState({ itemKey: `fixture-${code}` });
    state = applyPhase7RecoveryEvent(state, { type: 'arm_fixture' });
    state = applyPhase7RecoveryEvent(state, { type: 'lease', lease_id: `${code}-lease-1` });
    state = applyPhase7RecoveryEvent(state, { type: 'attempt_failed', code });
    state = applyPhase7RecoveryEvent(state, { type: 'lease', lease_id: `${code}-lease-2` });
    state = applyPhase7RecoveryEvent(state, { type: 'complete' });
    recoverableFailures[code] = state;
  }
  const failureMatrixPassed = Object.values(recoverableFailures)
    .every((state) => state.status === 'completed' && state.attempts === 2);
  const structuralHolds = {};
  for (const code of ['challenge', 'selector_drift', 'surface_login_wall', 'geo_mismatch']) {
    let state = createPhase7RecoveryState({ itemKey: `fixture-${code}` });
    state = applyPhase7RecoveryEvent(state, { type: 'arm_fixture' });
    state = applyPhase7RecoveryEvent(state, { type: 'lease', lease_id: `${code}-lease-1` });
    state = applyPhase7RecoveryEvent(state, { type: 'attempt_failed', code });
    structuralHolds[code] = state;
  }
  const structuralHoldMatrixPassed = Object.values(structuralHolds)
    .every((state) => state.status === 'held' && state.attempts === 1);

  return Object.freeze({
    schema_version: 'phase7-recovery-drill-v1',
    status: workerCrash.status === 'completed' &&
      dlqReplay.status === 'planned' &&
      failureMatrixPassed &&
      structuralHoldMatrixPassed
      ? 'passed'
      : 'failed',
    worker_crash_recovered: workerCrash.status === 'completed',
    dlq_replay_planned: dlqReplay.status === 'planned',
    recoverable_failure_matrix_passed: failureMatrixPassed,
    structural_hold_matrix_passed: structuralHoldMatrixPassed,
    network_calls_performed: 0,
    transport_authorized: false,
    scenarios: Object.freeze({
      worker_crash: workerCrash,
      dlq_replay: dlqReplay,
      recoverable_failures: Object.freeze(recoverableFailures),
      structural_holds: Object.freeze(structuralHolds)
    })
  });
}
