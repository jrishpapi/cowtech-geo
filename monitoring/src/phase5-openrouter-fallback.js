import { PHASE5_GUEST_SURFACES } from './phase5-surface-contract.js';

const ELIGIBLE_FAILURES = new Set([
  'answer_timeout',
  'surface_rate_limited',
  'surface_unavailable',
  'browser_transport_failed',
  'selector_drift',
  'prompt_input_missing'
]);

export class Phase5OpenRouterFallback {
  constructor({ provider } = {}) {
    this.provider = provider;
  }

  async run({ requestedSurface, failureCode, providerInput = {} } = {}) {
    const contract = PHASE5_GUEST_SURFACES[requestedSurface];
    if (!contract) throw new TypeError('requestedSurface is not a Phase 5 guest surface');
    if (!ELIGIBLE_FAILURES.has(String(failureCode || ''))) {
      return Object.freeze({ status: 'not_routed', reason: 'failure_not_fallback_eligible' });
    }
    if (!this.provider || typeof this.provider.runPrompt !== 'function') {
      throw new TypeError('OpenRouter provider.runPrompt is required');
    }
    const providerResult = await this.provider.runPrompt({
      ...providerInput,
      modelTarget: {
        ...(providerInput.modelTarget || {}),
        model_id: contract.fallback_model
      }
    });
    return Object.freeze({
      status: 'completed',
      requested_surface: requestedSurface,
      acquisition_mode: 'api_fallback',
      outcome: 'api_fallback',
      credit_settlement: 'not_native_ui_credit',
      fallback_reason: failureCode,
      fallback_model: contract.fallback_model,
      provider_result: providerResult
    });
  }
}
