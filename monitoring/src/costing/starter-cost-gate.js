const STARTER_BASE_PER_SURFACE = 1320;
const STARTER_FLEX_TOTAL = 40;
const STARTER_TOTAL_CREDITS = 4000;
const FROZEN_POC_COUNTS = Object.freeze({ chatgpt: 1334, perplexity: 1333, aio: 1333 });
const DECIMAL_BYTES_PER_GB = 1_000_000_000;
const DECIMAL_MB_PER_GB = 1000;
const RECONCILIATION_TOLERANCE = 0.02;
const MAX_STRESS_UTILIZATION = 0.85;
const MIN_COMMERCIAL_LOCK_DAYS = 365;

const TECHNICAL_LIMITS = Object.freeze({
  bright_mb_per_valid_web: 0.35,
  attempt_multiplier: 1.1,
  sonar_fallback_rate: 0.05,
  api_fallback_rate: 0.05,
  parser_accuracy: 0.99,
  evidence_return_rate: 0.995,
  structured_validation_rate: 1,
  guest_ui_native_success_rate: 0.97,
  aio_initial_success_rate: 0.995,
  within_2h_rate: 0.95,
  within_6h_rate: 0.99
});

function round(value, precision = 8) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function presentString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function periodCovers(periodStart, periodEnd, windowStart, windowEnd) {
  const start = parseIsoDate(periodStart);
  const end = parseIsoDate(periodEnd);
  const requiredStart = parseIsoDate(windowStart);
  const requiredEnd = parseIsoDate(windowEnd);
  if (!start || !end || !requiredStart || !requiredEnd) return false;
  return start <= requiredStart && end >= requiredEnd && start <= end && requiredStart <= requiredEnd;
}

function periodsMatch(leftStart, leftEnd, rightStart, rightEnd) {
  const leftStartDate = parseIsoDate(leftStart);
  const leftEndDate = parseIsoDate(leftEnd);
  const rightStartDate = parseIsoDate(rightStart);
  const rightEndDate = parseIsoDate(rightEnd);
  if (!leftStartDate || !leftEndDate || !rightStartDate || !rightEndDate) return false;
  return leftStartDate.getTime() === rightStartDate.getTime() && leftEndDate.getTime() === rightEndDate.getTime();
}

function optionalNumber(value, name, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${name} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

function optionalInteger(value, name, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requireNumber(value, name, options = {}) {
  const parsed = optionalNumber(value, name, options);
  if (parsed === null) throw new TypeError(`${name} is required`);
  return parsed;
}

function requireInteger(value, name, options = {}) {
  const parsed = optionalInteger(value, name, options);
  if (parsed === null) throw new TypeError(`${name} is required`);
  return parsed;
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function reconciliationDelta(localUnits, supplierUnits) {
  if (!Number.isFinite(localUnits) || !Number.isFinite(supplierUnits) || supplierUnits <= 0) return null;
  return Math.abs(localUnits - supplierUnits) / supplierUnits;
}

function totalCoversSubset(totalUnits, subsetUnits) {
  if (!Number.isFinite(totalUnits) || !Number.isFinite(subsetUnits) || totalUnits < 0 || subsetUnits < 0) {
    return false;
  }
  return totalUnits >= subsetUnits * (1 - RECONCILIATION_TOLERANCE);
}

export function normalizeStarterWorkload({
  base_per_surface,
  basePerSurface,
  flex_total,
  flexTotal,
  flex_allocation,
  flexAllocation
} = {}) {
  const requestedBase = basePerSurface ?? base_per_surface;
  const requestedFlex = flexTotal ?? flex_total;
  if (requestedBase !== undefined && requestedBase !== STARTER_BASE_PER_SURFACE) {
    throw new RangeError(`Starter base_per_surface is frozen at ${STARTER_BASE_PER_SURFACE}`);
  }
  if (requestedFlex !== undefined && requestedFlex !== STARTER_FLEX_TOTAL) {
    throw new RangeError(`Starter flex_total is frozen at ${STARTER_FLEX_TOTAL}`);
  }
  const allocation = flexAllocation ?? flex_allocation ?? { chatgpt: 0, perplexity: 0, aio: 40 };
  const chatgptFlex = requireInteger(allocation.chatgpt ?? 0, 'flex_allocation.chatgpt');
  const perplexityFlex = requireInteger(allocation.perplexity ?? 0, 'flex_allocation.perplexity');
  const aioFlex = requireInteger(allocation.aio ?? 0, 'flex_allocation.aio');

  if (chatgptFlex + perplexityFlex + aioFlex !== STARTER_FLEX_TOTAL) {
    throw new RangeError(`Starter flex allocation must sum to ${STARTER_FLEX_TOTAL}`);
  }

  const counts = {
    chatgpt: STARTER_BASE_PER_SURFACE + chatgptFlex,
    perplexity: STARTER_BASE_PER_SURFACE + perplexityFlex,
    aio: STARTER_BASE_PER_SURFACE + aioFlex
  };
  const total = counts.chatgpt + counts.perplexity + counts.aio;
  if (total !== STARTER_TOTAL_CREDITS) {
    throw new RangeError(`Starter workload must equal ${STARTER_TOTAL_CREDITS} credits`);
  }

  return {
    base_per_surface: STARTER_BASE_PER_SURFACE,
    flex_total: STARTER_FLEX_TOTAL,
    flex_allocation: { chatgpt: chatgptFlex, perplexity: perplexityFlex, aio: aioFlex },
    counts,
    web_observations: counts.chatgpt + counts.perplexity,
    aio_observations: counts.aio,
    total_credits: total
  };
}

function normalizeWorkloadObject(workload) {
  if (!workload) return normalizeStarterWorkload();
  if (workload.flex_allocation || workload.flexAllocation) return normalizeStarterWorkload(workload);
  if (workload.counts) {
    return normalizeStarterWorkload({
      flex_allocation: {
        chatgpt: workload.counts.chatgpt - STARTER_BASE_PER_SURFACE,
        perplexity: workload.counts.perplexity - STARTER_BASE_PER_SURFACE,
        aio: workload.counts.aio - STARTER_BASE_PER_SURFACE
      }
    });
  }
  return normalizeStarterWorkload(workload);
}

export function enumerateWorstCaseStarterWorkloads() {
  return [
    ['all_flex_chatgpt', { chatgpt: 40, perplexity: 0, aio: 0 }],
    ['all_flex_perplexity', { chatgpt: 0, perplexity: 40, aio: 0 }],
    ['all_flex_aio', { chatgpt: 0, perplexity: 0, aio: 40 }]
  ].map(([name, allocation]) => ({ name, ...normalizeStarterWorkload({ flex_allocation: allocation }) }));
}

export function countSerpApiSearchUnits({
  initial_attempts,
  initial_successful = 0,
  followup_attempts,
  followup_successful = 0,
  followup_errored = 0,
  followup_failed = 0,
  retry_attempts,
  retry_successful = 0,
  retry_errored = 0,
  retry_failed = 0,
  cached = 0,
  errored = 0,
  failed = 0
} = {}) {
  const initial = requireInteger(initial_successful, 'initial_successful');
  const followup = requireInteger(followup_successful, 'followup_successful');
  const followupErrors = requireInteger(followup_errored, 'followup_errored');
  const followupFailures = requireInteger(followup_failed, 'followup_failed');
  const retries = requireInteger(retry_successful, 'retry_successful');
  const retryErrors = requireInteger(retry_errored, 'retry_errored');
  const retryFailures = requireInteger(retry_failed, 'retry_failed');
  const cachedCount = requireInteger(cached, 'cached');
  const errorCount = requireInteger(errored, 'errored');
  const failedCount = requireInteger(failed, 'failed');
  if (followup > initial) {
    throw new RangeError('followup_successful cannot exceed initial_successful');
  }
  const resolvedInitialAttempts = initial_attempts ?? initial + cachedCount + errorCount + failedCount;
  const resolvedFollowupAttempts = followup_attempts ?? followup + followupErrors + followupFailures;
  const resolvedRetryAttempts = retry_attempts ?? retries + retryErrors + retryFailures;
  requireInteger(resolvedInitialAttempts, 'initial_attempts');
  requireInteger(resolvedFollowupAttempts, 'followup_attempts');
  requireInteger(resolvedRetryAttempts, 'retry_attempts');
  if (resolvedInitialAttempts !== initial + cachedCount + errorCount + failedCount) {
    throw new RangeError('initial_attempts must equal all initial outcomes');
  }
  if (resolvedFollowupAttempts !== followup + followupErrors + followupFailures) {
    throw new RangeError('followup_attempts must equal all follow-up outcomes');
  }
  if (resolvedFollowupAttempts > initial) {
    throw new RangeError('followup_attempts cannot exceed initial_successful');
  }
  if (resolvedRetryAttempts !== retries + retryErrors + retryFailures) {
    throw new RangeError('retry_attempts must equal all retry outcomes');
  }
  const retryableFailures = errorCount + failedCount + followupErrors + followupFailures;
  if (resolvedRetryAttempts > retryableFailures) {
    throw new RangeError('retry_attempts cannot exceed preceding retryable failures');
  }

  return {
    initial_attempts: resolvedInitialAttempts,
    initial_successful: initial,
    followup_attempts: resolvedFollowupAttempts,
    followup_successful: followup,
    retry_attempts: resolvedRetryAttempts,
    retry_successful: retries,
    billable_search_units: initial + followup + retries,
    non_billable_searches:
      cachedCount + errorCount + failedCount +
      followupErrors + followupFailures + retryErrors + retryFailures,
    total_supplier_requests:
      resolvedInitialAttempts + resolvedFollowupAttempts + resolvedRetryAttempts,
    cached: cachedCount,
    accounting_complete:
      initial_attempts !== undefined && followup_attempts !== undefined && retry_attempts !== undefined
  };
}

export function calculateFixedPlanEffectiveUnitRate({ monthly_fee_usd, included_units, utilization_rate }) {
  const monthlyFee = requireNumber(monthly_fee_usd, 'monthly_fee_usd', { min: Number.EPSILON });
  const includedUnits = requireNumber(included_units, 'included_units', { min: Number.EPSILON });
  const utilization = requireNumber(utilization_rate, 'utilization_rate', {
    min: Number.EPSILON,
    max: 1
  });
  const usedUnits = includedUnits * utilization;
  return { used_units: round(usedUnits), effective_usd_per_unit: round(monthlyFee / usedUnits) };
}

function resolveCommercialRateCard(rateCard = {}, unitName, commercialAsOf, commitmentEnd) {
  const blockers = [];
  const model = rateCard.pricing_model;
  let effectiveUnitRate = null;
  let stressUtilization = null;
  let actualUtilization = null;
  let poolGrossCharge = null;

  if (model === 'payg') {
    effectiveUnitRate = optionalNumber(rateCard.unit_rate_usd, `${unitName}.unit_rate_usd`, {
      min: Number.EPSILON
    });
    if (!Number.isFinite(effectiveUnitRate)) blockers.push(`${unitName}_payg_rate_missing`);
  } else if (model === 'committed') {
    const fee = optionalNumber(rateCard.gross_monthly_fee_usd, `${unitName}.gross_monthly_fee_usd`, {
      min: Number.EPSILON
    });
    const units = optionalNumber(rateCard.included_units, `${unitName}.included_units`, {
      min: Number.EPSILON
    });
    stressUtilization = optionalNumber(
      rateCard.stress_utilization_rate,
      `${unitName}.stress_utilization_rate`,
      { min: Number.EPSILON, max: 1 }
    );
    const overageRate = optionalNumber(rateCard.overage_unit_rate_usd, `${unitName}.overage_unit_rate_usd`);
    const actualUsedUnits = optionalNumber(rateCard.actual_pool_used_units, `${unitName}.actual_pool_used_units`, {
      min: Number.EPSILON
    });
    poolGrossCharge = optionalNumber(
      rateCard.pool_usage_gross_charge_usd,
      `${unitName}.pool_usage_gross_charge_usd`,
      { min: Number.EPSILON }
    );
    if (
      !Number.isFinite(fee) ||
      !Number.isFinite(units) ||
      !Number.isFinite(stressUtilization) ||
      !Number.isFinite(actualUsedUnits) ||
      !Number.isFinite(poolGrossCharge)
    ) {
      blockers.push(`${unitName}_committed_rate_inputs_missing`);
    } else {
      if (stressUtilization > MAX_STRESS_UTILIZATION) {
        blockers.push(`${unitName}_stress_utilization_above_0.85`);
      }
      const fixedPlanRate = fee / (units * stressUtilization);
      const actualPoolRate = Math.max(fee, poolGrossCharge) / actualUsedUnits;
      actualUtilization = actualUsedUnits / units;
      effectiveUnitRate = Math.max(fixedPlanRate, actualPoolRate, overageRate ?? 0);
    }
    if (!presentString(rateCard.pool_usage_period_id)) blockers.push(`${unitName}_pool_usage_period_id_missing`);
    if (!parseIsoDate(rateCard.pool_usage_period_start)) {
      blockers.push(`${unitName}_pool_usage_period_start_invalid_or_missing`);
    }
    if (!parseIsoDate(rateCard.pool_usage_period_end)) {
      blockers.push(`${unitName}_pool_usage_period_end_invalid_or_missing`);
    }
    if (!presentString(rateCard.pool_usage_invoice_id)) blockers.push(`${unitName}_pool_usage_invoice_id_missing`);
    if (rateCard.pool_usage_reconciled !== true) blockers.push(`${unitName}_pool_usage_not_reconciled`);
  } else {
    blockers.push(`${unitName}_pricing_model_missing`);
  }

  const effectiveFrom = parseIsoDate(rateCard.effective_from);
  const validThrough = parseIsoDate(rateCard.rate_valid_through);
  const asOf = parseIsoDate(commercialAsOf);
  const requiredEnd = parseIsoDate(commitmentEnd);
  if (!presentString(rateCard.contract_id)) blockers.push(`${unitName}_contract_id_missing`);
  if (!effectiveFrom) blockers.push(`${unitName}_effective_from_invalid_or_missing`);
  if (!validThrough) blockers.push(`${unitName}_rate_valid_through_invalid_or_missing`);
  if (!asOf) blockers.push('commercial_as_of_date_invalid_or_missing');
  if (!requiredEnd) blockers.push('commercial_commitment_end_date_invalid_or_missing');
  if (effectiveFrom && asOf && effectiveFrom > asOf) blockers.push(`${unitName}_rate_not_yet_effective`);
  if (validThrough && asOf && validThrough < asOf) blockers.push(`${unitName}_rate_expired`);
  if (validThrough && requiredEnd && validThrough < requiredEnd) {
    blockers.push(`${unitName}_rate_does_not_cover_commitment`);
  }
  if (rateCard.rate_locked !== true) blockers.push(`${unitName}_rate_not_locked`);
  if (rateCard.uses_promotional_credits !== false) blockers.push(`${unitName}_promotional_rate_not_excluded`);

  return {
    pricing_model: model ?? null,
    effective_unit_rate: round(effectiveUnitRate),
    stress_utilization_rate: stressUtilization,
    actual_utilization_rate: round(actualUtilization),
    actual_pool_used_units: optionalNumber(
      rateCard.actual_pool_used_units,
      `${unitName}.actual_pool_used_units`,
      { min: Number.EPSILON }
    ),
    pool_usage_period_id: rateCard.pool_usage_period_id ?? null,
    pool_usage_period_start: rateCard.pool_usage_period_start ?? null,
    pool_usage_period_end: rateCard.pool_usage_period_end ?? null,
    pool_usage_invoice_id: rateCard.pool_usage_invoice_id ?? null,
    pool_usage_gross_charge_usd: round(poolGrossCharge),
    effective_from: rateCard.effective_from ?? null,
    valid_through: rateCard.rate_valid_through ?? null,
    blockers
  };
}

function resolvePoc(poc = {}) {
  const completed = poc.completed === true;
  let planned = null;
  let planProvided = false;
  if (poc.planned_observations) {
    const counts = poc.planned_observations;
    const chatgpt = optionalInteger(counts.chatgpt, 'poc.planned_observations.chatgpt');
    const perplexity = optionalInteger(counts.perplexity, 'poc.planned_observations.perplexity');
    const aio = optionalInteger(counts.aio, 'poc.planned_observations.aio');
    if ([chatgpt, perplexity, aio].every(Number.isFinite)) {
      planned = normalizeStarterWorkload({
        flex_allocation: {
          chatgpt: chatgpt - STARTER_BASE_PER_SURFACE,
          perplexity: perplexity - STARTER_BASE_PER_SURFACE,
          aio: aio - STARTER_BASE_PER_SURFACE
        }
      });
      planProvided = true;
    }
  }
  planned ??= normalizeStarterWorkload({ flex_allocation: { chatgpt: 14, perplexity: 13, aio: 13 } });

  const terminal = {
    chatgpt: optionalInteger(poc.terminal_observations?.chatgpt, 'poc.terminal_observations.chatgpt'),
    perplexity: optionalInteger(poc.terminal_observations?.perplexity, 'poc.terminal_observations.perplexity'),
    aio: optionalInteger(poc.terminal_observations?.aio, 'poc.terminal_observations.aio')
  };
  const metrics = {
    evidence_records: optionalInteger(poc.evidence_records, 'poc.evidence_records'),
    structured_validations_passed: optionalInteger(
      poc.structured_validations_passed,
      'poc.structured_validations_passed'
    ),
    parser_evaluated_fields: optionalInteger(poc.parser_evaluated_fields, 'poc.parser_evaluated_fields'),
    parser_correct_fields: optionalInteger(poc.parser_correct_fields, 'poc.parser_correct_fields'),
    completed_within_2h: optionalInteger(poc.completed_within_2h, 'poc.completed_within_2h'),
    completed_within_6h: optionalInteger(poc.completed_within_6h, 'poc.completed_within_6h'),
    sonar_fallback_attempts: optionalInteger(poc.sonar_fallback_attempts, 'poc.sonar_fallback_attempts') ?? 0,
    openrouter_fallback_attempts:
      optionalInteger(poc.openrouter_fallback_attempts, 'poc.openrouter_fallback_attempts') ?? 0,
    other_fallback_attempts:
      optionalInteger(poc.other_fallback_attempts, 'poc.other_fallback_attempts') ?? 0,
    other_supplier_attempts:
      optionalInteger(poc.other_supplier_attempts, 'poc.other_supplier_attempts') ?? 0,
    total_supplier_attempts:
      optionalInteger(poc.total_supplier_attempts, 'poc.total_supplier_attempts'),
    unknown_cost_attempts: optionalInteger(poc.unknown_cost_attempts, 'poc.unknown_cost_attempts') ?? 0
  };

  return {
    completed,
    scope_id: poc.scope_id ?? null,
    cohort_id: poc.cohort_id ?? null,
    window_start: poc.window_start ?? null,
    window_end: poc.window_end ?? null,
    planned,
    plan_provided: planProvided,
    plan_matches_frozen_cohort:
      planProvided &&
      planned.counts.chatgpt === FROZEN_POC_COUNTS.chatgpt &&
      planned.counts.perplexity === FROZEN_POC_COUNTS.perplexity &&
      planned.counts.aio === FROZEN_POC_COUNTS.aio,
    terminal,
    metrics
  };
}

function resolveBrightSurface(name, surface = {}, plannedCount) {
  const nativeValid = optionalInteger(surface.native_valid_observations, `${name}.native_valid_observations`);
  const attempts = optionalInteger(surface.attempts, `${name}.attempts`);
  const zoneBytes = optionalNumber(surface.zone_billed_bytes, `${name}.zone_billed_bytes`);
  const sessionBytes = optionalNumber(surface.session_billed_bytes, `${name}.session_billed_bytes`);
  const grossCharge = optionalNumber(surface.gross_charge_usd, `${name}.gross_charge_usd`);
  const forecastMb = optionalNumber(surface.forecast_mb_per_valid_web, `${name}.forecast_mb_per_valid_web`);
  const premiumSurcharge = optionalNumber(
    surface.premium_surcharge_usd_per_gb,
    `${name}.premium_surcharge_usd_per_gb`
  );
  const actualMb = zoneBytes > 0 && nativeValid > 0 ? zoneBytes / nativeValid / 1_000_000 : null;
  const actualRate = zoneBytes > 0 && grossCharge > 0
    ? grossCharge / (zoneBytes / DECIMAL_BYTES_PER_GB)
    : null;
  const sessionDelta = zoneBytes > 0 && Number.isFinite(sessionBytes)
    ? reconciliationDelta(sessionBytes, zoneBytes)
    : null;

  return {
    zone_id: surface.zone_id ?? null,
    native_valid_observations: nativeValid,
    attempts,
    zone_billed_bytes: zoneBytes,
    session_billed_bytes: sessionBytes,
    gross_charge_usd: grossCharge,
    credits_rebates_usd: optionalNumber(surface.credits_rebates_usd, `${name}.credits_rebates_usd`) ?? 0,
    mb_per_valid_web: round(actualMb ?? forecastMb),
    actual_usd_per_gb: round(actualRate),
    session_zone_delta_rate: round(sessionDelta),
    native_success_rate: round(ratio(nativeValid, plannedCount)),
    premium_surcharge_usd_per_gb: premiumSurcharge,
    premium_rate_known: surface.premium_rate_known === true,
    actual_cost_is_gross: surface.actual_cost_is_gross === true,
    actual_complete:
      presentString(surface.zone_id) &&
      Number.isFinite(nativeValid) && nativeValid > 0 &&
      Number.isFinite(attempts) && attempts > 0 &&
      zoneBytes > 0 &&
      Number.isFinite(sessionBytes) && sessionBytes > 0 &&
      grossCharge > 0 &&
      surface.actual_cost_is_gross === true
  };
}

function resolveBrightData(brightData, planned, commercialAsOf, commitmentEnd) {
  const surfaces = {
    chatgpt: resolveBrightSurface('bright_data.surfaces.chatgpt', brightData?.surfaces?.chatgpt, planned.counts.chatgpt),
    perplexity: resolveBrightSurface(
      'bright_data.surfaces.perplexity',
      brightData?.surfaces?.perplexity,
      planned.counts.perplexity
    )
  };
  const rateCard = resolveCommercialRateCard(
    brightData?.rate_card,
    'bright_data',
    commercialAsOf,
    commitmentEnd
  );
  const totalBytes = Object.values(surfaces).reduce(
    (sum, item) => sum + (Number.isFinite(item.zone_billed_bytes) ? item.zone_billed_bytes : 0),
    0
  );
  const totalValid = Object.values(surfaces).reduce(
    (sum, item) => sum + (Number.isFinite(item.native_valid_observations) ? item.native_valid_observations : 0),
    0
  );
  return {
    usage_scope_id: brightData?.usage_scope_id ?? null,
    billing_period_id: brightData?.billing_period_id ?? null,
    billing_period_start: brightData?.billing_period_start ?? null,
    billing_period_end: brightData?.billing_period_end ?? null,
    invoice_id: brightData?.invoice_id ?? null,
    reconciled: brightData?.reconciled === true,
    surfaces,
    rate_card: rateCard,
    aggregate_mb_per_valid_web: round(totalBytes > 0 && totalValid > 0 ? totalBytes / totalValid / 1_000_000 : null)
  };
}

function resolveSerpApi(serpApi = {}, plannedAio, commercialAsOf, commitmentEnd) {
  const searchUnits = countSerpApiSearchUnits({
    initial_attempts: serpApi.initial_attempts,
    initial_successful: serpApi.initial_successful ?? 0,
    followup_attempts: serpApi.followup_attempts,
    followup_successful: serpApi.followup_successful ?? 0,
    followup_errored: serpApi.followup_errored ?? 0,
    followup_failed: serpApi.followup_failed ?? 0,
    retry_attempts: serpApi.retry_attempts,
    retry_successful: serpApi.retry_successful ?? 0,
    retry_errored: serpApi.retry_errored ?? 0,
    retry_failed: serpApi.retry_failed ?? 0,
    cached: serpApi.cached ?? 0,
    errored: serpApi.errored ?? 0,
    failed: serpApi.failed ?? 0
  });
  const supplierBillable = optionalInteger(serpApi.supplier_billable_searches, 'serpapi.supplier_billable_searches');
  const validObservations = optionalInteger(serpApi.valid_observations, 'serpapi.valid_observations');
  const grossCharge = optionalNumber(serpApi.gross_charge_usd, 'serpapi.gross_charge_usd');
  const forecastFollowup = optionalNumber(serpApi.forecast_followup_rate, 'serpapi.forecast_followup_rate', {
    max: 1
  });
  const followupRate = searchUnits.initial_successful > 0
    ? searchUnits.followup_successful / searchUnits.initial_successful
    : forecastFollowup;
  const retrySuccessfulRate = ratio(searchUnits.retry_successful, plannedAio);
  const actualRate = supplierBillable > 0 && grossCharge > 0 ? grossCharge / supplierBillable : null;
  const rateCard = resolveCommercialRateCard(
    serpApi.rate_card,
    'serpapi',
    commercialAsOf,
    commitmentEnd
  );

  return {
    ...searchUnits,
    usage_scope_id: serpApi.usage_scope_id ?? null,
    billing_period_id: serpApi.billing_period_id ?? null,
    billing_period_start: serpApi.billing_period_start ?? null,
    billing_period_end: serpApi.billing_period_end ?? null,
    invoice_id: serpApi.invoice_id ?? null,
    supplier_billable_searches: supplierBillable,
    valid_observations: validObservations,
    gross_charge_usd: grossCharge,
    credits_rebates_usd: optionalNumber(serpApi.credits_rebates_usd, 'serpapi.credits_rebates_usd') ?? 0,
    actual_cost_is_gross: serpApi.actual_cost_is_gross === true,
    reconciled: serpApi.reconciled === true,
    followup_measured: serpApi.followup_measured === true,
    followup_rate: round(followupRate),
    retry_successful_rate: round(retrySuccessfulRate),
    initial_success_rate: round(ratio(validObservations, plannedAio)),
    actual_usd_per_search: round(actualRate),
    actual_usd_per_thousand: round(Number.isFinite(actualRate) ? actualRate * 1000 : null),
    local_supplier_delta_rate: round(
      reconciliationDelta(searchUnits.billable_search_units, supplierBillable)
    ),
    rate_card: rateCard,
    actual_complete:
      searchUnits.accounting_complete &&
      searchUnits.initial_successful > 0 &&
      Number.isFinite(validObservations) && validObservations > 0 &&
      Number.isFinite(supplierBillable) && supplierBillable > 0 &&
      grossCharge > 0 &&
      serpApi.actual_cost_is_gross === true
  };
}

function resolveOtherRateLock(rateCard = {}, commercialAsOf, commitmentEnd) {
  const blockers = [];
  const effectiveFrom = parseIsoDate(rateCard.effective_from);
  const validThrough = parseIsoDate(rateCard.rate_valid_through);
  const asOf = parseIsoDate(commercialAsOf);
  const requiredEnd = parseIsoDate(commitmentEnd);
  if (!presentString(rateCard.contract_id)) blockers.push('other_cost_contract_id_missing');
  if (!effectiveFrom) blockers.push('other_cost_effective_from_invalid_or_missing');
  if (!validThrough) blockers.push('other_cost_valid_through_invalid_or_missing');
  if (effectiveFrom && asOf && effectiveFrom > asOf) blockers.push('other_cost_rate_not_yet_effective');
  if (validThrough && asOf && validThrough < asOf) blockers.push('other_cost_rate_expired');
  if (validThrough && requiredEnd && validThrough < requiredEnd) {
    blockers.push('other_cost_rate_does_not_cover_commitment');
  }
  if (rateCard.rate_locked !== true) blockers.push('other_cost_rate_not_locked');
  if (rateCard.uses_promotional_credits !== false) blockers.push('other_cost_promotional_rate_not_excluded');
  return { blockers };
}

function resolveOtherCosts(other = {}, poc, commercialAsOf, commitmentEnd) {
  const costKeys = [
    'sonar_usd',
    'openrouter_usd',
    'api_fallback_usd',
    'compute_usd',
    'storage_usd',
    'egress_usd',
    'other_vendor_usd'
  ];
  const costs = Object.fromEntries(
    costKeys.map((key) => [key, optionalNumber(other[key], `other.${key}`) ?? 0])
  );
  const runtime = Object.values(costs).reduce((sum, value) => sum + value, 0);
  const requestedOps = optionalNumber(other.ops_usd, 'other.ops_usd') ?? 5;
  const sourceBlockers = [];
  if (presentString(other.sonar_source_surface) && other.sonar_source_surface !== 'perplexity') {
    sourceBlockers.push('sonar_source_surface_must_be_perplexity');
  }
  if (presentString(other.openrouter_source_surface) && other.openrouter_source_surface !== 'chatgpt') {
    sourceBlockers.push('openrouter_source_surface_must_be_chatgpt_for_starter');
  }
  const variableDefinitions = [
    ['sonar_usd', poc.metrics.sonar_fallback_attempts, 'perplexity'],
    ['openrouter_usd', poc.metrics.openrouter_fallback_attempts, 'chatgpt'],
    ['api_fallback_usd', poc.metrics.other_fallback_attempts, other.api_fallback_source_surface],
    ['other_vendor_usd', poc.metrics.other_supplier_attempts, other.other_vendor_source_surface]
  ];
  const variable_allocations = variableDefinitions
    .filter(([, attempts]) => attempts > 0)
    .map(([costKey, attempts, sourceSurface]) => ({
      cost_key: costKey,
      attempts,
      gross_cost_usd: costs[costKey],
      source_surface: sourceSurface ?? null
    }));
  const variableKeys = new Set(variable_allocations.map((item) => item.cost_key));
  const fixedRuntime = Object.entries(costs)
    .filter(([key]) => !variableKeys.has(key))
    .reduce((sum, [, value]) => sum + value, 0);
  const rateLock = resolveOtherRateLock(other.rate_card, commercialAsOf, commitmentEnd);
  return {
    ...costs,
    runtime_cost_usd: round(runtime),
    fixed_runtime_cost_usd: round(fixedRuntime),
    variable_allocations,
    source_blockers: sourceBlockers,
    ops_usd: Math.max(5, requestedOps),
    requested_ops_usd: requestedOps,
    usage_scope_id: other.usage_scope_id ?? null,
    allocation_method_id: other.allocation_method_id ?? null,
    billing_period_id: other.billing_period_id ?? null,
    billing_period_start: other.billing_period_start ?? null,
    billing_period_end: other.billing_period_end ?? null,
    invoice_id: other.invoice_id ?? null,
    credits_rebates_usd: optionalNumber(other.credits_rebates_usd, 'other.credits_rebates_usd') ?? 0,
    reconciled: other.reconciled === true,
    uses_promotional_credits: other.uses_promotional_credits,
    rate_lock: rateLock,
    actual_complete:
      presentString(other.usage_scope_id) &&
      presentString(other.allocation_method_id) &&
      other.reconciled === true &&
      other.uses_promotional_credits === false &&
      costs.compute_usd > 0 && costs.storage_usd > 0
  };
}

function calculateOtherRuntimeCost(workload, poc, other) {
  const normalized = normalizeWorkloadObject(workload);
  let cost = other.fixed_runtime_cost_usd;
  for (const allocation of other.variable_allocations) {
    if (!['chatgpt', 'perplexity', 'aio'].includes(allocation.source_surface)) {
      cost += allocation.gross_cost_usd;
      continue;
    }
    const actualCount = poc.planned.counts[allocation.source_surface];
    const scenarioCount = normalized.counts[allocation.source_surface];
    cost += allocation.gross_cost_usd * scenarioCount / actualCount;
  }
  return round(cost);
}

export function calculateBrightDataCost({ workload, surfaces, base_usd_per_gb }) {
  const normalized = normalizeWorkloadObject(workload);
  const baseRate = requireNumber(base_usd_per_gb, 'base_usd_per_gb', { min: Number.EPSILON });
  const details = {};
  let total = 0;
  for (const name of ['chatgpt', 'perplexity']) {
    const mb = requireNumber(surfaces?.[name]?.mb_per_valid_web, `${name}.mb_per_valid_web`);
    const premium = requireNumber(
      surfaces?.[name]?.premium_surcharge_usd_per_gb,
      `${name}.premium_surcharge_usd_per_gb`
    );
    const observations = normalized.counts[name];
    const gb = observations * mb / DECIMAL_MB_PER_GB;
    const cost = gb * (baseRate + premium);
    details[name] = {
      observations,
      allocated_gb: round(gb),
      all_in_usd_per_gb: round(baseRate + premium),
      cost_usd: round(cost)
    };
    total += cost;
  }
  return { surfaces: details, cost_usd: round(total) };
}

export function calculateSerpApiCost({
  workload,
  followup_rate,
  retry_successful_rate = 0,
  effective_usd_per_search
}) {
  const normalized = normalizeWorkloadObject(workload);
  const followup = requireNumber(followup_rate, 'followup_rate', { max: 1 });
  const retryRate = requireNumber(retry_successful_rate, 'retry_successful_rate', { max: 1 });
  const rate = requireNumber(effective_usd_per_search, 'effective_usd_per_search', {
    min: Number.EPSILON
  });
  const units = normalized.aio_observations * (1 + followup + retryRate);
  return {
    aio_observations: normalized.aio_observations,
    provider_search_units: round(units),
    cost_usd: round(units * rate)
  };
}

function buildScenarios({ workloads, bright, serp, poc, other }) {
  const baseBrightRate = bright.rate_card.effective_unit_rate;
  const serpRate = serp.rate_card.effective_unit_rate;
  const usable =
    Number.isFinite(baseBrightRate) &&
    Number.isFinite(serpRate) &&
    Number.isFinite(serp.followup_rate) &&
    Number.isFinite(serp.retry_successful_rate) &&
    ['chatgpt', 'perplexity'].every((name) =>
      Number.isFinite(bright.surfaces[name].mb_per_valid_web) &&
      Number.isFinite(bright.surfaces[name].premium_surcharge_usd_per_gb)
    );
  if (!usable) return [];

  return workloads.map((workload) => {
    const otherRuntimeCost = calculateOtherRuntimeCost(workload, poc, other);
    const brightCost = calculateBrightDataCost({
      workload,
      surfaces: bright.surfaces,
      base_usd_per_gb: baseBrightRate
    });
    const serpCost = calculateSerpApiCost({
      workload,
      followup_rate: serp.followup_rate,
      retry_successful_rate: serp.retry_successful_rate,
      effective_usd_per_search: serpRate
    });
    return {
      name: workload.name,
      workload,
      bright_data: brightCost,
      serpapi: serpCost,
      other_runtime_cost_usd: round(otherRuntimeCost),
      runtime_cost_usd: round(brightCost.cost_usd + serpCost.cost_usd + otherRuntimeCost)
    };
  });
}

export function deriveVendorRateCeilings({ workloads, bright, serp, poc, other }) {
  const scenarios = workloads ?? enumerateWorstCaseStarterWorkloads();
  const brightBaseRate = bright?.rate_card?.effective_unit_rate;
  const serpRate = serp?.rate_card?.effective_unit_rate;
  const followupRate = serp?.followup_rate;
  const retryRate = serp?.retry_successful_rate;
  const brightCeilings = [];
  const serpCeilings = [];

  for (const workload of scenarios) {
    const otherRuntimeCost = poc && other ? calculateOtherRuntimeCost(workload, poc, other) : null;
    const web = ['chatgpt', 'perplexity'].map((name) => {
      const mb = bright?.surfaces?.[name]?.mb_per_valid_web;
      const premium = bright?.surfaces?.[name]?.premium_surcharge_usd_per_gb;
      const gb = Number.isFinite(mb) ? workload.counts[name] * mb / DECIMAL_MB_PER_GB : null;
      return { gb, premium };
    });
    const totalWebGb = web.every((item) => Number.isFinite(item.gb))
      ? web.reduce((sum, item) => sum + item.gb, 0)
      : null;
    const premiumCost = web.every((item) => Number.isFinite(item.gb) && Number.isFinite(item.premium))
      ? web.reduce((sum, item) => sum + item.gb * item.premium, 0)
      : null;
    const serpUnits = Number.isFinite(followupRate) && Number.isFinite(retryRate)
      ? workload.aio_observations * (1 + followupRate + retryRate)
      : null;
    const currentSerpCost = Number.isFinite(serpUnits) && Number.isFinite(serpRate)
      ? serpUnits * serpRate
      : null;
    const currentBrightCost = Number.isFinite(totalWebGb) && Number.isFinite(premiumCost) && Number.isFinite(brightBaseRate)
      ? totalWebGb * brightBaseRate + premiumCost
      : null;

    if (
      Number.isFinite(otherRuntimeCost) &&
      Number.isFinite(totalWebGb) && totalWebGb > 0 &&
      Number.isFinite(currentSerpCost) && Number.isFinite(premiumCost)
    ) {
      brightCeilings.push((15 - otherRuntimeCost - currentSerpCost - premiumCost) / totalWebGb);
    }
    if (
      Number.isFinite(otherRuntimeCost) &&
      Number.isFinite(serpUnits) && serpUnits > 0 && Number.isFinite(currentBrightCost)
    ) {
      serpCeilings.push((15 - otherRuntimeCost - currentBrightCost) / serpUnits * 1000);
    }
  }

  const minOrNull = (values) => values.length ? Math.min(...values) : null;
  const brightCeiling = minOrNull(brightCeilings);
  const serpCeiling = minOrNull(serpCeilings);
  return {
    bright_all_in_base_usd_per_gb_max: round(brightCeiling),
    serpapi_usd_per_thousand_max: round(serpCeiling),
    bright_feasible: Number.isFinite(brightCeiling) && brightCeiling > 0,
    serpapi_feasible: Number.isFinite(serpCeiling) && serpCeiling > 0
  };
}

function collectTechnicalFailures({ poc, bright, serp, knownSupplierAttempts, effectiveObservations }) {
  if (!poc.completed) return [];
  const failures = [];
  const planned = poc.planned;
  const total = STARTER_TOTAL_CREDITS;
  const metrics = poc.metrics;
  const requiredNumbers = [
    ['poc_plan_missing', poc.plan_provided ? 1 : null],
    ['evidence_records_missing', metrics.evidence_records],
    ['structured_validations_missing', metrics.structured_validations_passed],
    ['parser_evaluated_fields_missing', metrics.parser_evaluated_fields],
    ['parser_correct_fields_missing', metrics.parser_correct_fields],
    ['completed_within_2h_missing', metrics.completed_within_2h],
    ['completed_within_6h_missing', metrics.completed_within_6h],
    ['total_supplier_attempts_missing', metrics.total_supplier_attempts]
  ];
  for (const [code, value] of requiredNumbers) if (!Number.isFinite(value)) failures.push(code);
  if (!poc.plan_matches_frozen_cohort) failures.push('poc_planned_cohort_not_1334_1333_1333');

  for (const name of ['chatgpt', 'perplexity', 'aio']) {
    if (!Number.isFinite(poc.terminal[name]) || poc.terminal[name] !== planned.counts[name]) {
      failures.push(`${name}_terminal_observation_count_mismatch`);
    }
  }
  if (Number.isFinite(metrics.total_supplier_attempts) && metrics.total_supplier_attempts !== knownSupplierAttempts) {
    failures.push('supplier_attempt_ledger_not_conserved');
  }
  if (metrics.unknown_cost_attempts > 0) failures.push('unknown_cost_attempts_present');

  const attemptMultiplier = ratio(knownSupplierAttempts, effectiveObservations);
  if (!Number.isFinite(attemptMultiplier) || attemptMultiplier < 1 || attemptMultiplier > TECHNICAL_LIMITS.attempt_multiplier) {
    failures.push('attempt_multiplier_outside_1.00_to_1.10');
  }
  const sonarFallbackRate = ratio(metrics.sonar_fallback_attempts, planned.counts.perplexity);
  if (!Number.isFinite(sonarFallbackRate) || sonarFallbackRate > TECHNICAL_LIMITS.sonar_fallback_rate) {
    failures.push('sonar_fallback_rate_exceeds_0.05');
  }
  const apiFallbackAttempts =
    metrics.sonar_fallback_attempts + metrics.openrouter_fallback_attempts + metrics.other_fallback_attempts;
  const apiFallbackRate = ratio(apiFallbackAttempts, planned.web_observations);
  if (!Number.isFinite(apiFallbackRate) || apiFallbackRate > TECHNICAL_LIMITS.api_fallback_rate) {
    failures.push('api_fallback_rate_exceeds_0.05');
  }

  for (const name of ['chatgpt', 'perplexity']) {
    const surface = bright.surfaces[name];
    if (!Number.isFinite(surface.attempts) || surface.attempts < planned.counts[name]) {
      failures.push(`${name}_attempt_count_below_planned_observations`);
    }
    if (!Number.isFinite(surface.mb_per_valid_web) || surface.mb_per_valid_web > TECHNICAL_LIMITS.bright_mb_per_valid_web) {
      failures.push(`${name}_mb_per_valid_web_exceeds_0.35_or_missing`);
    }
    if (
      !Number.isFinite(surface.native_success_rate) ||
      surface.native_success_rate < TECHNICAL_LIMITS.guest_ui_native_success_rate ||
      surface.native_success_rate > 1
    ) {
      failures.push(`${name}_native_success_rate_below_0.97_or_invalid`);
    }
  }
  if (
    !Number.isFinite(bright.aggregate_mb_per_valid_web) ||
    bright.aggregate_mb_per_valid_web > TECHNICAL_LIMITS.bright_mb_per_valid_web
  ) {
    failures.push('aggregate_bright_mb_per_valid_web_exceeds_0.35_or_missing');
  }
  if (
    !Number.isFinite(serp.initial_success_rate) ||
    serp.initial_success_rate < TECHNICAL_LIMITS.aio_initial_success_rate ||
    serp.initial_success_rate > 1
  ) {
    failures.push('aio_initial_success_rate_below_0.995_or_invalid');
  }
  if (serp.total_supplier_requests < planned.counts.aio) {
    failures.push('serpapi_request_count_below_planned_aio_observations');
  }
  if (!serp.accounting_complete) failures.push('serpapi_attempt_accounting_incomplete');
  if (serp.initial_attempts !== planned.counts.aio) {
    failures.push('serpapi_initial_attempt_count_must_equal_planned_aio');
  }
  if (serp.cached > 0) failures.push('serpapi_cached_searches_present_in_no_cache_poc');
  if (
    !Number.isFinite(serp.valid_observations) ||
    serp.valid_observations > serp.initial_successful + serp.retry_successful
  ) {
    failures.push('serpapi_valid_observation_count_invalid');
  }

  const parserAccuracy = ratio(metrics.parser_correct_fields, metrics.parser_evaluated_fields);
  if (
    !Number.isFinite(parserAccuracy) ||
    metrics.parser_evaluated_fields < 100 ||
    parserAccuracy < TECHNICAL_LIMITS.parser_accuracy ||
    parserAccuracy > 1
  ) {
    failures.push('parser_accuracy_below_0.99_or_sample_too_small');
  }
  const evidenceRate = ratio(metrics.evidence_records, total);
  if (!Number.isFinite(evidenceRate) || evidenceRate < TECHNICAL_LIMITS.evidence_return_rate || evidenceRate > 1) {
    failures.push('evidence_return_rate_below_0.995_or_invalid');
  }
  const validationRate = ratio(metrics.structured_validations_passed, total);
  if (validationRate !== TECHNICAL_LIMITS.structured_validation_rate) {
    failures.push('structured_validation_rate_not_1.0');
  }
  const within2h = ratio(metrics.completed_within_2h, total);
  const within6h = ratio(metrics.completed_within_6h, total);
  if (!Number.isFinite(within2h) || within2h < TECHNICAL_LIMITS.within_2h_rate || within2h > 1) {
    failures.push('within_2h_rate_below_0.95_or_invalid');
  }
  if (!Number.isFinite(within6h) || within6h < TECHNICAL_LIMITS.within_6h_rate || within6h > 1) {
    failures.push('within_6h_rate_below_0.99_or_invalid');
  }
  if (Number.isFinite(within2h) && Number.isFinite(within6h) && within6h < within2h) {
    failures.push('within_6h_count_below_within_2h_count');
  }
  return [...new Set(failures)];
}

function collectCommercialBlockers({
  poc,
  bright,
  serp,
  other,
  commercialAsOf,
  commitmentEnd
}) {
  const blockers = [];
  const asOf = parseIsoDate(commercialAsOf);
  const requiredEnd = parseIsoDate(commitmentEnd);
  if (!asOf) blockers.push('commercial_as_of_date_invalid_or_missing');
  if (!requiredEnd) blockers.push('commercial_commitment_end_date_invalid_or_missing');
  if (asOf && requiredEnd) {
    const lockedDays = (requiredEnd.getTime() - asOf.getTime()) / 86_400_000;
    if (lockedDays < MIN_COMMERCIAL_LOCK_DAYS) {
      blockers.push('commercial_commitment_must_cover_at_least_365_days');
    }
  }
  if (!poc.completed) blockers.push('poc_not_completed');
  if (!presentString(poc.scope_id)) blockers.push('poc_scope_id_missing');
  if (!presentString(poc.cohort_id)) blockers.push('poc_cohort_id_missing');
  const pocStart = parseIsoDate(poc.window_start);
  const pocEnd = parseIsoDate(poc.window_end);
  if (!pocStart || !pocEnd || pocStart > pocEnd) {
    blockers.push('poc_window_invalid_or_missing');
  }
  if (poc.completed && pocEnd && asOf && pocEnd > asOf) blockers.push('poc_window_ends_after_commercial_as_of');

  if (!presentString(bright.usage_scope_id) || bright.usage_scope_id !== poc.scope_id) {
    blockers.push('bright_usage_scope_mismatch');
  }
  if (!presentString(bright.billing_period_id)) blockers.push('bright_billing_period_id_missing');
  if (!presentString(bright.invoice_id)) blockers.push('bright_invoice_id_missing');
  if (!periodCovers(bright.billing_period_start, bright.billing_period_end, poc.window_start, poc.window_end)) {
    blockers.push('bright_billing_period_does_not_cover_poc_window');
  }
  if (!bright.reconciled) blockers.push('bright_usage_not_reconciled');
  blockers.push(...bright.rate_card.blockers);
  if (bright.rate_card.pricing_model === 'committed') {
    if (bright.rate_card.pool_usage_period_id !== bright.billing_period_id) {
      blockers.push('bright_data_pool_usage_period_id_mismatch');
    }
    if (!periodsMatch(
      bright.rate_card.pool_usage_period_start,
      bright.rate_card.pool_usage_period_end,
      bright.billing_period_start,
      bright.billing_period_end
    )) {
      blockers.push('bright_data_pool_usage_period_mismatch');
    }
    if (bright.rate_card.pool_usage_invoice_id !== bright.invoice_id) {
      blockers.push('bright_data_pool_usage_invoice_mismatch');
    }
    const pocGb = Object.values(bright.surfaces).reduce(
      (sum, surface) => sum + ((surface.zone_billed_bytes ?? 0) / DECIMAL_BYTES_PER_GB),
      0
    );
    const pocGross = Object.values(bright.surfaces).reduce(
      (sum, surface) => sum + (surface.gross_charge_usd ?? 0),
      0
    );
    if (!totalCoversSubset(bright.rate_card.actual_pool_used_units, pocGb)) {
      blockers.push('bright_data_pool_units_do_not_cover_poc_subset');
    }
    if (!totalCoversSubset(bright.rate_card.pool_usage_gross_charge_usd, pocGross)) {
      blockers.push('bright_data_pool_gross_does_not_cover_poc_subset');
    }
  }
  const zones = [];
  for (const name of ['chatgpt', 'perplexity']) {
    const surface = bright.surfaces[name];
    if (!surface.actual_complete) blockers.push(`bright_${name}_actual_usage_or_gross_cost_missing`);
    if (surface.credits_rebates_usd > 0) blockers.push(`bright_${name}_promotional_period_not_eligible`);
    if (!surface.premium_rate_known) blockers.push(`bright_${name}_premium_rate_unknown`);
    if (!Number.isFinite(surface.premium_surcharge_usd_per_gb)) {
      blockers.push(`bright_${name}_premium_surcharge_missing`);
    }
    if (!Number.isFinite(surface.session_zone_delta_rate)) {
      blockers.push(`bright_${name}_session_zone_reconciliation_missing`);
    } else if (surface.session_zone_delta_rate > RECONCILIATION_TOLERANCE) {
      blockers.push(`bright_${name}_session_zone_delta_exceeds_0.02`);
    }
    if (presentString(surface.zone_id)) zones.push(surface.zone_id);
  }
  if (zones.length === 2 && new Set(zones).size !== 2) blockers.push('bright_surface_cost_attribution_not_isolated');

  if (!presentString(serp.usage_scope_id) || serp.usage_scope_id !== poc.scope_id) {
    blockers.push('serpapi_usage_scope_mismatch');
  }
  if (!presentString(serp.billing_period_id)) blockers.push('serpapi_billing_period_id_missing');
  if (!presentString(serp.invoice_id)) blockers.push('serpapi_invoice_id_missing');
  if (!periodCovers(serp.billing_period_start, serp.billing_period_end, poc.window_start, poc.window_end)) {
    blockers.push('serpapi_billing_period_does_not_cover_poc_window');
  }
  if (!serp.actual_complete) blockers.push('serpapi_actual_usage_or_gross_cost_missing');
  if (!serp.actual_cost_is_gross) blockers.push('serpapi_gross_cost_not_confirmed');
  if (serp.credits_rebates_usd > 0) blockers.push('serpapi_promotional_period_not_eligible');
  if (!serp.reconciled) blockers.push('serpapi_usage_not_reconciled');
  if (!serp.followup_measured) blockers.push('serpapi_followup_rate_not_measured');
  if (!Number.isFinite(serp.local_supplier_delta_rate)) {
    blockers.push('serpapi_local_supplier_reconciliation_missing');
  } else if (serp.local_supplier_delta_rate > RECONCILIATION_TOLERANCE) {
    blockers.push('serpapi_local_supplier_delta_exceeds_0.02');
  }
  blockers.push(...serp.rate_card.blockers);
  if (serp.rate_card.pricing_model === 'committed') {
    if (serp.rate_card.pool_usage_period_id !== serp.billing_period_id) {
      blockers.push('serpapi_pool_usage_period_id_mismatch');
    }
    if (!periodsMatch(
      serp.rate_card.pool_usage_period_start,
      serp.rate_card.pool_usage_period_end,
      serp.billing_period_start,
      serp.billing_period_end
    )) {
      blockers.push('serpapi_pool_usage_period_mismatch');
    }
    if (serp.rate_card.pool_usage_invoice_id !== serp.invoice_id) {
      blockers.push('serpapi_pool_usage_invoice_mismatch');
    }
    if (!totalCoversSubset(serp.rate_card.actual_pool_used_units, serp.supplier_billable_searches)) {
      blockers.push('serpapi_pool_units_do_not_cover_poc_subset');
    }
    if (!totalCoversSubset(serp.rate_card.pool_usage_gross_charge_usd, serp.gross_charge_usd)) {
      blockers.push('serpapi_pool_gross_does_not_cover_poc_subset');
    }
  }

  if (!other.actual_complete) blockers.push('other_runtime_costs_not_reconciled_or_incomplete');
  if (!presentString(other.billing_period_id)) blockers.push('other_cost_billing_period_id_missing');
  if (!presentString(other.invoice_id)) blockers.push('other_cost_invoice_id_missing');
  if (!periodCovers(other.billing_period_start, other.billing_period_end, poc.window_start, poc.window_end)) {
    blockers.push('other_cost_billing_period_does_not_cover_poc_window');
  }
  if (other.credits_rebates_usd > 0) blockers.push('other_cost_promotional_period_not_eligible');
  blockers.push(...other.rate_lock.blockers);
  if (!presentString(other.usage_scope_id) || other.usage_scope_id !== poc.scope_id) {
    blockers.push('other_cost_usage_scope_mismatch');
  }
  if (poc.metrics.sonar_fallback_attempts > 0 && !(round(other.sonar_usd, 8) > 0)) {
    blockers.push('sonar_attempts_have_zero_gross_cost');
  }
  if (poc.metrics.openrouter_fallback_attempts > 0 && !(round(other.openrouter_usd, 8) > 0)) {
    blockers.push('openrouter_attempts_have_zero_gross_cost');
  }
  if (poc.metrics.other_fallback_attempts > 0 && !(round(other.api_fallback_usd, 8) > 0)) {
    blockers.push('other_fallback_attempts_have_zero_gross_cost');
  }
  if (poc.metrics.other_supplier_attempts > 0 && !(round(other.other_vendor_usd, 8) > 0)) {
    blockers.push('other_supplier_attempts_have_zero_gross_cost');
  }
  if (poc.metrics.unknown_cost_attempts > 0) blockers.push('unknown_cost_attempts_present');
  blockers.push(...other.source_blockers);
  for (const allocation of other.variable_allocations) {
    if (!['chatgpt', 'perplexity', 'aio'].includes(allocation.source_surface)) {
      blockers.push(`${allocation.cost_key}_source_surface_missing_or_invalid`);
    }
  }
  return [...new Set(blockers)];
}

function buildDerivedMetrics({ poc, bright, serp, knownSupplierAttempts, effectiveObservations }) {
  const total = STARTER_TOTAL_CREDITS;
  const parserAccuracy = ratio(poc.metrics.parser_correct_fields, poc.metrics.parser_evaluated_fields);
  const apiFallbackAttempts =
    poc.metrics.sonar_fallback_attempts +
    poc.metrics.openrouter_fallback_attempts +
    poc.metrics.other_fallback_attempts;
  return {
    effective_observations: effectiveObservations,
    attempt_multiplier: round(ratio(knownSupplierAttempts, effectiveObservations)),
    sonar_fallback_rate: round(ratio(poc.metrics.sonar_fallback_attempts, poc.planned.counts.perplexity)),
    api_fallback_rate: round(ratio(apiFallbackAttempts, poc.planned.web_observations)),
    parser_accuracy: round(parserAccuracy),
    evidence_return_rate: round(ratio(poc.metrics.evidence_records, total)),
    structured_validation_rate: round(ratio(poc.metrics.structured_validations_passed, total)),
    within_2h_rate: round(ratio(poc.metrics.completed_within_2h, total)),
    within_6h_rate: round(ratio(poc.metrics.completed_within_6h, total)),
    guest_native_success_rate: {
      chatgpt: bright.surfaces.chatgpt.native_success_rate,
      perplexity: bright.surfaces.perplexity.native_success_rate
    },
    aio_initial_success_rate: serp.initial_success_rate,
    serpapi_retry_successful_rate: serp.retry_successful_rate
  };
}

export function evaluateStarterCostGate(input = {}) {
  const workloads = enumerateWorstCaseStarterWorkloads();
  const poc = resolvePoc(input.poc);
  const commercialAsOf = input.commercial_as_of_date;
  const commitmentEnd = input.commercial_commitment_end_date;
  const bright = resolveBrightData(input.bright_data, poc.planned, commercialAsOf, commitmentEnd);
  const serp = resolveSerpApi(
    input.serpapi,
    poc.planned.counts.aio,
    commercialAsOf,
    commitmentEnd
  );
  const other = resolveOtherCosts(input.other, poc, commercialAsOf, commitmentEnd);
  const knownSupplierAttempts =
    (bright.surfaces.chatgpt.attempts ?? 0) +
    (bright.surfaces.perplexity.attempts ?? 0) +
    serp.total_supplier_requests +
    poc.metrics.sonar_fallback_attempts +
    poc.metrics.openrouter_fallback_attempts +
    poc.metrics.other_fallback_attempts +
    poc.metrics.other_supplier_attempts;
  const effectiveObservations =
    (bright.surfaces.chatgpt.native_valid_observations ?? 0) +
    (bright.surfaces.perplexity.native_valid_observations ?? 0) +
    (serp.valid_observations ?? 0);
  const technicalFailures = collectTechnicalFailures({
    poc,
    bright,
    serp,
    knownSupplierAttempts,
    effectiveObservations
  });
  const blockers = collectCommercialBlockers({
    poc,
    bright,
    serp,
    other,
    commercialAsOf,
    commitmentEnd
  });
  const scenarios = buildScenarios({
    workloads,
    bright,
    serp,
    poc,
    other
  });
  const worstCase = scenarios.length
    ? scenarios.reduce((highest, scenario) =>
      scenario.runtime_cost_usd > highest.runtime_cost_usd ? scenario : highest
    )
    : null;
  const runtimeCost = worstCase?.runtime_cost_usd ?? null;
  const finalCost = Number.isFinite(runtimeCost) ? round(runtimeCost + other.ops_usd) : null;
  if (!Number.isFinite(runtimeCost)) blockers.push('commercial_cost_scenarios_incomplete');
  if (Number.isFinite(runtimeCost) && runtimeCost > 15) blockers.push('runtime_cost_exceeds_15_usd');
  if (Number.isFinite(finalCost) && finalCost > 20) blockers.push('final_cost_exceeds_20_usd');

  const warnings = [];
  if (other.requested_ops_usd < 5) warnings.push('ops_allocation_raised_to_hard_gate_floor_5_usd');
  let decision;
  if (technicalFailures.length) decision = 'TECHNICAL_NO_GO';
  else if (blockers.length || !Number.isFinite(runtimeCost) || !Number.isFinite(finalCost)) {
    decision = 'COMMERCIAL_BLOCKED';
  } else if (finalCost > 17) {
    decision = 'GO_SOFT_WARNING';
    warnings.push('final_cost_exceeds_17_usd_soft_warning');
  } else decision = 'GO';

  return {
    decision,
    runtime_cost_usd: runtimeCost,
    ops_allocation_usd: round(other.ops_usd),
    final_cost_usd: finalCost,
    selected_worst_case: worstCase,
    scenarios,
    derived_metrics: buildDerivedMetrics({
      poc,
      bright,
      serp,
      knownSupplierAttempts,
      effectiveObservations
    }),
    actual_vendor_metrics: {
      bright_data: {
        aggregate_mb_per_valid_web: bright.aggregate_mb_per_valid_web,
        surfaces: bright.surfaces
      },
      serpapi: {
        followup_rate: serp.followup_rate,
        retry_successful_rate: serp.retry_successful_rate,
        local_billable_search_units: serp.billable_search_units,
        supplier_billable_searches: serp.supplier_billable_searches,
        actual_usd_per_thousand: serp.actual_usd_per_thousand,
        local_supplier_delta_rate: serp.local_supplier_delta_rate
      }
    },
    commercial_rate_card: {
      bright_base_usd_per_gb: bright.rate_card.effective_unit_rate,
      serpapi_usd_per_thousand: round(
        Number.isFinite(serp.rate_card.effective_unit_rate)
          ? serp.rate_card.effective_unit_rate * 1000
          : null
      )
    },
    rate_ceiling: deriveVendorRateCeilings({
      workloads,
      bright,
      serp,
      poc,
      other
    }),
    technical_failures: [...new Set(technicalFailures)],
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)]
  };
}

export const starterCostGateConstants = Object.freeze({
  base_per_surface: STARTER_BASE_PER_SURFACE,
  flex_total: STARTER_FLEX_TOTAL,
  total_credits: STARTER_TOTAL_CREDITS,
  reconciliation_tolerance: RECONCILIATION_TOLERANCE,
  maximum_stress_utilization: MAX_STRESS_UTILIZATION,
  technical_limits: TECHNICAL_LIMITS
});
