import { pool as defaultPool } from './db.js';
import {
  PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
  validatePhase1ShadowActivation
} from './phase1-activation.js';

const COMPONENTS = new Set(['api', 'worker', 'scheduler', 'evidence_recovery', 'downstream']);

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

export async function recordPhase1RuntimeHeartbeat({
  database = defaultPool,
  component,
  instanceId,
  releaseRevision = null,
  details = {}
} = {}) {
  const runtimeComponent = requireText(component, 'component');
  if (!COMPONENTS.has(runtimeComponent)) throw new RangeError(`unsupported Phase 1 runtime component: ${runtimeComponent}`);
  const instance = requireText(instanceId, 'instanceId');
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new TypeError('details must be an object');
  const result = await database.query(
    `INSERT INTO phase1_runtime_heartbeats (
       component, instance_id, release_revision, heartbeat_at, details
     ) VALUES ($1, $2, $3, clock_timestamp(), $4::jsonb)
     ON CONFLICT (component, instance_id) DO UPDATE
       SET release_revision = EXCLUDED.release_revision,
           heartbeat_at = EXCLUDED.heartbeat_at,
           details = EXCLUDED.details,
           updated_at = NOW()
     RETURNING *`,
    [runtimeComponent, instance, releaseRevision, JSON.stringify(details)]
  );
  return result.rows[0];
}

export async function collectPhase1ActivationHealth({
  database = defaultPool,
  staleAfterSeconds = 120
} = {}) {
  positiveInteger(staleAfterSeconds, 'staleAfterSeconds', 3600);
  const flagsResult = await database.query(
    `SELECT * FROM phase1_feature_flags WHERE scope_key = 'global'`
  );
  const flags = flagsResult.rows[0];
  if (!flags) {
    return { ok: false, state: 'blocked', reasons: ['phase1_feature_flags_missing'], required_components: [], metrics: {} };
  }

  const forbiddenTransportEnabled =
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true;
  if (forbiddenTransportEnabled) {
    return {
      ok: false,
      state: 'blocked',
      reasons: ['phase1_shadow_forbids_live_paid_or_external_spend'],
      required_components: [],
      metrics: {}
    };
  }

  const activationRequested = [
    'shadow_contract_enabled',
    'scheduler_intake_enabled',
    'worker_drain_enabled',
    'observation_pipeline_enabled',
    'contract_v2_enabled',
    'tracking_fanout_enabled',
    'tracking_fanin_enabled',
    'compatibility_writes_enabled'
  ].some((flag) => flags[flag] === true);
  if (!activationRequested) {
    return { ok: true, state: 'disarmed', reasons: [], required_components: [], metrics: {} };
  }

  const reasons = [];
  const schedulerIntakeEnabled = flags.scheduler_intake_enabled === true;
  const workerDrainEnabled = flags.worker_drain_enabled === true;
  const shadowRuntimeRequested = schedulerIntakeEnabled || workerDrainEnabled;
  if (
    shadowRuntimeRequested &&
    (
      flags.shadow_contract_enabled !== true ||
      flags.shadow_contract_version !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION
    )
  ) {
    reasons.push('exact_shadow_contract_disabled');
  }
  // The Phase 1 shadow path is a separate internal-only scheduler/intake
  // contract.  The legacy observation pipeline is billable and backed only by
  // preproduction-locked plan contracts, so shadow readiness must prove that
  // every legacy entry gate remains closed.
  if (flags.observation_pipeline_enabled === true) reasons.push('legacy_observation_pipeline_must_remain_disabled');
  if (flags.contract_v2_enabled === true) reasons.push('legacy_contract_v2_must_remain_disabled');
  if (flags.tracking_fanout_enabled === true) reasons.push('legacy_tracking_fanout_must_remain_disabled');
  if (flags.tracking_fanin_enabled === true) reasons.push('legacy_tracking_fanin_must_remain_disabled');
  if (flags.compatibility_writes_enabled === true) reasons.push('legacy_compatibility_writes_must_remain_disabled');
  if (
    flags.observation_pipeline_enabled === true ||
    flags.contract_v2_enabled === true ||
    flags.tracking_fanout_enabled === true ||
    flags.tracking_fanin_enabled === true ||
    flags.compatibility_writes_enabled === true
  ) {
    reasons.push('legacy_observation_gates_must_remain_disabled');
  }
  if (shadowRuntimeRequested && flags.durable_queue_enabled !== true) reasons.push('durable_queue_disabled');
  if (schedulerIntakeEnabled && !workerDrainEnabled) reasons.push('scheduler_intake_requires_worker_drain');

  const requiredComponents = new Set();
  if (schedulerIntakeEnabled) requiredComponents.add('scheduler');
  if (workerDrainEnabled) requiredComponents.add('worker');

  const [activationResult, heartbeatResult, queueResult] = await Promise.all([
    database.query(
      `SELECT activation.*,
              activation.cycle_anchor_date::text AS cycle_anchor_date,
              activation.next_bucket_date::text AS next_bucket_date,
              activation.last_scheduled_bucket::text AS last_scheduled_bucket,
              customer.status AS customer_status,
              customer.plan_code AS customer_plan_code,
              customer.tenant_class AS customer_tenant_class,
              prompt_set.status AS prompt_set_status
         FROM phase1_tenant_activations AS activation
         JOIN customers AS customer ON customer.id = activation.customer_id
         JOIN brands AS brand
           ON brand.id = activation.brand_id
          AND brand.customer_id = activation.customer_id
         JOIN prompt_sets AS prompt_set
           ON prompt_set.id = activation.prompt_set_id
          AND prompt_set.brand_id = activation.brand_id
        WHERE activation.status = 'shadow'`
    ),
    database.query(
      `SELECT component, MAX(heartbeat_at) AS heartbeat_at
         FROM phase1_runtime_heartbeats
        WHERE heartbeat_at >= clock_timestamp() - ($1::integer * INTERVAL '1 second')
        GROUP BY component`,
      [staleAfterSeconds]
    ),
    database.query(
      `SELECT
         (SELECT COUNT(*) FROM phase1_tracking_intake
           WHERE status = 'leased' AND lease_until <= clock_timestamp())::INTEGER AS expired_intake_leases,
         (SELECT COUNT(*) FROM phase1_tracking_intake
           WHERE status = 'dead_letter')::INTEGER AS intake_dead_letters,
         (SELECT COUNT(*) FROM collection_tasks
           WHERE status = 'leased' AND lease_until <= clock_timestamp())::INTEGER AS expired_collection_leases,
         (SELECT COUNT(*) FROM observation_finalization_candidates
           WHERE status = 'evidence_pending' AND recovery_deadline_at <= clock_timestamp())::INTEGER AS overdue_evidence,
         (SELECT COUNT(*) FROM phase1_downstream_outbox
           WHERE status = 'leased' AND lease_until <= clock_timestamp())::INTEGER AS expired_downstream_leases,
         (SELECT COUNT(*) FROM phase1_downstream_outbox
           WHERE status = 'dead_letter')::INTEGER AS downstream_dead_letters`
    )
  ]);

  let activeTenants = 0;
  let invalidTenants = 0;
  for (const activation of activationResult.rows) {
    try {
      validatePhase1ShadowActivation(activation);
      activeTenants += 1;
    } catch {
      invalidTenants += 1;
    }
  }
  if (schedulerIntakeEnabled && activeTenants === 0) reasons.push('no_shadow_tenant_activation');
  if (invalidTenants > 0) reasons.push('invalid_shadow_tenant_activation');

  const freshComponents = new Set(heartbeatResult.rows.map((row) => row.component));
  for (const component of requiredComponents) {
    if (!freshComponents.has(component)) reasons.push(`stale_or_missing_${component}_heartbeat`);
  }

  const metrics = {
    active_tenants: activeTenants,
    invalid_tenants: invalidTenants,
    expired_intake_leases: Number(queueResult.rows[0]?.expired_intake_leases || 0),
    intake_dead_letters: Number(queueResult.rows[0]?.intake_dead_letters || 0),
    expired_collection_leases: Number(queueResult.rows[0]?.expired_collection_leases || 0),
    overdue_evidence: Number(queueResult.rows[0]?.overdue_evidence || 0),
    expired_downstream_leases: Number(queueResult.rows[0]?.expired_downstream_leases || 0),
    downstream_dead_letters: Number(queueResult.rows[0]?.downstream_dead_letters || 0)
  };
  // Only the scheduler/intake lane participates in the isolated shadow
  // activation. Legacy collection, evidence, and downstream queues remain
  // observable here, but they do not gate shadow readiness while all four
  // legacy gates above are closed.
  for (const metric of ['invalid_tenants', 'expired_intake_leases', 'intake_dead_letters']) {
    if (metrics[metric] > 0) reasons.push(metric);
  }

  const state = reasons.length > 0
    ? 'blocked'
    : schedulerIntakeEnabled
      ? 'shadow_ready'
      : workerDrainEnabled
        ? 'shadow_draining'
        : 'shadow_armed';
  return {
    ok: reasons.length === 0,
    state,
    reasons: [...new Set(reasons)],
    required_components: [...requiredComponents].sort(),
    metrics
  };
}
