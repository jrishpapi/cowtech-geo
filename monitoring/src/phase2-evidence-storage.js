import { createHash, randomUUID } from 'node:crypto';
import { gzip as gzipCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { assertRedactedEvidence, redactEvidencePayload } from './phase2-redaction.js';

const gzip = promisify(gzipCallback);
const RETENTION_DAYS = Object.freeze({ operational_30d: 30, audit_180d: 180, legal_hold: null });
const ARTIFACT_TYPES = new Set(['compressed_json', 'redacted_dom', 'sampled_screenshot', 'network_summary']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

function safeSegment(value, name) {
  const normalized = nonEmpty(value, name);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(normalized)) {
    throw new TypeError(`${name} contains an unsafe object-key segment`);
  }
  return normalized;
}

function sha256(buffer, encoding = 'hex') {
  return createHash('sha256').update(buffer).digest(encoding);
}

export function createEvidenceS3Client({ endpoint, region = 'auto', accessKeyId, secretAccessKey, sessionToken } = {}) {
  const normalizedSessionToken = String(sessionToken || '').trim();
  return new S3Client({
    region,
    endpoint: nonEmpty(endpoint, 'endpoint'),
    forcePathStyle: false,
    credentials: {
      accessKeyId: nonEmpty(accessKeyId, 'accessKeyId'),
      secretAccessKey: nonEmpty(secretAccessKey, 'secretAccessKey'),
      ...(normalizedSessionToken ? { sessionToken: normalizedSessionToken } : {})
    }
  });
}

export class Phase2EvidenceStorageError extends Error {
  constructor(code = 'phase2_evidence_storage_failed') {
    super('Phase 2 evidence storage operation failed');
    this.name = 'Phase2EvidenceStorageError';
    this.code = code;
  }
}

export class Phase2EvidenceStorage {
  constructor({ client, bucket, prefix = 'observation-evidence/v1', now = () => new Date(), enabled = false, persistReceipt = null, verifyReceipt = null } = {}) {
    if (!client || typeof client.send !== 'function') throw new TypeError('client.send is required');
    this.client = client;
    this.bucket = nonEmpty(bucket, 'bucket');
    this.prefix = prefix.split('/').map((part, index) => safeSegment(part, `prefix[${index}]`)).join('/');
    this.now = now;
    this.enabled = enabled === true;
    this.persistReceipt = persistReceipt;
    this.verifyReceipt = verifyReceipt;
  }

  async putJsonArtifact({
    collectionTaskId,
    attemptId,
    requestedSurface,
    acquisitionMode,
    requestedGeo,
    actualGeo,
    adapterVersion,
    payload,
    artifactType = 'compressed_json',
    retentionClass = 'operational_30d',
    manifestKey = randomUUID()
  } = {}) {
    if (!this.enabled) throw new Error('Phase 2 evidence storage is disabled');
    if (typeof this.persistReceipt !== 'function' || typeof this.verifyReceipt !== 'function') {
      throw new Error('Phase 2 evidence storage requires durable receipt persistence');
    }
    if (!(retentionClass in RETENTION_DAYS)) throw new TypeError('unsupported retentionClass');
    if (!ARTIFACT_TYPES.has(artifactType)) throw new TypeError('unsupported artifactType');
    const task = safeSegment(collectionTaskId, 'collectionTaskId');
    const attempt = safeSegment(attemptId, 'attemptId');
    const surface = safeSegment(requestedSurface, 'requestedSurface');
    const manifest = safeSegment(manifestKey, 'manifestKey');
    const redacted = redactEvidencePayload(payload);
    assertRedactedEvidence(redacted.value);
    const json = Buffer.from(JSON.stringify(canonicalize(redacted.value)), 'utf8');
    const body = await gzip(json, { level: 9, mtime: 0 });
    const contentSha256 = sha256(body);
    const key = `${this.prefix}/${surface}/${task}/${attempt}/${manifest}.json.gz`;
    const now = this.now();
    const retentionDays = RETENTION_DAYS[retentionClass];
    const expiresAt = retentionDays === null ? null : new Date(now.getTime() + retentionDays * 86400000);
    const checksumBase64 = sha256(body, 'base64');

    const objectPath = `s3://${this.bucket}/${key}`;
    const preparedReceipt = await this.persistReceipt({
      collection_task_id: task,
      observation_attempt_id: attempt,
      object_path: objectPath,
      content_sha256: contentSha256,
      content_size_bytes: body.byteLength,
      retention_class: retentionClass,
      retention_until: expiresAt?.toISOString() || null,
      metadata: { storage_version: 'phase2-evidence-storage-v1' }
    });
    if (!preparedReceipt?.id) throw new Error('evidence receipt persistence did not return an id');
    let head;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        ContentEncoding: 'gzip',
        ContentLength: body.byteLength,
        ChecksumSHA256: checksumBase64,
        Metadata: {
          sha256: contentSha256,
          retention_class: retentionClass,
          redaction: 'passed'
        }
      }));
      head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw new Phase2EvidenceStorageError(error?.name || 'phase2_evidence_storage_failed');
    }
    const storedLength = Number(head.ContentLength);
    const storedHash = head.Metadata?.sha256;
    if (storedLength !== body.byteLength || storedHash !== contentSha256) {
      throw new Error('evidence object verification failed after upload');
    }

    const receipt = await this.verifyReceipt({
      receipt_id: preparedReceipt.id,
      object_path: objectPath,
      content_sha256: contentSha256,
      content_size_bytes: body.byteLength
    });
    const artifact = Object.freeze({
      artifact_type: artifactType,
      object_path: objectPath,
      content_sha256: contentSha256,
      content_size_bytes: body.byteLength,
      compression: 'gzip',
      verification_status: 'verified',
      redaction_result: 'passed',
      retention_until: expiresAt?.toISOString() || null,
      metadata: Object.freeze({
        storage_version: 'phase2-evidence-storage-v1',
        uncompressed_size_bytes: json.byteLength,
        redaction_count: redacted.findings.length,
        content_type: 'application/json'
      })
    });
    return Object.freeze({
      manifest: Object.freeze({
        manifest_key: manifest,
        acquisition_mode: nonEmpty(acquisitionMode, 'acquisitionMode'),
        content_sha256: contentSha256,
        content_size_bytes: body.byteLength,
        object_path: objectPath,
        retention_class: retentionClass,
        requested_surface: surface,
        requested_geo: requestedGeo,
        actual_geo: actualGeo,
        adapter_version: nonEmpty(adapterVersion, 'adapterVersion'),
        verification_status: 'verified',
        artifact_verified: true,
        redaction_result: 'passed',
        sensitive_auth_data_present: false,
        expires_at: expiresAt?.toISOString() || null,
        metadata: Object.freeze({
          storage_version: 'phase2-evidence-storage-v1',
          redacted_input_fields: redacted.findings.length
        })
      }),
      artifacts: Object.freeze([artifact]),
      receipt,
      redaction_summary: Object.freeze({ count: redacted.findings.length, passed: true })
    });
  }
}
