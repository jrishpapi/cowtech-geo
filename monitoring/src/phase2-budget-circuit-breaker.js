function nonNegative(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

export class Phase2BudgetExceededError extends Error {
  constructor(message = 'Phase 2 local budget circuit breaker is open') {
    super(message);
    this.name = 'Phase2BudgetExceededError';
    this.code = 'phase2_budget_circuit_open';
  }
}

export class Phase2BudgetCircuitBreaker {
  #limit;
  #committed = 0;
  #reserved = 0;
  #open = false;

  constructor({ limitMicroUsd = 0 } = {}) {
    this.#limit = nonNegative(limitMicroUsd, 'limitMicroUsd');
  }

  reserve(estimatedMicroUsd) {
    const amount = nonNegative(estimatedMicroUsd, 'estimatedMicroUsd');
    if (this.#open || this.#limit === 0 || this.#committed + this.#reserved + amount > this.#limit) {
      this.#open = true;
      throw new Phase2BudgetExceededError();
    }
    this.#reserved += amount;
    let terminal = false;
    return Object.freeze({
      commit: (actualMicroUsd = amount) => {
        if (terminal) throw new Error('budget reservation is already terminal');
        const actual = nonNegative(actualMicroUsd, 'actualMicroUsd');
        terminal = true;
        this.#reserved -= amount;
        this.#committed += actual;
        if (this.#committed > this.#limit) this.#open = true;
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

  trip() {
    this.#open = true;
  }

  snapshot() {
    return Object.freeze({
      limit_micro_usd: this.#limit,
      reserved_micro_usd: this.#reserved,
      committed_micro_usd: this.#committed,
      remaining_micro_usd: Math.max(0, this.#limit - this.#reserved - this.#committed),
      open: this.#open
    });
  }
}
