export const PHASE8_CANARY_STAGES = Object.freeze([5, 25, 100]);

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

export function buildPhase8CanaryPlan({
  cohortId,
  eligibleCustomerIds = [],
  engineeringAuthorityRef
} = {}) {
  required(cohortId, 'cohortId');
  required(engineeringAuthorityRef, 'engineeringAuthorityRef');
  const customers = [...new Set(eligibleCustomerIds.map((id) => required(id, 'customer_id')))].sort();
  if (!customers.length) throw new TypeError('eligibleCustomerIds must not be empty');
  const stages = PHASE8_CANARY_STAGES.map((percent) => {
    const count = percent === 100
      ? customers.length
      : Math.max(1, Math.ceil(customers.length * percent / 100));
    return Object.freeze({
      percent,
      customer_count: count,
      customer_ids: Object.freeze(customers.slice(0, count)),
      status: 'live_frozen',
      entry_gate: percent === 5 ? 'phase8_live_readiness' : `stage_${percent === 25 ? 5 : 25}_accepted`,
      rollback_required_on_gate_failure: true
    });
  });
  return Object.freeze({
    schema_version: 'phase8-canary-plan-v1',
    cohort_id: cohortId,
    engineering_authority_ref: engineeringAuthorityRef.trim(),
    status: 'PHASE8_CANARY_PLANNED_LIVE_FROZEN',
    rollout_order: PHASE8_CANARY_STAGES,
    stages: Object.freeze(stages),
    live_start_allowed: false,
    network_calls_performed: 0
  });
}

export function evaluatePhase8CanaryStage({
  plan,
  percent,
  metrics = {},
  liveEvidence = false,
  evidenceRef = ''
} = {}) {
  if (plan?.schema_version !== 'phase8-canary-plan-v1') {
    throw new TypeError('valid Phase 8 canary plan is required');
  }
  const stage = plan.stages.find((row) => row.percent === percent);
  if (!stage) throw new RangeError(`unsupported canary stage: ${percent}`);
  const blockers = [];
  if (liveEvidence !== true) blockers.push('live_evidence_missing');
  if (liveEvidence === true && !String(evidenceRef || '').trim()) {
    blockers.push('evidence_ref_missing');
  }
  if (typeof metrics.success_rate !== 'number' || metrics.success_rate < 0.97) {
    blockers.push('success_rate_missing_or_below_0.97');
  }
  if (typeof metrics.parser_accuracy !== 'number' || metrics.parser_accuracy < 0.99) {
    blockers.push('parser_accuracy_missing_or_below_0.99');
  }
  if (typeof metrics.evidence_coverage !== 'number' || metrics.evidence_coverage < 0.995) {
    blockers.push('evidence_coverage_missing_or_below_0.995');
  }
  if (metrics.queue_sla_passed !== true) blockers.push('queue_sla_failed');
  if (metrics.cost_gate_passed !== true) blockers.push('cost_gate_failed');
  if (metrics.account_health_passed !== true) blockers.push('account_health_failed');
  return Object.freeze({
    schema_version: 'phase8-canary-stage-evaluation-v1',
    percent,
    status: blockers.length ? 'HOLD_OR_ROLLBACK' : 'ACCEPTED',
    advance_eligible: blockers.length === 0,
    authoritative: liveEvidence === true && String(evidenceRef || '').trim().length > 0,
    apply_allowed: false,
    blockers: Object.freeze(blockers)
  });
}

export function buildPhase8OpsSnapshot({
  accountPool,
  schedule,
  scalePlan,
  costReconciliation,
  canaryPlan
} = {}) {
  return Object.freeze({
    schema_version: 'phase8-ops-snapshot-v1',
    phase8_status: 'PHASE8_ENGINEERING_READY_LIVE_FROZEN',
    account_slots: accountPool?.slots?.length ?? 0,
    account_pool_status: accountPool?.status ?? 'missing',
    planned_tasks: schedule?.planned_tasks ?? 0,
    proposed_workers: scalePlan?.proposed_workers ?? 0,
    cost_alert_state: costReconciliation?.alert_state ?? 'UNKNOWN',
    canary_status: canaryPlan?.status ?? 'missing',
    live_controls: Object.freeze({
      dispatch_allowed: false,
      scale_apply_allowed: false,
      account_binding_allowed: false,
      canary_start_allowed: false
    }),
    network_calls_performed: 0
  });
}
