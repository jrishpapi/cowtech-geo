import { buildPhase7PocPlan } from './phase7-poc-plan.js';
import { buildPhase7SessionBinding, classifyPhase7Failure } from './phase7-live-runner.js';
import { runPhase7RecoveryDrill } from './phase7-recovery.js';
import { assertPhase8ProductionGate } from './phase8-production-executor.js';
import { buildPhase9LiveReadiness } from './phase9-engineering-contract.js';
import {
  assertPhase9CommercialLaunchControlGate,
  assertPhase9ProductionGate
} from './phase9-production-executor.js';
import { buildPhase9LaunchGate } from './phase9-launch-gate.js';

function blocks(fn, expectedCode) {
  try {
    fn();
    return false;
  } catch (error) {
    return error?.code === expectedCode;
  }
}

export function buildPhase7Phase9ProductionAcceptance() {
  const blockers = [];
  const plan = buildPhase7PocPlan({
    engineeringAuthorityRef: 'telegram:dev:13671',
    phase6FreezeDecisionRef: 'telegram:dev:13638'
  });
  const web = plan.items.filter((item) => item.acquisition_mode === 'web_ui');
  const environments = new Set(web.map((item) => buildPhase7SessionBinding({
    runId: 'offline-production-acceptance', item
  }).environment));
  if (web.length !== 2667) blockers.push('phase7_web_demand_count_changed');
  if (environments.size !== 28) blockers.push('phase7_session_cycle_count_changed');
  const recovery = runPhase7RecoveryDrill();
  if (recovery.status !== 'passed') blockers.push('phase7_fault_injection_failed');
  for (const code of ['challenge', 'selector_drift', 'surface_login_wall', 'geo_mismatch']) {
    if (classifyPhase7Failure(code).retryable) blockers.push(`${code}_must_not_retry`);
  }
  for (const code of ['http_429', 'http_5xx', 'answer_timeout', 'supplier_disconnect']) {
    if (!classifyPhase7Failure(code).retryable) blockers.push(`${code}_must_be_bounded_retry`);
  }

  const phase8Blocked = blocks(() => assertPhase8ProductionGate({
    liveReadiness: {
      schema_version: 'phase8-live-readiness-v1', live_allowed: true,
      production_migration_allowed: true, approved_budget_micro_usd: 1
    },
    controls: {
      engineering_contract_enabled: true, production_executor_enabled: true,
      live_execution_enabled: true, paid_transport_enabled: true,
      external_spend_enabled: false, production_migration_enabled: true,
      phase7_authoritative_go: true, live_authority_ref: 'offline',
      phase7_completion_authority_ref: 'offline', approved_budget_micro_usd: 1
    }
  }), 'phase8_production_gate_blocked');
  if (!phase8Blocked) blockers.push('phase8_partial_gate_did_not_fail_closed');

  const phase9Readiness = buildPhase9LiveReadiness({
    engineeringReadiness: { engineering_allowed: true },
    phase8RolloutComplete: true,
    phase9LiveAuthorityRef: 'offline:future-authority',
    approvedBudgetMicroUsd: 1,
    productionExecutorAvailable: true
  });
  if (!phase9Readiness.live_soak_allowed) blockers.push('phase9_executor_readiness_missing');
  const phase9Blocked = blocks(() => assertPhase9ProductionGate({
    liveReadiness: phase9Readiness,
    controls: {
      engineering_contract_enabled: true, production_executor_enabled: true,
      live_soak_enabled: true, live_transport_enabled: true,
      paid_transport_enabled: true, external_spend_enabled: false,
      production_write_enabled: true, phase8_rollout_complete: true,
      live_authority_ref: 'offline', phase8_completion_authority_ref: 'offline',
      approved_budget_micro_usd: 1
    }
  }), 'phase9_production_gate_blocked');
  if (!phase9Blocked) blockers.push('phase9_partial_gate_did_not_fail_closed');

  const ownerWaiver = Object.freeze({
    schema_version: 'phase9-soak-waiver-decision-v1',
    decision: 'SOAK_WAIVED_BY_OWNER',
    decision_owner: 'offline-contract-owner',
    authority_ref: 'offline:owner-soak-waiver',
    evidence_ref: 'offline:evidence:owner-soak-waiver',
    decided_at: '2026-08-03T00:00:00Z',
    waived_requirement: 'phase9_authoritative_7_to_14_day_live_soak',
    acceptance_effect: 'FULL_ACCEPTANCE_WITH_SOAK_WAIVED',
    risk_acknowledged: true,
    claims_authoritative_soak_completed: false
  });
  const waiverLaunchGate = buildPhase9LaunchGate({
    soakWaiver: ownerWaiver,
    phase8RolloutComplete: true,
    supportRunbookApproved: true,
    statusPageApproved: true,
    rollbackChecklistApproved: true,
    commercialLaunchAuthorityRef: 'offline:commercial-launch'
  });
  if (!waiverLaunchGate.launch_eligible || waiverLaunchGate.acceptance_basis !== 'OWNER_SOAK_WAIVER') {
    blockers.push('phase9_owner_soak_waiver_contract_missing');
  }
  const waiverMismatchBlocked = blocks(() => assertPhase9CommercialLaunchControlGate({
    controls: {
      engineering_contract_enabled: true, production_executor_enabled: true,
      production_write_enabled: true, phase8_rollout_complete: true,
      commercial_launch_enabled: true,
      phase8_completion_authority_ref: 'offline:phase8-complete',
      commercial_launch_authority_ref: 'offline:commercial-launch',
      phase9_soak_go_review: false, phase9_soak_waived: true,
      phase9_soak_waiver_authority_ref: ownerWaiver.authority_ref,
      phase9_soak_waiver_evidence_ref: 'offline:mismatched-evidence'
    },
    launchGate: waiverLaunchGate,
    soakWaiver: ownerWaiver,
    commercialLaunchAuthorityRef: 'offline:commercial-launch'
  }), 'phase9_commercial_launch_control_gate_blocked');
  if (!waiverMismatchBlocked) blockers.push('phase9_waiver_evidence_mismatch_did_not_fail_closed');

  return Object.freeze({
    schema_version: 'phase7-phase9-productionization-acceptance-v1',
    status: blockers.length
      ? 'PHASE7_9_PRODUCTIONIZATION_BLOCKED'
      : 'PHASE7_9_PRODUCTIONIZATION_COMPLETE_LIVE_FROZEN',
    productionization_complete: blockers.length === 0,
    live_validation_complete: false,
    phase7_live_poc_complete: false,
    phase8_live_rollout_complete: false,
    phase9_live_soak_complete: false,
    commercial_launch_complete: false,
    provider_calls_performed: 0,
    network_calls_performed: 0,
    external_spend_micro_usd: 0,
    production_writes_performed: 0,
    phase7: Object.freeze({
      planned_demands: plan.planned_demands,
      web_demands: web.length,
      session_cycles: environments.size,
      recovery_status: recovery.status,
      structural_hold_matrix_passed: recovery.structural_hold_matrix_passed
    }),
    phase8: Object.freeze({
      production_executor_available: true,
      partial_gate_fail_closed: phase8Blocked,
      rollout_order: Object.freeze([5, 25, 100])
    }),
    phase9: Object.freeze({
      production_executor_available: true,
      partial_gate_fail_closed: phase9Blocked,
      live_readiness_contract_can_be_satisfied: phase9Readiness.live_soak_allowed,
      acceptance_policy: 'AUTHORITATIVE_SOAK_GO_OR_OWNER_SOAK_WAIVER',
      owner_soak_waiver_contract_valid: waiverLaunchGate.launch_eligible,
      owner_soak_waiver_claims_soak_complete: waiverLaunchGate.authoritative_soak_complete,
      waiver_evidence_mismatch_fail_closed: waiverMismatchBlocked
    }),
    blockers: Object.freeze(blockers.sort())
  });
}
