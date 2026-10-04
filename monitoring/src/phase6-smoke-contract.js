import { createHash } from 'node:crypto';

export const PHASE6_SMOKE_CONTRACT_VERSION = 'phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers';
export const PHASE6_DEFAULT_RUNS_PER_SURFACE = 40;
export const PHASE6_MIN_RUNS_PER_SURFACE = 30;
export const PHASE6_MAX_RUNS_PER_SURFACE = 50;
export const PHASE6_DELIVERY_SUCCESS_MINIMUM = 0.95;

export const PHASE6_SURFACES = Object.freeze({
  chatgpt_ui: Object.freeze({
    route_policy: 'guest_primary',
    selected_route: 'bright_data_guest',
    acquisition_mode: 'web_ui'
  }),
  perplexity_ui: Object.freeze({
    route_policy: 'guest_primary',
    selected_route: 'bright_data_guest',
    acquisition_mode: 'web_ui'
  }),
  google_aio: Object.freeze({
    route_policy: 'provider_surface',
    selected_route: 'serpapi_google_ai_overview',
    acquisition_mode: 'serpapi_aio'
  }),
  gemini_ui: Object.freeze({
    route_policy: 'guest_primary',
    selected_route: 'bright_data_guest',
    acquisition_mode: 'web_ui'
  }),
  grok_ui: Object.freeze({
    route_policy: 'guest_first_preferred_api',
    selected_route: 'preferred_grok_api',
    acquisition_mode: 'grok_api',
    preferred_api_supplier: 'xai',
    accepted_api_suppliers: Object.freeze(['xai', 'openrouter'])
  }),
  qwen_ui: Object.freeze({
    route_policy: 'guest_first_official_api_fallback',
    selected_route: 'dashscope_official_api',
    acquisition_mode: 'official_api',
    official_api_supplier: 'dashscope'
  })
});

export function selectPreferredGrokApiSupplier(credentials = {}, requestedSupplier = 'auto') {
  if (!['auto', 'xai', 'openrouter'].includes(requestedSupplier)) {
    throw new RangeError('requested Grok API supplier must be auto, xai, or openrouter');
  }
  const xaiReady = credentials.xai === true && credentials.xai_pricing === true;
  const openrouterReady =
    credentials.openrouter === true && credentials.openrouter_pricing === true;
  if (requestedSupplier === 'xai') return xaiReady ? 'xai' : null;
  if (requestedSupplier === 'openrouter') return openrouterReady ? 'openrouter' : null;
  if (xaiReady) return 'xai';
  if (openrouterReady) return 'openrouter';
  return null;
}

function count(value, name) {
  if (!Number.isSafeInteger(value) || value < PHASE6_MIN_RUNS_PER_SURFACE || value > PHASE6_MAX_RUNS_PER_SURFACE) {
    throw new RangeError(`${name} must be between 30 and 50`);
  }
  return value;
}

function prompt(value, index) {
  if (!value || typeof value.prompt_text !== 'string' || !value.prompt_text.trim()) {
    throw new TypeError(`prompts[${index}].prompt_text must be non-empty`);
  }
  return value;
}

export function buildPhase6SmokeManifest({
  prompts,
  runsPerSurface = PHASE6_DEFAULT_RUNS_PER_SURFACE,
  region = 'US',
  language = 'en',
  device = 'desktop',
  grokApiSupplier = 'xai'
} = {}) {
  if (!Array.isArray(prompts) || prompts.length === 0) throw new TypeError('prompts must be a non-empty array');
  const normalizedPrompts = prompts.map(prompt);
  const perSurface = count(runsPerSurface, 'runsPerSurface');
  if (!PHASE6_SURFACES.grok_ui.accepted_api_suppliers.includes(grokApiSupplier)) {
    throw new RangeError('grokApiSupplier must be xai or openrouter');
  }
  const items = [];
  for (const [surface, contract] of Object.entries(PHASE6_SURFACES)) {
    for (let index = 0; index < perSurface; index += 1) {
      const selectedPrompt = normalizedPrompts[index % normalizedPrompts.length];
      const quarter = Math.floor((index * 4) / perSurface);
      const isWeb = contract.acquisition_mode === 'web_ui';
      items.push(Object.freeze({
        item_key: `${surface}:${String(index + 1).padStart(2, '0')}`,
        surface,
        route_policy: contract.route_policy,
        route: contract.selected_route,
        acquisition_mode: contract.acquisition_mode,
        official_api_supplier: surface === 'grok_ui'
          ? grokApiSupplier
          : contract.official_api_supplier || null,
        prompt_id: selectedPrompt.id || `prompt-${index % normalizedPrompts.length}`,
        prompt_text: selectedPrompt.prompt_text,
        prompt_sha256: createHash('sha256').update(selectedPrompt.prompt_text).digest('hex'),
        session_mode: isWeb ? (quarter < 2 ? 'cold' : 'warm') : 'not_applicable',
        resource_policy: quarter % 2 === 0 ? 'conservative' : 'aggressive',
        requested_geo: Object.freeze({ region, language, device })
      }));
    }
  }
  return Object.freeze({
    schema_version: PHASE6_SMOKE_CONTRACT_VERSION,
    runs_per_surface: perSurface,
    planned_attempts: items.length,
    surfaces: Object.freeze(Object.keys(PHASE6_SURFACES)),
    items: Object.freeze(items),
    login_surfaces_included: false,
    account_pool_included: false,
    accepted_delivery_modes: Object.freeze(['web_ui', 'serpapi_aio', 'grok_api', 'official_api']),
    external_route_disclosure: 'guest_surface_primary_preferred_grok_api_auxiliary',
    grok_api_supplier: grokApiSupplier,
    grok_api_preference: Object.freeze(['xai', 'openrouter']),
    fallback_counts_as_native: false
  });
}

export function evaluatePhase6Smoke(results = [], reconciliations = []) {
  if (!Array.isArray(results)) throw new TypeError('results must be an array');
  const bySurface = {};
  const blockers = [];
  for (const surface of Object.keys(PHASE6_SURFACES)) {
    const rows = results.filter((row) => row.surface === surface);
    const planned = rows.length;
    const terminal = rows.filter((row) => row.terminal === true).length;
    const contract = PHASE6_SURFACES[surface];
    const deliveryValid = rows.filter((row) => {
      const resultValid = row.delivery_valid === true ||
        (row.delivery_valid === undefined && row.native_valid === true);
      if (!resultValid || row.acquisition_mode !== contract.acquisition_mode) return false;
      if (!['grok_api', 'official_api'].includes(row.acquisition_mode)) return true;
      if (surface === 'grok_ui') {
        return contract.accepted_api_suppliers.includes(row.official_api_supplier);
      }
      return row.official_api_supplier === contract.official_api_supplier;
    }).length;
    const nativeValid = rows.filter((row) =>
      row.native_valid === true &&
      ['web_ui', 'serpapi_aio'].includes(row.acquisition_mode)
    ).length;
    const apiValid = rows.filter((row) =>
      row.delivery_valid === true &&
      ['grok_api', 'official_api'].includes(row.acquisition_mode) &&
      (surface === 'grok_ui'
        ? contract.accepted_api_suppliers.includes(row.official_api_supplier)
        : row.official_api_supplier === contract.official_api_supplier)
    ).length;
    const evaluated = rows.reduce((sum, row) => sum + Number(row.parser_evaluated_fields || 0), 0);
    const correct = rows.reduce((sum, row) => sum + Number(row.parser_correct_fields || 0), 0);
    const parserAccuracy = evaluated > 0 ? correct / evaluated : null;
    const structuralFailures = rows.filter((row) => row.structural_failure === true).length;
    const evidenceComplete = rows.filter((row) => row.evidence_verified === true).length;
    const deliveryEvidenceComplete = rows.filter((row) => {
      const resultValid = row.delivery_valid === true ||
        (row.delivery_valid === undefined && row.native_valid === true);
      if (!resultValid || row.evidence_verified !== true || row.acquisition_mode !== contract.acquisition_mode) {
        return false;
      }
      if (!['grok_api', 'official_api'].includes(row.acquisition_mode)) return true;
      if (surface === 'grok_ui') {
        return contract.accepted_api_suppliers.includes(row.official_api_supplier);
      }
      return row.official_api_supplier === contract.official_api_supplier;
    }).length;
    if (planned < PHASE6_MIN_RUNS_PER_SURFACE || planned > PHASE6_MAX_RUNS_PER_SURFACE) {
      blockers.push(`${surface}_sample_size_out_of_range`);
    }
    if (terminal !== planned) blockers.push(`${surface}_non_terminal_results`);
    if (planned > 0 && deliveryValid / planned < PHASE6_DELIVERY_SUCCESS_MINIMUM) {
      blockers.push(`${surface}_delivery_success_below_0.95`);
    }
    if (parserAccuracy === null || parserAccuracy < 0.99) blockers.push(`${surface}_parser_below_0.99`);
    if (deliveryEvidenceComplete !== deliveryValid) blockers.push(`${surface}_delivery_evidence_incomplete`);
    bySurface[surface] = Object.freeze({
      planned,
      terminal,
      delivery_valid: deliveryValid,
      native_valid: nativeValid,
      api_valid: apiValid,
      official_api_valid: apiValid,
      parser_accuracy: parserAccuracy,
      evidence_verified: evidenceComplete,
      delivery_evidence_verified: deliveryEvidenceComplete,
      structural_failures: structuralFailures
    });
  }
  const requiredSuppliers = new Set();
  for (const row of results) {
    if (row.acquisition_mode === 'web_ui') requiredSuppliers.add('bright_data');
    if (row.acquisition_mode === 'serpapi_aio') requiredSuppliers.add('serpapi');
    if (['grok_api', 'official_api'].includes(row.acquisition_mode) && row.official_api_supplier) {
      requiredSuppliers.add(row.official_api_supplier);
    }
  }
  const reconciled = new Map((reconciliations || []).map((item) => [item.supplier, item]));
  const commercialBlockers = [];
  for (const supplier of requiredSuppliers) {
    const item = reconciled.get(supplier);
    if (!item || item.reconciliation_status !== 'reconciled') {
      commercialBlockers.push(`${supplier}_not_reconciled`);
    } else if (!(Number(item.billed_cost_micro_usd) > 0)) {
      commercialBlockers.push(`${supplier}_zero_or_promotional_cost`);
    }
  }
  return Object.freeze({
    schema_version: 'phase6-hybrid-smoke-evaluation-v3-95pct',
    delivery_success_minimum: PHASE6_DELIVERY_SUCCESS_MINIMUM,
    surfaces: Object.freeze(bySurface),
    technical_status: blockers.length ? 'no_go' : 'passed',
    commercial_status: commercialBlockers.length ? 'blocked' : 'proved',
    exit_status: blockers.length
      ? 'NO_GO'
      : commercialBlockers.length
        ? 'COMMERCIAL_BLOCKED'
        : 'PHASE6_EXIT_PASSED',
    blockers: Object.freeze(blockers),
    commercial_blockers: Object.freeze(commercialBlockers)
  });
}

export function buildPhase6Preflight({
  approvedBudgetMicroUsd = 0,
  explicitLiveAuthorization = false,
  credentials = {},
  grokApiSupplier = 'auto',
  policyEvidence = {}
} = {}) {
  const blockers = [];
  if (explicitLiveAuthorization !== true) blockers.push('explicit_live_authorization_missing');
  if (!Number.isSafeInteger(approvedBudgetMicroUsd) || approvedBudgetMicroUsd <= 0) {
    blockers.push('approved_budget_missing');
  }
  for (const key of [
    'bright_data_cdp',
    'bright_data_account_api',
    'evidence_storage',
    'serpapi',
    'dashscope',
    'dashscope_pricing'
  ]) {
    if (credentials[key] !== true) {
      blockers.push(key.endsWith('_pricing') ? `${key}_missing` : `${key}_credential_missing`);
    }
  }
  const selectedGrokApiSupplier = selectPreferredGrokApiSupplier(credentials, grokApiSupplier);
  if (!selectedGrokApiSupplier) blockers.push('grok_api_route_missing');
  for (const key of [
    'supplier_policy_ref',
    'target_policy_ref',
    'permission_scope_ref',
    'official_api_policy_ref'
  ]) {
    if (!String(policyEvidence[key] || '').trim()) blockers.push(`${key}_missing`);
  }
  for (const key of [
    'supplier_policy_status',
    'target_policy_status',
    'permission_scope_status',
    'official_api_policy_status'
  ]) {
    if (policyEvidence[key] !== 'approved') blockers.push(`${key}_not_approved`);
  }
  return Object.freeze({
    schema_version: 'phase6-hybrid-live-preflight-v2',
    status: blockers.length ? 'external_blocked' : 'ready',
    approved_budget_micro_usd: approvedBudgetMicroUsd,
    grok_api_supplier: selectedGrokApiSupplier,
    grok_api_preference: Object.freeze(['xai', 'openrouter']),
    blockers: Object.freeze(blockers),
    secrets_exposed: false
  });
}
