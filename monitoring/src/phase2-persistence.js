import { createHash } from 'node:crypto';
import { pool as defaultPool } from './db.js';
import { withTransaction } from './db-transaction.js';

function txOptions({ pool, client }) {
  return client ? { client } : { pool: pool || defaultPool };
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export async function createBrowserSessionRecord(input, options = {}) {
  return withTransaction(txOptions(options), async (client) => {
    const gate = await client.query(`SELECT * FROM phase2_feature_flags WHERE scope_key = 'global' FOR SHARE`);
    if (gate.rows[0]?.browser_core_enabled !== true || gate.rows[0]?.session_pool_enabled !== true) {
      throw new Error('Phase 2 browser/session database gates are disabled');
    }
    const result = await client.query(
      `INSERT INTO browser_sessions (
         surface_key, environment, authentication_mode,
         requested_region, requested_language, requested_device,
         actual_region, actual_language, actual_device,
         bright_data_zone, bright_data_session_id, status,
         started_at, last_used_at, expires_at, metadata
       ) VALUES ($1, $2, 'guest', $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW(), $11, $12::jsonb)
       RETURNING *`,
      [
        input.surface_key, input.environment || 'phase2_guest',
        input.requested_geo.region, input.requested_geo.language, input.requested_geo.device,
        input.actual_geo.region, input.actual_geo.language, input.actual_geo.device,
        input.bright_data_zone || null, input.provider_session_id,
        input.expires_at, JSON.stringify(input.metadata || {})
      ]
    );
    return result.rows[0];
  });
}

export async function recordBrowserSessionObservation(input, options = {}) {
  return withTransaction(txOptions(options), async (client) => {
    const result = await client.query(
      `INSERT INTO phase2_browser_session_observations (
         browser_session_id, observation_attempt_id, collection_task_id,
         sequence_no, temperature, resource_policy, requested_geo, actual_geo,
         geo_verification_status, local_request_bytes, local_response_bytes,
         vendor_billed_bytes, provider_session_id_hash, started_at, finished_at,
         status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
       RETURNING *`,
      [
        input.browser_session_id, input.observation_attempt_id, input.collection_task_id,
        input.sequence_no, input.temperature, input.resource_policy,
        JSON.stringify(input.requested_geo), JSON.stringify(input.actual_geo), input.geo_verification_status,
        input.local_request_bytes || 0, input.local_response_bytes || 0,
        input.vendor_billed_bytes ?? null, sha256(input.provider_session_id),
        input.started_at, input.finished_at || null, input.status || 'started', JSON.stringify(input.metadata || {})
      ]
    );
    return result.rows[0];
  });
}

export async function registerEvidenceObjectReceipt(input, options = {}) {
  return withTransaction(txOptions(options), async (client) => {
    const gate = await client.query(`SELECT * FROM phase2_feature_flags WHERE scope_key = 'global' FOR SHARE`);
    if (gate.rows[0]?.evidence_storage_enabled !== true) throw new Error('Phase 2 evidence-storage database gate is disabled');
    const result = await client.query(
      `INSERT INTO phase2_evidence_object_receipts (
         collection_task_id, observation_attempt_id, object_path, content_sha256,
         content_size_bytes, retention_class, status,
         retention_until, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,'prepared',$7,$8::jsonb)
       ON CONFLICT (object_path) DO UPDATE SET
         updated_at = NOW()
       WHERE phase2_evidence_object_receipts.collection_task_id = EXCLUDED.collection_task_id
         AND phase2_evidence_object_receipts.observation_attempt_id = EXCLUDED.observation_attempt_id
         AND phase2_evidence_object_receipts.content_sha256 = EXCLUDED.content_sha256
         AND phase2_evidence_object_receipts.content_size_bytes = EXCLUDED.content_size_bytes
         AND phase2_evidence_object_receipts.retention_class = EXCLUDED.retention_class
         AND phase2_evidence_object_receipts.retention_until IS NOT DISTINCT FROM EXCLUDED.retention_until
       RETURNING *`,
      [
        input.collection_task_id, input.observation_attempt_id, input.object_path,
        input.content_sha256, input.content_size_bytes, input.retention_class,
        input.retention_until || null, JSON.stringify(input.metadata || {})
      ]
    );
    if (!result.rows[0]) throw new Error('evidence object path already exists with different immutable content');
    return result.rows[0];
  });
}

export async function markEvidenceObjectReceiptVerified(input, options = {}) {
  return withTransaction(txOptions(options), async (client) => {
    const result = await client.query(
      `UPDATE phase2_evidence_object_receipts
          SET status = CASE WHEN status = 'attached' THEN status ELSE 'verified' END,
              verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
        WHERE id = $1
          AND status IN ('prepared', 'uploaded', 'verified', 'attached')
          AND object_path = $2
          AND content_sha256 = $3
          AND content_size_bytes = $4
      RETURNING *`,
      [input.receipt_id, input.object_path, input.content_sha256, input.content_size_bytes]
    );
    if (!result.rows[0]) throw new Error('evidence receipt verification does not match prepared immutable content');
    return result.rows[0];
  });
}

export async function attachEvidenceObjectReceipt({ receiptId, evidenceManifestId }, options = {}) {
  return withTransaction(txOptions(options), async (client) => {
    const result = await client.query(
      `UPDATE phase2_evidence_object_receipts AS receipt
          SET status = 'attached', evidence_manifest_id = $2, attached_at = NOW(), updated_at = NOW()
         FROM evidence_manifests AS manifest
        WHERE receipt.id = $1
          AND receipt.status = 'verified'
          AND manifest.id = $2
          AND manifest.object_path = receipt.object_path
          AND manifest.content_sha256 = receipt.content_sha256
          AND manifest.content_size_bytes = receipt.content_size_bytes
       RETURNING receipt.*`,
      [receiptId, evidenceManifestId]
    );
    if (!result.rows[0]) throw new Error('verified evidence receipt does not exactly match the manifest');
    return result.rows[0];
  });
}
