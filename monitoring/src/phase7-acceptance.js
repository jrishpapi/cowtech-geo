import { Phase7BudgetHardStop } from './phase7-budget-hard-stop.js';
import {
  buildPhase7DryRunObservations,
  runPhase7FrozenDryRun
} from './phase7-dry-run.js';
import { buildPhase7PocEvaluation } from './phase7-evaluation.js';
import { buildPhase7PocPlan } from './phase7-poc-plan.js';
import {
  buildPhase7BillingReconciliation,
  buildPhase7SupplierReconciliation
} from './phase7-reconciliation.js';

const RUN_WINDOW = 'phase7-engineering-dry-run-v1';

function fixtureSupplier(supplier, unit, count) {
  return buildPhase7SupplierReconciliation({
    supplier,
    unit,
    run_window_id: RUN_WINDOW,
    local_billable_units: count,
    supplier_billable_units: count,
    no_dedup_baseline_units: count,
    billed_cost_micro_usd: 0,
    steady_state_allocated_cost_micro_usd: 0,
    statement_ref: `fixture:${supplier}:non-authoritative`,
    captured_at: '2026-07-30T06:00:00.000Z',
    pricing_state: 'fixture'
  });
}

export function buildPhase7EngineeringAcceptance() {
  const plan = buildPhase7PocPlan({
    engineeringAuthorityRef: 'telegram:dev:13532',
    phase6FreezeDecisionRef: 'docs/decisions/phase6-phase7-freeze-2026-07-30.json'
  });
  const dryRun = runPhase7FrozenDryRun({ plan });
  const observations = buildPhase7DryRunObservations({ plan });
  const billing = buildPhase7BillingReconciliation({
    runWindowId: RUN_WINDOW,
    records: [
      fixtureSupplier('bright_data', 'bytes', 800_100_000),
      fixtureSupplier('serpapi', 'searches', 1333),
      fixtureSupplier('sonar', 'tokens', 0)
    ]
  });
  const budget = new Phase7BudgetHardStop();
  const evaluation = buildPhase7PocEvaluation({
    plan,
    observations,
    billingReconciliation: billing,
    budgetSnapshot: budget.snapshot(),
    liveEvidence: false,
    runWindowId: RUN_WINDOW
  });
  const engineeringBlockers = [];
  if (dryRun.status !== 'PHASE7_DRY_RUN_PASSED') {
    engineeringBlockers.push(...dryRun.blockers);
  }
  if (evaluation.no_go_reasons.length) {
    engineeringBlockers.push(...evaluation.no_go_reasons);
  }
  if (evaluation.decision !== 'COMMERCIAL-BLOCKED') {
    engineeringBlockers.push('fixture_evaluation_must_remain_commercial_blocked');
  }
  if (evaluation.phase8_unlock_allowed !== false) {
    engineeringBlockers.push('phase8_must_remain_frozen');
  }
  return Object.freeze({
    schema_version: 'phase7-engineering-acceptance-v1',
    engineering_status: engineeringBlockers.length
      ? 'PHASE7_ENGINEERING_BLOCKED'
      : 'PHASE7_ENGINEERING_COMPLETE_LIVE_POC_DEFERRED_TO_PRELAUNCH',
    live_status: 'PHASE7_LIVE_FROZEN',
    phase8_status: 'PHASE8_FROZEN',
    engineering_complete: engineeringBlockers.length === 0,
    live_poc_complete: false,
    phase8_unlock_allowed: false,
    network_calls_performed: 0,
    provider_calls_performed: 0,
    external_spend_micro_usd: 0,
    plan: Object.freeze({
      cohort_id: plan.cohort_id,
      dataset_sha256: plan.dataset_sha256,
      plan_sha256: plan.plan_sha256,
      planned_demands: plan.planned_demands,
      planned_batches: plan.planned_batches
    }),
    dry_run: dryRun,
    fixture_gate: evaluation,
    deferred_live_blockers: Object.freeze([
      'phase6_exit_not_passed',
      'phase7_live_authority_missing',
      'phase7_positive_budget_missing',
      'phase7_supplier_scope_not_ready',
      'phase7_live_4000_demand_poc_not_run',
      'phase7_authoritative_go_missing'
    ]),
    engineering_blockers: Object.freeze([...new Set(engineeringBlockers)].sort())
  });
}
