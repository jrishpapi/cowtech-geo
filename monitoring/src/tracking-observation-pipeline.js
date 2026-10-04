import {
  FROZEN_OBSERVATION_CONTRACT_VERSION,
  FROZEN_PLAN_CONTRACTS,
  FROZEN_PLAN_CONTRACT_VERSION,
  STANDARD_SURFACES
} from './poc/frozen-observation-contract.js';
import {
  PHASE1_SHADOW_PLAN_CONTRACT_VERSION,
  validatePhase1ShadowActivation
} from './phase1-activation.js';
import { withTransaction } from './db-transaction.js';
import { ensureObservationCreditAccount, reserveObservationCredit } from './observation-ledger.js';
import { buildCollectionKey, buildObservationDemandKey, sha256Hex } from './observation-identity.js';
import { enqueuePhase1DownstreamCompletion } from './phase1-downstream-outbox.js';

const SUPPORTED_DEVICES = new Set(['desktop', 'mobile', 'tablet']);
const TERMINAL_COLLECTION_TASK_STATUSES = new Set(['completed', 'unavailable', 'dead_letter']);

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function transactionOptions({ pool, client }) {
  return client ? { client } : pool ? { pool } : {};
}

function parseInstant(value, name) {
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return instant;
}

function parseIsoDay(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${name} must be a real calendar date`);
  }
  return parsed;
}

function addUtcDays(day, amount) {
  const date = parseIsoDay(day, 'day');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function normalizeRegion(value) {
  const normalized = String(value || 'US').trim().toUpperCase();
  if (!normalized) throw new TypeError('region must be a non-empty string');
  return normalized;
}

function normalizeLanguage(value) {
  const normalized = String(value || 'en').trim().toLowerCase();
  if (!normalized) throw new TypeError('language must be a non-empty string');
  return normalized;
}

function normalizeDevice(value) {
  const normalized = String(value || 'desktop').trim().toLowerCase();
  if (!SUPPORTED_DEVICES.has(normalized)) {
    throw new RangeError(`unsupported observation device: ${value}`);
  }
  return normalized;
}

function assertUtcMonitoringTimezone(value) {
  const timezone = String(value || 'UTC').trim();
  if (timezone !== 'UTC') {
    throw new RangeError('Phase 1 fan-out currently requires monitoring_timezone=UTC');
  }
  return timezone;
}

function disabledResult(operation, reason) {
  return Object.freeze({ operation, enabled: false, status: 'disabled', reason });
}

async function readFeatureGate(client, capability) {
  const result = await client.query(
    `SELECT *
       FROM phase1_feature_flags
      WHERE scope_key = 'global'
      FOR SHARE`
  );
  const flags = result.rows[0];
  if (!flags) return { enabled: false, reason: 'phase1_feature_flags_missing' };

  const enabled =
    flags.observation_pipeline_enabled === true &&
    flags.contract_v2_enabled === true &&
    flags[capability] === true;
  if (!enabled) return { enabled: false, reason: 'database_feature_flags_disabled' };

  if (
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true
  ) {
    throw new Error('Phase 1 observation orchestration requires live, paid, and external-spend flags to remain disabled');
  }
  return { enabled: true, flags };
}

function planSnapshot({ planCode, plan, surface, cycleStart, cycleEnd, monitoringTimezone }) {
  return Object.freeze({
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    activation_state: plan.activation_state,
    plan_code: planCode,
    prompt_slots: plan.prompt_slots,
    cadence: plan.cadence,
    cycle_days: plan.cycle_days,
    plan_surfaces: [...plan.surfaces],
    surface,
    base_credits: plan.base_credits,
    flexible_credits: plan.flexible_credits,
    total_credits: plan.total_credits,
    surface_base_credit_limit: plan.prompt_slots * plan.cycle_days,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    monitoring_timezone: monitoringTimezone
  });
}

async function lockTrackingContext(client, trackingRunId) {
  const result = await client.query(
    `SELECT tr.*,
            b.customer_id,
            b.locale AS brand_locale,
            c.plan_code
       FROM tracking_runs tr
       JOIN brands b ON b.id = tr.brand_id
       JOIN customers c ON c.id = b.customer_id
      WHERE tr.id = $1
      FOR UPDATE OF tr`,
    [trackingRunId]
  );
  if (!result.rows[0]) throw new Error(`tracking run not found: ${trackingRunId}`);
  return result.rows[0];
}

async function assertShadowRunCannotEnterBillableFanout(client, run) {
  const isShadowRun =
    run.run_type === 'phase1_shadow' ||
    run.run_payload?.contract_version === PHASE1_SHADOW_PLAN_CONTRACT_VERSION;
  if (!isShadowRun) return;

  const result = await client.query(
    `SELECT activation.*,
            activation.cycle_anchor_date::text AS cycle_anchor_date,
            activation.next_bucket_date::text AS next_bucket_date,
            activation.last_scheduled_bucket::text AS last_scheduled_bucket,
            customer.status AS customer_status,
            customer.plan_code AS customer_plan_code,
            customer.tenant_class AS customer_tenant_class,
            prompt_set.status AS prompt_set_status,
            intake.contract_version AS intake_contract_version,
            intake.customer_visible AS intake_customer_visible,
            intake.billing_enabled AS intake_billing_enabled,
            intake.external_transport_enabled AS intake_external_transport_enabled
       FROM phase1_tracking_intake AS intake
       JOIN phase1_tenant_activations AS activation ON activation.id = intake.activation_id
       JOIN customers AS customer ON customer.id = activation.customer_id
       JOIN prompt_sets AS prompt_set ON prompt_set.id = activation.prompt_set_id
      WHERE intake.tracking_run_id = $1
      FOR SHARE OF activation, intake`,
    [run.id]
  );
  const activation = result.rows[0];
  if (!activation) throw new Error('Phase 1 shadow run has no exact durable tenant activation');
  validatePhase1ShadowActivation({
    ...activation
  });
  if (
    activation.intake_contract_version !== PHASE1_SHADOW_PLAN_CONTRACT_VERSION ||
    activation.intake_customer_visible === true ||
    activation.intake_billing_enabled === true ||
    activation.intake_external_transport_enabled === true
  ) {
    throw new Error('Phase 1 shadow intake violates the exact non-billable contract');
  }
  throw new Error(
    'Phase 1 shadow run cannot enter the billable preproduction fan-out; non-billing shadow fan-out is required'
  );
}

async function loadFrozenPrompts(client, promptSetId, promptSlots) {
  if (!promptSetId) throw new Error('tracking run has no prompt set');
  const result = await client.query(
    `SELECT p.id, p.prompt_text
       FROM prompts p
      WHERE p.prompt_set_id = $1
        AND COALESCE(p.status, 'active') = 'active'
      ORDER BY p.priority DESC NULLS LAST, p.created_at ASC, p.id ASC
      LIMIT $2`,
    [promptSetId, promptSlots]
  );
  if (result.rows.length === 0) throw new Error(`active prompts not found for prompt set ${promptSetId}`);
  for (const prompt of result.rows) nonEmptyString(prompt.prompt_text, `prompt ${prompt.id} prompt_text`);
  return result.rows;
}

async function upsertCollectionTask(client, dimensions) {
  const result = await client.query(
    `INSERT INTO collection_tasks (
       collection_key, collection_root_key, normalized_prompt_hash, original_prompt_text,
       requested_surface, route, region, language, device, daily_bucket
     ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (collection_key) DO UPDATE
       SET collection_key = collection_tasks.collection_key
     WHERE collection_tasks.normalized_prompt_hash = EXCLUDED.normalized_prompt_hash
       AND collection_tasks.collection_root_key = EXCLUDED.collection_root_key
       AND collection_tasks.original_prompt_text = EXCLUDED.original_prompt_text
       AND collection_tasks.requested_surface = EXCLUDED.requested_surface
       AND collection_tasks.route = EXCLUDED.route
       AND collection_tasks.region = EXCLUDED.region
       AND collection_tasks.language = EXCLUDED.language
       AND collection_tasks.device = EXCLUDED.device
       AND collection_tasks.daily_bucket = EXCLUDED.daily_bucket
     RETURNING collection_tasks.*`,
    [
      dimensions.collection_key,
      dimensions.normalized_prompt_hash,
      dimensions.original_prompt_text,
      dimensions.requested_surface,
      dimensions.route,
      dimensions.region,
      dimensions.language,
      dimensions.device,
      dimensions.daily_bucket
    ]
  );
  if (!result.rows[0]) {
    throw new Error(`collection key collision with incompatible original prompt or dimensions: ${dimensions.collection_key}`);
  }
  const task = result.rows[0];
  if (TERMINAL_COLLECTION_TASK_STATUSES.has(task.status)) {
    throw new Error(
      `collection task ${task.id} is already terminal (${task.status}); refusing to attach a new reserved demand`
    );
  }
  return task;
}

async function upsertObservationDemand(client, demand) {
  const result = await client.query(
    `INSERT INTO observation_demands (
       demand_key, logical_demand_key, tracking_run_id, customer_id, brand_id, prompt_id,
       collection_task_id, generation_no, credit_account_id, original_prompt_text,
       normalized_prompt_hash, requested_surface, route, authentication_mode,
       region, language, device, scheduled_for, daily_bucket, demand_class,
       contract_version, observation_contract_version, entitlement_snapshot,
       addon_entitlement_snapshot
     ) VALUES (
       $1, $1, $2, $3, $4, $5, $6, $21, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, 'base', $18, $19, $20::jsonb, '{}'::jsonb
     )
     ON CONFLICT (demand_key) DO UPDATE
       SET demand_key = observation_demands.demand_key
     WHERE observation_demands.tracking_run_id = EXCLUDED.tracking_run_id
       AND observation_demands.logical_demand_key = EXCLUDED.logical_demand_key
       AND observation_demands.generation_no = EXCLUDED.generation_no
       AND observation_demands.customer_id = EXCLUDED.customer_id
       AND observation_demands.brand_id = EXCLUDED.brand_id
       AND observation_demands.prompt_id = EXCLUDED.prompt_id
       AND observation_demands.collection_task_id = EXCLUDED.collection_task_id
       AND observation_demands.credit_account_id = EXCLUDED.credit_account_id
       AND observation_demands.original_prompt_text = EXCLUDED.original_prompt_text
       AND observation_demands.normalized_prompt_hash = EXCLUDED.normalized_prompt_hash
       AND observation_demands.requested_surface = EXCLUDED.requested_surface
       AND observation_demands.route = EXCLUDED.route
       AND observation_demands.authentication_mode = EXCLUDED.authentication_mode
       AND observation_demands.region = EXCLUDED.region
       AND observation_demands.language = EXCLUDED.language
       AND observation_demands.device = EXCLUDED.device
       AND observation_demands.scheduled_for = EXCLUDED.scheduled_for
       AND observation_demands.daily_bucket = EXCLUDED.daily_bucket
       AND observation_demands.contract_version = EXCLUDED.contract_version
       AND observation_demands.observation_contract_version = EXCLUDED.observation_contract_version
       AND observation_demands.entitlement_snapshot = EXCLUDED.entitlement_snapshot
     RETURNING observation_demands.*`,
    [
      demand.demand_key,
      demand.tracking_run_id,
      demand.customer_id,
      demand.brand_id,
      demand.prompt_id,
      demand.collection_task_id,
      demand.credit_account_id,
      demand.original_prompt_text,
      demand.normalized_prompt_hash,
      demand.requested_surface,
      demand.route,
      demand.authentication_mode,
      demand.region,
      demand.language,
      demand.device,
      demand.scheduled_for,
      demand.daily_bucket,
      FROZEN_PLAN_CONTRACT_VERSION,
      FROZEN_OBSERVATION_CONTRACT_VERSION,
      JSON.stringify(demand.entitlement_snapshot),
      Number(demand.generation_no || 1)
    ]
  );
  if (!result.rows[0]) {
    throw new Error(`demand key collision with incompatible immutable fields: ${demand.demand_key}`);
  }
  return result.rows[0];
}

/**
 * Atomically expand one tracking run into tenant-scoped credit demands and
 * exact-key-coalesced physical collection tasks. This function performs no
 * supplier or network transport.
 */
export async function fanOutTrackingRun({
  pool,
  client,
  tracking_run_id,
  scheduled_for,
  cycle_start,
  device = 'desktop',
  monitoring_timezone = 'UTC',
  enabled = false
} = {}) {
  const trackingRunId = nonEmptyString(tracking_run_id, 'tracking_run_id');
  if (enabled !== true) return disabledResult('fan_out', 'process_feature_flag_disabled');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const gate = await readFeatureGate(tx, 'tracking_fanout_enabled');
    if (!gate.enabled) return disabledResult('fan_out', gate.reason);

    const run = await lockTrackingContext(tx, trackingRunId);
    await assertShadowRunCannotEnterBillableFanout(tx, run);
    const plan = FROZEN_PLAN_CONTRACTS[run.plan_code];
    if (!plan) {
      throw new Error(`tracking run customer is not entitled to frozen plan v2: ${run.plan_code || '<missing>'}`);
    }
    // The frozen Phase 0 registry is intentionally a pricing/reference
    // contract only. Every current entry is preproduction-gate-locked; boolean
    // database flags must never be able to promote it into a billable contract.
    // A future customer path needs a new, explicitly active production
    // contract registry/version before this legacy fan-out can be enabled.
    if (plan.activation_state !== 'production_active') {
      const error = new Error(
        `tracking run plan contract is not production-active: ${plan.activation_state || '<missing>'}`
      );
      error.code = 'legacy_plan_contract_not_active';
      throw error;
    }

    const scheduledAt = parseInstant(scheduled_for, 'scheduled_for');
    const scheduledFor = scheduledAt.toISOString();
    const dailyBucket = scheduledFor.slice(0, 10);
    const cycleStartDate = parseIsoDay(cycle_start, 'cycle_start');
    const cycleStart = cycleStartDate.toISOString().slice(0, 10);
    const cycleEnd = addUtcDays(cycleStart, plan.cycle_days - 1);
    if (dailyBucket < cycleStart || dailyBucket > cycleEnd) {
      throw new RangeError(`scheduled_for bucket ${dailyBucket} is outside monitoring cycle ${cycleStart}..${cycleEnd}`);
    }

    const observationDevice = normalizeDevice(device);
    const monitoringTimezone = assertUtcMonitoringTimezone(monitoring_timezone);
    const region = normalizeRegion(run.region);
    const language = normalizeLanguage(run.language || run.brand_locale);
    const prompts = await loadFrozenPrompts(tx, run.prompt_set_id, plan.prompt_slots);
    const fanoutKey = `phase1:${sha256Hex(
      JSON.stringify({ tracking_run_id: trackingRunId, contract_version: FROZEN_PLAN_CONTRACT_VERSION, daily_bucket: dailyBucket })
    )}`;

    if (run.observation_fanout_idempotency_key && run.observation_fanout_idempotency_key !== fanoutKey) {
      throw new Error('tracking run was already fanned out with a different immutable schedule');
    }

    let demandCount = 0;
    const collectionKeys = new Set();
    const plannedCollections = new Map();

    // Preflight every physical task before creating a tenant credit account,
    // demand, or reservation. The no-op conflict update takes a row lock, so a
    // concurrent finalizer either sees this demand in the same task generation
    // or commits first and makes this fan-out fail atomically.
    for (const surfaceKey of plan.surfaces) {
      const surface = STANDARD_SURFACES[surfaceKey];
      if (!surface) throw new Error(`frozen plan references unsupported surface: ${surfaceKey}`);
      const plannedForSurface = [];
      for (const prompt of prompts) {
        const identity = buildCollectionKey({
          prompt_text: prompt.prompt_text,
          surface: surfaceKey,
          region,
          language,
          device: observationDevice,
          daily_bucket: dailyBucket
        });
        const collectionTask = await upsertCollectionTask(tx, {
          collection_key: identity.collection_key,
          normalized_prompt_hash: identity.normalized_prompt_hash,
          original_prompt_text: prompt.prompt_text,
          requested_surface: surfaceKey,
          route: surface.route,
          region,
          language,
          device: observationDevice,
          daily_bucket: dailyBucket
        });
        collectionKeys.add(collectionTask.collection_key);
        plannedForSurface.push({ prompt, identity, collectionTask });
      }
      plannedCollections.set(surfaceKey, plannedForSurface);
    }

    for (const surfaceKey of plan.surfaces) {
      const surface = STANDARD_SURFACES[surfaceKey];
      const entitlementSnapshot = planSnapshot({
        planCode: run.plan_code,
        plan,
        surface: surfaceKey,
        cycleStart,
        cycleEnd,
        monitoringTimezone
      });
      const creditAccountResult = await ensureObservationCreditAccount({
        client: tx,
        customer_id: run.customer_id,
        contract_version: FROZEN_PLAN_CONTRACT_VERSION,
        entitlement_key: `${run.plan_code}:base:${cycleStart}`,
        surface_key: surfaceKey,
        credit_class: 'base',
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        limit_units: plan.prompt_slots * plan.cycle_days,
        entitlement_snapshot: entitlementSnapshot
      });
      const creditAccount = creditAccountResult.account;

      for (const { prompt, identity, collectionTask } of plannedCollections.get(surfaceKey)) {
        const demandKey = buildObservationDemandKey({
          customer_id: run.customer_id,
          brand_id: run.brand_id,
          tracking_run_id: trackingRunId,
          prompt_id: prompt.id,
          collection_key: identity.collection_key,
          contract_version: FROZEN_PLAN_CONTRACT_VERSION
        });
        const demand = await upsertObservationDemand(tx, {
          demand_key: demandKey,
          tracking_run_id: trackingRunId,
          customer_id: run.customer_id,
          brand_id: run.brand_id,
          prompt_id: prompt.id,
          collection_task_id: collectionTask.id,
          generation_no: Number(collectionTask.generation_no || 1),
          credit_account_id: creditAccount.id,
          original_prompt_text: prompt.prompt_text,
          normalized_prompt_hash: identity.normalized_prompt_hash,
          requested_surface: surfaceKey,
          route: surface.route,
          authentication_mode: surface.authentication,
          region,
          language,
          device: observationDevice,
          scheduled_for: scheduledFor,
          daily_bucket: dailyBucket,
          entitlement_snapshot: entitlementSnapshot
        });

        await reserveObservationCredit({
          client: tx,
          credit_account_id: creditAccount.id,
          observation_demand_id: demand.id,
          units: 1,
          idempotency_key: `observation-credit:reserve:${demandKey}`,
          metadata: {
            tracking_run_id: trackingRunId,
            collection_task_id: collectionTask.id,
            contract_version: FROZEN_PLAN_CONTRACT_VERSION
          }
        });
        demandCount += 1;
      }
    }

    const update = await tx.query(
      `UPDATE tracking_runs
          SET status = CASE WHEN status = 'queued' THEN 'running' ELSE status END,
              started_at = COALESCE(started_at, NOW()),
              observation_contract_version = $2,
              observation_fanout_idempotency_key = $3,
              observation_fanout_at = COALESCE(observation_fanout_at, NOW())
        WHERE id = $1
          AND (observation_fanout_idempotency_key IS NULL OR observation_fanout_idempotency_key = $3)
        RETURNING *`,
      [trackingRunId, FROZEN_OBSERVATION_CONTRACT_VERSION, fanoutKey]
    );
    if (!update.rows[0]) throw new Error('tracking run fan-out idempotency update failed');

    return Object.freeze({
      operation: 'fan_out',
      enabled: true,
      status: 'fanned_out',
      tracking_run_id: trackingRunId,
      contract_version: FROZEN_PLAN_CONTRACT_VERSION,
      observation_contract_version: FROZEN_OBSERVATION_CONTRACT_VERSION,
      plan_code: run.plan_code,
      daily_bucket: dailyBucket,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      prompt_count: prompts.length,
      surface_count: plan.surfaces.length,
      demand_count: demandCount,
      physical_task_count: collectionKeys.size,
      fanout_idempotency_key: fanoutKey
    });
  });
}

/**
 * Complete a tracking run only after every tenant demand has reached a credit
 * terminal state. Reserved demands leave the run untouched.
 */
export async function fanInTrackingRun({ pool, client, tracking_run_id, enabled = false } = {}) {
  const trackingRunId = nonEmptyString(tracking_run_id, 'tracking_run_id');
  if (enabled !== true) return disabledResult('fan_in', 'process_feature_flag_disabled');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const gate = await readFeatureGate(tx, 'tracking_fanin_enabled');
    if (!gate.enabled) return disabledResult('fan_in', gate.reason);

    const run = await lockTrackingContext(tx, trackingRunId);
    if (!run.observation_fanout_idempotency_key) {
      throw new Error('tracking run has not been fanned out through the Phase 1 observation pipeline');
    }

    const aggregateResult = await tx.query(
      `WITH latest_demands AS (
         SELECT DISTINCT ON (logical_demand_key)
                logical_demand_key, generation_no, credit_state
           FROM observation_demands
          WHERE tracking_run_id = $1
          ORDER BY logical_demand_key, generation_no DESC, created_at DESC, id DESC
       )
       SELECT COUNT(*)::INTEGER AS total_demands,
              COUNT(*) FILTER (WHERE credit_state = 'reserved')::INTEGER AS reserved_demands,
              COUNT(*) FILTER (WHERE credit_state = 'settled')::INTEGER AS settled_demands,
              COUNT(*) FILTER (WHERE credit_state = 'released')::INTEGER AS released_demands,
              COALESCE(MAX(generation_no), 1)::INTEGER AS generation_no
         FROM latest_demands`,
      [trackingRunId]
    );
    const counts = aggregateResult.rows[0] || {};
    const totalDemands = Number(counts.total_demands || 0);
    const reservedDemands = Number(counts.reserved_demands || 0);
    const settledDemands = Number(counts.settled_demands || 0);
    const releasedDemands = Number(counts.released_demands || 0);
    const generationNo = Number(counts.generation_no || 1);

    if (totalDemands === 0 || reservedDemands > 0 || settledDemands + releasedDemands !== totalDemands) {
      return Object.freeze({
        operation: 'fan_in',
        enabled: true,
        status: 'pending',
        tracking_run_id: trackingRunId,
        total_demands: totalDemands,
        reserved_demands: reservedDemands,
        settled_demands: settledDemands,
        released_demands: releasedDemands
      });
    }

    const terminalStatus =
      releasedDemands === 0 ? 'completed' : settledDemands === 0 ? 'failed' : 'partial_failed';
    const update = await tx.query(
      `UPDATE tracking_runs
          SET status = $2,
              finished_at = COALESCE(finished_at, NOW()),
              observation_fanin_at = COALESCE(observation_fanin_at, NOW())
        WHERE id = $1
        RETURNING *`,
      [trackingRunId, terminalStatus]
    );
    if (!update.rows[0]) throw new Error(`tracking run not found during fan-in: ${trackingRunId}`);

    const downstream = await enqueuePhase1DownstreamCompletion({
      trackingRunId,
      generationNo,
      terminalStatus,
      counts: {
        total_demands: totalDemands,
        settled_demands: settledDemands,
        released_demands: releasedDemands
      }
    }, { client: tx });

    return Object.freeze({
      operation: 'fan_in',
      enabled: true,
      status: terminalStatus,
      tracking_run_id: trackingRunId,
      total_demands: totalDemands,
      reserved_demands: 0,
      settled_demands: settledDemands,
      released_demands: releasedDemands,
      downstream_outbox_id: downstream.id,
      observation_generation: generationNo
    });
  });
}
