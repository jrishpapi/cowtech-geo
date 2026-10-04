import { createHash } from 'node:crypto';
import {
  buildStarterPocDataset,
  validateStarterPocDataset
} from './poc/starter-poc-workload.js';

export const PHASE7_SESSION_CHECKPOINTS = Object.freeze([1, 2, 10, 50, 100]);

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildPhase7PocPlan({
  demands = buildStarterPocDataset(),
  engineeringAuthorityRef,
  phase6FreezeDecisionRef
} = {}) {
  const validation = validateStarterPocDataset(demands);
  if (!validation.valid) {
    throw new Error(`invalid frozen Phase 7 workload: ${validation.errors.join(',')}`);
  }
  const surfaceOrdinals = new Map();
  const items = demands.map((demand) => {
    const surfaceOrdinal = (surfaceOrdinals.get(demand.surface) || 0) + 1;
    surfaceOrdinals.set(demand.surface, surfaceOrdinal);
    const webSurface = demand.acquisition_mode === 'web_ui';
    const sessionOrdinal = webSurface ? ((surfaceOrdinal - 1) % 100) + 1 : null;
    const sessionCycle = webSurface ? Math.floor((surfaceOrdinal - 1) / 100) + 1 : null;
    const sessionCheckpoint = webSurface && PHASE7_SESSION_CHECKPOINTS.includes(sessionOrdinal)
      ? sessionOrdinal
      : null;
    const canary = surfaceOrdinal === 1;
    return Object.freeze({
      item_key: demand.demand_key,
      sequence: demand.sequence,
      batch_key: canary
        ? 'phase7-canary-001'
        : `${demand.daily_bucket}:${demand.surface}`,
      stage: canary ? 'canary' : 'bulk',
      surface: demand.surface,
      prompt_id: demand.prompt_id,
      prompt_text: demand.prompt_text,
      prompt_sha256: demand.original_prompt_sha256,
      daily_bucket: demand.daily_bucket,
      workload_class: demand.workload_class,
      acquisition_mode: demand.acquisition_mode,
      surface_ordinal: surfaceOrdinal,
      session_mode: webSurface
        ? (sessionOrdinal === 1 ? 'cold' : 'warm')
        : 'not_applicable',
      session_cycle: sessionCycle,
      session_ordinal: sessionOrdinal,
      session_checkpoint: sessionCheckpoint,
      no_cache: demand.no_cache,
      customer_credit_units: demand.customer_credit_units,
      status: 'planned'
    });
  });
  const batchMap = new Map();
  for (const item of items) {
    const current = batchMap.get(item.batch_key) || {
      batch_key: item.batch_key,
      stage: item.stage,
      planned_demands: 0,
      surfaces: new Set()
    };
    current.planned_demands += 1;
    current.surfaces.add(item.surface);
    batchMap.set(item.batch_key, current);
  }
  const batches = [...batchMap.values()]
    .map((batch) => Object.freeze({
      batch_key: batch.batch_key,
      stage: batch.stage,
      planned_demands: batch.planned_demands,
      surfaces: Object.freeze([...batch.surfaces].sort()),
      status: 'planned'
    }))
    .sort((left, right) => {
      if (left.stage !== right.stage) return left.stage === 'canary' ? -1 : 1;
      return left.batch_key.localeCompare(right.batch_key);
    });
  const planBody = {
    cohort_id: 'starter-4000-v1',
    dataset_sha256: validation.dataset_sha256,
    planned_demands: items.length,
    batches,
    items
  };
  return Object.freeze({
    schema_version: 'phase7-poc-engineering-plan-v1',
    cohort_id: planBody.cohort_id,
    dataset_sha256: planBody.dataset_sha256,
    engineering_authority_ref: required(engineeringAuthorityRef, 'engineeringAuthorityRef'),
    phase6_freeze_decision_ref: required(phase6FreezeDecisionRef, 'phase6FreezeDecisionRef'),
    phase6_exit_passed: false,
    live_execution_allowed: false,
    approved_budget_micro_usd: 0,
    planned_demands: items.length,
    planned_batches: batches.length,
    session_checkpoints: PHASE7_SESSION_CHECKPOINTS,
    batches: Object.freeze(batches),
    items: Object.freeze(items),
    plan_sha256: hash(planBody)
  });
}
