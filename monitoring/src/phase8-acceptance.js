import { readFileSync } from 'node:fs';
import {
  buildPhase8EngineeringReadiness
} from './phase8-engineering-contract.js';
import {
  buildPhase8FairSchedule,
  buildPhase8LogicalAccountPool,
  buildPhase8ScalePlan
} from './phase8-capacity-plan.js';
import {
  buildPhase8BackupManifest,
  buildPhase8CostReconciliation,
  runPhase8FailureDrill,
  runPhase8RestoreDrill
} from './phase8-operations.js';
import {
  buildPhase8CustomerMigrationPlan,
  buildPhase8PlanV2Catalog,
  buildPhase8WeightedCostAddendum
} from './phase8-plan-migration.js';
import {
  buildPhase8CanaryPlan,
  buildPhase8OpsSnapshot,
  evaluatePhase8CanaryStage
} from './phase8-canary.js';
import {
  buildPhase8BillingEntitlementCommand,
  buildPhase8CommercializationReadiness,
  buildPhase8ServiceWiringPlan,
  evaluatePhase8RealOrderAcceptance
} from './phase8-commercialization.js';

const decision = JSON.parse(readFileSync(
  new URL('../docs/decisions/phase8-engineering-only-2026-07-30.json', import.meta.url),
  'utf8'
));

const accountSlots = [
  'chatgpt_ui',
  'perplexity_ui',
  'gemini_ui',
  'grok_ui',
  'qwen_ui',
  'deepseek_ui',
  'mistral_vibe_ui'
].map((surface) => ({
  slot_key: `${surface}:logical-slot-01`,
  surface,
  region: 'fixture',
  compliance_policy_ref: `policy:${surface}:prelaunch-v1`,
  max_concurrency: 1
}));

function fixtureStatements(runWindowId) {
  return [
    ['bright_data', 'bytes'],
    ['serpapi', 'searches'],
    ['sonar', 'tokens'],
    ['openrouter', 'tokens']
  ].map(([supplier, unit]) => ({
    supplier,
    unit,
    run_window_id: runWindowId,
    local_units: 0,
    billed_units: 0,
    billed_cost_micro_usd: 0,
    statement_ref: `fixture:${supplier}:non-authoritative`,
    fixture: true
  }));
}

export function buildPhase8EngineeringAcceptance() {
  const blockers = [];
  const readiness = buildPhase8EngineeringReadiness({
    decision,
    safety: {
      external_spend_mode: 'deny',
      live_transport_enabled: false,
      paid_transport_enabled: false,
      production_migration_enabled: false,
      approved_budget_micro_usd: 0
    }
  });
  if (!readiness.engineering_allowed) blockers.push(...readiness.blockers);

  const accountPool = buildPhase8LogicalAccountPool({
    authorityRef: decision.authority_ref,
    slots: accountSlots
  });
  const schedule = buildPhase8FairSchedule({
    tasks: [
      { task_key: 'task-1', tenant_key: 'tenant-a', surface: 'chatgpt_ui' },
      { task_key: 'task-2', tenant_key: 'tenant-b', surface: 'perplexity_ui' },
      { task_key: 'task-3', tenant_key: 'tenant-a', surface: 'google_aio' }
    ],
    workerSlots: 2
  });
  const scalePlan = buildPhase8ScalePlan({
    queueDepth: 75,
    oldestAgeSeconds: 61,
    currentWorkers: 2,
    minWorkers: 1,
    maxWorkers: 8,
    targetQueuePerWorker: 25,
    targetOldestAgeSeconds: 60
  });
  const runWindowId = 'phase8-engineering-acceptance-fixture-v1';
  const costs = buildPhase8CostReconciliation({
    runWindowId,
    statements: fixtureStatements(runWindowId)
  });
  if (costs.status !== 'COMMERCIAL_BLOCKED') {
    blockers.push('fixture_costs_must_remain_commercial_blocked');
  }
  const backupEntries = [
    { logical_name: 'phase8-config', kind: 'json', content: '{"live":false}' },
    { logical_name: 'phase8-ledger', kind: 'jsonl', content: '{"cost":0}\n' }
  ];
  const backup = buildPhase8BackupManifest({
    snapshotId: 'phase8-engineering-fixture-snapshot',
    capturedAt: '2026-07-30T06:45:00.000Z',
    entries: backupEntries
  });
  const restore = runPhase8RestoreDrill({
    manifest: backup,
    restoredEntries: backupEntries
  });
  if (restore.status !== 'RESTORE_DRILL_PASSED') blockers.push(...restore.blockers);
  const drills = [
    'worker_crash',
    'supplier_outage',
    'account_challenge',
    'backup_corruption'
  ].map((scenario) => runPhase8FailureDrill({ scenario, queueDepth: 3, inFlight: 1 }));
  if (drills.some((drill) => drill.status !== 'DRILL_PASSED')) {
    blockers.push('failure_drill_failed');
  }

  const catalog = buildPhase8PlanV2Catalog();
  const customers = catalog.plans.map((plan, index) => ({
    customer_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    plan_code: plan.plan_code,
    source_contract_version: 'legacy-v1',
    prompt_slots: 1,
    surfaces: ['chatgpt_ui'],
    total_credits: 1
  }));
  const migration = buildPhase8CustomerMigrationPlan({
    customers,
    authorityRef: decision.authority_ref
  });
  const addenda = ['pro', 'god'].map((planCode) => buildPhase8WeightedCostAddendum({
    planCode,
    surfaceCostMicroUsd: {},
    fixedAllocatedCostMicroUsd: 0
  }));
  const billingEntitlement = buildPhase8BillingEntitlementCommand({
    customerId: customers[0].customer_id,
    planCode: 'starter',
    subscriptionStatus: 'active',
    subscriptionRef: 'fixture:subscription:starter',
    billingEventRef: 'fixture:event:phase8-commercialization'
  });
  const serviceWiring = buildPhase8ServiceWiringPlan({
    customerId: customers[0].customer_id,
    brandId: '00000000-0000-4000-8000-000000000101',
    planCode: 'starter',
    intakeId: 'fixture:intake:phase8',
    approvedFactIds: ['fixture:fact:company-name']
  });
  const orderAcceptance = evaluatePhase8RealOrderAcceptance({
    orderId: 'fixture:order:phase8-commercialization'
  });
  const commercialization = buildPhase8CommercializationReadiness({
    planCatalog: catalog,
    billingCommand: billingEntitlement,
    serviceWiring,
    orderAcceptance
  });
  if (!commercialization.engineering_complete) blockers.push(...commercialization.blockers);
  const canary = buildPhase8CanaryPlan({
    cohortId: 'phase8-engineering-acceptance-fixture-v1',
    eligibleCustomerIds: customers.map((customer) => customer.customer_id),
    engineeringAuthorityRef: decision.authority_ref
  });
  const fixtureCanaryGate = evaluatePhase8CanaryStage({
    plan: canary,
    percent: 5,
    metrics: {
      success_rate: 1,
      parser_accuracy: 1,
      evidence_coverage: 1,
      queue_sla_passed: true,
      cost_gate_passed: true,
      account_health_passed: true
    }
  });
  if (fixtureCanaryGate.advance_eligible || fixtureCanaryGate.authoritative) {
    blockers.push('fixture_canary_must_remain_non_authoritative');
  }
  const ops = buildPhase8OpsSnapshot({
    accountPool,
    schedule,
    scalePlan,
    costReconciliation: costs,
    canaryPlan: canary
  });
  if (Object.values(ops.live_controls).some(Boolean)) blockers.push('live_control_armed');

  return Object.freeze({
    schema_version: 'phase8-engineering-acceptance-v1',
    engineering_status: blockers.length
      ? 'PHASE8_ENGINEERING_BLOCKED'
      : 'PHASE8_ENGINEERING_COMPLETE_COMMERCIALIZATION_INTEGRATED_LIVE_FROZEN',
    live_status: 'PHASE8_LIVE_FROZEN',
    phase9_status: 'PHASE9_LIVE_SOAK_FROZEN',
    engineering_complete: blockers.length === 0,
    live_complete: false,
    network_calls_performed: 0,
    provider_calls_performed: 0,
    external_spend_micro_usd: 0,
    readiness,
    account_pool: accountPool,
    fair_schedule: schedule,
    scale_plan: scalePlan,
    fixture_cost_reconciliation: costs,
    backup_manifest: backup,
    restore_drill: restore,
    failure_drills: Object.freeze(drills),
    plan_catalog: catalog,
    customer_migration: migration,
    weighted_cost_addenda: Object.freeze(addenda),
    phase4_commercialization: commercialization,
    billing_entitlement_command: billingEntitlement,
    phase4_service_wiring: serviceWiring,
    real_order_acceptance: orderAcceptance,
    canary_plan: canary,
    fixture_canary_gate: fixtureCanaryGate,
    ops_snapshot: ops,
    deferred_live_blockers: Object.freeze([
      'phase6_live_exit_gate_not_passed',
      'phase7_live_4000_demand_poc_not_run',
      'phase7_authoritative_go_missing',
      'phase8_real_account_validation_missing',
      'phase8_real_billing_entitlement_apply_missing',
      'phase8_real_site_crawl_and_intake_projection_missing',
      'phase8_geoflow_execution_and_real_publish_missing',
      'phase8_real_order_acceptance_missing',
      'phase8_production_migration_not_approved',
      'phase8_live_5_25_100_rollout_not_run',
      'phase9_owner_soak_waiver_not_recorded'
    ]),
    engineering_blockers: Object.freeze([...new Set(blockers)].sort())
  });
}
