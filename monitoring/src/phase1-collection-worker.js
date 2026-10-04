import { pool as defaultPool } from './db.js';
import { getConfig } from './config.js';
import {
  claimCollectionTask,
  heartbeatCollectionTask,
  prepareObservationAttempt,
  sweepExpiredCollectionTaskLeases
} from './collection-queue.js';
import { finalizeObservationTask } from './observation-finalizer.js';
import { runWithCollectionLeaseHeartbeat } from './phase1-transport-runtime.js';
import { PHASE1_SHADOW_PLAN_CONTRACT_VERSION } from './phase1-activation.js';
import { sweepExpiredSupplierReservations } from './supplier-budget-ledger.js';

const DEFAULT_OPERATIONS = Object.freeze({
  claimCollectionTask,
  heartbeatCollectionTask,
  prepareObservationAttempt,
  sweepExpiredCollectionTaskLeases,
  sweepExpiredSupplierReservations,
  finalizeObservationTask
});

function disabled(reason) {
  return Object.freeze({ operation: 'phase1_collection_cycle', enabled: false, status: 'disabled', reason });
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function mockAcquisition(task) {
  if (task.requested_surface === 'google_aio') {
    return { acquisitionMode: 'serpapi_aio' };
  }
  return { acquisitionMode: 'web_ui' };
}

async function readWorkerGate(pool) {
  const result = await pool.query(
    `SELECT observation_pipeline_enabled,
            durable_queue_enabled,
            tracking_fanout_enabled,
            tracking_fanin_enabled,
            contract_v2_enabled,
            shadow_contract_enabled,
            shadow_contract_version,
            worker_drain_enabled,
            collection_drain_enabled,
            live_supplier_transport_enabled,
            paid_supplier_transport_enabled,
            external_spend_enabled
       FROM phase1_feature_flags
      WHERE scope_key = 'global'`
  );
  const flags = result.rows[0];
  if (!flags) return { enabled: false, reason: 'phase1_feature_flags_missing' };
  if (
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true
  ) {
    throw new Error('Phase 1 mock collection worker refuses live, paid, or external-spend flags');
  }
  const enabled =
    flags.observation_pipeline_enabled === true &&
    flags.durable_queue_enabled === true &&
    flags.tracking_fanin_enabled === true &&
    flags.contract_v2_enabled === true &&
    flags.shadow_contract_enabled === true &&
    flags.shadow_contract_version === PHASE1_SHADOW_PLAN_CONTRACT_VERSION &&
    flags.worker_drain_enabled === true &&
    flags.collection_drain_enabled === true;
  return enabled
    ? { enabled: true, flags }
    : { enabled: false, reason: 'database_feature_flags_disabled' };
}

export function isPhase1FanoutResult(result) {
  return result?.operation === 'fan_out';
}

/**
 * Process at most one durable collection task without invoking a provider,
 * supplier API, browser, proxy, or paid transport. Expired leases are swept on
 * every enabled cycle; an idle result lets the Redis worker block normally.
 */
export async function runPhase1CollectionCycle(
  {
    pool = defaultPool,
    config = getConfig(),
    workerId = `phase1-mock-worker:${process.pid}`
  } = {},
  operations = DEFAULT_OPERATIONS
) {
  if (config.phase1CollectionWorkerEnabled !== true) {
    return disabled('collection_worker_process_feature_flag_disabled');
  }
  if (config.phase1DurableQueueWorkerEnabled !== true) {
    return disabled('worker_process_feature_flag_disabled');
  }
  const leaseMs = positiveInteger(config.phase1LeaseMs, 'phase1LeaseMs');
  const heartbeatMs = positiveInteger(config.phase1HeartbeatMs, 'phase1HeartbeatMs');
  if (heartbeatMs >= leaseMs) throw new RangeError('phase1HeartbeatMs must be less than phase1LeaseMs');
  const leaseSeconds = Math.max(1, Math.ceil(leaseMs / 1000));

  const gate = await readWorkerGate(pool);
  if (!gate.enabled) return disabled(gate.reason);

  const sweptPermits = await operations.sweepExpiredSupplierReservations({
    pool,
    actor: `${workerId}:permit-sweeper`
  });
  const swept = await operations.sweepExpiredCollectionTaskLeases(
    { actor: `${workerId}:sweeper` },
    { pool }
  );
  const task = await operations.claimCollectionTask({ workerId, leaseSeconds }, { pool });
  if (!task) {
    return Object.freeze({
      operation: 'phase1_collection_cycle',
      enabled: true,
      status: 'idle',
      swept: Object.freeze([...swept]),
      swept_permits: Object.freeze([...sweptPermits]),
      redis_wakeup_enabled: config.phase1RedisWakeupEnabled === true
    });
  }

  const { attempt, acquisitionMode, finalized } = await runWithCollectionLeaseHeartbeat(
    {
      pool,
      taskId: task.id,
      leaseToken: task.lease_token,
      fencingToken: Number(task.lease_fencing_token),
      workerId,
      leaseSeconds,
      heartbeatMs
    },
    async ({ signal, fenceForCommit }) => {
      const { acquisitionMode } = mockAcquisition(task);
      const attempt = await operations.prepareObservationAttempt(
        {
          taskId: task.id,
          leaseToken: task.lease_token,
          fencingToken: task.lease_fencing_token,
          supplier: 'phase1_mock',
          transportSupplier: 'phase1_mock',
          route: task.route,
          acquisitionMode,
          metadata: {
            synthetic: true,
            synthetic_shadow: true,
            external_transport_invoked: false,
            billable: false
          }
        },
        { pool }
      );
      if (signal.aborted) throw signal.reason;
      await fenceForCommit();

      // A transport-disarmed shadow attempt is never a native observation.
      // Persist it as a non-billable technical failure with no evidence, so
      // customer credit is released instead of settled and no synthetic
      // artifact can be mistaken for verified provider output.
      const requestedGeo = {
        region: task.region,
        language: task.language,
        device: task.device
      };
      const finalized = await operations.finalizeObservationTask({
        pool,
        task_id: task.id,
        attempt_id: attempt.id,
        lease_token: task.lease_token,
        fencing_token: Number(task.lease_fencing_token),
        actor: workerId,
        outcome: 'technical_failed',
        acquisition_mode: acquisitionMode,
        answer_text: null,
        normalized_answer: null,
        citations: [],
        requested_geo: requestedGeo,
        actual_geo: null,
        adapter_version: null,
        parser_version: null,
        structured_validation_passed: false,
        evidence_manifest: null,
        artifacts: [],
        attempt_details: {
          latency_ms: 0,
          local_request_bytes: Buffer.byteLength(task.original_prompt_text),
          local_response_bytes: 0,
          vendor_billed_bytes: 0,
          error_taxonomy: 'synthetic_shadow_non_billable',
          error_code: 'phase1_mock_transport_disarmed',
          error_details: {
            synthetic: true,
            synthetic_shadow: true,
            external_transport_invoked: false,
            billable: false
          }
        },
        enabled: true
      });
      return { attempt, acquisitionMode, finalized };
    },
    { heartbeat: operations.heartbeatCollectionTask }
  );

  return Object.freeze({
    operation: 'phase1_collection_cycle',
    enabled: true,
    status: 'processed',
    collection_task_id: task.id,
    observation_attempt_id: attempt.id,
    finalized,
    swept: Object.freeze([...swept]),
    swept_permits: Object.freeze([...sweptPermits]),
    mock_only: true,
    synthetic_shadow: true,
    outcome: 'technical_failed',
    external_transport_invoked: false
  });
}
