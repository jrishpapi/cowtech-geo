import { PHASE7_CASH_HARD_LIMIT_MICRO_USD } from './phase7-budget-hard-stop.js';

const TRANSIENT_FAILURES = new Set([
  'answer_timeout',
  'http_429',
  'http_5xx',
  'phase2_observation_context_create_timeout',
  'phase2_observation_deadline_exceeded',
  'phase2_observation_page_create_timeout',
  'phase2_observation_resource_policy_timeout',
  'supplier_disconnect',
  'transport_timeout'
]);

const STRUCTURAL_FAILURES = new Set([
  'account_challenge',
  'auth_failed',
  'challenge',
  'geo_mismatch',
  'policy_blocked',
  'selector_drift',
  'session_continuity_broken',
  'surface_login_wall'
]);

function nonEmpty(value, name) {
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

export function classifyPhase7Failure(errorCode) {
  const code = nonEmpty(errorCode, 'errorCode');
  if (TRANSIENT_FAILURES.has(code)) {
    return Object.freeze({
      code,
      classification: 'transient',
      retryable: true,
      requires_fresh_session: true,
      requires_operator_authority: false
    });
  }
  if (STRUCTURAL_FAILURES.has(code)) {
    return Object.freeze({
      code,
      classification: 'structural_hold',
      retryable: false,
      requires_fresh_session: true,
      requires_operator_authority: true
    });
  }
  return Object.freeze({
    code,
    classification: 'unknown_hold',
    retryable: false,
    requires_fresh_session: true,
    requires_operator_authority: true
  });
}

export function buildPhase7SessionBinding({ runId, item } = {}) {
  const run = nonEmpty(runId, 'runId');
  if (!item || typeof item !== 'object') throw new TypeError('item is required');
  if (item.acquisition_mode === 'serpapi_aio') {
    if (
      item.surface !== 'google_aio' || item.session_mode !== 'not_applicable' ||
      item.session_cycle !== null || item.session_ordinal !== null || item.no_cache !== true
    ) {
      throw new Error('Google AIO item violates the no-session/no-cache contract');
    }
    return Object.freeze({
      mode: 'not_applicable',
      cycle: null,
      ordinal: null,
      environment: null,
      force_fresh_session: false
    });
  }
  if (item.acquisition_mode !== 'web_ui') throw new RangeError('unsupported acquisition_mode');
  if (!['chatgpt_ui', 'perplexity_ui'].includes(item.surface)) {
    throw new RangeError('unsupported Phase 7 web surface');
  }
  const cycle = positiveInteger(item.session_cycle, 'item.session_cycle');
  const ordinal = positiveInteger(item.session_ordinal, 'item.session_ordinal');
  if (ordinal > 100) throw new RangeError('item.session_ordinal cannot exceed 100');
  const expectedMode = ordinal === 1 ? 'cold' : 'warm';
  if (item.session_mode !== expectedMode) {
    throw new Error(`session_mode must be ${expectedMode} for ordinal ${ordinal}`);
  }
  return Object.freeze({
    mode: expectedMode,
    cycle,
    ordinal,
    environment: `phase7-${run}-${item.surface}-cycle-${cycle}`,
    force_fresh_session: ordinal === 1,
    checkpoint: item.session_checkpoint ?? null
  });
}

export function assertPhase7ProductionGate({ liveReadiness, controls, runId } = {}) {
  const blockers = [];
  if (liveReadiness?.schema_version !== 'phase7-live-readiness-v1') {
    blockers.push('phase7_live_readiness_invalid');
  }
  if (liveReadiness?.live_allowed !== true) blockers.push('phase7_live_not_allowed');
  const approvedBudget = Number(liveReadiness?.approved_budget_micro_usd || 0);
  if (!Number.isSafeInteger(approvedBudget) || approvedBudget <= 0) {
    blockers.push('phase7_positive_budget_missing');
  }
  if (approvedBudget > PHASE7_CASH_HARD_LIMIT_MICRO_USD) {
    blockers.push('phase7_budget_exceeds_authority');
  }
  for (const flag of [
    'engineering_contract_enabled',
    'production_runner_enabled',
    'live_execution_enabled',
    'paid_transport_enabled',
    'external_spend_enabled',
    'phase6_exit_passed'
  ]) {
    if (controls?.[flag] !== true) blockers.push(`${flag}_missing`);
  }
  if (controls?.approved_budget_micro_usd !== approvedBudget) {
    blockers.push('phase7_budget_authority_mismatch');
  }
  if (!String(controls?.live_authority_ref || '').trim()) {
    blockers.push('phase7_live_authority_missing');
  }
  nonEmpty(runId, 'runId');
  if (blockers.length) {
    const error = new Error(`Phase 7 production gate blocked: ${blockers.join(',')}`);
    error.code = 'phase7_production_gate_blocked';
    error.blockers = Object.freeze(blockers);
    throw error;
  }
  return Object.freeze({
    allowed: true,
    run_id: String(runId),
    authority_ref: controls.live_authority_ref,
    approved_budget_micro_usd: approvedBudget
  });
}

function validDelivery(result) {
  return result?.delivery_valid === true &&
    result?.native_valid === true &&
    result?.evidence_verified === true;
}

export class Phase7LiveRunner {
  constructor({ repository, permitIssuer, webTransport, aioTransport, maxAttempts = 3 } = {}) {
    for (const [name, value, method] of [
      ['repository', repository, 'claimNext'],
      ['permitIssuer', permitIssuer, 'issue'],
      ['webTransport', webTransport, 'run'],
      ['aioTransport', aioTransport, 'run']
    ]) {
      if (!value || typeof value[method] !== 'function') {
        throw new TypeError(`${name}.${method} is required`);
      }
    }
    if (typeof permitIssuer.finalize !== 'function') {
      throw new TypeError('permitIssuer.finalize is required');
    }
    if (typeof repository.recordOutcome !== 'function') {
      throw new TypeError('repository.recordOutcome is required');
    }
    if (typeof repository.verifySessionContinuity !== 'function') {
      throw new TypeError('repository.verifySessionContinuity is required');
    }
    this.repository = repository;
    this.permitIssuer = permitIssuer;
    this.webTransport = webTransport;
    this.aioTransport = aioTransport;
    this.maxAttempts = positiveInteger(maxAttempts, 'maxAttempts');
  }

  async runNext({ runId, workerId, liveReadiness, controls } = {}) {
    const gate = assertPhase7ProductionGate({ liveReadiness, controls, runId });
    const worker = nonEmpty(workerId, 'workerId');
    const item = await this.repository.claimNext({
      runId: gate.run_id,
      workerId: worker,
      authorityRef: gate.authority_ref
    });
    if (!item) return Object.freeze({ status: 'idle', run_id: gate.run_id });
    const existingAttempts = Number(item.attempt_count || 0);
    if (!Number.isSafeInteger(existingAttempts) || existingAttempts < 0) {
      throw new Error('claimed item attempt_count is invalid');
    }
    if (existingAttempts >= this.maxAttempts) {
      throw new Error('claimed item has exhausted its retry budget');
    }
    const attemptOrdinal = existingAttempts + 1;
    const session = buildPhase7SessionBinding({ runId: gate.run_id, item });
    const attemptItem = Object.freeze({
      ...item,
      item_key: `${item.item_key}:attempt:${attemptOrdinal}`,
      phase7_item_key: item.item_key,
      session_environment: session.environment,
      force_fresh_session: session.force_fresh_session,
      phase7_attempt_ordinal: attemptOrdinal
    });
    const permit = await this.permitIssuer.issue({ item: attemptItem });
    let result;
    try {
      const transport = item.acquisition_mode === 'web_ui' ? this.webTransport : this.aioTransport;
      result = await transport.run(Object.freeze({ ...attemptItem, budgetPermit: permit }));
    } catch (error) {
      result = Object.freeze({
        delivery_valid: false,
        native_valid: false,
        evidence_verified: false,
        transport_started: error?.transport_started === true,
        settled_cost_micro_usd: Number.isSafeInteger(error?.settled_cost_micro_usd)
          ? error.settled_cost_micro_usd
          : 0,
        cost_basis: error?.transport_started === true ? 'unknown_or_conservative' : null,
        error_code: error?.code || 'unknown_transport_error',
        failure_detail: String(error?.message || error?.code || 'unknown transport error')
      });
    }
    await this.permitIssuer.finalize({ item: attemptItem, permit, result });
    if (validDelivery(result) && item.acquisition_mode === 'web_ui') {
      const continuity = await this.repository.verifySessionContinuity({
        runId: gate.run_id,
        item,
        attemptOrdinal,
        session,
        providerSessionId: result.provider_session_id
      });
      if (continuity?.verified !== true) {
        result = Object.freeze({
          ...result,
          delivery_valid: false,
          native_valid: false,
          error_code: 'session_continuity_broken',
          failure_detail: 'provider session identity did not match the frozen 100-demand cycle'
        });
      }
    }
    if (validDelivery(result)) {
      const outcome = await this.repository.recordOutcome({
        runId: gate.run_id,
        workerId: worker,
        item,
        attemptOrdinal,
        status: 'completed',
        result,
        session,
        failure: null
      });
      return Object.freeze({ status: 'completed', item_key: item.item_key, outcome });
    }
    const failure = classifyPhase7Failure(result?.error_code || 'unknown_result_failure');
    const exhausted = attemptOrdinal >= this.maxAttempts;
    const status = failure.retryable && !exhausted
      ? 'retryable'
      : failure.retryable
        ? 'dlq'
        : 'held';
    const outcome = await this.repository.recordOutcome({
      runId: gate.run_id,
      workerId: worker,
      item,
      attemptOrdinal,
      status,
      result,
      session,
      failure
    });
    return Object.freeze({
      status,
      item_key: item.item_key,
      attempt_ordinal: attemptOrdinal,
      failure,
      outcome
    });
  }
}
