import { runPhase7RecoveryDrill } from './phase7-recovery.js';

function validatePlan(plan) {
  if (plan?.schema_version !== 'phase7-poc-engineering-plan-v1') {
    throw new TypeError('invalid Phase 7 engineering plan');
  }
  if (
    plan.live_execution_allowed !== false ||
    plan.approved_budget_micro_usd !== 0 ||
    plan.planned_demands !== 4000 ||
    plan.items?.length !== 4000
  ) {
    throw new Error('Phase 7 dry-run requires the frozen 4,000-demand budget-zero plan');
  }
}

export function runPhase7FrozenDryRun({ plan } = {}) {
  validatePlan(plan);
  const bySurface = {};
  const byStage = {};
  let sessionCheckpoints = 0;
  let aioNoCache = 0;
  for (const item of plan.items) {
    bySurface[item.surface] = (bySurface[item.surface] || 0) + 1;
    byStage[item.stage] = (byStage[item.stage] || 0) + 1;
    if (item.session_checkpoint !== null) sessionCheckpoints += 1;
    if (item.surface === 'google_aio' && item.no_cache === true) aioNoCache += 1;
  }
  const recovery = runPhase7RecoveryDrill();
  const blockers = [];
  if (bySurface.chatgpt_ui !== 1334) blockers.push('chatgpt_allocation_changed');
  if (bySurface.perplexity_ui !== 1333) blockers.push('perplexity_allocation_changed');
  if (bySurface.google_aio !== 1333) blockers.push('aio_allocation_changed');
  if (byStage.canary !== 3) blockers.push('canary_batch_changed');
  if (aioNoCache !== 1333) blockers.push('aio_no_cache_not_enforced');
  if (recovery.status !== 'passed') blockers.push('recovery_drill_failed');
  return Object.freeze({
    schema_version: 'phase7-frozen-dry-run-v1',
    status: blockers.length ? 'PHASE7_DRY_RUN_BLOCKED' : 'PHASE7_DRY_RUN_PASSED',
    authoritative_poc_result: false,
    phase8_unlock_allowed: false,
    plan_sha256: plan.plan_sha256,
    simulated_demands: plan.items.length,
    simulated_batches: plan.batches.length,
    by_surface: Object.freeze(bySurface),
    by_stage: Object.freeze(byStage),
    session_checkpoint_items: sessionCheckpoints,
    aio_no_cache_items: aioNoCache,
    budget_micro_usd: 0,
    network_calls_performed: 0,
    provider_calls_performed: 0,
    transport_authorized: false,
    recovery_drill: recovery,
    blockers: Object.freeze(blockers)
  });
}

export function buildPhase7DryRunObservations({ plan, webTrafficBytes = 300_000 } = {}) {
  validatePlan(plan);
  if (!Number.isSafeInteger(webTrafficBytes) || webTrafficBytes < 0) {
    throw new TypeError('webTrafficBytes must be a non-negative safe integer');
  }
  return Object.freeze(plan.items.map((item, index) => Object.freeze({
    item_key: item.item_key,
    surface: item.surface,
    valid: true,
    native_success: true,
    attempts: 1,
    fallback_attempts: 0,
    latency_ms: 500 + (index % 100),
    parser_correct: true,
    evidence_present: true,
    structured_valid: true,
    traffic_bytes: item.surface === 'google_aio' ? 0 : webTrafficBytes,
    aio_triggered: item.surface === 'google_aio',
    aio_followup: item.surface === 'google_aio' && index % 10 === 0,
    evidence_mode: 'deterministic_fixture',
    authoritative_live_evidence: false
  })));
}
