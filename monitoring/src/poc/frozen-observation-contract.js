import { starterCostGateConstants } from '../costing/starter-cost-gate.js';

export const FROZEN_OBSERVATION_CONTRACT_VERSION = 'brightdata-playwright-serpapi-observation-v1';
export const FROZEN_PLAN_CONTRACT_VERSION = 'diagnostic-monitoring-plan-v2-preproduction';
export const PHASE0_GUEST_ROUTE_CONTRACT_VERSION = 'phase0-guest-public-self-service-v1';

export const ACQUISITION_MODES = Object.freeze({
  WEB_UI: 'web_ui',
  SERPAPI_AIO: 'serpapi_aio',
  SONAR_API: 'sonar_api',
  OPENROUTER_API: 'openrouter_api',
  OTHER_API: 'other_api'
});

export const OBSERVATION_OUTCOMES = Object.freeze({
  web_ui_observed: Object.freeze({
    acquisition_modes: Object.freeze([ACQUISITION_MODES.WEB_UI]),
    native_observation: true,
    evidence_required: true,
    credit_disposition: 'settled'
  }),
  serpapi_aio_observed: Object.freeze({
    acquisition_modes: Object.freeze([ACQUISITION_MODES.SERPAPI_AIO]),
    native_observation: true,
    evidence_required: true,
    credit_disposition: 'settled'
  }),
  aio_not_triggered: Object.freeze({
    acquisition_modes: Object.freeze([ACQUISITION_MODES.SERPAPI_AIO]),
    native_observation: true,
    evidence_required: true,
    credit_disposition: 'settled'
  }),
  api_fallback: Object.freeze({
    acquisition_modes: Object.freeze([
      ACQUISITION_MODES.SONAR_API,
      ACQUISITION_MODES.OPENROUTER_API,
      ACQUISITION_MODES.OTHER_API
    ]),
    native_observation: false,
    evidence_required: true,
    credit_disposition: 'released'
  }),
  surface_unavailable: Object.freeze({
    acquisition_modes: Object.freeze(Object.values(ACQUISITION_MODES)),
    native_observation: false,
    evidence_required: false,
    credit_disposition: 'released'
  }),
  technical_failed: Object.freeze({
    acquisition_modes: Object.freeze(Object.values(ACQUISITION_MODES)),
    native_observation: false,
    evidence_required: false,
    credit_disposition: 'released'
  })
});

export const STANDARD_SURFACES = Object.freeze({
  chatgpt_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'guest'
  }),
  perplexity_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'guest'
  }),
  google_aio: Object.freeze({
    route: 'serpapi_google_ai_overview',
    acquisition_mode: ACQUISITION_MODES.SERPAPI_AIO,
    authentication: 'none'
  }),
  gemini_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'guest'
  }),
  grok_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'guest'
  }),
  qwen_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'guest'
  }),
  deepseek_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'login_managed',
    live_gate: 'written_domain_and_use_case_approval_required',
    phase0_scope: 'excluded_future_optional'
  }),
  mistral_vibe_ui: Object.freeze({
    route: 'bright_data_playwright',
    acquisition_mode: ACQUISITION_MODES.WEB_UI,
    authentication: 'login_managed',
    live_gate: 'written_domain_and_use_case_approval_required',
    phase0_scope: 'excluded_future_optional'
  })
});

export const FALLBACK_SURFACE_ROUTES = Object.freeze({
  [ACQUISITION_MODES.SONAR_API]: Object.freeze(['perplexity_ui']),
  [ACQUISITION_MODES.OPENROUTER_API]: Object.freeze([
    'chatgpt_ui',
    'gemini_ui',
    'grok_ui',
    'qwen_ui',
    'deepseek_ui',
    'mistral_vibe_ui'
  ])
});

export const FROZEN_PLAN_CONTRACTS = Object.freeze({
  starter: Object.freeze({
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    activation_state: 'preproduction_gate_locked',
    prompt_slots: 44,
    cadence: 'daily',
    cycle_days: 30,
    surfaces: Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio']),
    base_credits: 3960,
    flexible_credits: 40,
    total_credits: 4000
  }),
  pro: Object.freeze({
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    activation_state: 'preproduction_gate_locked',
    prompt_slots: 66,
    cadence: 'daily',
    cycle_days: 30,
    surfaces: Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui']),
    base_credits: 9900,
    flexible_credits: 100,
    total_credits: 10000
  }),
  god: Object.freeze({
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    activation_state: 'preproduction_gate_locked',
    prompt_slots: 104,
    cadence: 'daily',
    cycle_days: 30,
    surfaces: Object.freeze([
      'chatgpt_ui',
      'perplexity_ui',
      'google_aio',
      'gemini_ui',
      'grok_ui',
      'qwen_ui',
      'deepseek_ui',
      'mistral_vibe_ui'
    ]),
    base_credits: 24960,
    flexible_credits: 40,
    total_credits: 25000
  })
});

export const PHASE0_GUEST_ROUTE_CONTRACT = Object.freeze({
  contract_version: PHASE0_GUEST_ROUTE_CONTRACT_VERSION,
  decision_date: '2026-07-19',
  exit_scope: 'guest_public_self_service',
  starter_surfaces: Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio']),
  allowed_authentication: Object.freeze(['guest', 'none']),
  supplier_product_selection: 'deferred_until_future_live_run',
  residential_proxy_allowed_in_phase0: false,
  password_entry_allowed_in_phase0: false,
  authenticated_session_state_allowed_in_phase0: false,
  ephemeral_guest_session_state_allowed_in_phase0: true,
  kyc_required_for_phase0_exit: false,
  supplier_outreach_required_for_phase0_exit: false,
  pricing_evidence_required_for_phase0_exit: false,
  future_paid_transport: 'separate_post_phase0_budget_and_current_supplier_policy_gate'
});

export const CLAUDE_ADDON_CONTRACT = Object.freeze({
  surface: 'claude',
  standard_plan_surface: false,
  entitlement: 'separately_priced_addon',
  credits: 'separate_from_standard_plan'
});

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function validGeo(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ['region', 'language', 'device'].every((field) => typeof value[field] === 'string' && value[field].trim().length > 0)
  );
}

function sameGeo(left, right) {
  return ['region', 'language', 'device'].every((field) => left[field] === right[field]);
}

function requestedSurfaceSupportsAcquisitionMode(requestedSurface, acquisitionMode) {
  if (!Object.hasOwn(STANDARD_SURFACES, requestedSurface)) return false;
  const surface = STANDARD_SURFACES[requestedSurface];
  const fallbackSurfaces = Object.hasOwn(FALLBACK_SURFACE_ROUTES, acquisitionMode)
    ? FALLBACK_SURFACE_ROUTES[acquisitionMode]
    : null;
  if (fallbackSurfaces) return fallbackSurfaces.includes(requestedSurface);
  return surface.acquisition_mode === acquisitionMode;
}

export function validateObservationEvidenceManifest({ evidence_manifest, acquisition_mode } = {}) {
  const errors = [];
  if (!evidence_manifest || typeof evidence_manifest !== 'object' || Array.isArray(evidence_manifest)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['evidence_manifest_missing']) });
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{2,127}$/.test(evidence_manifest.manifest_id || '')) {
    errors.push('manifest_id_invalid');
  }
  if (!/^[a-f0-9]{64}$/.test(evidence_manifest.content_sha256 || '')) errors.push('content_sha256_invalid');
  if (evidence_manifest.artifact_verified !== true) errors.push('artifact_not_verified');
  if (evidence_manifest.acquisition_mode !== acquisition_mode) errors.push('acquisition_mode_mismatch');
  if (!Object.hasOwn(STANDARD_SURFACES, evidence_manifest.requested_surface)) errors.push('requested_surface_invalid');
  else if (!requestedSurfaceSupportsAcquisitionMode(evidence_manifest.requested_surface, acquisition_mode)) {
    errors.push('requested_surface_acquisition_mode_mismatch');
  }
  if (!validGeo(evidence_manifest.requested_geo)) errors.push('requested_geo_invalid');
  if (!validGeo(evidence_manifest.actual_geo)) errors.push('actual_geo_invalid');
  if (
    validGeo(evidence_manifest.requested_geo) &&
    validGeo(evidence_manifest.actual_geo) &&
    !sameGeo(evidence_manifest.requested_geo, evidence_manifest.actual_geo)
  ) {
    errors.push('requested_actual_geo_mismatch');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/.test(evidence_manifest.adapter_version || '')) {
    errors.push('adapter_version_invalid');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(evidence_manifest.retention_class || '')) {
    errors.push('retention_class_invalid');
  }
  if (evidence_manifest.redaction_result !== 'passed') errors.push('redaction_not_passed');
  if (evidence_manifest.sensitive_auth_data_present !== false) errors.push('sensitive_auth_data_status_invalid');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function assertOriginalPromptPreserved({ stored_prompt_text, submitted_prompt_text } = {}) {
  const stored = requireNonEmptyString(stored_prompt_text, 'stored_prompt_text');
  const submitted = requireNonEmptyString(submitted_prompt_text, 'submitted_prompt_text');
  if (Buffer.from(stored, 'utf8').compare(Buffer.from(submitted, 'utf8')) !== 0) {
    throw new Error('submitted_prompt_text must be byte-for-byte identical to stored_prompt_text');
  }
  return stored;
}

export function resolveCreditDisposition({ outcome, acquisition_mode, evidence_manifest } = {}) {
  const contract = OBSERVATION_OUTCOMES[outcome];
  if (!contract) throw new RangeError(`unsupported observation outcome: ${outcome || '<missing>'}`);
  if (!contract.acquisition_modes.includes(acquisition_mode)) {
    throw new Error(`outcome ${outcome} is incompatible with acquisition_mode ${acquisition_mode || '<missing>'}`);
  }

  const evidenceValidation = validateObservationEvidenceManifest({ evidence_manifest, acquisition_mode });
  if (contract.credit_disposition === 'settled' && contract.evidence_required && !evidenceValidation.valid) {
    return Object.freeze({
      state: 'reserved',
      settle_allowed: false,
      release_allowed: false,
      reason: 'valid_evidence_manifest_required',
      evidence_errors: evidenceValidation.errors
    });
  }

  if (contract.credit_disposition === 'settled') {
    return Object.freeze({
      state: 'settled',
      settle_allowed: true,
      release_allowed: false,
      reason: 'native_valid_observation'
    });
  }
  const fallback = outcome === 'api_fallback';
  return Object.freeze({
    state: 'released',
    settle_allowed: false,
    release_allowed: true,
    reason: fallback ? 'fallback_is_auxiliary_not_native_credit' : 'no_valid_native_observation',
    ...(fallback
      ? {
          auxiliary_result_available: evidenceValidation.valid,
          evidence_errors: evidenceValidation.errors
        }
      : {})
  });
}

export function validateFrozenContracts() {
  const expectedPlans = {
    starter: { prompt_slots: 44, surfaces: 3, base: 3960, flexible: 40, total: 4000 },
    pro: { prompt_slots: 66, surfaces: 5, base: 9900, flexible: 100, total: 10000 },
    god: { prompt_slots: 104, surfaces: 8, base: 24960, flexible: 40, total: 25000 }
  };
  const errors = [];

  for (const [planCode, expected] of Object.entries(expectedPlans)) {
    const plan = FROZEN_PLAN_CONTRACTS[planCode];
    const calculatedBase = plan.prompt_slots * plan.surfaces.length * plan.cycle_days;
    if (plan.cadence !== 'daily' || plan.cycle_days !== 30) errors.push(`${planCode}_schedule_not_daily_30_day`);
    if (plan.prompt_slots !== expected.prompt_slots) errors.push(`${planCode}_prompt_slots_mismatch`);
    if (plan.surfaces.length !== expected.surfaces) errors.push(`${planCode}_surface_count_mismatch`);
    if (calculatedBase !== expected.base || plan.base_credits !== expected.base) errors.push(`${planCode}_base_credits_mismatch`);
    if (plan.flexible_credits !== expected.flexible) errors.push(`${planCode}_flexible_credits_mismatch`);
    if (plan.base_credits + plan.flexible_credits !== expected.total || plan.total_credits !== expected.total) {
      errors.push(`${planCode}_total_credits_mismatch`);
    }
    if (plan.surfaces.includes('claude')) errors.push(`${planCode}_claude_must_not_be_standard`);
    for (const surface of plan.surfaces) {
      if (!STANDARD_SURFACES[surface]) errors.push(`${planCode}_unknown_surface_${surface}`);
    }
  }

  if (PHASE0_GUEST_ROUTE_CONTRACT.contract_version !== PHASE0_GUEST_ROUTE_CONTRACT_VERSION) {
    errors.push('phase0_guest_route_contract_version_mismatch');
  }
  if (
    JSON.stringify(PHASE0_GUEST_ROUTE_CONTRACT.starter_surfaces) !==
    JSON.stringify(FROZEN_PLAN_CONTRACTS.starter.surfaces)
  ) {
    errors.push('phase0_guest_route_starter_surface_mismatch');
  }
  for (const surfaceCode of PHASE0_GUEST_ROUTE_CONTRACT.starter_surfaces) {
    const surface = STANDARD_SURFACES[surfaceCode];
    if (!surface || !PHASE0_GUEST_ROUTE_CONTRACT.allowed_authentication.includes(surface.authentication)) {
      errors.push(`phase0_guest_route_authentication_invalid_${surfaceCode}`);
    }
  }
  if (
    PHASE0_GUEST_ROUTE_CONTRACT.residential_proxy_allowed_in_phase0 !== false ||
    PHASE0_GUEST_ROUTE_CONTRACT.password_entry_allowed_in_phase0 !== false ||
    PHASE0_GUEST_ROUTE_CONTRACT.authenticated_session_state_allowed_in_phase0 !== false ||
    PHASE0_GUEST_ROUTE_CONTRACT.ephemeral_guest_session_state_allowed_in_phase0 !== true ||
    PHASE0_GUEST_ROUTE_CONTRACT.kyc_required_for_phase0_exit !== false ||
    PHASE0_GUEST_ROUTE_CONTRACT.supplier_outreach_required_for_phase0_exit !== false ||
    PHASE0_GUEST_ROUTE_CONTRACT.pricing_evidence_required_for_phase0_exit !== false
  ) {
    errors.push('phase0_guest_route_exclusion_policy_invalid');
  }
  for (const futureSurface of ['deepseek_ui', 'mistral_vibe_ui']) {
    if (STANDARD_SURFACES[futureSurface].phase0_scope !== 'excluded_future_optional') {
      errors.push(`phase0_future_optional_scope_invalid_${futureSurface}`);
    }
  }

  if (starterCostGateConstants.base_per_surface !== 1320) errors.push('cost_gate_base_per_surface_mismatch');
  if (starterCostGateConstants.flex_total !== 40) errors.push('cost_gate_flex_total_mismatch');
  if (starterCostGateConstants.total_credits !== 4000) errors.push('cost_gate_total_credits_mismatch');

  return Object.freeze({
    valid: errors.length === 0,
    contract_version: FROZEN_OBSERVATION_CONTRACT_VERSION,
    plan_contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    errors: Object.freeze(errors)
  });
}
