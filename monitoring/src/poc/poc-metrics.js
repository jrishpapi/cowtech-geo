import { starterCostGateConstants } from '../costing/starter-cost-gate.js';

const LIMITS = starterCostGateConstants.technical_limits;
const DECIMAL_BYTES_PER_MB = 1_000_000;

export const FROZEN_STARTER_POC_SCOPE = Object.freeze({
  cohort_id: 'starter-4000-v1',
  dataset_sha256: 'e0668a26da4faecbeb31abc87b3185abf62b182beb6b4ae82d6e8e7c0980281b',
  surfaces: Object.freeze({
    chatgpt_ui: Object.freeze({
      planned_demands: 1334,
      route: 'bright_data_playwright',
      authentication: 'guest'
    }),
    perplexity_ui: Object.freeze({
      planned_demands: 1333,
      route: 'bright_data_playwright',
      authentication: 'guest'
    }),
    google_aio: Object.freeze({
      planned_demands: 1333,
      route: 'serpapi_google_ai_overview',
      authentication: 'none'
    })
  })
});

export const PHASE0_METRIC_DICTIONARY = Object.freeze({
  attempt_multiplier: Object.freeze({
    numerator: 'total_supplier_attempts',
    denominator: 'native_valid_observations',
    formula: 'total_supplier_attempts / native_valid_observations',
    threshold: '<= 1.10',
    missing_policy: 'technical_no_go'
  }),
  api_fallback_rate: Object.freeze({
    numerator: 'api_fallback_attempts',
    denominator: 'planned_web_demands',
    formula: 'api_fallback_attempts / planned_web_demands',
    threshold: '<= 0.05',
    missing_policy: 'technical_no_go'
  }),
  parser_accuracy: Object.freeze({
    numerator: 'parser_correct_fields',
    denominator: 'parser_evaluated_fields',
    formula: 'parser_correct_fields / parser_evaluated_fields',
    threshold: '>= 0.99 with at least 100 evaluated fields',
    missing_policy: 'technical_no_go'
  }),
  evidence_return_rate: Object.freeze({
    numerator: 'evidence_records',
    denominator: 'planned_demands',
    formula: 'evidence_records / planned_demands',
    threshold: '>= 0.995',
    missing_policy: 'technical_no_go'
  }),
  structured_validation_rate: Object.freeze({
    numerator: 'structured_validations_passed',
    denominator: 'planned_demands',
    formula: 'structured_validations_passed / planned_demands',
    threshold: '= 1.00',
    missing_policy: 'technical_no_go'
  }),
  bright_mb_per_valid_web: Object.freeze({
    numerator: 'Bright Data vendor_billed_bytes for native UI attempts',
    denominator: 'native_valid_web_observations',
    formula: 'vendor_billed_bytes / 1,000,000 / native_valid_web_observations',
    threshold: '<= 0.35 MB',
    missing_policy: 'technical_no_go'
  }),
  guest_ui_native_success_rate: Object.freeze({
    numerator: 'guest native_valid_observations',
    denominator: 'guest planned_demands',
    formula: 'native_valid_observations / planned_demands',
    threshold: '>= 0.97',
    missing_policy: 'technical_no_go'
  }),
  login_ui_native_success_rate: Object.freeze({
    numerator: 'login native_valid_observations',
    denominator: 'login planned_demands',
    formula: 'native_valid_observations / planned_demands',
    threshold: '>= 0.93',
    missing_policy: 'not_applicable only when login planned_demands = 0'
  }),
  aio_followup_rate: Object.freeze({
    numerator: 'SerpApi successful follow-up searches',
    denominator: 'SerpApi successful initial searches',
    formula: 'aio_followup_successful / aio_initial_successful',
    threshold: 'measured; commercial input, no technical pass threshold',
    missing_policy: 'commercial_blocked'
  }),
  completed_within_2h_rate: Object.freeze({
    numerator: 'valid demands completed within 2 hours',
    denominator: 'planned_demands',
    formula: 'completed_within_2h / planned_demands',
    threshold: '>= 0.95',
    missing_policy: 'technical_no_go'
  }),
  completed_within_6h_rate: Object.freeze({
    numerator: 'valid demands completed within 6 hours',
    denominator: 'planned_demands',
    formula: 'completed_within_6h / planned_demands',
    threshold: '>= 0.99',
    missing_policy: 'technical_no_go'
  }),
  supplier_reconciliation_delta: Object.freeze({
    numerator: 'abs(local_billable_units - supplier_billable_units)',
    denominator: 'supplier_billable_units',
    formula: 'abs(local - supplier) / supplier',
    threshold: '<= 0.02 per supplier billing scope',
    missing_policy: 'commercial_blocked'
  })
});

function integer(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function finiteNumber(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative finite number`);
  return value;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function round(value, precision = 8) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function gate(value, predicate, missingCode, failureCode, { notApplicable = false } = {}) {
  if (value === null) {
    return Object.freeze({
      value: null,
      status: notApplicable ? 'not_applicable' : 'missing',
      blocker: notApplicable ? null : missingCode
    });
  }
  const passed = predicate(value);
  return Object.freeze({
    value: round(value),
    status: passed ? 'pass' : 'fail',
    blocker: passed ? null : failureCode
  });
}

function assertFrozenStarterPocScope(input = {}) {
  if (input.cohort_id !== FROZEN_STARTER_POC_SCOPE.cohort_id) {
    throw new RangeError(`cohort_id must equal ${FROZEN_STARTER_POC_SCOPE.cohort_id}`);
  }
  if (input.dataset_sha256 !== FROZEN_STARTER_POC_SCOPE.dataset_sha256) {
    throw new RangeError('dataset_sha256 must match the frozen starter-4000-v1 dataset');
  }
  if (!input.surfaces || typeof input.surfaces !== 'object' || Array.isArray(input.surfaces)) {
    throw new TypeError('surfaces must be an object containing the frozen Starter surfaces');
  }

  const expectedNames = Object.keys(FROZEN_STARTER_POC_SCOPE.surfaces);
  const actualNames = Object.keys(input.surfaces);
  const exactSurfaceSet =
    actualNames.length === expectedNames.length &&
    expectedNames.every((name) => Object.prototype.hasOwnProperty.call(input.surfaces, name));
  if (!exactSurfaceSet) {
    throw new RangeError(`surfaces must exactly equal ${expectedNames.join(', ')}`);
  }
}

function normalizeSurface(name, surface = {}, expected) {
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
    throw new TypeError(`surfaces.${name} must be an object`);
  }
  const planned = integer(surface.planned_demands, `surfaces.${name}.planned_demands`);
  const nativeValid = integer(surface.native_valid_observations, `surfaces.${name}.native_valid_observations`);
  const vendorBytes = finiteNumber(surface.vendor_billed_bytes, `surfaces.${name}.vendor_billed_bytes`);
  if (planned !== expected.planned_demands) {
    throw new RangeError(`surfaces.${name}.planned_demands must equal ${expected.planned_demands}`);
  }
  if (nativeValid > planned) throw new RangeError(`surfaces.${name}.native_valid_observations cannot exceed planned_demands`);
  if (surface.authentication !== expected.authentication) {
    throw new RangeError(`surfaces.${name}.authentication must equal ${expected.authentication}`);
  }
  if (surface.route !== expected.route) {
    throw new RangeError(`surfaces.${name}.route must equal ${expected.route}`);
  }
  return {
    name,
    planned,
    nativeValid,
    vendorBytes,
    authentication: expected.authentication,
    route: expected.route
  };
}

export function calculatePocMetrics(input = {}) {
  assertFrozenStarterPocScope(input);
  const surfaces = Object.entries(FROZEN_STARTER_POC_SCOPE.surfaces).map(([name, expected]) =>
    normalizeSurface(name, input.surfaces[name], expected)
  );

  const plannedDemands = surfaces.reduce((sum, surface) => sum + surface.planned, 0);
  const nativeValidObservations = surfaces.reduce((sum, surface) => sum + surface.nativeValid, 0);
  const webSurfaces = surfaces.filter((surface) => surface.route === 'bright_data_playwright');
  const plannedWebDemands = webSurfaces.reduce((sum, surface) => sum + surface.planned, 0);
  const nativeValidWeb = webSurfaces.reduce((sum, surface) => sum + surface.nativeValid, 0);
  const brightBytes = webSurfaces.reduce((sum, surface) => sum + surface.vendorBytes, 0);
  const guest = webSurfaces.filter((surface) => surface.authentication === 'guest');
  const login = webSurfaces.filter((surface) => surface.authentication === 'login_managed');
  const guestPlanned = guest.reduce((sum, surface) => sum + surface.planned, 0);
  const guestValid = guest.reduce((sum, surface) => sum + surface.nativeValid, 0);
  const loginPlanned = login.reduce((sum, surface) => sum + surface.planned, 0);
  const loginValid = login.reduce((sum, surface) => sum + surface.nativeValid, 0);

  const totalSupplierAttempts = integer(input.total_supplier_attempts, 'total_supplier_attempts');
  const apiFallbackAttempts = integer(input.api_fallback_attempts, 'api_fallback_attempts');
  const parserEvaluated = integer(input.parser_evaluated_fields, 'parser_evaluated_fields');
  const parserCorrect = integer(input.parser_correct_fields, 'parser_correct_fields');
  const evidenceRecords = integer(input.evidence_records, 'evidence_records');
  const validationsPassed = integer(input.structured_validations_passed, 'structured_validations_passed');
  const within2h = integer(input.completed_within_2h, 'completed_within_2h');
  const within6h = integer(input.completed_within_6h, 'completed_within_6h');
  const aioInitialSuccessful = integer(input.aio_initial_successful, 'aio_initial_successful');
  const aioFollowupSuccessful = integer(input.aio_followup_successful, 'aio_followup_successful');
  if (parserCorrect > parserEvaluated) throw new RangeError('parser_correct_fields cannot exceed parser_evaluated_fields');
  const aioPlanned = FROZEN_STARTER_POC_SCOPE.surfaces.google_aio.planned_demands;
  if (aioInitialSuccessful > aioPlanned) {
    throw new RangeError('aio_initial_successful cannot exceed planned Google AIO demands');
  }
  if (aioFollowupSuccessful > aioInitialSuccessful) {
    throw new RangeError('aio_followup_successful cannot exceed aio_initial_successful');
  }
  for (const [name, value] of [
    ['evidence_records', evidenceRecords],
    ['structured_validations_passed', validationsPassed],
    ['completed_within_2h', within2h],
    ['completed_within_6h', within6h]
  ]) {
    if (value > plannedDemands) throw new RangeError(`${name} cannot exceed planned demands`);
  }
  if (within2h > within6h) throw new RangeError('completed_within_2h cannot exceed completed_within_6h');

  const metrics = {
    attempt_multiplier: gate(
      ratio(totalSupplierAttempts, nativeValidObservations),
      (value) => value >= 1 && value <= LIMITS.attempt_multiplier,
      'attempt_multiplier_missing',
      'attempt_multiplier_outside_1.00_to_1.10'
    ),
    api_fallback_rate: gate(
      ratio(apiFallbackAttempts, plannedWebDemands),
      (value) => value <= LIMITS.api_fallback_rate,
      'api_fallback_rate_missing',
      'api_fallback_rate_exceeds_0.05'
    ),
    parser_accuracy: gate(
      ratio(parserCorrect, parserEvaluated),
      (value) => parserEvaluated >= 100 && value >= LIMITS.parser_accuracy,
      'parser_accuracy_missing',
      'parser_accuracy_below_0.99_or_sample_too_small'
    ),
    evidence_return_rate: gate(
      ratio(evidenceRecords, plannedDemands),
      (value) => value >= LIMITS.evidence_return_rate,
      'evidence_return_rate_missing',
      'evidence_return_rate_below_0.995'
    ),
    structured_validation_rate: gate(
      ratio(validationsPassed, plannedDemands),
      (value) => value === LIMITS.structured_validation_rate,
      'structured_validation_rate_missing',
      'structured_validation_rate_not_1.0'
    ),
    bright_mb_per_valid_web: gate(
      nativeValidWeb > 0 ? brightBytes / DECIMAL_BYTES_PER_MB / nativeValidWeb : null,
      (value) => value <= LIMITS.bright_mb_per_valid_web,
      'bright_mb_per_valid_web_missing',
      'bright_mb_per_valid_web_exceeds_0.35'
    ),
    guest_ui_native_success_rate: gate(
      ratio(guestValid, guestPlanned),
      (value) => value >= LIMITS.guest_ui_native_success_rate,
      'guest_ui_native_success_rate_missing',
      'guest_ui_native_success_rate_below_0.97'
    ),
    login_ui_native_success_rate: gate(
      ratio(loginValid, loginPlanned),
      (value) => value >= 0.93,
      'login_ui_native_success_rate_missing',
      'login_ui_native_success_rate_below_0.93',
      { notApplicable: loginPlanned === 0 }
    ),
    aio_followup_rate: Object.freeze({
      value: round(ratio(aioFollowupSuccessful, aioInitialSuccessful)),
      status: aioInitialSuccessful > 0 ? 'measured' : 'missing',
      blocker: aioInitialSuccessful > 0 ? null : 'aio_followup_rate_not_measured'
    }),
    completed_within_2h_rate: gate(
      ratio(within2h, plannedDemands),
      (value) => value >= LIMITS.within_2h_rate,
      'completed_within_2h_rate_missing',
      'completed_within_2h_rate_below_0.95'
    ),
    completed_within_6h_rate: gate(
      ratio(within6h, plannedDemands),
      (value) => value >= LIMITS.within_6h_rate,
      'completed_within_6h_rate_missing',
      'completed_within_6h_rate_below_0.99'
    )
  };

  if (!Array.isArray(input.supplier_reconciliations)) {
    throw new TypeError('supplier_reconciliations must be an array');
  }
  const seenBillingScopes = new Set();
  const reconciliations = input.supplier_reconciliations.map((scope, index) => {
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
      throw new TypeError(`supplier_reconciliations.${index} must be an object`);
    }
    if (typeof scope.supplier !== 'string' || !scope.supplier.trim()) {
      throw new TypeError(`supplier_reconciliations.${index}.supplier must be a non-empty string`);
    }
    if (typeof scope.billing_scope_id !== 'string' || !scope.billing_scope_id.trim()) {
      throw new TypeError(`supplier_reconciliations.${index}.billing_scope_id must be a non-empty string`);
    }
    if (seenBillingScopes.has(scope.billing_scope_id)) {
      throw new RangeError(`duplicate supplier billing scope: ${scope.billing_scope_id}`);
    }
    seenBillingScopes.add(scope.billing_scope_id);
    const local = finiteNumber(scope.local_billable_units, `supplier_reconciliations.${index}.local_billable_units`);
    const supplier = finiteNumber(scope.supplier_billable_units, `supplier_reconciliations.${index}.supplier_billable_units`);
    const delta = supplier > 0 ? Math.abs(local - supplier) / supplier : null;
    return Object.freeze({
      supplier: scope.supplier,
      billing_scope_id: scope.billing_scope_id,
      delta_rate: round(delta),
      status: delta !== null && delta <= starterCostGateConstants.reconciliation_tolerance ? 'pass' : 'blocked'
    });
  });

  const technicalFailures = Object.values(metrics)
    .filter((metric) => metric.status === 'fail' || metric.status === 'missing')
    .map((metric) => metric.blocker)
    .filter((blocker) => blocker && blocker !== 'aio_followup_rate_not_measured');
  const reconciledSuppliers = new Set(reconciliations.map((item) => item.supplier));
  const requiredReconciliations = ['bright_data', 'serpapi', ...(apiFallbackAttempts > 0 ? ['other'] : [])];
  const commercialBlockers = [
    metrics.aio_followup_rate.blocker,
    ...requiredReconciliations
      .filter((supplier) => !reconciledSuppliers.has(supplier))
      .map((supplier) => `${supplier}_reconciliation_missing`),
    ...reconciliations.filter((item) => item.status !== 'pass').map((item) => `${item.supplier}_reconciliation_missing_or_exceeds_0.02`)
  ].filter(Boolean);

  return Object.freeze({
    schema_version: 'poc-metrics-v1',
    counts: Object.freeze({
      planned_demands: plannedDemands,
      planned_web_demands: plannedWebDemands,
      native_valid_observations: nativeValidObservations,
      native_valid_web_observations: nativeValidWeb,
      total_supplier_attempts: totalSupplierAttempts,
      api_fallback_attempts: apiFallbackAttempts
    }),
    metrics: Object.freeze(metrics),
    supplier_reconciliations: Object.freeze(reconciliations),
    technical_failures: Object.freeze([...new Set(technicalFailures)]),
    commercial_blockers: Object.freeze([...new Set(commercialBlockers)]),
    technical_status: technicalFailures.length ? 'NO_GO' : 'PASS',
    commercial_status: commercialBlockers.length ? 'BLOCKED' : 'READY'
  });
}
