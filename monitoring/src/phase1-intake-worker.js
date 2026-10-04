import { randomUUID } from 'node:crypto';
import { pool as defaultPool } from './db.js';
import { getConfig } from './config.js';
import { withTransaction } from './db-transaction.js';
import {
  PHASE1_SHADOW_PLAN_CONTRACT,
  PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
  validatePhase1ShadowActivation
} from './phase1-activation.js';

const RETRYABLE_TRANSACTION_CODES = new Set(['40001', '40P01']);
const EXACT_SHADOW_SURFACES = Object.freeze(['chatgpt_ui', 'perplexity_ui', 'google_aio']);

function disabled(reason) {
  return Object.freeze({ operation: 'phase1_intake_cycle', enabled: false, status: 'disabled', reason });
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function isoDay(value, name) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid date`);
  return date.toISOString().slice(0, 10);
}

function safeError(error) {
  return Object.freeze({
    code: String(error?.code || 'phase1_intake_fanout_failed').slice(0, 100),
    details: Object.freeze({
      name: String(error?.name || 'Error').slice(0, 100),
      message: String(error?.message || error || 'unknown intake failure').slice(0, 500)
    })
  });
}

async function readIntakeGate(client) {
  const result = await client.query(
    `SELECT observation_pipeline_enabled,
            durable_queue_enabled,
            tracking_fanout_enabled,
            tracking_fanin_enabled,
            contract_v2_enabled,
            compatibility_writes_enabled,
            shadow_contract_enabled,
            shadow_contract_version,
            worker_drain_enabled,
            live_supplier_transport_enabled,
            paid_supplier_transport_enabled,
            external_spend_enabled
       FROM phase1_feature_flags
      WHERE scope_key = 'global'
      FOR SHARE`
  );
  const flags = result.rows[0];
  if (!flags) return { enabled: false, reason: 'phase1_feature_flags_missing' };
  if (
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true
  ) {
    throw new Error('Phase 1 intake worker refuses live, paid, or external-spend flags');
  }
  if (
    flags.observation_pipeline_enabled === true ||
    flags.contract_v2_enabled === true ||
    flags.tracking_fanout_enabled === true ||
    flags.tracking_fanin_enabled === true ||
    flags.compatibility_writes_enabled === true
  ) {
    throw new Error(
      'Phase 1 shadow intake refuses legacy observation, contract-v2, fan-out, fan-in, or compatibility-write gates'
    );
  }
  const enabled =
    flags.durable_queue_enabled === true &&
    flags.shadow_contract_enabled === true &&
    flags.shadow_contract_version === PHASE1_SHADOW_PLAN_CONTRACT_VERSION &&
    flags.worker_drain_enabled === true;
  return enabled
    ? { enabled: true, flags }
    : { enabled: false, reason: 'database_worker_drain_flags_disabled' };
}

async function claimIntake(client, { workerId, leaseSeconds }) {
  const leaseToken = randomUUID();
  const result = await client.query(
    `WITH candidate AS (
       SELECT id
         FROM phase1_tracking_intake
        WHERE (
                status IN ('queued', 'retry_wait')
                AND available_at <= clock_timestamp()
              )
           OR (
                status = 'leased'
                AND lease_until <= clock_timestamp()
              )
        ORDER BY
          CASE WHEN status = 'leased' THEN lease_until ELSE available_at END,
          created_at,
          id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     UPDATE phase1_tracking_intake AS intake
        SET status = 'leased',
            lease_owner = $1,
            lease_token = $2,
            lease_until = clock_timestamp() + ($3 * INTERVAL '1 second'),
            lease_fencing_token = intake.lease_fencing_token + 1,
            attempt_count = intake.attempt_count + 1,
            updated_at = NOW()
       FROM candidate
      WHERE intake.id = candidate.id
      RETURNING intake.*,
                intake.daily_bucket::text AS daily_bucket_text,
                intake.cycle_start::text AS cycle_start_text,
                intake.cycle_end::text AS cycle_end_text`,
    [workerId, leaseToken, leaseSeconds]
  );
  return result.rows[0] || null;
}

function assertShadowIntake(intake) {
  if (intake.contract_version !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION) {
    const error = new Error('Phase 1 intake contract version mismatch');
    error.code = 'phase1_intake_contract_mismatch';
    throw error;
  }
  if (intake.plan_code !== 'starter' || intake.monitoring_timezone !== 'UTC') {
    const error = new Error('Phase 1 intake is outside the Starter UTC shadow contract');
    error.code = 'phase1_intake_shadow_scope_invalid';
    throw error;
  }
  if (
    intake.customer_visible !== false ||
    intake.billing_enabled !== false ||
    intake.external_transport_enabled !== false
  ) {
    const error = new Error('Phase 1 intake violates invisible, non-billable, transport-disarmed boundaries');
    error.code = 'phase1_intake_shadow_boundary_invalid';
    throw error;
  }
}

/**
 * Expand one exact shadow intake into internal-only, non-billable validation
 * rows. This function deliberately has no path to customer demand/credit,
 * collection-task, result, supplier, provider, or transport tables.
 */
export async function fanOutPhase1ShadowIntake({ client, intake } = {}) {
  if (!client || typeof client.query !== 'function') throw new TypeError('client must expose query(sql, params)');
  if (!intake || typeof intake !== 'object') throw new TypeError('intake must be an object');
  assertShadowIntake(intake);
  if (
    PHASE1_SHADOW_PLAN_CONTRACT.prompt_slots !== 44 ||
    JSON.stringify(PHASE1_SHADOW_PLAN_CONTRACT.surfaces) !== JSON.stringify(EXACT_SHADOW_SURFACES)
  ) {
    throw new Error('Phase 1 shadow fan-out contract is not the exact frozen 44x3 shape');
  }

  const activationResult = await client.query(
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
      WHERE activation.id = $1
      FOR SHARE OF activation, customer, brand, prompt_set`,
    [intake.activation_id]
  );
  const activation = activationResult.rows[0];
  if (!activation) throw new Error(`Phase 1 shadow activation not found: ${intake.activation_id}`);
  try {
    validatePhase1ShadowActivation(activation);
  } catch (cause) {
    const error = new Error(`Phase 1 activation is invalid at intake consumption: ${cause.message}`, { cause });
    error.code = 'phase1_shadow_activation_invalid';
    throw error;
  }
  if (
    activation.id !== intake.activation_id ||
    activation.customer_id !== intake.customer_id ||
    activation.brand_id !== intake.brand_id ||
    activation.prompt_set_id !== intake.prompt_set_id ||
    activation.contract_version !== intake.contract_version ||
    activation.plan_code !== intake.plan_code
  ) {
    const error = new Error('Phase 1 intake context does not match its locked activation');
    error.code = 'phase1_shadow_activation_context_mismatch';
    throw error;
  }

  const promptResult = await client.query(
    `SELECT p.id, p.prompt_text
       FROM prompts AS p
      WHERE p.prompt_set_id = $1
        AND COALESCE(p.status, 'active') = 'active'
      ORDER BY p.priority DESC NULLS LAST, p.created_at ASC, p.id ASC
      FOR SHARE OF p`,
    [activation.prompt_set_id]
  );
  if (promptResult.rows.length !== PHASE1_SHADOW_PLAN_CONTRACT.prompt_slots) {
    const error = new Error(
      `Phase 1 shadow fan-out requires exactly 44 active prompts; found ${promptResult.rows.length}`
    );
    error.code = 'phase1_shadow_prompt_count_mismatch';
    throw error;
  }
  for (const prompt of promptResult.rows) {
    if (!prompt.id || typeof prompt.prompt_text !== 'string' || prompt.prompt_text.trim() === '') {
      const error = new Error('Phase 1 shadow prompt set contains an invalid active prompt');
      error.code = 'phase1_shadow_prompt_invalid';
      throw error;
    }
  }

  const demandRows = [];
  for (const [promptIndex, prompt] of promptResult.rows.entries()) {
    for (const surfaceKey of EXACT_SHADOW_SURFACES) {
      demandRows.push({
        idempotency_key: `phase1-shadow-demand:${intake.id}:${prompt.id}:${surfaceKey}`,
        prompt_id: prompt.id,
        prompt_slot: promptIndex + 1,
        surface_key: surfaceKey
      });
    }
  }
  if (demandRows.length !== 132) throw new Error('Phase 1 shadow fan-out did not produce exactly 132 demands');

  const validationDetails = JSON.stringify({
    schema_version: 'phase1-shadow-demand-validation-v1',
    prompt_count: 44,
    surface_count: 3,
    demand_count: 132,
    customer_visible: false,
    billing_enabled: false,
    external_transport_enabled: false
  });
  const inserted = await client.query(
    `INSERT INTO phase1_shadow_demands (
       idempotency_key, activation_id, intake_id, shadow_run_id,
       prompt_set_id, prompt_id, prompt_slot, surface_key, daily_bucket,
       contract_version, plan_code, status, validation_details,
       customer_visible, billing_enabled, external_transport_enabled,
       validated_at
     )
     SELECT demand.idempotency_key, $2, $1, $3,
            $4, demand.prompt_id, demand.prompt_slot, demand.surface_key, $5::date,
            $6, 'starter', 'validated', $7::jsonb,
            FALSE, FALSE, FALSE, NOW()
       FROM jsonb_to_recordset($8::jsonb) AS demand(
         idempotency_key TEXT,
         prompt_id UUID,
         prompt_slot SMALLINT,
         surface_key TEXT
       )
     ON CONFLICT (idempotency_key) DO UPDATE
       SET idempotency_key = EXCLUDED.idempotency_key
     WHERE phase1_shadow_demands.activation_id = EXCLUDED.activation_id
       AND phase1_shadow_demands.intake_id = EXCLUDED.intake_id
       AND phase1_shadow_demands.shadow_run_id = EXCLUDED.shadow_run_id
       AND phase1_shadow_demands.prompt_set_id = EXCLUDED.prompt_set_id
       AND phase1_shadow_demands.prompt_id = EXCLUDED.prompt_id
       AND phase1_shadow_demands.prompt_slot = EXCLUDED.prompt_slot
       AND phase1_shadow_demands.surface_key = EXCLUDED.surface_key
       AND phase1_shadow_demands.daily_bucket = EXCLUDED.daily_bucket
       AND phase1_shadow_demands.contract_version = EXCLUDED.contract_version
       AND phase1_shadow_demands.plan_code = EXCLUDED.plan_code
       AND phase1_shadow_demands.customer_visible = FALSE
       AND phase1_shadow_demands.billing_enabled = FALSE
       AND phase1_shadow_demands.external_transport_enabled = FALSE
     RETURNING id, idempotency_key, prompt_id, prompt_slot, surface_key, status`,
    [
      intake.id,
      intake.activation_id,
      intake.shadow_run_id,
      activation.prompt_set_id,
      intake.daily_bucket_text || isoDay(intake.daily_bucket, 'daily_bucket'),
      PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
      validationDetails,
      JSON.stringify(demandRows)
    ]
  );
  if (inserted.rows.length !== 132) {
    const error = new Error(`Phase 1 shadow demand idempotency conflict: expected 132 rows, got ${inserted.rows.length}`);
    error.code = 'phase1_shadow_demand_idempotency_conflict';
    throw error;
  }

  const shadowRunResult = await client.query(
    `UPDATE phase1_shadow_runs
        SET status = 'completed',
            started_at = COALESCE(started_at, NOW()),
            finished_at = COALESCE(finished_at, NOW()),
            run_payload = run_payload || $2::jsonb,
            updated_at = NOW()
      WHERE id = $1
        AND activation_id = $3
        AND customer_id = $4
        AND brand_id = $5
        AND prompt_set_id = $6
        AND contract_version = $7
        AND plan_code = 'starter'
        AND daily_bucket = $8::date
        AND provider_mode = 'mock'
        AND monitoring_timezone = 'UTC'
        AND customer_visible = FALSE
        AND billing_enabled = FALSE
        AND external_transport_enabled = FALSE
      RETURNING id, status`,
    [
      intake.shadow_run_id,
      JSON.stringify({
        shadow_fanout_contract_version: PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
        shadow_demand_count: 132,
        shadow_execution_mode: 'internal_validation_only',
        terminal_without_collection_transport: true,
        customer_visible: false,
        billing_enabled: false,
        external_transport_enabled: false
      }),
      intake.activation_id,
      intake.customer_id,
      intake.brand_id,
      activation.prompt_set_id,
      PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
      intake.daily_bucket_text || isoDay(intake.daily_bucket, 'daily_bucket')
    ]
  );
  if (!shadowRunResult.rows[0]) throw new Error('Phase 1 shadow run is missing or not transport-disarmed');

  return Object.freeze({
    operation: 'phase1_shadow_fan_out',
    status: 'shadow_fanned_out',
    shadow_run_id: intake.shadow_run_id,
    prompt_count: 44,
    surface_count: 3,
    demand_count: 132,
    customer_visible: false,
    billing_enabled: false,
    external_transport_enabled: false
  });
}

const DEFAULT_OPERATIONS = Object.freeze({ fanOutPhase1ShadowIntake });

async function markIntakeCompleted(client, intake) {
  const result = await client.query(
    `UPDATE phase1_tracking_intake
        SET status = 'completed',
            lease_owner = NULL,
            lease_token = NULL,
            lease_until = NULL,
            last_error_code = NULL,
            last_error_details = '{}'::jsonb,
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
      WHERE id = $1
        AND status = 'leased'
        AND lease_owner = $2
        AND lease_token = $3
        AND lease_fencing_token = $4
      RETURNING *`,
    [intake.id, intake.lease_owner, intake.lease_token, intake.lease_fencing_token]
  );
  if (!result.rows[0]) throw new Error('Phase 1 intake completion was fenced');
  return result.rows[0];
}

async function markIntakeFailure(client, intake, { maxAttempts, retryDelaySeconds, error }) {
  const failure = safeError(error);
  const exhausted = Number(intake.attempt_count) >= maxAttempts;
  const nextStatus = exhausted ? 'dead_letter' : 'retry_wait';
  const result = await client.query(
    `UPDATE phase1_tracking_intake
        SET status = $5,
            available_at = CASE
              WHEN $5 = 'retry_wait'
                THEN clock_timestamp() + ($6 * INTERVAL '1 second')
              ELSE available_at
            END,
            lease_owner = NULL,
            lease_token = NULL,
            lease_until = NULL,
            last_error_code = $7,
            last_error_details = $8::jsonb,
            updated_at = NOW()
      WHERE id = $1
        AND status = 'leased'
        AND lease_owner = $2
        AND lease_token = $3
        AND lease_fencing_token = $4
      RETURNING *`,
    [
      intake.id,
      intake.lease_owner,
      intake.lease_token,
      intake.lease_fencing_token,
      nextStatus,
      retryDelaySeconds,
      failure.code,
      JSON.stringify(failure.details)
    ]
  );
  if (!result.rows[0]) throw new Error('Phase 1 intake failure transition was fenced');
  return { intake: result.rows[0], status: exhausted ? 'dead_letter' : 'retry_scheduled', failure };
}

/**
 * Consume one PostgreSQL-backed scheduler intake.  Fan-out and commit-as-ACK
 * happen in the same transaction, so a crash cannot lose the shadow run or
 * acknowledge it before its durable demands exist.
 */
export async function runPhase1IntakeCycle(
  {
    pool = defaultPool,
    config = getConfig(),
    workerId = `phase1-intake-worker:${process.pid}`
  } = {},
  operations = DEFAULT_OPERATIONS
) {
  if (config.phase1DurableQueueWorkerEnabled !== true) {
    return disabled('worker_process_feature_flag_disabled');
  }
  const leaseMs = positiveInteger(config.phase1LeaseMs, 'phase1LeaseMs');
  const maxAttempts = positiveInteger(config.phase1IntakeMaxAttempts ?? 3, 'phase1IntakeMaxAttempts');
  const retryDelayMs = positiveInteger(config.phase1IntakeRetryDelayMs ?? 30000, 'phase1IntakeRetryDelayMs');
  const leaseSeconds = Math.max(1, Math.ceil(leaseMs / 1000));
  const retryDelaySeconds = Math.max(1, Math.ceil(retryDelayMs / 1000));

  return withTransaction({ pool }, async (client) => {
    const gate = await readIntakeGate(client);
    if (!gate.enabled) return disabled(gate.reason);

    const intake = await claimIntake(client, { workerId, leaseSeconds });
    if (!intake) {
      return Object.freeze({ operation: 'phase1_intake_cycle', enabled: true, status: 'idle' });
    }

    await client.query('SAVEPOINT phase1_intake_fanout');
    try {
      assertShadowIntake(intake);
      const fanout = await operations.fanOutPhase1ShadowIntake({ client, intake });
      if (fanout?.operation !== 'phase1_shadow_fan_out' || fanout?.status !== 'shadow_fanned_out') {
        const error = new Error(`Phase 1 fan-out did not complete: ${fanout?.reason || fanout?.status || 'unknown'}`);
        error.code = 'phase1_intake_fanout_incomplete';
        throw error;
      }
      const completed = await markIntakeCompleted(client, intake);
      await client.query('RELEASE SAVEPOINT phase1_intake_fanout');
      return Object.freeze({
        operation: 'phase1_intake_cycle',
        enabled: true,
        status: 'processed',
        phase1_tracking_intake_id: completed.id,
        shadow_run_id: completed.shadow_run_id,
        fanout
      });
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT phase1_intake_fanout');
      await client.query('RELEASE SAVEPOINT phase1_intake_fanout');
      if (RETRYABLE_TRANSACTION_CODES.has(error?.code)) throw error;
      const failed = await markIntakeFailure(client, intake, {
        maxAttempts,
        retryDelaySeconds,
        error
      });
      return Object.freeze({
        operation: 'phase1_intake_cycle',
        enabled: true,
        status: failed.status,
        phase1_tracking_intake_id: failed.intake.id,
        shadow_run_id: failed.intake.shadow_run_id,
        error_code: failed.failure.code
      });
    }
  });
}
