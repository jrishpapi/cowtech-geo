import { createHash } from 'node:crypto';
import { withTransaction } from './db-transaction.js';
import {
  releaseObservationCredit,
  settleObservationCredit
} from './observation-ledger.js';
import {
  recordUnknownSupplierCost,
  settleSupplierBudget
} from './supplier-budget-ledger.js';
import {
  completeCollectionTask,
  deadLetterCollectionTask,
  markCollectionTaskUnavailable
} from './collection-queue.js';
import { scheduleObservationEvidenceRecovery } from './observation-evidence-recovery.js';
import { fanInTrackingRun } from './tracking-observation-pipeline.js';
import {
  OBSERVATION_OUTCOMES,
  resolveCreditDisposition
} from './poc/frozen-observation-contract.js';

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function jsonObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function jsonArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function optionalNonNegativeInteger(value, name) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer or null`);
  }
  return value;
}

function nonNegativeInteger(value, name) {
  const parsed = optionalNonNegativeInteger(value, name);
  if (parsed === null) throw new TypeError(`${name} is required`);
  return parsed;
}

function transactionOptions({ pool, client }) {
  return client ? { client } : pool ? { pool } : {};
}

function disabledResult(reason) {
  return Object.freeze({ operation: 'finalize_observation', enabled: false, status: 'disabled', reason });
}

function stableResultHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function comparableJson(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, canonicalize(item[key])])
      );
    }
    return item;
  };
  return JSON.stringify(canonicalize(value ?? null));
}

function assertSettlementArtifacts(disposition, manifest, artifacts) {
  if (disposition.state !== 'settled') return;
  if (artifacts.length === 0) {
    throw new Error('settled native observation requires at least one verified evidence artifact');
  }
  for (const rawArtifact of artifacts) {
    const artifact = jsonObject(rawArtifact, 'artifact');
    if (artifact.verification_status !== 'verified' || artifact.redaction_result !== 'passed') {
      throw new Error('settled native observation requires every evidence artifact to be verified and redacted');
    }
  }
  const manifestArtifact = artifacts.some((rawArtifact) => {
    const artifact = jsonObject(rawArtifact, 'artifact');
    return artifact.object_path === manifest.object_path &&
      artifact.content_sha256 === manifest.content_sha256 &&
      Number(artifact.content_size_bytes) === Number(manifest.content_size_bytes) &&
      artifact.verification_status === 'verified' &&
      artifact.redaction_result === 'passed';
  });
  if (!manifestArtifact) {
    throw new Error('settled evidence manifest must bind an exact verified artifact path, hash, and size');
  }
}

export function assertNativeSettlementProvenance(disposition, attempt, manifest, artifacts) {
  if (disposition.state !== 'settled') return;
  const expectedSupplier = attempt.acquisition_mode === 'web_ui'
    ? 'bright_data'
    : attempt.acquisition_mode === 'serpapi_aio'
      ? 'serpapi'
      : null;
  if (
    attempt.provenance_class !== 'native_supplier' ||
    !attempt.transport_started_at ||
    !expectedSupplier ||
    attempt.supplier !== expectedSupplier ||
    attempt.transport_supplier !== expectedSupplier ||
    attempt.supplier === 'phase1_mock' ||
    attempt.metadata?.synthetic === true ||
    manifest?.metadata?.synthetic === true ||
    artifacts.some((artifact) => artifact?.metadata?.synthetic === true)
  ) {
    throw new Error('native credit settlement requires a started, non-synthetic native supplier attempt');
  }
}

function assertSameResult(existing, expected) {
  const matches =
    existing.collection_task_id === expected.collection_task_id &&
    existing.final_attempt_id === expected.final_attempt_id &&
    existing.requested_surface === expected.requested_surface &&
    existing.acquisition_mode === expected.acquisition_mode &&
    existing.outcome === expected.outcome &&
    existing.answer_text === expected.answer_text &&
    comparableJson(existing.normalized_answer) === comparableJson(expected.normalized_answer) &&
    comparableJson(existing.citations) === comparableJson(expected.citations) &&
    comparableJson(existing.requested_geo) === comparableJson(expected.requested_geo) &&
    comparableJson(existing.actual_geo) === comparableJson(expected.actual_geo) &&
    existing.result_hash === expected.result_hash;
  if (!matches) throw new Error('collection task already has a different terminal observation result');
}

async function readFinalizerGate(client) {
  const result = await client.query(
    `SELECT *
       FROM phase1_feature_flags
      WHERE scope_key = 'global'
      FOR SHARE`
  );
  const flags = result.rows[0];
  if (!flags) return { enabled: false, reason: 'phase1_feature_flags_missing' };
  if (
    flags.observation_pipeline_enabled !== true ||
    flags.contract_v2_enabled !== true ||
    flags.durable_queue_enabled !== true
  ) {
    return { enabled: false, reason: 'database_feature_flags_disabled' };
  }
  if (
    flags.live_supplier_transport_enabled === true ||
    flags.paid_supplier_transport_enabled === true ||
    flags.external_spend_enabled === true
  ) {
    throw new Error('Phase 1 finalization requires live, paid, and external-spend flags to remain disabled');
  }
  return { enabled: true, flags };
}

async function lockTask(client, { taskId, leaseToken, fencingToken }) {
  const result = await client.query(
    `SELECT *
       FROM collection_tasks
      WHERE id = $1
      FOR UPDATE`,
    [taskId]
  );
  const task = result.rows[0];
  if (!task) throw new Error(`collection task not found: ${taskId}`);
  if (['completed', 'unavailable', 'dead_letter'].includes(task.status)) return task;
  const leaseMatches =
    task.status === 'leased' &&
    task.lease_token === leaseToken &&
    String(task.lease_fencing_token) === String(fencingToken) &&
    new Date(task.lease_until).getTime() > Date.now();
  if (!leaseMatches) throw new Error('collection task lease is missing, expired, or fenced');
  return task;
}

async function lockAttempt(client, { taskId, attemptId, leaseToken, fencingToken, workerId }) {
  const result = await client.query(
    `SELECT *
       FROM observation_attempts
      WHERE id = $1
        AND collection_task_id = $2
        AND lease_token = $3
        AND lease_fencing_token = $4
        AND lease_owner = $5
      FOR UPDATE`,
    [attemptId, taskId, leaseToken, fencingToken, workerId]
  );
  const attempt = result.rows[0];
  if (!attempt) throw new Error(`observation attempt is missing or fenced for collection task: ${attemptId}`);
  const mockAttemptReady =
    attempt.supplier === 'phase1_mock' && attempt.status === 'created' && !attempt.transport_started_at;
  if (!mockAttemptReady && !['transport_started', 'reconciliation_pending', 'succeeded', 'failed'].includes(attempt.status)) {
    throw new Error(`observation attempt cannot be finalized from status ${attempt.status}`);
  }
  return attempt;
}

export function normalizeEvidenceManifest(input, { task, acquisitionMode }) {
  if (!input) return null;
  const manifest = jsonObject(input, 'evidence_manifest');
  const manifestAcquisitionMode = nonEmptyString(
    manifest.acquisition_mode,
    'evidence_manifest.acquisition_mode'
  );
  if (manifestAcquisitionMode !== acquisitionMode) {
    throw new Error('evidence manifest acquisition mode does not match the result');
  }
  const requestedSurface = nonEmptyString(
    manifest.requested_surface,
    'evidence_manifest.requested_surface'
  );
  if (requestedSurface !== task.requested_surface) {
    throw new Error('evidence manifest requested surface does not match the collection task');
  }
  const requestedGeo = jsonObject(manifest.requested_geo, 'evidence_manifest.requested_geo');
  const taskRequestedGeo = {
    region: task.region,
    language: task.language,
    device: task.device
  };
  if (comparableJson(requestedGeo) !== comparableJson(taskRequestedGeo)) {
    throw new Error('evidence manifest requested geo does not exactly match the collection task');
  }
  const manifestKey = nonEmptyString(manifest.manifest_key || manifest.manifest_id, 'evidence_manifest.manifest_key');
  const verificationStatus = manifest.verification_status || (manifest.artifact_verified === true ? 'verified' : 'pending');
  return {
    manifest_key: manifestKey,
    manifest_id: manifestKey,
    acquisition_mode: manifestAcquisitionMode,
    content_sha256: nonEmptyString(manifest.content_sha256, 'evidence_manifest.content_sha256'),
    content_size_bytes: nonNegativeInteger(manifest.content_size_bytes, 'evidence_manifest.content_size_bytes'),
    object_path: nonEmptyString(manifest.object_path, 'evidence_manifest.object_path'),
    retention_class: nonEmptyString(manifest.retention_class, 'evidence_manifest.retention_class'),
    requested_surface: requestedSurface,
    requested_geo: requestedGeo,
    actual_geo: jsonObject(manifest.actual_geo, 'evidence_manifest.actual_geo'),
    adapter_version: nonEmptyString(manifest.adapter_version, 'evidence_manifest.adapter_version'),
    verification_status: verificationStatus,
    artifact_verified: manifest.artifact_verified === true,
    redaction_result: manifest.redaction_result || 'pending',
    sensitive_auth_data_present: manifest.sensitive_auth_data_present === true,
    expires_at: manifest.expires_at || null,
    metadata: jsonObject(manifest.metadata || {}, 'evidence_manifest.metadata')
  };
}

async function upsertResult(client, expected) {
  const existingResult = await client.query(
    `SELECT * FROM observation_results WHERE collection_task_id = $1 FOR UPDATE`,
    [expected.collection_task_id]
  );
  if (existingResult.rows[0]) {
    assertSameResult(existingResult.rows[0], expected);
    return { result: existingResult.rows[0], idempotent: true };
  }
  const inserted = await client.query(
    `INSERT INTO observation_results (
       collection_task_id, final_attempt_id, requested_surface, acquisition_mode,
       outcome, answer_text, normalized_answer, citations, requested_geo,
       actual_geo, adapter_version, parser_version, structured_validation_passed,
       result_hash
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb,
       $10::jsonb, $11, $12, $13, $14
     )
     RETURNING *`,
    [
      expected.collection_task_id,
      expected.final_attempt_id,
      expected.requested_surface,
      expected.acquisition_mode,
      expected.outcome,
      expected.answer_text,
      JSON.stringify(expected.normalized_answer),
      JSON.stringify(expected.citations),
      JSON.stringify(expected.requested_geo),
      expected.actual_geo ? JSON.stringify(expected.actual_geo) : null,
      expected.adapter_version,
      expected.parser_version,
      expected.structured_validation_passed,
      expected.result_hash
    ]
  );
  return { result: inserted.rows[0], idempotent: false };
}

async function upsertEvidenceManifest(client, resultId, manifest) {
  if (!manifest) return { manifest: null, idempotent: true };
  const existingResult = await client.query(
    `SELECT *
       FROM evidence_manifests
      WHERE observation_result_id = $1 OR manifest_key = $2
      ORDER BY observation_result_id = $1 DESC
      LIMIT 1
      FOR UPDATE`,
    [resultId, manifest.manifest_key]
  );
  const existing = existingResult.rows[0];
  if (existing) {
    const immutableMatches =
      existing.observation_result_id === resultId &&
      existing.manifest_key === manifest.manifest_key &&
      existing.requested_surface === manifest.requested_surface &&
      existing.acquisition_mode === manifest.acquisition_mode &&
      existing.content_sha256 === manifest.content_sha256 &&
      Number(existing.content_size_bytes) === manifest.content_size_bytes &&
      existing.object_path === manifest.object_path &&
      existing.retention_class === manifest.retention_class &&
      comparableJson(existing.requested_geo) === comparableJson(manifest.requested_geo) &&
      comparableJson(existing.actual_geo) === comparableJson(manifest.actual_geo) &&
      existing.adapter_version === manifest.adapter_version;
    if (!immutableMatches) throw new Error('evidence manifest idempotency conflict');
    if (existing.verification_status === 'verified' && manifest.verification_status !== 'verified') {
      throw new Error('verified evidence manifest cannot regress to a non-verified state');
    }
    const unchanged =
      existing.verification_status === manifest.verification_status &&
      existing.artifact_verified === manifest.artifact_verified &&
      existing.redaction_result === manifest.redaction_result &&
      existing.sensitive_auth_data_present === manifest.sensitive_auth_data_present &&
      comparableInstant(existing.expires_at) === comparableInstant(manifest.expires_at) &&
      comparableJson(existing.metadata) === comparableJson(manifest.metadata);
    if (unchanged) return { manifest: existing, idempotent: true };
    const updated = await client.query(
      `UPDATE evidence_manifests
          SET verification_status = $2,
              artifact_verified = $3,
              redaction_result = $4,
              sensitive_auth_data_present = $5,
              verified_at = CASE WHEN $2 = 'verified' THEN COALESCE(verified_at, NOW()) ELSE NULL END,
              expires_at = COALESCE($6::timestamptz, expires_at),
              metadata = metadata || $7::jsonb,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        existing.id,
        manifest.verification_status,
        manifest.artifact_verified,
        manifest.redaction_result,
        manifest.sensitive_auth_data_present,
        manifest.expires_at,
        JSON.stringify(manifest.metadata)
      ]
    );
    return { manifest: updated.rows[0], idempotent: true };
  }
  const inserted = await client.query(
    `INSERT INTO evidence_manifests (
       manifest_key, observation_result_id, requested_surface, acquisition_mode, content_sha256,
       content_size_bytes, object_path, retention_class, requested_geo, actual_geo,
       adapter_version, verification_status, artifact_verified, redaction_result,
       sensitive_auth_data_present, verified_at, expires_at, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
       $11, $12, $13, $14, $15,
       CASE WHEN $12 = 'verified' THEN NOW() ELSE NULL END,
       $16::timestamptz, $17::jsonb
     )
     RETURNING *`,
    [
      manifest.manifest_key,
      resultId,
      manifest.requested_surface,
      manifest.acquisition_mode,
      manifest.content_sha256,
      manifest.content_size_bytes,
      manifest.object_path,
      manifest.retention_class,
      JSON.stringify(manifest.requested_geo),
      JSON.stringify(manifest.actual_geo),
      manifest.adapter_version,
      manifest.verification_status,
      manifest.artifact_verified,
      manifest.redaction_result,
      manifest.sensitive_auth_data_present,
      manifest.expires_at,
      JSON.stringify(manifest.metadata)
    ]
  );
  return { manifest: inserted.rows[0], idempotent: false };
}

function comparableInstant(value) {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('artifact.retention_until must be a valid timestamp or null');
  return parsed.toISOString();
}

function assertSameArtifact(existing, expected) {
  const immutableMatches =
    existing.artifact_type === expected.artifact_type &&
    existing.object_path === expected.object_path &&
    existing.content_sha256 === expected.content_sha256 &&
    Number(existing.content_size_bytes) === expected.content_size_bytes &&
    (existing.compression || null) === expected.compression &&
    comparableInstant(existing.retention_until) === comparableInstant(expected.retention_until);
  if (!immutableMatches) throw new Error('observation artifact idempotency conflict');
  if (existing.verification_status === 'verified' && expected.verification_status !== 'verified') {
    throw new Error('verified observation artifact cannot regress to a non-verified state');
  }
  if (existing.redaction_result === 'passed' && expected.redaction_result !== 'passed') {
    throw new Error('redacted observation artifact cannot regress to a non-passed state');
  }
}

export async function upsertObservationArtifacts(client, manifestId, artifacts) {
  const rows = [];
  let idempotent = true;
  for (const rawArtifact of artifacts) {
    const artifact = jsonObject(rawArtifact, 'artifact');
    const expected = {
      artifact_type: nonEmptyString(artifact.artifact_type, 'artifact.artifact_type'),
      object_path: nonEmptyString(artifact.object_path, 'artifact.object_path'),
      content_sha256: nonEmptyString(artifact.content_sha256, 'artifact.content_sha256'),
      content_size_bytes: nonNegativeInteger(artifact.content_size_bytes, 'artifact.content_size_bytes'),
      compression: artifact.compression || null,
      verification_status: artifact.verification_status || 'pending',
      redaction_result: artifact.redaction_result || 'pending',
      retention_until: artifact.retention_until || null,
      metadata: jsonObject(artifact.metadata || {}, 'artifact.metadata')
    };
    const existingResult = await client.query(
      `SELECT *
         FROM observation_artifacts
        WHERE evidence_manifest_id = $1
          AND object_path = $2
        FOR UPDATE`,
      [manifestId, expected.object_path]
    );
    const existing = existingResult.rows[0];
    if (existing) {
      assertSameArtifact(existing, expected);
      const unchanged =
        existing.verification_status === expected.verification_status &&
        existing.redaction_result === expected.redaction_result &&
        comparableJson(existing.metadata) === comparableJson(expected.metadata);
      if (unchanged) {
        rows.push(existing);
        continue;
      }
      const updated = await client.query(
        `UPDATE observation_artifacts
            SET verification_status = $2,
                redaction_result = $3,
                metadata = metadata || $4::jsonb
          WHERE id = $1
          RETURNING *`,
        [existing.id, expected.verification_status, expected.redaction_result, JSON.stringify(expected.metadata)]
      );
      rows.push(updated.rows[0]);
      continue;
    }
    const result = await client.query(
      `INSERT INTO observation_artifacts (
         evidence_manifest_id, artifact_type, object_path, content_sha256,
         content_size_bytes, compression, verification_status, redaction_result,
         retention_until, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::jsonb)
       RETURNING *`,
      [
        manifestId,
        expected.artifact_type,
        expected.object_path,
        expected.content_sha256,
        expected.content_size_bytes,
        expected.compression,
        expected.verification_status,
        expected.redaction_result,
        expected.retention_until,
        JSON.stringify(expected.metadata)
      ]
    );
    rows.push(result.rows[0]);
    idempotent = false;
  }
  return Object.freeze({ rows: Object.freeze(rows), idempotent });
}

export async function assertSupplierCostProvidedForStartedAttempt(client, attempt, supplierCost) {
  if (!attempt.transport_started_at) return null;
  const reservationResult = await client.query(
    `SELECT id, status, transport_started_at, permit_id,
            collection_task_id, observation_attempt_id, lease_fencing_token
       FROM supplier_budget_reservations
      WHERE observation_attempt_id = $1
      `,
    [attempt.id]
  );
  const reservation = reservationResult.rows[0] || null;
  if (['bright_data', 'serpapi', 'other'].includes(attempt.supplier) && !reservation) {
    throw new Error('budgeted supplier transport cannot finalize without a durable supplier reservation');
  }
  if (reservation && !supplierCost) {
    throw new Error('supplier_cost is required for a started attempt with a supplier budget reservation');
  }
  return reservation;
}

async function finalizeAttempt(client, attempt, { outcome, details, costResolution }) {
  const terminalAttemptStatus = ['surface_unavailable', 'technical_failed'].includes(outcome) ? 'failed' : 'succeeded';
  const status = costResolution?.reservation?.status === 'reconciliation_pending'
    ? 'reconciliation_pending'
    : terminalAttemptStatus;
  const result = await client.query(
    `UPDATE observation_attempts
        SET status = $2,
            finished_at = COALESCE(finished_at, NOW()),
            latency_ms = COALESCE($3, latency_ms),
            error_taxonomy = COALESCE($4, error_taxonomy),
            error_code = COALESCE($5, error_code),
            error_details = error_details || $6::jsonb,
            local_request_bytes = COALESCE($7, local_request_bytes),
            local_response_bytes = COALESCE($8, local_response_bytes),
            vendor_billed_bytes = COALESCE($9, vendor_billed_bytes),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      attempt.id,
      status,
      details.latency_ms,
      details.error_taxonomy || null,
      details.error_code || null,
      JSON.stringify(details.error_details),
      details.local_request_bytes,
      details.local_response_bytes,
      details.vendor_billed_bytes
    ]
  );
  return result.rows[0];
}

async function resolveSupplierCost(client, supplierCost, { expectedReservation, task, attempt }) {
  if (!supplierCost) return null;
  const cost = jsonObject(supplierCost, 'supplier_cost');
  if (!expectedReservation) {
    throw new Error('supplier_cost cannot be supplied when the current attempt has no supplier reservation');
  }
  const permitId = nonEmptyString(cost.permit_id, 'supplier_cost.permit_id');
  if (String(expectedReservation.permit_id) !== permitId) {
    throw new Error('supplier_cost permit does not belong to the current observation attempt');
  }
  const common = {
    client,
    permit_id: permitId,
    permit_token: nonEmptyString(cost.permit_token, 'supplier_cost.permit_token'),
    allocation_reason: cost.allocation_reason,
    metadata: jsonObject(cost.metadata || {}, 'supplier_cost.metadata')
  };
  const resolution = cost.actual_cost_micro_usd === null || cost.actual_cost_micro_usd === undefined
    ? recordUnknownSupplierCost(common)
    : settleSupplierBudget({ ...common, actual_cost_micro_usd: cost.actual_cost_micro_usd });
  const resolved = await resolution;
  const reservation = resolved?.reservation;
  const identityMatches =
    reservation?.id === expectedReservation.id &&
    reservation?.collection_task_id === task.id &&
    reservation?.observation_attempt_id === attempt.id &&
    String(reservation?.lease_fencing_token) === String(attempt.lease_fencing_token);
  if (!identityMatches) {
    throw new Error('supplier cost resolution returned a reservation outside the current task lease');
  }
  return resolved;
}

async function writeCompatibilityProjection(client, { demand, result, attempt, costEntry, state }) {
  const completed = state === 'settled';
  await client.query(
    `INSERT INTO prompt_results (
       tracking_run_id, prompt_id, provider_id, model_id, status,
       raw_answer, normalized_answer, error_code, error_message,
       engine, region, language, observation_demand_id,
       observation_result_id, observation_idempotency_key
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9,
       $10, $11, $12, $13, $14, $15
     )
     ON CONFLICT DO NOTHING`,
    [
      demand.tracking_run_id,
      demand.prompt_id,
      attempt.supplier,
      demand.requested_surface,
      completed ? 'completed' : 'failed',
      result.answer_text,
      result.normalized_answer ? JSON.stringify(result.normalized_answer) : null,
      completed ? null : result.outcome,
      completed ? null : result.outcome,
      result.acquisition_mode,
      demand.region,
      demand.language,
      demand.id,
      result.id,
      `phase1:prompt-result:${demand.id}`
    ]
  );
  await client.query(
    `INSERT INTO usage_ledger (
       customer_id, brand_id, event_type, units, cost_estimate_usd, metadata,
       observation_demand_id, observation_attempt_id, supplier_cost_entry_id,
       observation_idempotency_key
     ) VALUES ($1, $2, $3, 1, NULL, $4::jsonb, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    [
      demand.customer_id,
      demand.brand_id,
      state === 'settled' ? 'observation_credit_settled' : 'observation_credit_released',
      JSON.stringify({
        tracking_run_id: demand.tracking_run_id,
        observation_result_id: result.id,
        outcome: result.outcome,
        requested_surface: demand.requested_surface,
        acquisition_mode: result.acquisition_mode
      }),
      demand.id,
      attempt.id,
      costEntry?.id || null,
      `phase1:usage:${demand.id}:${state}`
    ]
  );
}

/**
 * Atomically commits the physical result, evidence state, attempt finish,
 * tenant credit transitions, compatibility projections, queue ACK, and fan-in.
 * It never performs supplier transport.
 */
export async function finalizeObservationTask({
  pool,
  client,
  task_id,
  attempt_id,
  lease_token,
  fencing_token,
  actor,
  outcome,
  acquisition_mode,
  answer_text = null,
  normalized_answer = null,
  citations = [],
  requested_geo,
  actual_geo = null,
  adapter_version = null,
  parser_version = null,
  structured_validation_passed = false,
  result_hash = null,
  evidence_manifest = null,
  artifacts = [],
  attempt_details = {},
  supplier_cost = null,
  evidence_retry_delay_seconds = 60,
  enabled = false
} = {}) {
  const taskId = nonEmptyString(task_id, 'task_id');
  const attemptId = nonEmptyString(attempt_id, 'attempt_id');
  const leaseToken = nonEmptyString(lease_token, 'lease_token');
  const worker = nonEmptyString(actor, 'actor');
  const fencingToken = Number(fencing_token);
  if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0) {
    throw new TypeError('fencing_token must be a positive integer');
  }
  if (!OBSERVATION_OUTCOMES[outcome]) throw new RangeError(`unsupported observation outcome: ${outcome}`);
  const acquisitionMode = nonEmptyString(acquisition_mode, 'acquisition_mode');
  const requestedGeo = jsonObject(requested_geo, 'requested_geo');
  const actualGeo = actual_geo === null ? null : jsonObject(actual_geo, 'actual_geo');
  const normalizedAnswer = normalized_answer === null ? null : jsonObject(normalized_answer, 'normalized_answer');
  const resultCitations = jsonArray(citations, 'citations');
  const resultArtifacts = jsonArray(artifacts, 'artifacts');
  const details = jsonObject(attempt_details, 'attempt_details');
  details.error_details = jsonObject(details.error_details || {}, 'attempt_details.error_details');
  for (const field of ['latency_ms', 'local_request_bytes', 'local_response_bytes', 'vendor_billed_bytes']) {
    details[field] = optionalNonNegativeInteger(details[field], `attempt_details.${field}`);
  }
  if (enabled !== true) return disabledResult('process_feature_flag_disabled');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const gate = await readFinalizerGate(tx);
    if (!gate.enabled) return disabledResult(gate.reason);
    const task = await lockTask(tx, { taskId, leaseToken, fencingToken });
    const attempt = await lockAttempt(tx, {
      taskId,
      attemptId,
      leaseToken,
      fencingToken,
      workerId: worker
    });
    if (
      requestedGeo.region !== task.region ||
      requestedGeo.language !== task.language ||
      requestedGeo.device !== task.device
    ) {
      throw new Error('requested_geo must exactly match the collection task region, language, and device');
    }
    if (attempt.acquisition_mode !== acquisitionMode) {
      throw new Error('observation attempt acquisition mode does not match the result');
    }
    const supplierReservation = await assertSupplierCostProvidedForStartedAttempt(tx, attempt, supplier_cost);

    const manifestInput = normalizeEvidenceManifest(evidence_manifest, { task, acquisitionMode });
    const evidenceContract = manifestInput
      ? {
          manifest_id: manifestInput.manifest_id,
          content_sha256: manifestInput.content_sha256,
          artifact_verified:
            manifestInput.verification_status === 'verified' && manifestInput.artifact_verified,
          acquisition_mode: acquisitionMode,
          requested_surface: task.requested_surface,
          requested_geo: manifestInput.requested_geo,
          actual_geo: manifestInput.actual_geo,
          adapter_version: manifestInput.adapter_version,
          retention_class: manifestInput.retention_class,
          redaction_result: manifestInput.redaction_result,
          sensitive_auth_data_present: manifestInput.sensitive_auth_data_present
        }
      : undefined;
    const disposition = resolveCreditDisposition({
      outcome,
      acquisition_mode: acquisitionMode,
      evidence_manifest: evidenceContract
    });
    assertSettlementArtifacts(disposition, manifestInput, resultArtifacts);
    assertNativeSettlementProvenance(disposition, attempt, manifestInput, resultArtifacts);
    const expectedResult = {
      collection_task_id: task.id,
      final_attempt_id: attempt.id,
      requested_surface: task.requested_surface,
      acquisition_mode: acquisitionMode,
      outcome,
      answer_text,
      normalized_answer: normalizedAnswer,
      citations: resultCitations,
      requested_geo: requestedGeo,
      actual_geo: actualGeo,
      adapter_version,
      parser_version,
      structured_validation_passed: structured_validation_passed === true,
      result_hash:
        result_hash ||
        stableResultHash({
          task_id: task.id,
          attempt_id: attempt.id,
          outcome,
          acquisition_mode: acquisitionMode,
          answer_text,
          normalized_answer: normalizedAnswer,
          citations: resultCitations,
          requested_geo: requestedGeo,
          actual_geo: actualGeo
        })
    };
    const costResolution = await resolveSupplierCost(tx, supplier_cost, {
      expectedReservation: supplierReservation,
      task,
      attempt
    });
    const demandsResult = await tx.query(
      `SELECT *
         FROM observation_demands
        WHERE collection_task_id = $1
        ORDER BY id`,
      [task.id]
    );
    if (demandsResult.rows.length === 0) throw new Error('collection task has no observation demands');
    const trackingRunIds = new Set(demandsResult.rows.map((demand) => demand.tracking_run_id));

    // A native result without verified evidence is not terminal. Persisting it
    // here would consume the task's one-result slot and make a later attempt
    // conflict on final_attempt_id. Keep credit reserved, retain supplier-cost
    // accounting, and retry without creating terminal result/evidence rows.
    if (disposition.state === 'reserved') {
      for (const demand of demandsResult.rows) {
        if (demand.credit_state !== 'reserved') {
          throw new Error(`missing evidence cannot preserve terminal demand ${demand.id}`);
        }
      }
      const taskState = await scheduleObservationEvidenceRecovery({
        task,
        attempt,
        leaseToken,
        fencingToken,
        actor: worker,
        candidate: expectedResult,
        evidenceErrors: disposition.evidence_errors || [],
        delaySeconds: evidence_retry_delay_seconds,
        eventId: `evidence-${attempt.id}`
      }, { client: tx });
      const fanIn = [];
      for (const trackingRunId of [...trackingRunIds].sort()) {
        fanIn.push(await fanInTrackingRun({ client: tx, tracking_run_id: trackingRunId, enabled: true }));
      }
      return Object.freeze({
        operation: 'finalize_observation',
        enabled: true,
        status: 'evidence_pending',
        collection_task_id: task.id,
        observation_result_id: null,
        evidence_manifest_id: null,
        artifact_count: 0,
        credit: Object.freeze({ settled: 0, released: 0, reserved: demandsResult.rows.length }),
        cost_reconciliation_status: costResolution?.reservation?.status || null,
        task_status: taskState.task?.status || taskState.status,
        work_kind: taskState.task?.work_kind || 'evidence_recovery',
        fan_in: Object.freeze(fanIn),
        idempotent: false
      });
    }

    const finishedAttempt = await finalizeAttempt(tx, attempt, {
      outcome,
      details,
      costResolution
    });
    const resultWrite = await upsertResult(tx, expectedResult);
    const manifestWrite = await upsertEvidenceManifest(tx, resultWrite.result.id, manifestInput);
    const artifactWrite = manifestWrite.manifest
      ? await upsertObservationArtifacts(tx, manifestWrite.manifest.id, resultArtifacts)
      : { rows: [], idempotent: true };

    let settled = 0;
    let released = 0;
    for (const demand of demandsResult.rows) {
      if (disposition.state === 'settled') {
        const transition = await settleObservationCredit({
          client: tx,
          credit_account_id: demand.credit_account_id,
          observation_demand_id: demand.id,
          terminal_result_id: resultWrite.result.id,
          evidence_manifest_id: manifestWrite.manifest.id,
          idempotency_key: `observation-credit:settle:${demand.id}`,
          reason: disposition.reason,
          metadata: { observation_attempt_id: attempt.id }
        });
        settled += 1;
        if (gate.flags.compatibility_writes_enabled === true) {
          await writeCompatibilityProjection(tx, {
            demand: transition.demand,
            result: resultWrite.result,
            attempt: finishedAttempt,
            costEntry: costResolution?.cost_entry,
            state: 'settled'
          });
        }
      } else if (disposition.state === 'released') {
        const transition = await releaseObservationCredit({
          client: tx,
          credit_account_id: demand.credit_account_id,
          observation_demand_id: demand.id,
          terminal_result_id: resultWrite.result.id,
          idempotency_key: `observation-credit:release:${demand.id}`,
          reason: disposition.reason,
          metadata: { observation_attempt_id: attempt.id }
        });
        released += 1;
        if (gate.flags.compatibility_writes_enabled === true) {
          await writeCompatibilityProjection(tx, {
            demand: transition.demand,
            result: resultWrite.result,
            attempt: finishedAttempt,
            costEntry: costResolution?.cost_entry,
            state: 'released'
          });
        }
      }
    }

    const expectedTaskStatus =
      outcome === 'surface_unavailable'
          ? 'unavailable'
          : outcome === 'technical_failed'
            ? 'dead_letter'
            : 'completed';
    let taskState;
    if (['completed', 'unavailable', 'dead_letter'].includes(task.status)) {
      if (task.status !== expectedTaskStatus) {
        throw new Error(`terminal task status ${task.status} conflicts with outcome ${outcome}`);
      }
      taskState = task;
    } else if (outcome === 'surface_unavailable') {
      taskState = await markCollectionTaskUnavailable(
        {
          taskId: task.id,
          attemptId: attempt.id,
          leaseToken,
          fencingToken,
          actor: worker,
          reason: 'surface_unavailable',
          errorDetails: details.error_details,
          eventId: resultWrite.result.id
        },
        { client: tx }
      );
    } else if (outcome === 'technical_failed') {
      taskState = await deadLetterCollectionTask(
        {
          taskId: task.id,
          attemptId: attempt.id,
          leaseToken,
          fencingToken,
          actor: worker,
          reason: 'technical_failed',
          errorDetails: details.error_details,
          eventId: resultWrite.result.id
        },
        { client: tx }
      );
    } else {
      taskState = await completeCollectionTask(
        {
          taskId: task.id,
          attemptId: attempt.id,
          leaseToken,
          fencingToken,
          actor: worker,
          eventId: resultWrite.result.id
        },
        { client: tx }
      );
    }

    const fanIn = [];
    for (const trackingRunId of [...trackingRunIds].sort()) {
      fanIn.push(await fanInTrackingRun({ client: tx, tracking_run_id: trackingRunId, enabled: true }));
    }
    return Object.freeze({
      operation: 'finalize_observation',
      enabled: true,
      status: 'finalized',
      collection_task_id: task.id,
      observation_result_id: resultWrite.result.id,
      evidence_manifest_id: manifestWrite.manifest?.id || null,
      artifact_count: artifactWrite.rows.length,
      credit: Object.freeze({ settled, released, reserved: 0 }),
      cost_reconciliation_status: costResolution?.reservation?.status || null,
      task_status: taskState.task?.status || taskState.status,
      fan_in: Object.freeze(fanIn),
      idempotent: resultWrite.idempotent && manifestWrite.idempotent && artifactWrite.idempotent
    });
  });
}

/**
 * Terminalizes an evidence-recovery claim without creating a new attempt or
 * touching supplier transport/cost.  The immutable candidate is the only
 * accepted result payload. A verifier failure/timeout becomes technical_failed
 * and releases credit; it can never be promoted to a native observation.
 */
export async function finalizeObservationEvidenceRecovery({
  pool,
  client,
  task_id,
  candidate_id,
  lease_token,
  fencing_token,
  actor,
  verification,
  enabled = false
} = {}) {
  const taskId = nonEmptyString(task_id, 'task_id');
  const candidateId = nonEmptyString(candidate_id, 'candidate_id');
  const leaseToken = nonEmptyString(lease_token, 'lease_token');
  const worker = nonEmptyString(actor, 'actor');
  const fencingToken = Number(fencing_token);
  if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0) {
    throw new TypeError('fencing_token must be a positive integer');
  }
  const verificationResult = jsonObject(verification, 'verification');
  if (!['verified', 'failed'].includes(verificationResult.status)) {
    throw new RangeError("verification.status must be 'verified' or 'failed'");
  }
  if (enabled !== true) return disabledResult('process_feature_flag_disabled');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const gate = await readFinalizerGate(tx);
    if (!gate.enabled) return disabledResult(gate.reason);

    const taskResult = await tx.query(
      `SELECT *
         FROM collection_tasks
        WHERE id = $1
          AND status = 'leased'
          AND work_kind = 'evidence_recovery'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND lease_until > clock_timestamp()
        FOR UPDATE`,
      [taskId, leaseToken, fencingToken, worker]
    );
    const task = taskResult.rows[0];
    if (!task) throw new Error('evidence recovery lease is missing, expired, or fenced');

    const candidateResult = await tx.query(
      `SELECT *
         FROM observation_finalization_candidates
        WHERE id = $1
          AND collection_task_id = $2
          AND status = 'evidence_pending'
        FOR UPDATE`,
      [candidateId, taskId]
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) throw new Error('pending observation finalization candidate is missing');

    const attemptResult = await tx.query(
      `SELECT *
         FROM observation_attempts
        WHERE id = $1
          AND collection_task_id = $2
          AND status = 'evidence_pending'
        FOR UPDATE`,
      [candidate.observation_attempt_id, taskId]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) throw new Error('evidence recovery must use the original evidence-pending attempt');
    if (
      attempt.provenance_class !== 'native_supplier' ||
      !attempt.transport_started_at ||
      attempt.supplier === 'phase1_mock' ||
      attempt.metadata?.synthetic === true
    ) {
      throw new Error('evidence recovery candidate has invalid native supplier provenance');
    }

    const demandsResult = await tx.query(
      `SELECT *
         FROM observation_demands
        WHERE collection_task_id = $1
        ORDER BY id
        FOR UPDATE`,
      [taskId]
    );
    if (demandsResult.rows.length === 0) throw new Error('collection task has no observation demands');
    for (const demand of demandsResult.rows) {
      if (demand.credit_state !== 'reserved') {
        throw new Error(`evidence recovery cannot mutate terminal demand ${demand.id}`);
      }
    }

    const deadlineExpired = new Date(candidate.recovery_deadline_at).getTime() <= Date.now();
    const success = verificationResult.status === 'verified' && !deadlineExpired;
    const outcome = success ? candidate.outcome : 'technical_failed';
    const manifestInput = success
      ? normalizeEvidenceManifest(verificationResult.evidence_manifest, {
          task,
          acquisitionMode: candidate.acquisition_mode
        })
      : null;
    const artifacts = success
      ? jsonArray(verificationResult.artifacts || [], 'verification.artifacts')
      : [];
    const disposition = resolveCreditDisposition({
      outcome,
      acquisition_mode: candidate.acquisition_mode,
      evidence_manifest: success
        ? {
            manifest_id: manifestInput.manifest_id,
            content_sha256: manifestInput.content_sha256,
            artifact_verified:
              manifestInput.verification_status === 'verified' && manifestInput.artifact_verified,
            acquisition_mode: candidate.acquisition_mode,
            requested_surface: task.requested_surface,
            requested_geo: manifestInput.requested_geo,
            actual_geo: manifestInput.actual_geo,
            adapter_version: manifestInput.adapter_version,
            retention_class: manifestInput.retention_class,
            redaction_result: manifestInput.redaction_result,
            sensitive_auth_data_present: manifestInput.sensitive_auth_data_present
          }
        : undefined
    });
    if (success && disposition.state !== 'settled') {
      throw new Error('verified evidence recovery did not satisfy native settlement contract');
    }
    assertSettlementArtifacts(disposition, manifestInput, artifacts);
    assertNativeSettlementProvenance(disposition, attempt, manifestInput, artifacts);

    const failureReason = deadlineExpired
      ? 'evidence_recovery_deadline_exceeded'
      : verificationResult.reason || 'evidence_verification_failed';
    const expectedResult = success
      ? {
          collection_task_id: task.id,
          final_attempt_id: attempt.id,
          requested_surface: task.requested_surface,
          acquisition_mode: candidate.acquisition_mode,
          outcome: candidate.outcome,
          answer_text: candidate.answer_text,
          normalized_answer: candidate.normalized_answer,
          citations: candidate.citations,
          requested_geo: candidate.requested_geo,
          actual_geo: candidate.actual_geo,
          adapter_version: candidate.adapter_version,
          parser_version: candidate.parser_version,
          structured_validation_passed: candidate.structured_validation_passed === true,
          result_hash: candidate.result_hash
        }
      : {
          collection_task_id: task.id,
          final_attempt_id: attempt.id,
          requested_surface: task.requested_surface,
          acquisition_mode: candidate.acquisition_mode,
          outcome: 'technical_failed',
          answer_text: null,
          normalized_answer: null,
          citations: [],
          requested_geo: candidate.requested_geo,
          actual_geo: candidate.actual_geo,
          adapter_version: candidate.adapter_version,
          parser_version: candidate.parser_version,
          structured_validation_passed: false,
          result_hash: stableResultHash({
            task_id: task.id,
            attempt_id: attempt.id,
            outcome: 'technical_failed',
            reason: failureReason,
            candidate_result_hash: candidate.result_hash
          })
        };

    const finishedAttempt = await finalizeAttempt(tx, attempt, {
      outcome,
      details: {
        latency_ms: null,
        local_request_bytes: null,
        local_response_bytes: null,
        vendor_billed_bytes: null,
        error_taxonomy: success ? null : 'evidence_recovery_failed',
        error_code: success ? null : failureReason,
        error_details: success ? {} : { reason: failureReason, verifier: verificationResult.details || {} }
      },
      costResolution: null
    });
    const resultWrite = await upsertResult(tx, expectedResult);
    const manifestWrite = await upsertEvidenceManifest(tx, resultWrite.result.id, manifestInput);
    const artifactWrite = manifestWrite.manifest
      ? await upsertObservationArtifacts(tx, manifestWrite.manifest.id, artifacts)
      : { rows: [], idempotent: true };
    const costEntryResult = await tx.query(
      `SELECT *
         FROM supplier_cost_entries
        WHERE observation_attempt_id = $1
        ORDER BY allocation_version DESC
        LIMIT 1`,
      [attempt.id]
    );
    const costEntry = costEntryResult.rows[0] || null;

    let settled = 0;
    let released = 0;
    for (const demand of demandsResult.rows) {
      if (success) {
        const transition = await settleObservationCredit({
          client: tx,
          credit_account_id: demand.credit_account_id,
          observation_demand_id: demand.id,
          terminal_result_id: resultWrite.result.id,
          evidence_manifest_id: manifestWrite.manifest.id,
          idempotency_key: `observation-credit:settle:${demand.id}`,
          reason: 'native_valid_observation_recovered_evidence',
          metadata: { observation_attempt_id: attempt.id, evidence_recovery_candidate_id: candidate.id }
        });
        settled += 1;
        if (gate.flags.compatibility_writes_enabled === true) {
          await writeCompatibilityProjection(tx, {
            demand: transition.demand,
            result: resultWrite.result,
            attempt: finishedAttempt,
            costEntry,
            state: 'settled'
          });
        }
      } else {
        const transition = await releaseObservationCredit({
          client: tx,
          credit_account_id: demand.credit_account_id,
          observation_demand_id: demand.id,
          terminal_result_id: resultWrite.result.id,
          idempotency_key: `observation-credit:release:${demand.id}`,
          reason: failureReason,
          metadata: { observation_attempt_id: attempt.id, evidence_recovery_candidate_id: candidate.id }
        });
        released += 1;
        if (gate.flags.compatibility_writes_enabled === true) {
          await writeCompatibilityProjection(tx, {
            demand: transition.demand,
            result: resultWrite.result,
            attempt: finishedAttempt,
            costEntry,
            state: 'released'
          });
        }
      }
    }

    await tx.query(
      `UPDATE observation_finalization_candidates
          SET status = $2,
              finalized_at = CASE WHEN $2 = 'finalized' THEN NOW() ELSE NULL END,
              failed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END,
              evidence_errors = CASE
                WHEN $2 = 'failed' THEN evidence_errors || $3::jsonb
                ELSE evidence_errors
              END,
              recovery_attempt_count = recovery_attempt_count + 1,
              updated_at = NOW()
        WHERE id = $1`,
      [candidate.id, success ? 'finalized' : 'failed', JSON.stringify([failureReason])]
    );
    const terminalTask = await tx.query(
      `UPDATE collection_tasks
          SET status = $5,
              lease_owner = NULL,
              lease_token = NULL,
              lease_until = NULL,
              lease_heartbeat_at = NULL,
              completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END,
              dead_lettered_at = CASE WHEN $5 = 'dead_letter' THEN NOW() ELSE NULL END,
              dead_letter_reason = CASE WHEN $5 = 'dead_letter' THEN $6 ELSE NULL END,
              last_error_taxonomy = CASE WHEN $5 = 'dead_letter' THEN 'evidence_recovery_failed' ELSE NULL END,
              last_error_code = CASE WHEN $5 = 'dead_letter' THEN $6 ELSE NULL END,
              last_error_details = CASE WHEN $5 = 'dead_letter' THEN $7::jsonb ELSE '{}'::jsonb END,
              updated_at = NOW()
        WHERE id = $1
          AND status = 'leased'
          AND lease_token = $2
          AND lease_fencing_token = $3
          AND lease_owner = $4
          AND work_kind = 'evidence_recovery'
          AND lease_until > clock_timestamp()
        RETURNING *`,
      [
        task.id,
        leaseToken,
        fencingToken,
        worker,
        success ? 'completed' : 'dead_letter',
        failureReason,
        JSON.stringify({ reason: failureReason, supplier_transport_replayed: false })
      ]
    );
    if (!terminalTask.rows[0]) throw new Error('evidence recovery task lost its active lease before ACK');
    await tx.query(
      `INSERT INTO collection_task_events (
         collection_task_id, observation_attempt_id, event_type, from_status,
         to_status, lease_token, fencing_token, idempotency_key, actor, reason, details
       ) VALUES ($1, $2, $3, 'leased', $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        task.id,
        attempt.id,
        success ? 'completed' : 'dead_lettered',
        success ? 'completed' : 'dead_letter',
        leaseToken,
        fencingToken,
        `collection-task:${task.id}:evidence-terminal:${candidate.id}`,
        worker,
        success ? 'evidence_recovered' : failureReason,
        JSON.stringify({ candidate_id: candidate.id, supplier_transport_replayed: false })
      ]
    );

    const fanIn = [];
    const trackingRunIds = [...new Set(demandsResult.rows.map((demand) => demand.tracking_run_id))].sort();
    for (const trackingRunId of trackingRunIds) {
      fanIn.push(await fanInTrackingRun({ client: tx, tracking_run_id: trackingRunId, enabled: true }));
    }
    return Object.freeze({
      operation: 'finalize_evidence_recovery',
      enabled: true,
      status: success ? 'finalized' : 'failed',
      collection_task_id: task.id,
      observation_attempt_id: attempt.id,
      observation_result_id: resultWrite.result.id,
      evidence_manifest_id: manifestWrite.manifest?.id || null,
      artifact_count: artifactWrite.rows.length,
      credit: Object.freeze({ settled, released, reserved: 0 }),
      task_status: terminalTask.rows[0].status,
      supplier_transport_replayed: false,
      fan_in: Object.freeze(fanIn)
    });
  });
}
