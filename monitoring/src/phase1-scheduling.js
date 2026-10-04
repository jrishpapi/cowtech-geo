import { pool as defaultPool } from './db.js';
import {
  addPhase1UtcDays,
  PHASE1_SHADOW_PLAN_CONTRACT,
  PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
  buildPhase1ShadowContractSnapshot,
  buildPhase1TrackingRunKey,
  phase1UtcDay,
  resolvePhase1Cycle,
  validatePhase1ShadowActivation,
  validatePhase1ShadowGate
} from './phase1-activation.js';

export const PHASE1_INTAKE_WAKEUP_CHANNEL = 'avgl:phase1:shadow-intake:wakeup';

const RETRYABLE_TRANSACTION_CODES = new Set(['40001', '40P01']);
const DEFAULT_TRANSACTION_MAX_RETRIES = 3;
const DEFAULT_TRANSACTION_RETRY_DELAY_MS = 10;
const MAX_TRANSACTION_RETRY_DELAY_MS = 250;

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError(`${name} must be a positive integer`);
  return number;
}

function boundedNonNegativeInteger(value, name, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) {
    throw new TypeError(`${name} must be an integer between 0 and ${maximum}`);
  }
  return number;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactError(error) {
  return {
    code: error?.code || 'phase1_scheduler_wakeup_failed',
    message: String(error?.message || error || 'unknown wakeup error').slice(0, 500)
  };
}

function postgresDateText(value, name) {
  let day;
  if (typeof value === 'string') {
    day = value.slice(0, 10);
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // node-postgres parses DATE as local midnight.  Reading the local calendar
    // fields preserves the database day; toISOString() can move it backwards.
    day = [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  } else {
    throw new TypeError(`${name} must be a PostgreSQL DATE value`);
  }
  return phase1UtcDay(`${day}T00:00:00.000Z`);
}

async function readShadowGate(client) {
  const result = await client.query(
    `SELECT *
       FROM phase1_feature_flags
      WHERE scope_key = 'global'
      FOR SHARE`
  );
  return validatePhase1ShadowGate(result.rows[0]);
}

async function lockNextDueActivation(client, today) {
  const result = await client.query(
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
      WHERE activation.status = 'shadow'
        AND customer.tenant_class = 'internal_canary'
        AND activation.next_bucket_date <= $1::date
      ORDER BY activation.next_bucket_date ASC, activation.id ASC
      FOR UPDATE OF activation SKIP LOCKED
      LIMIT 1`,
    [today]
  );
  return result.rows[0] || null;
}

function buildRunPayload(activation, cycle, scheduledFor, contractSnapshot) {
  return {
    source: 'phase1_shadow_scheduler',
    phase1_activation_id: activation.id,
    contract_version: PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
    activation_state: PHASE1_SHADOW_PLAN_CONTRACT.activation_state,
    durable_intake: true,
    provider_mode: 'mock',
    scheduled_for: scheduledFor,
    daily_bucket: cycle.daily_bucket,
    cycle_anchor_date: activation.cycle_anchor_date,
    cycle_start: cycle.cycle_start,
    cycle_end: cycle.cycle_end,
    cycle_number: cycle.cycle_number,
    bucket_index: cycle.bucket_index,
    monitoring_timezone: 'UTC',
    region: activation.region,
    language: activation.language,
    device: activation.device,
    customer_visible: false,
    billing_enabled: false,
    external_transport_enabled: false,
    contract_snapshot: contractSnapshot
  };
}

async function ensureShadowRun(client, activation, cycle, scheduledFor, contractSnapshot, runPayload) {
  const idempotencyKey = buildPhase1TrackingRunKey({
    activation_id: activation.id,
    brand_id: activation.brand_id,
    contract_version: activation.contract_version,
    daily_bucket: cycle.daily_bucket
  });
  const inserted = await client.query(
    `INSERT INTO phase1_shadow_runs (
       activation_id, customer_id, brand_id, prompt_set_id,
       contract_version, plan_code, daily_bucket, status, idempotency_key,
       provider_mode, scheduled_for, monitoring_timezone, region, language, device,
       customer_visible, billing_enabled, external_transport_enabled,
       contract_snapshot, run_payload
     ) VALUES (
       $1, $2, $3, $4,
       $5, 'starter', $6, 'queued', $7,
       'mock', $8, 'UTC', $9, $10, $11,
       FALSE, FALSE, FALSE,
       $12::jsonb, $13::jsonb
     )
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      activation.id,
      activation.customer_id,
      activation.brand_id,
      activation.prompt_set_id,
      activation.contract_version,
      cycle.daily_bucket,
      idempotencyKey,
      scheduledFor,
      activation.region,
      activation.language,
      activation.device,
      JSON.stringify(contractSnapshot),
      JSON.stringify(runPayload)
    ]
  );
  if (inserted.rows[0]) return { run: inserted.rows[0], created: true, idempotency_key: idempotencyKey };

  const existing = await client.query(
    `SELECT *, daily_bucket::text AS daily_bucket_text
       FROM phase1_shadow_runs
      WHERE idempotency_key = $1
      FOR UPDATE`,
    [idempotencyKey]
  );
  const run = existing.rows[0];
  if (!run) throw new Error('Phase 1 shadow run idempotency row disappeared');
  if (
    run.activation_id !== activation.id ||
    run.customer_id !== activation.customer_id ||
    run.brand_id !== activation.brand_id ||
    run.prompt_set_id !== activation.prompt_set_id ||
    run.contract_version !== activation.contract_version ||
    run.plan_code !== 'starter' ||
    (run.daily_bucket_text || postgresDateText(run.daily_bucket, 'daily_bucket')) !== cycle.daily_bucket ||
    run.provider_mode !== 'mock' ||
    run.monitoring_timezone !== 'UTC' ||
    run.customer_visible === true ||
    run.billing_enabled === true ||
    run.external_transport_enabled === true
  ) {
    throw new Error('Phase 1 shadow run idempotency conflict has incompatible immutable fields');
  }
  return { run, created: false, idempotency_key: idempotencyKey };
}

async function ensureIntake(client, activation, cycle, scheduledFor, contractSnapshot, runPayload, shadowRun) {
  const inserted = await client.query(
    `INSERT INTO phase1_tracking_intake (
       activation_id, shadow_run_id, customer_id, brand_id, prompt_set_id,
       contract_version, plan_code, daily_bucket, cycle_start, cycle_end,
       cycle_number, bucket_index, scheduled_for, monitoring_timezone,
       status, customer_visible, billing_enabled, external_transport_enabled,
       contract_snapshot, run_payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'starter', $7, $8, $9,
       $10, $11, $12, 'UTC', 'queued', FALSE, FALSE, FALSE,
       $13::jsonb, $14::jsonb
     )
     ON CONFLICT (activation_id, daily_bucket) DO NOTHING
     RETURNING *`,
    [
      activation.id,
      shadowRun.id,
      activation.customer_id,
      activation.brand_id,
      activation.prompt_set_id,
      activation.contract_version,
      cycle.daily_bucket,
      cycle.cycle_start,
      cycle.cycle_end,
      cycle.cycle_number,
      cycle.bucket_index,
      scheduledFor,
      JSON.stringify(contractSnapshot),
      JSON.stringify(runPayload)
    ]
  );
  if (inserted.rows[0]) return { intake: inserted.rows[0], created: true };

  const existing = await client.query(
    `SELECT *
       FROM phase1_tracking_intake
      WHERE activation_id = $1 AND daily_bucket = $2
      FOR UPDATE`,
    [activation.id, cycle.daily_bucket]
  );
  const intake = existing.rows[0];
  if (!intake) throw new Error('Phase 1 scheduler intake idempotency row disappeared');
  if (
    intake.shadow_run_id !== shadowRun.id ||
    intake.prompt_set_id !== activation.prompt_set_id ||
    intake.contract_version !== activation.contract_version
  ) {
    throw new Error('Phase 1 scheduler intake idempotency conflict has incompatible immutable fields');
  }
  return { intake, created: false };
}

async function scheduleOnePhase1ShadowIntakeAttempt({ database, today }) {
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const gate = await readShadowGate(client);
    if (!gate.enabled) {
      await client.query('COMMIT');
      return { status: 'disabled', reason: gate.reason };
    }

    const rawActivation = await lockNextDueActivation(client, today);
    if (!rawActivation) {
      await client.query('COMMIT');
      return { status: 'idle', reason: 'no_due_shadow_activation' };
    }
    const activation = {
      ...rawActivation,
      cycle_anchor_date: postgresDateText(rawActivation.cycle_anchor_date, 'cycle_anchor_date'),
      next_bucket_date: postgresDateText(rawActivation.next_bucket_date, 'next_bucket_date'),
      last_scheduled_bucket: rawActivation.last_scheduled_bucket == null
        ? null
        : postgresDateText(rawActivation.last_scheduled_bucket, 'last_scheduled_bucket')
    };
    validatePhase1ShadowActivation(activation);

    const dailyBucket = activation.next_bucket_date;
    const cycle = resolvePhase1Cycle({
      cycle_anchor_date: activation.cycle_anchor_date,
      daily_bucket: dailyBucket
    });
    const scheduledFor = `${dailyBucket}T00:00:00.000Z`;
    const contractSnapshot = buildPhase1ShadowContractSnapshot(
      {
        ...activation,
        cycle_anchor_date: activation.cycle_anchor_date,
        next_bucket_date: dailyBucket
      },
      cycle
    );
    const runPayload = buildRunPayload(activation, cycle, scheduledFor, contractSnapshot);
    const shadow = await ensureShadowRun(
      client,
      activation,
      cycle,
      scheduledFor,
      contractSnapshot,
      runPayload
    );
    const intake = await ensureIntake(
      client,
      activation,
      cycle,
      scheduledFor,
      contractSnapshot,
      runPayload,
      shadow.run
    );
    const nextBucket = addPhase1UtcDays(dailyBucket, 1);
    const advanced = await client.query(
      `UPDATE phase1_tenant_activations
          SET last_scheduled_bucket = $2,
              next_bucket_date = $3,
              updated_at = NOW()
        WHERE id = $1
          AND status = 'shadow'
          AND next_bucket_date = $2
        RETURNING *`,
      [activation.id, dailyBucket, nextBucket]
    );
    if (!advanced.rows[0]) throw new Error('Phase 1 tenant activation cursor advance failed');
    await client.query('COMMIT');
    return {
      status: 'scheduled',
      activation_id: activation.id,
      customer_id: activation.customer_id,
      brand_id: activation.brand_id,
      shadow_run_id: shadow.run.id,
      intake_id: intake.intake.id,
      daily_bucket: dailyBucket,
      cycle_start: cycle.cycle_start,
      cycle_end: cycle.cycle_end,
      cycle_number: cycle.cycle_number,
      bucket_index: cycle.bucket_index,
      shadow_run_created: shadow.created,
      intake_created: intake.created
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original scheduling error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function scheduleOnePhase1ShadowIntake({
  database,
  today,
  transactionMaxRetries,
  transactionRetryDelayMs,
  sleepFn
}) {
  const maxRetries = boundedNonNegativeInteger(
    transactionMaxRetries,
    'transaction_max_retries',
    5
  );
  const baseDelayMs = boundedNonNegativeInteger(
    transactionRetryDelayMs,
    'transaction_retry_delay_ms',
    MAX_TRANSACTION_RETRY_DELAY_MS
  );
  if (typeof sleepFn !== 'function') throw new TypeError('sleep_fn must be a function');

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      // Each attempt owns a newly acquired client. PostgreSQL requires a fresh
      // transaction after a serialization failure or deadlock.
      return await scheduleOnePhase1ShadowIntakeAttempt({ database, today });
    } catch (error) {
      const retryable = RETRYABLE_TRANSACTION_CODES.has(error?.code);
      if (!retryable || attempt === maxRetries) throw error;
      const retryDelayMs = Math.min(
        baseDelayMs * (2 ** attempt),
        MAX_TRANSACTION_RETRY_DELAY_MS
      );
      if (retryDelayMs > 0) await sleepFn(retryDelayMs);
    }
  }

  throw new Error('Phase 1 scheduler transaction retry loop exhausted unexpectedly');
}

async function publishOptionalWakeup({ database, redis, channel, scheduled }) {
  if (!redis) return { attempted: false, delivered: false, error: null };
  try {
    await redis.publish(
      channel,
      JSON.stringify({
        schema_version: 'phase1-shadow-intake-wakeup-v1',
        intake_id: scheduled.intake_id,
        shadow_run_id: scheduled.shadow_run_id,
        daily_bucket: scheduled.daily_bucket
      })
    );
    if (typeof database.query === 'function') {
      await database.query(
        `UPDATE phase1_tracking_intake SET redis_wakeup_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [scheduled.intake_id]
      );
    }
    return { attempted: true, delivered: true, error: null };
  } catch (error) {
    return { attempted: true, delivered: false, error: compactError(error) };
  }
}

/**
 * Create durable Phase 1 shadow intake only.  It never calls a provider, never
 * writes customer credit, and never falls back to the legacy scheduler.  Redis
 * publish is an optional best-effort wakeup after the PostgreSQL commit; the
 * durable intake row remains the queue truth.
 */
export async function schedulePhase1ShadowIntake({
  pool = defaultPool,
  redis = null,
  now = new Date(),
  max_intakes = 100,
  wakeup_channel = PHASE1_INTAKE_WAKEUP_CHANNEL,
  transaction_max_retries = DEFAULT_TRANSACTION_MAX_RETRIES,
  transaction_retry_delay_ms = DEFAULT_TRANSACTION_RETRY_DELAY_MS,
  sleep_fn = sleep
} = {}) {
  const today = phase1UtcDay(now);
  const limit = positiveInteger(max_intakes, 'max_intakes');
  const scheduled = [];
  let terminal = null;

  for (let index = 0; index < limit; index += 1) {
    const result = await scheduleOnePhase1ShadowIntake({
      database: pool,
      today,
      transactionMaxRetries: transaction_max_retries,
      transactionRetryDelayMs: transaction_retry_delay_ms,
      sleepFn: sleep_fn
    });
    if (result.status !== 'scheduled') {
      terminal = result;
      break;
    }
    const wakeup = await publishOptionalWakeup({
      database: pool,
      redis,
      channel: wakeup_channel,
      scheduled: result
    });
    scheduled.push({ ...result, redis_wakeup: wakeup });
  }

  if (terminal?.status === 'disabled') {
    return Object.freeze({
      mode: 'phase1_shadow_intake',
      status: 'disabled',
      reason: terminal.reason,
      scheduled: Object.freeze([]),
      scheduled_count: 0
    });
  }
  return Object.freeze({
    mode: 'phase1_shadow_intake',
    status: scheduled.length ? 'scheduled' : 'idle',
    reason: terminal?.reason || (scheduled.length === limit ? 'batch_limit_reached' : null),
    scheduled: Object.freeze(scheduled),
    scheduled_count: scheduled.length,
    batch_limit: limit,
    as_of_day: today
  });
}
