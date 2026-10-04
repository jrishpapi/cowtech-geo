import {
  PHASE7_CASH_HARD_LIMIT_MICRO_USD,
  PHASE7_COGS_HARD_LIMIT_MICRO_USD,
  PHASE7_COGS_SOFT_WARNING_MICRO_USD
} from './phase7-budget-hard-stop.js';

export const PHASE7_DECISIONS = Object.freeze([
  'GO',
  'OPTIMIZE',
  'NO-GO',
  'COMMERCIAL-BLOCKED'
]);

const SURFACES = Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio']);
const EXPECTED = Object.freeze({
  chatgpt_ui: 1334,
  perplexity_ui: 1333,
  google_aio: 1333
});

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function validatePlan(plan) {
  if (
    plan?.schema_version !== 'phase7-poc-engineering-plan-v1' ||
    plan.planned_demands !== 4000 ||
    plan.items?.length !== 4000
  ) {
    throw new TypeError('a valid frozen Phase 7 4,000-demand plan is required');
  }
}

function aggregateSurface(surface, planned, rows) {
  const valid = rows.filter((row) => row.valid === true).length;
  const nativeSuccess = rows.filter((row) => row.native_success === true).length;
  const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
  const fallbackAttempts = rows.reduce((sum, row) => sum + row.fallback_attempts, 0);
  const parserCorrect = rows.filter((row) => row.parser_correct === true).length;
  const evidence = rows.filter((row) => row.evidence_present === true).length;
  const structured = rows.filter((row) => row.structured_valid === true).length;
  const trafficBytes = rows.reduce((sum, row) => sum + row.traffic_bytes, 0);
  const latencies = rows.map((row) => row.latency_ms);
  const aioTriggered = rows.filter((row) => row.aio_triggered === true).length;
  const aioFollowup = rows.filter((row) => row.aio_followup === true).length;
  return Object.freeze({
    surface,
    planned_demands: planned,
    observed_demands: rows.length,
    valid_observations: valid,
    native_successes: nativeSuccess,
    total_attempts: attempts,
    fallback_attempts: fallbackAttempts,
    native_success_rate: ratio(nativeSuccess, planned),
    valid_delivery_rate: ratio(valid, planned),
    attempt_multiplier: ratio(attempts, planned),
    fallback_rate: ratio(fallbackAttempts, attempts),
    parser_accuracy: ratio(parserCorrect, rows.length),
    evidence_coverage: ratio(evidence, rows.length),
    structured_validation_rate: ratio(structured, rows.length),
    traffic_bytes: trafficBytes,
    p50_latency_ms: percentile(latencies, 0.5),
    p95_latency_ms: percentile(latencies, 0.95),
    aio_trigger_rate: surface === 'google_aio' ? ratio(aioTriggered, rows.length) : null,
    aio_no_trigger_rate: surface === 'google_aio' ? ratio(rows.length - aioTriggered, rows.length) : null,
    aio_followup_rate: surface === 'google_aio' ? ratio(aioFollowup, aioTriggered) : null
  });
}

function normalizeObservation(row = {}) {
  if (!SURFACES.includes(row.surface)) throw new RangeError(`unsupported surface: ${row.surface}`);
  return Object.freeze({
    item_key: String(row.item_key || '').trim(),
    surface: row.surface,
    valid: row.valid === true,
    native_success: row.native_success === true,
    attempts: nonNegativeInteger(row.attempts, 'attempts'),
    fallback_attempts: nonNegativeInteger(row.fallback_attempts, 'fallback_attempts'),
    latency_ms: nonNegativeInteger(row.latency_ms, 'latency_ms'),
    parser_correct: row.parser_correct === true,
    evidence_present: row.evidence_present === true,
    structured_valid: row.structured_valid === true,
    traffic_bytes: nonNegativeInteger(row.traffic_bytes, 'traffic_bytes'),
    aio_triggered: row.aio_triggered === true,
    aio_followup: row.aio_followup === true
  });
}

export function buildPhase7PocEvaluation({
  plan,
  observations = [],
  billingReconciliation,
  budgetSnapshot,
  liveEvidence = false,
  liveEvidenceRef = '',
  runWindowId = ''
} = {}) {
  validatePlan(plan);
  const blockers = [];
  const noGoReasons = [];
  const optimizeReasons = [];
  const commercialReasons = [];
  const planItems = new Map(plan.items.map((item) => [item.item_key, item]));
  const seen = new Set();
  const normalized = [];
  for (const input of observations) {
    const row = normalizeObservation(input);
    if (!row.item_key || !planItems.has(row.item_key)) {
      blockers.push('unknown_observation_item');
      continue;
    }
    if (seen.has(row.item_key)) {
      blockers.push('duplicate_observation_item');
      continue;
    }
    if (planItems.get(row.item_key).surface !== row.surface) {
      blockers.push('observation_surface_mismatch');
      continue;
    }
    if (row.fallback_attempts > row.attempts) blockers.push('fallback_attempts_exceed_attempts');
    seen.add(row.item_key);
    normalized.push(row);
  }
  if (normalized.length !== 4000) blockers.push('observation_coverage_not_4000');

  const surfaceReports = SURFACES.map((surface) => aggregateSurface(
    surface,
    EXPECTED[surface],
    normalized.filter((row) => row.surface === surface)
  ));
  for (const report of surfaceReports) {
    if (report.observed_demands !== report.planned_demands) {
      noGoReasons.push(`${report.surface}_coverage_incomplete`);
      continue;
    }
    const nativeMinimum = report.surface === 'google_aio' ? 0.995 : 0.97;
    if (report.native_success_rate < nativeMinimum) {
      noGoReasons.push(`${report.surface}_native_success_below_threshold`);
    }
    if (report.parser_accuracy < 0.99) noGoReasons.push(`${report.surface}_parser_below_0.99`);
    if (report.evidence_coverage < 0.995) noGoReasons.push(`${report.surface}_evidence_below_0.995`);
    if (report.structured_validation_rate < 1) {
      noGoReasons.push(`${report.surface}_structured_validation_below_1`);
    }
    if (report.attempt_multiplier > 1.1) {
      noGoReasons.push(`${report.surface}_attempt_multiplier_above_1.1`);
    }
    if (report.fallback_rate > 0.05) {
      noGoReasons.push(`${report.surface}_fallback_rate_above_0.05`);
    }
  }
  if (blockers.length) noGoReasons.push(...blockers);

  const webReports = surfaceReports.filter((row) => row.surface !== 'google_aio');
  const webValid = webReports.reduce((sum, row) => sum + row.valid_observations, 0);
  const brightBytes = webReports.reduce((sum, row) => sum + row.traffic_bytes, 0);
  const brightMbPerValidWeb = webValid > 0 ? brightBytes / webValid / 1_000_000 : null;
  if (brightMbPerValidWeb !== null && brightMbPerValidWeb > 0.6) {
    noGoReasons.push('bright_mb_per_valid_web_above_0.60');
  } else if (brightMbPerValidWeb !== null && brightMbPerValidWeb > 0.35) {
    optimizeReasons.push(
      brightMbPerValidWeb > 0.45
        ? 'bright_mb_per_valid_web_above_0.45'
        : 'bright_mb_per_valid_web_between_0.35_and_0.45'
    );
  }

  const billedCost = billingReconciliation?.total_billed_cost_micro_usd ?? 0;
  const steadyStateCogs =
    billingReconciliation?.steady_state_cogs_micro_usd_per_4000_credits ?? 0;
  if (billedCost > PHASE7_CASH_HARD_LIMIT_MICRO_USD) {
    noGoReasons.push('actual_cash_cost_above_65_usd');
  }
  if (steadyStateCogs > PHASE7_COGS_HARD_LIMIT_MICRO_USD) {
    noGoReasons.push('steady_state_cogs_above_50_usd');
  } else if (steadyStateCogs >= PHASE7_COGS_SOFT_WARNING_MICRO_USD) {
    optimizeReasons.push('steady_state_cogs_at_or_above_45_usd');
  }
  if (budgetSnapshot?.hard_stop_open === true && billedCost < PHASE7_CASH_HARD_LIMIT_MICRO_USD) {
    noGoReasons.push('budget_hard_stop_open');
  }
  if (liveEvidence !== true) commercialReasons.push('live_evidence_missing');
  if (liveEvidence === true && !String(liveEvidenceRef || '').trim()) {
    commercialReasons.push('live_evidence_ref_missing');
  }
  if (billingReconciliation?.status !== 'reconciled') {
    commercialReasons.push('supplier_billing_not_reconciled');
  }
  if (billingReconciliation?.run_window_id !== runWindowId) {
    commercialReasons.push('billing_run_window_mismatch');
  }

  let decision = 'GO';
  if (noGoReasons.length) decision = 'NO-GO';
  else if (commercialReasons.length) decision = 'COMMERCIAL-BLOCKED';
  else if (optimizeReasons.length) decision = 'OPTIMIZE';
  const authoritative = liveEvidence === true &&
    String(liveEvidenceRef || '').trim().length > 0;
  return Object.freeze({
    schema_version: 'phase7-poc-evaluation-v1',
    run_window_id: String(runWindowId || ''),
    cohort_id: plan.cohort_id,
    dataset_sha256: plan.dataset_sha256,
    planned_demands: 4000,
    observed_demands: normalized.length,
    valid_observations: normalized.filter((row) => row.valid).length,
    total_attempts: normalized.reduce((sum, row) => sum + row.attempts, 0),
    fallback_attempts: normalized.reduce((sum, row) => sum + row.fallback_attempts, 0),
    bright_mb_per_valid_web: brightMbPerValidWeb,
    actual_cash_cost_micro_usd: billedCost,
    steady_state_cogs_micro_usd_per_4000_credits: steadyStateCogs,
    billing_reconciliation: billingReconciliation || null,
    cash_hard_limit_micro_usd: PHASE7_CASH_HARD_LIMIT_MICRO_USD,
    cogs_soft_warning_micro_usd: PHASE7_COGS_SOFT_WARNING_MICRO_USD,
    cogs_hard_limit_micro_usd: PHASE7_COGS_HARD_LIMIT_MICRO_USD,
    surface_reports: Object.freeze(surfaceReports),
    decision,
    authoritative_poc_result: authoritative,
    phase8_unlock_eligible: authoritative && decision === 'GO',
    phase8_unlock_allowed: false,
    no_go_reasons: Object.freeze([...new Set(noGoReasons)].sort()),
    optimize_reasons: Object.freeze([...new Set(optimizeReasons)].sort()),
    commercial_blockers: Object.freeze([...new Set(commercialReasons)].sort())
  });
}

export function buildPhase7ToPhase8Gate({
  evaluation,
  phase7CompletionAuthorityRef = '',
  phase8AuthorizationRef = ''
} = {}) {
  const blockers = [];
  if (evaluation?.decision !== 'GO') blockers.push('phase7_gate_not_go');
  if (evaluation?.authoritative_poc_result !== true) {
    blockers.push('phase7_authoritative_live_poc_missing');
  }
  if (evaluation?.phase8_unlock_eligible !== true) {
    blockers.push('phase7_evaluation_not_phase8_eligible');
  }
  if (!String(phase7CompletionAuthorityRef || '').trim()) {
    blockers.push('phase7_completion_authority_missing');
  }
  if (!String(phase8AuthorizationRef || '').trim()) {
    blockers.push('phase8_authorization_missing');
  }
  return Object.freeze({
    schema_version: 'phase7-to-phase8-gate-v1',
    phase7_status: blockers.length ? 'PHASE7_LIVE_NOT_COMPLETE' : 'PHASE7_COMPLETE',
    phase8_status: blockers.length ? 'PHASE8_FROZEN' : 'PHASE8_AUTHORIZED',
    phase8_unlock_allowed: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}
