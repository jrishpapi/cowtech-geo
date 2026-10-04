export const PHASE5_SURFACE_CONTRACT_VERSION = 'phase5-pro-god-guest-surfaces-v1';

export const PHASE5_GUEST_SURFACES = Object.freeze({
  gemini_ui: Object.freeze({
    plan: 'pro',
    route: 'bright_data_guest',
    adapter_version: 'gemini-guest-ui-v1',
    fallback_model: 'google/gemini-2.5-flash',
    rate_limit: Object.freeze({ requests: 6, window_ms: 60_000 }),
    circuit_breaker: Object.freeze({ failures: 3, cooldown_ms: 300_000 })
  }),
  grok_ui: Object.freeze({
    plan: 'pro',
    route: 'bright_data_guest',
    adapter_version: 'grok-guest-ui-v1',
    fallback_model: 'x-ai/grok-4.20',
    rate_limit: Object.freeze({ requests: 6, window_ms: 60_000 }),
    circuit_breaker: Object.freeze({ failures: 3, cooldown_ms: 300_000 })
  }),
  qwen_ui: Object.freeze({
    plan: 'god',
    route: 'bright_data_guest',
    adapter_version: 'qwen-guest-ui-v1',
    fallback_model: 'qwen/qwen3.6-plus',
    rate_limit: Object.freeze({ requests: 6, window_ms: 60_000 }),
    circuit_breaker: Object.freeze({ failures: 3, cooldown_ms: 300_000 })
  })
});

const PLAN_RANK = Object.freeze({ starter: 0, pro: 1, god: 2 });

export function buildPhase5SurfaceEntitlement({ planCode, claudeAddonEnabled = false } = {}) {
  const normalizedPlan = String(planCode || '').trim().toLowerCase();
  const rank = PLAN_RANK[normalizedPlan] ?? -1;
  const surfaces = Object.fromEntries(
    Object.entries(PHASE5_GUEST_SURFACES).map(([surface, contract]) => [
      surface,
      rank >= PLAN_RANK[contract.plan]
    ])
  );
  return Object.freeze({
    schema_version: 'phase5-surface-entitlement-v1',
    plan_code: normalizedPlan || null,
    guest_surfaces: Object.freeze(surfaces),
    claude_addon: Object.freeze({
      entitled: claudeAddonEnabled === true,
      core_surface: false,
      execution_status: 'boundary_only'
    }),
    login_surfaces: Object.freeze({
      deepseek_ui: 'not_in_current_dod',
      mistral_vibe_ui: 'not_in_current_dod'
    })
  });
}

export function assertPhase5SurfaceEntitled({ entitlement, requestedSurface } = {}) {
  if (!PHASE5_GUEST_SURFACES[requestedSurface]) {
    throw new TypeError('requestedSurface is not a Phase 5 guest surface');
  }
  if (entitlement?.guest_surfaces?.[requestedSurface] !== true) {
    const error = new Error(`${requestedSurface} is not entitled`);
    error.code = 'phase5_surface_not_entitled';
    throw error;
  }
  return true;
}

export function assertPhase5Provenance(record = {}) {
  const surface = String(record.requested_surface || '');
  if (!PHASE5_GUEST_SURFACES[surface]) throw new TypeError('requested_surface is not a Phase 5 guest surface');
  const outcome = String(record.outcome || '');
  if (!['web_ui_observed', 'api_fallback', 'surface_unavailable', 'technical_failed'].includes(outcome)) {
    throw new TypeError('outcome is invalid for requested_surface');
  }
  if (outcome === 'web_ui_observed' && record.acquisition_mode !== 'web_ui') {
    throw new Error('native guest observation must use web_ui acquisition mode');
  }
  if (outcome === 'api_fallback') {
    if (record.acquisition_mode !== 'api_fallback') throw new Error('API fallback provenance mismatch');
    if (record.credit_settlement !== 'not_native_ui_credit') {
      throw new Error('API fallback cannot settle native UI credit');
    }
  }
  return true;
}

export class Phase5SurfaceRuntimeGuard {
  constructor({ contracts = PHASE5_GUEST_SURFACES, now = () => Date.now() } = {}) {
    this.contracts = contracts;
    this.now = now;
    this.state = new Map();
  }

  acquire(surface) {
    const contract = this.contracts[surface];
    if (!contract) throw new TypeError('surface is not a Phase 5 guest surface');
    const currentTime = this.now();
    const state = this.state.get(surface) || { attempts: [], consecutiveFailures: 0, openUntil: 0 };
    if (state.openUntil > currentTime) {
      const error = new Error(`${surface} circuit breaker is open`);
      error.code = 'phase5_surface_circuit_open';
      error.retry_after_ms = state.openUntil - currentTime;
      throw error;
    }
    state.attempts = state.attempts.filter(
      (timestamp) => timestamp > currentTime - contract.rate_limit.window_ms
    );
    if (state.attempts.length >= contract.rate_limit.requests) {
      const error = new Error(`${surface} independent rate limit reached`);
      error.code = 'phase5_surface_rate_limited';
      error.retry_after_ms = state.attempts[0] + contract.rate_limit.window_ms - currentTime;
      throw error;
    }
    state.attempts.push(currentTime);
    this.state.set(surface, state);
    return Object.freeze({ surface, acquired_at: new Date(currentTime).toISOString() });
  }

  recordSuccess(surface) {
    const state = this.state.get(surface);
    if (state) {
      state.consecutiveFailures = 0;
      state.openUntil = 0;
    }
  }

  recordFailure(surface) {
    const contract = this.contracts[surface];
    const state = this.state.get(surface) || { attempts: [], consecutiveFailures: 0, openUntil: 0 };
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= contract.circuit_breaker.failures) {
      state.openUntil = this.now() + contract.circuit_breaker.cooldown_ms;
      state.consecutiveFailures = 0;
    }
    this.state.set(surface, state);
  }
}
