// Keep the immutable Phase 0 frozen-contract module byte-exact. Phase 1 uses
// this separate exact shadow-only contract.
export const PHASE1_SHADOW_PLAN_CONTRACT_VERSION = 'diagnostic-monitoring-plan-v2-shadow-v1';
export const PHASE1_SHADOW_PLAN_CONTRACT = Object.freeze({
  contract_version: PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
  activation_state: 'shadow_canary',
  plan_code: 'starter',
  prompt_slots: 44,
  cadence: 'daily',
  cycle_days: 30,
  surfaces: Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio']),
  base_credits: 3960,
  flexible_credits: 40,
  total_credits: 4000,
  monitoring_timezones: Object.freeze(['UTC']),
  customer_visible: false,
  billing_enabled: false,
  external_transport_enabled: false
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function nonEmptyString(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

export function parsePhase1IsoDay(value, name = 'day') {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) {
    throw new TypeError(`${name} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${name} must be a real calendar date`);
  }
  return parsed;
}

export function addPhase1UtcDays(day, amount) {
  if (!Number.isSafeInteger(amount)) throw new TypeError('amount must be a safe integer');
  const date = parsePhase1IsoDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function phase1UtcDay(value = new Date()) {
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError('now must be a valid timestamp');
  return instant.toISOString().slice(0, 10);
}

export function resolvePhase1Cycle({ cycle_anchor_date, daily_bucket } = {}) {
  const anchor = parsePhase1IsoDay(cycle_anchor_date, 'cycle_anchor_date');
  const bucket = parsePhase1IsoDay(daily_bucket, 'daily_bucket');
  const elapsedDays = Math.round((bucket.getTime() - anchor.getTime()) / MILLISECONDS_PER_DAY);
  if (elapsedDays < 0) throw new RangeError('daily_bucket cannot precede cycle_anchor_date');

  const cycleDays = PHASE1_SHADOW_PLAN_CONTRACT.cycle_days;
  const cycleNumber = Math.floor(elapsedDays / cycleDays);
  const bucketIndex = elapsedDays % cycleDays;
  const cycleStart = addPhase1UtcDays(cycle_anchor_date, cycleNumber * cycleDays);
  const cycleEnd = addPhase1UtcDays(cycleStart, cycleDays - 1);

  return Object.freeze({
    daily_bucket,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    cycle_number: cycleNumber,
    bucket_index: bucketIndex,
    cycle_days: cycleDays,
    monitoring_timezone: 'UTC'
  });
}

export function buildPhase1TrackingRunKey({ activation_id, brand_id, contract_version, daily_bucket } = {}) {
  const activationId = nonEmptyString(activation_id, 'activation_id');
  const brandId = nonEmptyString(brand_id, 'brand_id');
  const contractVersion = nonEmptyString(contract_version, 'contract_version');
  parsePhase1IsoDay(daily_bucket, 'daily_bucket');
  if (contractVersion !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION) {
    throw new RangeError('contract_version is not the exact Phase 1 shadow contract');
  }
  return `phase1-shadow:${contractVersion}:${activationId}:${brandId}:${daily_bucket}`;
}

export function validatePhase1ShadowGate(flags) {
  if (!flags) return Object.freeze({ enabled: false, reason: 'phase1_feature_flags_missing' });
  if (flags.scheduler_intake_enabled !== true) {
    return Object.freeze({ enabled: false, reason: 'scheduler_intake_disabled' });
  }
  if (
    flags.observation_pipeline_enabled === true ||
    flags.contract_v2_enabled === true ||
    flags.tracking_fanout_enabled === true ||
    flags.tracking_fanin_enabled === true ||
    flags.compatibility_writes_enabled === true
  ) {
    throw new Error('Phase 1 shadow scheduler refuses every legacy observation-pipeline gate');
  }
  if (
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true
  ) {
    throw new Error('Phase 1 shadow scheduler refuses live, paid, or external-spend flags');
  }
  if (
    flags.shadow_contract_enabled !== true ||
    flags.shadow_contract_version !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION
  ) {
    return Object.freeze({ enabled: false, reason: 'exact_shadow_contract_disabled' });
  }
  if (flags.durable_queue_enabled !== true) {
    return Object.freeze({ enabled: false, reason: 'durable_queue_disabled' });
  }
  if (flags.worker_drain_enabled !== true) {
    return Object.freeze({ enabled: false, reason: 'scheduler_worker_drain_disabled' });
  }
  return Object.freeze({ enabled: true, reason: null });
}

export function validatePhase1ShadowActivation(activation = {}) {
  if (activation.status !== 'shadow') throw new Error('tenant activation is not in shadow state');
  if (activation.contract_version !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION) {
    throw new Error('tenant activation contract version mismatch');
  }
  if (activation.plan_code !== 'starter' || activation.customer_plan_code !== 'starter') {
    throw new Error('Phase 1 shadow activation is Starter-only');
  }
  if (activation.customer_tenant_class !== 'internal_canary') {
    throw new Error('Phase 1 shadow activation is internal-canary-only');
  }
  if (activation.customer_status !== 'active') throw new Error('tenant customer is not active');
  if (activation.prompt_set_status !== 'active') throw new Error('tenant prompt set is not active');
  if (activation.monitoring_timezone !== 'UTC') throw new Error('Phase 1 shadow activation requires UTC');
  if (activation.device !== 'desktop') throw new Error('Phase 1 shadow activation requires desktop');
  if (
    activation.customer_visible !== false ||
    activation.billing_enabled !== false ||
    activation.external_transport_enabled !== false
  ) {
    throw new Error('Phase 1 shadow activation must remain invisible, non-billable, and transport-disarmed');
  }
  if (!activation.activated_at || Number.isNaN(new Date(activation.activated_at).getTime())) {
    throw new Error('Phase 1 shadow activation requires a valid activated_at timestamp');
  }
  nonEmptyString(activation.region, 'region');
  nonEmptyString(activation.language, 'language');
  const anchor = parsePhase1IsoDay(activation.cycle_anchor_date, 'cycle_anchor_date');
  const nextBucket = parsePhase1IsoDay(activation.next_bucket_date, 'next_bucket_date');
  if (nextBucket.getTime() < anchor.getTime()) {
    throw new Error('Phase 1 shadow activation next bucket precedes its cycle anchor');
  }
  if (activation.last_scheduled_bucket != null) {
    const lastBucket = parsePhase1IsoDay(activation.last_scheduled_bucket, 'last_scheduled_bucket');
    if (lastBucket.getTime() < anchor.getTime() || lastBucket.getTime() >= nextBucket.getTime()) {
      throw new Error('Phase 1 shadow activation last scheduled bucket is outside its valid range');
    }
  }
  return activation;
}

export function buildPhase1ShadowContractSnapshot(activation, cycle) {
  validatePhase1ShadowActivation(activation);
  return Object.freeze({
    ...PHASE1_SHADOW_PLAN_CONTRACT,
    surfaces: [...PHASE1_SHADOW_PLAN_CONTRACT.surfaces],
    activation_id: activation.id,
    customer_id: activation.customer_id,
    brand_id: activation.brand_id,
    prompt_set_id: activation.prompt_set_id,
    cycle_anchor_date: activation.cycle_anchor_date,
    cycle_start: cycle.cycle_start,
    cycle_end: cycle.cycle_end,
    cycle_number: cycle.cycle_number,
    monitoring_timezone: activation.monitoring_timezone,
    region: activation.region,
    language: activation.language,
    device: activation.device
  });
}
