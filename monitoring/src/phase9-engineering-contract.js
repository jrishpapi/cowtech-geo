const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

export function buildPhase9EngineeringReadiness({ decision, safety }) {
  const blockers = [];
  if (decision?.schema_version !== 'phase9-engineering-only-decision-v1') {
    blockers.push('phase9_decision_schema_invalid');
  }
  if (!nonEmpty(decision?.authority_ref)) blockers.push('phase9_engineering_authority_missing');
  if (decision?.phase8?.engineering_status !== 'PHASE8_ENGINEERING_COMPLETE_LIVE_FROZEN') {
    blockers.push('phase8_engineering_not_complete');
  }
  if (decision?.phase9?.engineering_status !== 'PHASE9_ENGINEERING_ONLY_AUTHORIZED') {
    blockers.push('phase9_engineering_not_authorized');
  }
  if (decision?.phase9?.live_soak_status !== 'PHASE9_LIVE_SOAK_FROZEN') {
    blockers.push('phase9_live_soak_must_remain_frozen');
  }
  if (decision?.phase9?.commercial_launch_status !== 'COMMERCIAL_LAUNCH_FROZEN') {
    blockers.push('commercial_launch_must_remain_frozen');
  }
  if (safety?.live_transport_enabled) blockers.push('live_transport_must_be_disabled');
  if (safety?.paid_transport_enabled) blockers.push('paid_transport_must_be_disabled');
  if (safety?.external_spend_enabled) blockers.push('external_spend_must_be_disabled');
  if (safety?.production_write_enabled) blockers.push('production_write_must_be_disabled');
  if (Number(safety?.approved_budget_micro_usd || 0) !== 0) {
    blockers.push('engineering_budget_must_be_zero');
  }
  return Object.freeze({
    schema_version: 'phase9-engineering-readiness-v1',
    engineering_allowed: blockers.length === 0,
    live_soak_allowed: false,
    commercial_launch_allowed: false,
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

export function buildPhase9LiveReadiness({
  engineeringReadiness,
  phase8RolloutComplete = false,
  phase9LiveAuthorityRef = '',
  approvedBudgetMicroUsd = 0,
  productionExecutorAvailable = false
}) {
  const blockers = [];
  if (!engineeringReadiness?.engineering_allowed) blockers.push('phase9_engineering_not_ready');
  if (!phase8RolloutComplete) blockers.push('phase8_live_rollout_not_complete');
  if (!nonEmpty(phase9LiveAuthorityRef)) blockers.push('phase9_live_authority_missing');
  if (!Number.isSafeInteger(approvedBudgetMicroUsd) || approvedBudgetMicroUsd <= 0) {
    blockers.push('phase9_positive_budget_missing');
  }
  if (productionExecutorAvailable !== true) blockers.push('phase9_live_soak_executor_not_available');
  return Object.freeze({
    schema_version: 'phase9-live-readiness-v1',
    status: blockers.length ? 'PHASE9_LIVE_SOAK_FROZEN' : 'PHASE9_LIVE_SOAK_READY',
    live_soak_allowed: blockers.length === 0,
    approved_budget_micro_usd: blockers.length ? 0 : approvedBudgetMicroUsd,
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}
