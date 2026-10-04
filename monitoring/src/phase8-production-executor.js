import { evaluatePhase8CanaryStage, PHASE8_CANARY_STAGES } from './phase8-canary.js';

const ORDER_STAGES = Object.freeze([
  'payment',
  'entitlement',
  'site_crawl',
  'intake_projection',
  'human_review',
  'geoflow_execution',
  'controlled_publish',
  'aivgl_retest',
  'customer_report',
  'rollback_verification'
]);

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

export function assertPhase8ProductionGate({ liveReadiness, controls } = {}) {
  const blockers = [];
  if (liveReadiness?.schema_version !== 'phase8-live-readiness-v1') {
    blockers.push('phase8_live_readiness_invalid');
  }
  if (liveReadiness?.live_allowed !== true || liveReadiness?.production_migration_allowed !== true) {
    blockers.push('phase8_live_not_allowed');
  }
  const approvedBudget = Number(liveReadiness?.approved_budget_micro_usd || 0);
  if (!Number.isSafeInteger(approvedBudget) || approvedBudget <= 0) {
    blockers.push('phase8_positive_budget_missing');
  }
  for (const flag of [
    'engineering_contract_enabled', 'production_executor_enabled',
    'live_execution_enabled', 'paid_transport_enabled',
    'external_spend_enabled', 'production_migration_enabled',
    'phase7_authoritative_go'
  ]) {
    if (controls?.[flag] !== true) blockers.push(`${flag}_missing`);
  }
  if (!String(controls?.live_authority_ref || '').trim()) blockers.push('phase8_live_authority_missing');
  if (!String(controls?.phase7_completion_authority_ref || '').trim()) {
    blockers.push('phase7_completion_authority_missing');
  }
  if (controls?.approved_budget_micro_usd !== approvedBudget) {
    blockers.push('phase8_budget_authority_mismatch');
  }
  if (blockers.length) {
    const error = new Error(`Phase 8 production gate blocked: ${blockers.join(',')}`);
    error.code = 'phase8_production_gate_blocked';
    error.blockers = Object.freeze(blockers);
    throw error;
  }
  return Object.freeze({
    allowed: true,
    authority_ref: controls.live_authority_ref,
    approved_budget_micro_usd: approvedBudget
  });
}

function assertVerifiedReceipt(receipt, stage) {
  if (receipt?.verified !== true) throw new Error(`${stage} did not return verified evidence`);
  required(receipt.evidence_ref, `${stage}.evidence_ref`);
  return receipt;
}

export class Phase8ProductionExecutor {
  constructor({
    repository,
    accountValidator,
    migrationAdapter,
    serviceStages = {},
    rolloutDispatcher
  } = {}) {
    for (const [name, value, method] of [
      ['repository', repository, 'recordEvent'],
      ['accountValidator', accountValidator, 'validate'],
      ['migrationAdapter', migrationAdapter, 'apply'],
      ['rolloutDispatcher', rolloutDispatcher, 'dispatch']
    ]) {
      if (!value || typeof value[method] !== 'function') {
        throw new TypeError(`${name}.${method} is required`);
      }
    }
    if (typeof migrationAdapter.rollback !== 'function') {
      throw new TypeError('migrationAdapter.rollback is required');
    }
    for (const stage of ORDER_STAGES) {
      if (!serviceStages[stage] || typeof serviceStages[stage].execute !== 'function') {
        throw new TypeError(`serviceStages.${stage}.execute is required`);
      }
    }
    if (typeof rolloutDispatcher.rollback !== 'function') {
      throw new TypeError('rolloutDispatcher.rollback is required');
    }
    this.repository = repository;
    this.accountValidator = accountValidator;
    this.migrationAdapter = migrationAdapter;
    this.serviceStages = serviceStages;
    this.rolloutDispatcher = rolloutDispatcher;
  }

  gate(input) {
    return assertPhase8ProductionGate(input);
  }

  async bindAccount({ liveReadiness, controls, slot, credentialRef } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    const slotKey = required(slot?.slot_key, 'slot.slot_key');
    const reference = required(credentialRef, 'credentialRef');
    if (/[\r\n]|bearer\s|password=|token=/iu.test(reference)) {
      throw new Error('credentialRef must be an opaque reference, not credential material');
    }
    const receipt = assertVerifiedReceipt(await this.accountValidator.validate({
      slot: Object.freeze({ ...slot }),
      credentialRef: reference,
      authorityRef: gate.authority_ref
    }), 'account_validation');
    await this.repository.recordEvent({
      phase: 8,
      eventType: 'account_bound',
      authorityRef: gate.authority_ref,
      idempotencyKey: `phase8-account:${slotKey}:${reference}`,
      payload: {
        slot_key: slotKey,
        credential_ref: reference,
        evidence_ref: receipt.evidence_ref,
        state: 'healthy'
      }
    });
    return Object.freeze({ status: 'PHASE8_ACCOUNT_BOUND', slot_key: slotKey, receipt });
  }

  async applyMigration({
    liveReadiness, controls, migrationRunId, migrationItems = [],
    backupEvidenceRef, productionApprovalRef
  } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    const runId = required(migrationRunId, 'migrationRunId');
    required(backupEvidenceRef, 'backupEvidenceRef');
    required(productionApprovalRef, 'productionApprovalRef');
    const applied = [];
    try {
      for (const item of migrationItems) {
        required(item.customer_id, 'migration item customer_id');
        required(item.idempotency_key, 'migration item idempotency_key');
        const receipt = item.action === 'no_op'
          ? { verified: true, evidence_ref: `no-op:${item.idempotency_key}`, no_op: true }
          : assertVerifiedReceipt(await this.migrationAdapter.apply({
            item,
            authorityRef: gate.authority_ref,
            productionApprovalRef,
            backupEvidenceRef
          }), 'customer_migration');
        applied.push({ item, receipt });
        await this.repository.recordEvent({
          phase: 8,
          eventType: 'migration_item_applied',
          authorityRef: gate.authority_ref,
          idempotencyKey: item.idempotency_key,
          payload: {
            migration_run_id: runId,
            customer_id: item.customer_id,
            action: item.action,
            evidence_ref: receipt.evidence_ref
          }
        });
      }
    } catch (error) {
      const rollbackReceipts = [];
      for (const appliedItem of [...applied].reverse()) {
        if (appliedItem.receipt.no_op) continue;
        const rollback = assertVerifiedReceipt(await this.migrationAdapter.rollback({
          item: appliedItem.item,
          authorityRef: gate.authority_ref,
          rollbackSnapshot: appliedItem.item.rollback_snapshot
        }), 'customer_migration_rollback');
        rollbackReceipts.push(rollback);
      }
      await this.repository.recordEvent({
        phase: 8,
        eventType: 'migration_rolled_back',
        authorityRef: gate.authority_ref,
        idempotencyKey: `phase8-migration-rollback:${runId}`,
        payload: {
          migration_run_id: runId,
          error_code: error?.code || 'migration_failed',
          rollback_evidence_refs: rollbackReceipts.map((receipt) => receipt.evidence_ref)
        }
      });
      throw error;
    }
    return Object.freeze({
      status: 'PHASE8_MIGRATION_APPLIED',
      migration_run_id: runId,
      applied_count: applied.length,
      evidence_refs: Object.freeze(applied.map(({ receipt }) => receipt.evidence_ref))
    });
  }

  async executeRealOrder({
    liveReadiness, controls, orderId, orderApprovalRef, context = {}
  } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    const order = required(orderId, 'orderId');
    required(orderApprovalRef, 'orderApprovalRef');
    const completed = [];
    try {
      for (const stage of ORDER_STAGES) {
        const receipt = assertVerifiedReceipt(await this.serviceStages[stage].execute({
          orderId: order,
          context: Object.freeze({ ...context }),
          priorReceipts: Object.freeze(completed.map((row) => row.receipt)),
          authorityRef: gate.authority_ref,
          orderApprovalRef
        }), stage);
        completed.push({ stage, receipt });
        await this.repository.recordEvent({
          phase: 8,
          eventType: `order_${stage}_verified`,
          authorityRef: gate.authority_ref,
          idempotencyKey: `phase8-order:${order}:${stage}`,
          payload: { order_id: order, evidence_ref: receipt.evidence_ref }
        });
      }
    } catch (error) {
      const rollbackRefs = [];
      for (const row of [...completed].reverse()) {
        const executor = this.serviceStages[row.stage];
        if (typeof executor.rollback !== 'function') continue;
        const receipt = assertVerifiedReceipt(await executor.rollback({
          orderId: order,
          receipt: row.receipt,
          authorityRef: gate.authority_ref
        }), `${row.stage}_rollback`);
        rollbackRefs.push(receipt.evidence_ref);
      }
      await this.repository.recordEvent({
        phase: 8,
        eventType: 'order_execution_rolled_back',
        authorityRef: gate.authority_ref,
        idempotencyKey: `phase8-order:${order}:rollback`,
        payload: { order_id: order, rollback_evidence_refs: rollbackRefs }
      });
      throw error;
    }
    return Object.freeze({
      status: 'PHASE8_REAL_ORDER_EXECUTED',
      order_id: order,
      evidence_refs: Object.freeze(completed.map(({ receipt }) => receipt.evidence_ref))
    });
  }

  async advanceRollout({
    liveReadiness, controls, canaryPlan, currentPercent = 0,
    targetPercent, priorStageAccepted = false
  } = {}) {
    const gate = this.gate({ liveReadiness, controls });
    const currentIndex = currentPercent === 0 ? -1 : PHASE8_CANARY_STAGES.indexOf(currentPercent);
    const expected = PHASE8_CANARY_STAGES[currentIndex + 1];
    if (targetPercent !== expected) {
      throw new Error(`Phase 8 rollout must advance from ${currentPercent} to ${expected}`);
    }
    if (currentPercent !== 0 && priorStageAccepted !== true) {
      throw new Error('prior Phase 8 rollout stage is not accepted');
    }
    const dispatch = await this.rolloutDispatcher.dispatch({
      plan: canaryPlan,
      percent: targetPercent,
      authorityRef: gate.authority_ref,
      approvedBudgetMicroUsd: gate.approved_budget_micro_usd
    });
    const evaluation = evaluatePhase8CanaryStage({
      plan: canaryPlan,
      percent: targetPercent,
      metrics: dispatch.metrics,
      liveEvidence: dispatch.live_evidence === true,
      evidenceRef: dispatch.evidence_ref
    });
    if (!evaluation.advance_eligible) {
      const rollback = assertVerifiedReceipt(await this.rolloutDispatcher.rollback({
        plan: canaryPlan,
        percent: targetPercent,
        authorityRef: gate.authority_ref,
        blockers: evaluation.blockers
      }), 'rollout_rollback');
      await this.repository.recordEvent({
        phase: 8,
        eventType: 'rollout_stage_rolled_back',
        authorityRef: gate.authority_ref,
        idempotencyKey: `phase8-rollout:${canaryPlan.cohort_id}:${targetPercent}:rollback`,
        payload: {
          cohort_id: canaryPlan.cohort_id,
          percent: targetPercent,
          blockers: evaluation.blockers,
          evidence_ref: rollback.evidence_ref
        }
      });
      return Object.freeze({ status: 'ROLLED_BACK', evaluation, rollback });
    }
    await this.repository.recordEvent({
      phase: 8,
      eventType: 'rollout_stage_accepted',
      authorityRef: gate.authority_ref,
      idempotencyKey: `phase8-rollout:${canaryPlan.cohort_id}:${targetPercent}:accepted`,
      payload: {
        cohort_id: canaryPlan.cohort_id,
        percent: targetPercent,
        evidence_ref: dispatch.evidence_ref
      }
    });
    return Object.freeze({
      status: targetPercent === 100 ? 'PHASE8_ROLLOUT_COMPLETE' : 'STAGE_ACCEPTED',
      evaluation,
      dispatch
    });
  }
}

export { ORDER_STAGES as PHASE8_REAL_ORDER_STAGES };
