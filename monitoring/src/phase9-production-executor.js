import { buildPhase9LaunchGate } from './phase9-launch-gate.js';
import { evaluatePhase9Soak } from './phase9-slo.js';
import { aggregatePhase9Day, buildPhase9Checkpoint } from './phase9-soak.js';

const SURFACES = Object.freeze([
  'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui',
  'grok_ui', 'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui'
]);

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function verified(receipt, name) {
  if (receipt?.verified !== true) throw new Error(`${name} is not verified`);
  required(receipt.evidence_ref, `${name}.evidence_ref`);
  return receipt;
}

export function assertPhase9ProductionGate({ liveReadiness, controls } = {}) {
  const blockers = [];
  if (liveReadiness?.schema_version !== 'phase9-live-readiness-v1') {
    blockers.push('phase9_live_readiness_invalid');
  }
  if (liveReadiness?.live_soak_allowed !== true) blockers.push('phase9_live_soak_not_allowed');
  const approvedBudget = Number(liveReadiness?.approved_budget_micro_usd || 0);
  if (!Number.isSafeInteger(approvedBudget) || approvedBudget <= 0) {
    blockers.push('phase9_positive_budget_missing');
  }
  for (const flag of [
    'engineering_contract_enabled', 'production_executor_enabled',
    'live_soak_enabled', 'live_transport_enabled', 'paid_transport_enabled',
    'external_spend_enabled', 'production_write_enabled', 'phase8_rollout_complete'
  ]) {
    if (controls?.[flag] !== true) blockers.push(`${flag}_missing`);
  }
  if (!String(controls?.live_authority_ref || '').trim()) blockers.push('phase9_live_authority_missing');
  if (!String(controls?.phase8_completion_authority_ref || '').trim()) {
    blockers.push('phase8_completion_authority_missing');
  }
  if (controls?.approved_budget_micro_usd !== approvedBudget) {
    blockers.push('phase9_budget_authority_mismatch');
  }
  if (blockers.length) {
    const error = new Error(`Phase 9 production gate blocked: ${blockers.join(',')}`);
    error.code = 'phase9_production_gate_blocked';
    error.blockers = Object.freeze(blockers);
    throw error;
  }
  return Object.freeze({
    allowed: true,
    authority_ref: controls.live_authority_ref,
    approved_budget_micro_usd: approvedBudget
  });
}

export function assertPhase9CommercialLaunchControlGate({
  controls, launchGate, soakWaiver, commercialLaunchAuthorityRef
} = {}) {
  const blockers = [];
  for (const flag of [
    'engineering_contract_enabled', 'production_executor_enabled',
    'production_write_enabled', 'phase8_rollout_complete', 'commercial_launch_enabled'
  ]) {
    if (controls?.[flag] !== true) blockers.push(`${flag}_missing`);
  }
  const launchAuthority = String(commercialLaunchAuthorityRef || '').trim();
  if (!launchAuthority) blockers.push('commercial_launch_authority_missing');
  if (String(controls?.commercial_launch_authority_ref || '').trim() !== launchAuthority) {
    blockers.push('commercial_launch_authority_mismatch');
  }
  if (!String(controls?.phase8_completion_authority_ref || '').trim()) {
    blockers.push('phase8_completion_authority_missing');
  }
  if (launchGate?.launch_eligible !== true) blockers.push('commercial_launch_evidence_not_eligible');
  if (launchGate?.acceptance_basis === 'AUTHORITATIVE_SOAK_GO') {
    if (controls?.phase9_soak_go_review !== true) blockers.push('phase9_soak_go_control_missing');
  } else if (launchGate?.acceptance_basis === 'OWNER_SOAK_WAIVER') {
    if (controls?.phase9_soak_waived !== true) blockers.push('phase9_soak_waiver_control_missing');
    if (String(controls?.phase9_soak_waiver_authority_ref || '').trim() !==
      String(soakWaiver?.authority_ref || '').trim()) {
      blockers.push('phase9_soak_waiver_authority_mismatch');
    }
    if (String(controls?.phase9_soak_waiver_evidence_ref || '').trim() !==
      String(soakWaiver?.evidence_ref || '').trim()) {
      blockers.push('phase9_soak_waiver_evidence_mismatch');
    }
  } else {
    blockers.push('phase9_acceptance_basis_missing');
  }
  if (blockers.length) {
    const error = new Error(`Phase 9 commercial launch control gate blocked: ${blockers.join(',')}`);
    error.code = 'phase9_commercial_launch_control_gate_blocked';
    error.blockers = Object.freeze([...new Set(blockers)].sort());
    throw error;
  }
  return Object.freeze({
    allowed: true,
    authority_ref: launchAuthority,
    rollback_authority_ref: controls.phase8_completion_authority_ref,
    acceptance_basis: launchGate.acceptance_basis
  });
}

function validateDailyPayload(payload) {
  if (!Array.isArray(payload?.surfaceMetrics) || payload.surfaceMetrics.length !== SURFACES.length) {
    throw new Error('Phase 9 live day must contain all eight Surface metrics');
  }
  const actual = [...payload.surfaceMetrics.map((item) => item.surface)].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...SURFACES].sort())) {
    throw new Error('Phase 9 live day Surface set mismatch');
  }
  for (const metric of payload.surfaceMetrics) {
    if (metric.fixture === true || metric.authoritative !== true) {
      throw new Error(`${metric.surface} metric is not authoritative`);
    }
    required(metric.evidence_ref, `${metric.surface}.evidence_ref`);
  }
  if (payload.costs?.reconciled !== true || payload.costs?.fixture === true) {
    throw new Error('Phase 9 daily supplier cost is not authoritatively reconciled');
  }
}

export class Phase9ProductionExecutor {
  constructor({ repository, trafficRunner, deploymentAdapter } = {}) {
    for (const [name, value, method] of [
      ['repository', repository, 'recordEvent'],
      ['trafficRunner', trafficRunner, 'runDay'],
      ['deploymentAdapter', deploymentAdapter, 'launch']
    ]) {
      if (!value || typeof value[method] !== 'function') {
        throw new TypeError(`${name}.${method} is required`);
      }
    }
    if (typeof trafficRunner.rollback !== 'function') {
      throw new TypeError('trafficRunner.rollback is required');
    }
    if (typeof deploymentAdapter.rollback !== 'function') {
      throw new TypeError('deploymentAdapter.rollback is required');
    }
    this.repository = repository;
    this.trafficRunner = trafficRunner;
    this.deploymentAdapter = deploymentAdapter;
  }

  gate(input) {
    return assertPhase9ProductionGate(input);
  }

  async start({ liveReadiness, controls, plan } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    if (plan?.schema_version !== 'phase9-soak-plan-v1' || plan.timeline?.length < 7) {
      throw new TypeError('valid Phase 9 soak plan is required');
    }
    await this.repository.recordEvent({
      phase: 9,
      eventType: 'soak_started',
      authorityRef: gate.authority_ref,
      idempotencyKey: `phase9-soak:${plan.soak_id}:start`,
      payload: {
        soak_id: plan.soak_id,
        plan_sha256: plan.plan_sha256,
        target_days: plan.target_days,
        maximum_days: plan.maximum_days
      }
    });
    return Object.freeze({ status: 'PHASE9_SOAK_RUNNING', soak_id: plan.soak_id });
  }

  async runDay({
    liveReadiness, controls, plan, day, priorDailyAggregates = []
  } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    if (!Number.isSafeInteger(day) || day !== priorDailyAggregates.length + 1) {
      throw new Error('Phase 9 day must be contiguous');
    }
    if (day > plan.maximum_days) throw new Error('Phase 9 day exceeds maximum soak length');
    const payload = await this.trafficRunner.runDay({
      plan,
      day,
      authorityRef: gate.authority_ref,
      approvedBudgetMicroUsd: gate.approved_budget_micro_usd
    });
    validateDailyPayload(payload);
    const aggregate = aggregatePhase9Day({
      day,
      surfaceMetrics: payload.surfaceMetrics,
      accountHealth: payload.accountHealth,
      queue: payload.queue,
      costs: payload.costs,
      authoritative: true
    });
    const daily = Object.freeze([...priorDailyAggregates, aggregate]);
    const checkpoint = buildPhase9Checkpoint({ plan, dailyAggregates: daily });
    const evaluation = evaluatePhase9Soak({ plan, dailyAggregates: daily });
    await this.repository.recordEvent({
      phase: 9,
      eventType: 'soak_day_recorded',
      authorityRef: gate.authority_ref,
      idempotencyKey: `phase9-soak:${plan.soak_id}:day:${day}`,
      payload: {
        soak_id: plan.soak_id,
        aggregate,
        checkpoint,
        decision: evaluation.decision
      }
    });
    if (evaluation.decision === 'ROLLBACK') {
      const rollback = verified(await this.trafficRunner.rollback({
        plan,
        day,
        authorityRef: gate.authority_ref,
        blockers: evaluation.evaluations.at(-1)?.blockers || []
      }), 'phase9_traffic_rollback');
      await this.repository.recordEvent({
        phase: 9,
        eventType: 'soak_rolled_back',
        authorityRef: gate.authority_ref,
        idempotencyKey: `phase9-soak:${plan.soak_id}:rollback:${day}`,
        payload: { soak_id: plan.soak_id, day, evidence_ref: rollback.evidence_ref }
      });
      return Object.freeze({ status: 'ROLLED_BACK', aggregate, checkpoint, evaluation, rollback });
    }
    const status = evaluation.decision === 'GO_REVIEW'
      ? 'PHASE9_SOAK_COMPLETE_GO_REVIEW'
      : evaluation.decision === 'NO_GO'
        ? 'NO_GO'
        : evaluation.decision === 'PAUSE'
          ? 'PAUSED'
          : evaluation.decision === 'EXTEND_SOAK'
            ? 'EXTENDED'
            : 'CONTINUE';
    return Object.freeze({ status, aggregate, checkpoint, evaluation });
  }

  async resume({ liveReadiness, controls, plan, checkpoint, resumeAuthorityRef } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    const resumeAuthority = required(resumeAuthorityRef, 'resumeAuthorityRef');
    if (checkpoint?.schema_version !== 'phase9-soak-checkpoint-v1') {
      throw new TypeError('valid Phase 9 checkpoint is required');
    }
    if (checkpoint.next_day > plan.maximum_days) throw new Error('Phase 9 soak cannot resume past maximum_days');
    await this.repository.recordEvent({
      phase: 9,
      eventType: 'soak_resumed',
      authorityRef: gate.authority_ref,
      idempotencyKey: `phase9-soak:${plan.soak_id}:resume:${checkpoint.next_day}`,
      payload: {
        soak_id: plan.soak_id,
        completed_days: checkpoint.completed_days,
        next_day: checkpoint.next_day,
        resume_authority_ref: resumeAuthority
      }
    });
    return Object.freeze({ status: 'PHASE9_SOAK_RESUMED', next_day: checkpoint.next_day });
  }

  async launch({
    controls, soakEvaluation, soakWaiver, approvals = {},
    commercialLaunchAuthorityRef
  } = {}) {
    const launchAuthority = required(commercialLaunchAuthorityRef, 'commercialLaunchAuthorityRef');
    const launchGate = buildPhase9LaunchGate({
      soakEvaluation,
      soakWaiver,
      phase8RolloutComplete: controls?.phase8_rollout_complete === true,
      supportRunbookApproved: approvals.support_runbook === true,
      statusPageApproved: approvals.status_page === true,
      rollbackChecklistApproved: approvals.rollback_checklist === true,
      commercialLaunchAuthorityRef: launchAuthority
    });
    if (!launchGate.launch_eligible) {
      const error = new Error(`commercial launch blocked: ${launchGate.blockers.join(',')}`);
      error.code = 'phase9_commercial_launch_blocked';
      throw error;
    }
    const controlGate = assertPhase9CommercialLaunchControlGate({
      controls,
      launchGate,
      soakWaiver,
      commercialLaunchAuthorityRef: launchAuthority
    });
    if (controlGate.acceptance_basis === 'OWNER_SOAK_WAIVER') {
      await this.repository.recordEvent({
        phase: 9,
        eventType: 'soak_waiver_accepted',
        authorityRef: soakWaiver.authority_ref,
        idempotencyKey: `phase9-soak-waiver:${soakWaiver.evidence_ref}`,
        payload: { ...soakWaiver, waiver_key: soakWaiver.evidence_ref }
      });
    }
    const receipt = verified(await this.deploymentAdapter.launch({
      authorityRef: launchAuthority,
      soakEvaluation,
      soakWaiver,
      acceptanceBasis: controlGate.acceptance_basis,
      rollbackAuthorityRef: controlGate.rollback_authority_ref
    }), 'commercial_launch');
    await this.repository.recordEvent({
      phase: 9,
      eventType: 'commercial_launch_applied',
      authorityRef: launchAuthority,
      idempotencyKey: `phase9-launch:${launchAuthority}`,
      payload: {
        evidence_ref: receipt.evidence_ref,
        acceptance_basis: controlGate.acceptance_basis,
        soak_waiver_evidence_ref: controlGate.acceptance_basis === 'OWNER_SOAK_WAIVER'
          ? soakWaiver.evidence_ref
          : null
      }
    });
    return Object.freeze({
      status: 'COMMERCIAL_LAUNCH_APPLIED',
      acceptance_basis: controlGate.acceptance_basis,
      receipt
    });
  }
}

export { SURFACES as PHASE9_PRODUCTION_SURFACES };
