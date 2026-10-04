import { buildStarterPocManifest } from './poc/starter-poc-workload.js';

export const PHASE6_DEFERRED_STATUS =
  'PHASE6_ENGINEERING_COMPLETE_LIVE_VALIDATION_DEFERRED_TO_PRELAUNCH';
export const PHASE7_ENGINEERING_STATUS = 'PHASE7_ENGINEERING_READY_LIVE_FROZEN';

const EXPECTED_SURFACE_COUNTS = Object.freeze({
  chatgpt_ui: 1334,
  perplexity_ui: 1333,
  google_aio: 1333
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function buildPhase7EngineeringReadiness({
  decision = {},
  manifest = buildStarterPocManifest(),
  safety = {}
} = {}) {
  const blockers = [];
  if (decision?.schema_version !== 'phase6-phase7-freeze-decision-v1') {
    blockers.push('freeze_decision_schema_invalid');
  }
  if (!nonEmpty(decision?.authority_ref)) blockers.push('engineering_authority_missing');
  if (decision?.phase6?.status !== PHASE6_DEFERRED_STATUS) {
    blockers.push('phase6_deferred_status_missing');
  }
  if (decision?.phase6?.exit_gate_passed !== false) {
    blockers.push('phase6_exit_must_remain_unpassed');
  }
  if (decision?.phase7?.engineering_status !== 'PHASE7_ENGINEERING_ONLY_AUTHORIZED') {
    blockers.push('phase7_engineering_not_authorized');
  }
  if (manifest?.valid !== true) blockers.push('starter_manifest_invalid');
  if (manifest?.cohort_id !== 'starter-4000-v1') blockers.push('starter_cohort_changed');
  if (manifest?.counts?.total !== 4000) blockers.push('starter_total_must_equal_4000');
  for (const [surface, expected] of Object.entries(EXPECTED_SURFACE_COUNTS)) {
    if (manifest?.counts?.by_surface?.[surface] !== expected) {
      blockers.push(`${surface}_allocation_changed`);
    }
  }
  if (manifest?.flex_cohort?.allocation_is_fixed_before_run !== true) {
    blockers.push('flex_allocation_not_frozen');
  }
  if (safety.external_spend_mode !== 'deny') blockers.push('external_spend_must_be_denied');
  if (safety.live_transport_enabled !== false) blockers.push('live_transport_must_be_disabled');
  if (safety.paid_transport_enabled !== false) blockers.push('paid_transport_must_be_disabled');
  if (safety.approved_budget_micro_usd !== 0) blockers.push('engineering_budget_must_be_zero');

  return Object.freeze({
    schema_version: 'phase7-engineering-readiness-v1',
    status: blockers.length ? 'PHASE7_ENGINEERING_BLOCKED' : PHASE7_ENGINEERING_STATUS,
    engineering_allowed: blockers.length === 0,
    live_allowed: false,
    cohort_id: manifest?.cohort_id || null,
    dataset_sha256: manifest?.dataset_sha256 || null,
    planned_demands: manifest?.counts?.total ?? null,
    blockers: Object.freeze(blockers),
    network_calls_performed: 0
  });
}

export function buildPhase7LiveReadiness({
  engineeringReadiness,
  phase6ExitPassed = false,
  phase6CompletionAuthorityRef = '',
  phase7LiveAuthorityRef = '',
  approvedBudgetMicroUsd = 0,
  supplierScopeReady = false
} = {}) {
  const blockers = [];
  if (engineeringReadiness?.engineering_allowed !== true) blockers.push('phase7_engineering_not_ready');
  if (phase6ExitPassed !== true) blockers.push('phase6_exit_not_passed');
  if (!nonEmpty(phase6CompletionAuthorityRef)) blockers.push('phase6_completion_authority_missing');
  if (!nonEmpty(phase7LiveAuthorityRef)) blockers.push('phase7_live_authority_missing');
  if (!positiveInteger(approvedBudgetMicroUsd)) blockers.push('phase7_positive_budget_missing');
  if (supplierScopeReady !== true) blockers.push('phase7_supplier_scope_not_ready');
  return Object.freeze({
    schema_version: 'phase7-live-readiness-v1',
    status: blockers.length ? 'PHASE7_LIVE_FROZEN' : 'PHASE7_LIVE_READY',
    live_allowed: blockers.length === 0,
    approved_budget_micro_usd: positiveInteger(approvedBudgetMicroUsd)
      ? approvedBudgetMicroUsd
      : 0,
    blockers: Object.freeze(blockers)
  });
}
