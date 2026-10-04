import { createHash } from 'node:crypto';

export const PHASE8_SURFACES = Object.freeze([
  'chatgpt_ui',
  'perplexity_ui',
  'google_aio',
  'gemini_ui',
  'grok_ui',
  'qwen_ui',
  'deepseek_ui',
  'mistral_vibe_ui'
]);

const ACCOUNT_SURFACES = new Set(PHASE8_SURFACES.filter((surface) => surface !== 'google_aio'));
const SLOT_STATES = new Set(['live_frozen', 'healthy', 'degraded', 'quarantined', 'retired']);
const ALLOWED_TRANSITIONS = Object.freeze({
  live_frozen: new Set(['healthy', 'retired']),
  healthy: new Set(['degraded', 'quarantined', 'retired']),
  degraded: new Set(['healthy', 'quarantined', 'retired']),
  quarantined: new Set(['healthy', 'retired']),
  retired: new Set()
});

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildPhase8LogicalAccountPool({
  authorityRef,
  slots = []
} = {}) {
  required(authorityRef, 'authorityRef');
  const seen = new Set();
  const normalized = slots.map((slot) => {
    const slotKey = required(slot.slot_key, 'slot_key');
    if (seen.has(slotKey)) throw new Error(`duplicate slot_key: ${slotKey}`);
    seen.add(slotKey);
    if (!ACCOUNT_SURFACES.has(slot.surface)) {
      throw new RangeError(`unsupported account surface: ${slot.surface}`);
    }
    if (slot.secret || slot.credential || slot.cookie || slot.password || slot.token) {
      throw new Error(`logical slot ${slotKey} must not contain credentials`);
    }
    const state = slot.state || 'live_frozen';
    if (!SLOT_STATES.has(state)) throw new RangeError(`unsupported slot state: ${state}`);
    if (state !== 'live_frozen') {
      throw new Error('engineering-only account slots must start live_frozen');
    }
    return Object.freeze({
      slot_key: slotKey,
      surface: slot.surface,
      region: required(slot.region, 'region'),
      compliance_policy_ref: required(slot.compliance_policy_ref, 'compliance_policy_ref'),
      state,
      max_concurrency: Number.isSafeInteger(slot.max_concurrency) && slot.max_concurrency > 0
        ? slot.max_concurrency
        : 1,
      real_account_bound: false,
      credential_material_present: false
    });
  }).sort((left, right) => left.slot_key.localeCompare(right.slot_key));
  const body = {
    contract_version: 'phase8-logical-account-pool-v1',
    slots: normalized
  };
  return Object.freeze({
    schema_version: 'phase8-logical-account-pool-v1',
    engineering_authority_ref: authorityRef.trim(),
    status: 'PHASE8_ACCOUNT_POOL_LIVE_FROZEN',
    live_binding_allowed: false,
    slots: Object.freeze(normalized),
    pool_sha256: hash(body),
    network_calls_performed: 0
  });
}

export function previewPhase8AccountTransition(slot, nextState, {
  authoritativeGo = false,
  phase8LiveAuthorityRef = ''
} = {}) {
  if (!slot || !SLOT_STATES.has(slot.state)) throw new TypeError('valid slot is required');
  if (!SLOT_STATES.has(nextState)) throw new RangeError(`unsupported slot state: ${nextState}`);
  if (!ALLOWED_TRANSITIONS[slot.state].has(nextState)) {
    throw new Error(`invalid slot transition: ${slot.state}->${nextState}`);
  }
  const blockers = [];
  if (slot.state === 'live_frozen' && nextState === 'healthy') {
    if (authoritativeGo !== true) blockers.push('phase7_authoritative_go_missing');
    if (!String(phase8LiveAuthorityRef || '').trim()) blockers.push('phase8_live_authority_missing');
    blockers.push('real_account_validation_not_performed');
  }
  blockers.push('phase8_live_transition_executor_not_available');
  return Object.freeze({
    schema_version: 'phase8-account-transition-preview-v1',
    slot_key: slot.slot_key,
    from: slot.state,
    to: nextState,
    apply_allowed: false,
    preview_only: true,
    blockers: Object.freeze(blockers)
  });
}

function normalizeTasks(tasks) {
  const seen = new Set();
  return tasks.map((task, index) => {
    const taskKey = required(task.task_key, 'task_key');
    if (seen.has(taskKey)) throw new Error(`duplicate task_key: ${taskKey}`);
    seen.add(taskKey);
    if (!PHASE8_SURFACES.includes(task.surface)) {
      throw new RangeError(`unsupported surface: ${task.surface}`);
    }
    return Object.freeze({
      task_key: taskKey,
      tenant_key: required(task.tenant_key, 'tenant_key'),
      surface: task.surface,
      priority: Number.isSafeInteger(task.priority) ? task.priority : 0,
      input_order: index
    });
  });
}

export function buildPhase8FairSchedule({
  tasks = [],
  workerSlots = 1
} = {}) {
  if (!Number.isSafeInteger(workerSlots) || workerSlots <= 0) {
    throw new TypeError('workerSlots must be a positive safe integer');
  }
  const normalized = normalizeTasks(tasks);
  const queues = new Map();
  for (const task of normalized) {
    const key = `${task.surface}\u0000${task.tenant_key}`;
    const queue = queues.get(key) || [];
    queue.push(task);
    queues.set(key, queue);
  }
  for (const queue of queues.values()) {
    queue.sort((left, right) => right.priority - left.priority || left.input_order - right.input_order);
  }
  const queueKeys = [...queues.keys()].sort((left, right) => left.localeCompare(right));
  const assignments = [];
  let cursor = 0;
  while (assignments.length < normalized.length) {
    const key = queueKeys[cursor % queueKeys.length];
    const queue = queues.get(key);
    if (queue.length) {
      const task = queue.shift();
      assignments.push(Object.freeze({
        sequence: assignments.length + 1,
        worker_slot: (assignments.length % workerSlots) + 1,
        task_key: task.task_key,
        tenant_key: task.tenant_key,
        surface: task.surface,
        status: 'live_frozen'
      }));
    }
    cursor += 1;
  }
  return Object.freeze({
    schema_version: 'phase8-fair-schedule-v1',
    status: 'PHASE8_SCHEDULE_PLANNED_LIVE_FROZEN',
    planned_tasks: assignments.length,
    worker_slots: workerSlots,
    dispatch_allowed: false,
    assignments: Object.freeze(assignments),
    network_calls_performed: 0
  });
}

export function buildPhase8ScalePlan({
  queueDepth,
  oldestAgeSeconds,
  currentWorkers,
  minWorkers = 1,
  maxWorkers = 32,
  targetQueuePerWorker = 25,
  targetOldestAgeSeconds = 60
} = {}) {
  for (const [name, value] of Object.entries({
    queueDepth,
    oldestAgeSeconds,
    currentWorkers,
    minWorkers,
    maxWorkers,
    targetQueuePerWorker,
    targetOldestAgeSeconds
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${name} must be a non-negative safe integer`);
    }
  }
  if (minWorkers < 1 || maxWorkers < minWorkers || targetQueuePerWorker < 1) {
    throw new RangeError('invalid worker scaling bounds');
  }
  const demandWorkers = Math.ceil(queueDepth / targetQueuePerWorker);
  const ageBoost = oldestAgeSeconds > targetOldestAgeSeconds ? 1 : 0;
  const proposed = Math.min(maxWorkers, Math.max(minWorkers, demandWorkers + ageBoost));
  return Object.freeze({
    schema_version: 'phase8-worker-scale-plan-v1',
    current_workers: currentWorkers,
    proposed_workers: proposed,
    delta: proposed - currentWorkers,
    reason: proposed > currentWorkers
      ? 'queue_or_age_pressure'
      : proposed < currentWorkers
        ? 'excess_idle_capacity'
        : 'capacity_stable',
    apply_allowed: false,
    live_status: 'PHASE8_LIVE_FROZEN'
  });
}
