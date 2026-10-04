export const PHASE7_CASH_HARD_LIMIT_MICRO_USD = 65_000_000;
export const PHASE7_COGS_SOFT_WARNING_MICRO_USD = 45_000_000;
export const PHASE7_COGS_HARD_LIMIT_MICRO_USD = 50_000_000;

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function authority(value) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError('resumeAuthorityRef is required');
  return normalized;
}

export class Phase7BudgetHardStopError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'Phase7BudgetHardStopError';
    this.code = code;
  }
}

export class Phase7BudgetHardStop {
  #approvedLimit;
  #committed;
  #reserved;
  #tripped;
  #resumeAuthorityRef;

  constructor({
    approvedLimitMicroUsd = 0,
    committedMicroUsd = 0,
    reservedMicroUsd = 0,
    tripped = false,
    resumeAuthorityRef = null
  } = {}) {
    this.#approvedLimit = nonNegativeInteger(approvedLimitMicroUsd, 'approvedLimitMicroUsd');
    this.#committed = nonNegativeInteger(committedMicroUsd, 'committedMicroUsd');
    this.#reserved = nonNegativeInteger(reservedMicroUsd, 'reservedMicroUsd');
    if (this.#approvedLimit > PHASE7_CASH_HARD_LIMIT_MICRO_USD) {
      throw new RangeError('approvedLimitMicroUsd cannot exceed the authorized Phase 7 $65 cash hard limit');
    }
    if (this.#committed + this.#reserved > this.#approvedLimit && this.#approvedLimit > 0) {
      throw new RangeError('restored budget state exceeds approved limit');
    }
    this.#tripped = tripped === true;
    this.#resumeAuthorityRef = resumeAuthorityRef ? authority(resumeAuthorityRef) : null;
  }

  reserve(estimatedMicroUsd) {
    const amount = nonNegativeInteger(estimatedMicroUsd, 'estimatedMicroUsd');
    if (this.#approvedLimit === 0) {
      this.#tripped = true;
      throw new Phase7BudgetHardStopError(
        'phase7_budget_zero',
        'Phase 7 budget is zero and external spend remains frozen'
      );
    }
    if (this.#tripped) {
      throw new Phase7BudgetHardStopError(
        'phase7_budget_hard_stop_open',
        'Phase 7 budget hard stop is open'
      );
    }
    if (this.#committed + this.#reserved + amount > this.#approvedLimit) {
      this.#tripped = true;
      throw new Phase7BudgetHardStopError(
        'phase7_budget_limit_exceeded',
        'Phase 7 reservation would exceed the approved budget'
      );
    }
    this.#reserved += amount;
    let terminal = false;
    return Object.freeze({
      commit: (actualMicroUsd = amount) => {
        if (terminal) throw new Error('budget reservation is already terminal');
        const actual = nonNegativeInteger(actualMicroUsd, 'actualMicroUsd');
        terminal = true;
        this.#reserved -= amount;
        this.#committed += actual;
        if (
          this.#committed > this.#approvedLimit ||
          this.#committed > PHASE7_CASH_HARD_LIMIT_MICRO_USD
        ) {
          this.#tripped = true;
        }
        return this.snapshot();
      },
      release: () => {
        if (terminal) throw new Error('budget reservation is already terminal');
        terminal = true;
        this.#reserved -= amount;
        return this.snapshot();
      }
    });
  }

  trip(reason = 'manual_hard_stop') {
    this.#tripped = true;
    return Object.freeze({ ...this.snapshot(), trip_reason: String(reason) });
  }

  resume({ resumeAuthorityRef } = {}) {
    if (!this.#tripped) throw new Error('Phase 7 budget hard stop is not open');
    if (this.#approvedLimit === 0) {
      throw new Phase7BudgetHardStopError(
        'phase7_budget_zero',
        'cannot resume while the approved Phase 7 budget is zero'
      );
    }
    if (this.#reserved !== 0) {
      throw new Phase7BudgetHardStopError(
        'phase7_budget_reservations_outstanding',
        'cannot resume with outstanding reservations'
      );
    }
    if (this.#committed >= this.#approvedLimit) {
      throw new Phase7BudgetHardStopError(
        'phase7_budget_exhausted',
        'cannot resume an exhausted Phase 7 budget'
      );
    }
    this.#resumeAuthorityRef = authority(resumeAuthorityRef);
    this.#tripped = false;
    return this.snapshot();
  }

  checkpoint() {
    return Object.freeze({
      schema_version: 'phase7-budget-checkpoint-v1',
      ...this.snapshot()
    });
  }

  snapshot() {
    const used = this.#committed + this.#reserved;
    return Object.freeze({
      approved_limit_micro_usd: this.#approvedLimit,
      cash_hard_limit_micro_usd: PHASE7_CASH_HARD_LIMIT_MICRO_USD,
      cogs_soft_warning_micro_usd: PHASE7_COGS_SOFT_WARNING_MICRO_USD,
      cogs_hard_limit_micro_usd: PHASE7_COGS_HARD_LIMIT_MICRO_USD,
      committed_micro_usd: this.#committed,
      reserved_micro_usd: this.#reserved,
      remaining_micro_usd: Math.max(0, this.#approvedLimit - used),
      cash_warning: false,
      hard_stop_open: this.#tripped,
      resume_authority_ref: this.#resumeAuthorityRef,
      transport_authorized: false
    });
  }

  static restore(checkpoint = {}) {
    if (checkpoint.schema_version !== 'phase7-budget-checkpoint-v1') {
      throw new TypeError('invalid Phase 7 budget checkpoint');
    }
    return new Phase7BudgetHardStop({
      approvedLimitMicroUsd: checkpoint.approved_limit_micro_usd,
      committedMicroUsd: checkpoint.committed_micro_usd,
      reservedMicroUsd: checkpoint.reserved_micro_usd,
      tripped: checkpoint.hard_stop_open,
      resumeAuthorityRef: checkpoint.resume_authority_ref
    });
  }
}
