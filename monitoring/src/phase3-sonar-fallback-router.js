const ELIGIBLE_FAILURES = new Set([
  'answer_timeout',
  'surface_rate_limited',
  'surface_unavailable',
  'browser_transport_failed',
  'selector_drift'
]);

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export class SonarFallbackRouter {
  constructor({ targetRatio = 0.03, hardLimitRatio = 0.05 } = {}) {
    if (!(targetRatio >= 0 && targetRatio <= hardLimitRatio)) throw new RangeError('targetRatio is invalid');
    if (!(hardLimitRatio > 0 && hardLimitRatio <= 0.05)) throw new RangeError('hardLimitRatio must be in (0, 0.05]');
    this.targetRatio = targetRatio;
    this.hardLimitRatio = hardLimitRatio;
  }

  decide({ requestedSurface, plannedObservations, fallbackCalls, failureCode }) {
    const planned = nonNegativeInteger(plannedObservations, 'plannedObservations');
    const calls = nonNegativeInteger(fallbackCalls, 'fallbackCalls');
    if (requestedSurface !== 'perplexity_ui') {
      return Object.freeze({ allowed: false, reason: 'sonar_only_supports_perplexity_ui' });
    }
    if (!ELIGIBLE_FAILURES.has(String(failureCode || ''))) {
      return Object.freeze({ allowed: false, reason: 'failure_not_fallback_eligible' });
    }
    if (planned === 0) return Object.freeze({ allowed: false, reason: 'planned_observations_zero' });
    const hardLimitCalls = Math.floor(planned * this.hardLimitRatio);
    if (calls >= hardLimitCalls) {
      return Object.freeze({
        allowed: false,
        reason: 'sonar_hard_limit_reached',
        hard_limit_calls: hardLimitCalls
      });
    }
    return Object.freeze({
      allowed: true,
      reason: calls < Math.floor(planned * this.targetRatio) ? 'within_target' : 'above_target_within_hard_limit',
      projected_ratio: (calls + 1) / planned,
      hard_limit_calls: hardLimitCalls
    });
  }

  async run({ provider, providerInput, requestedSurface, plannedObservations, fallbackCalls, failureCode }) {
    const decision = this.decide({ requestedSurface, plannedObservations, fallbackCalls, failureCode });
    if (!decision.allowed) return Object.freeze({ status: 'not_routed', decision });
    if (!provider || typeof provider.runPrompt !== 'function') throw new TypeError('provider.runPrompt is required');
    const result = await provider.runPrompt(providerInput);
    return Object.freeze({
      status: 'completed',
      decision,
      result: Object.freeze({
        ...result,
        requested_surface: 'perplexity_ui',
        acquisition_mode: 'api_fallback',
        outcome: 'api_fallback',
        credit_settlement: 'not_native_ui_credit',
        fallback_reason: failureCode,
        normalized_answer: Object.freeze({
          ...(result.normalized_answer || {}),
          acquisition_mode: 'api_fallback',
          requested_surface: 'perplexity_ui',
          fallback_provider: 'sonar'
        })
      })
    });
  }
}
