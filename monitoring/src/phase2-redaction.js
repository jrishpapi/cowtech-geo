import { createHash } from 'node:crypto';

const SENSITIVE_KEY = /(?:^|[_-])(authorization|cookie|cookies|set_cookie|password|passwd|secret|token|api_key|apikey|access_key|storage_state|account_email|email)(?:$|[_-])|^(?:accessToken|refreshToken|apiKey|accessKeyId|secretAccessKey|storageState|accountEmail)$/i;
const AUTH_VALUE = /\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}/i;
const COOKIE_VALUE = /(?:^|[;,]\s*)[a-z0-9_.-]+\s*=\s*[^;,]{3,}/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const SECRET_QUERY = /([?&](?:api_?key|access_?token|auth|token|key)=)[^&#\s]+/gi;

export const REDACTED_VALUE = '[REDACTED]';

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function sanitizeString(value, findings, path) {
  let output = value.replace(SECRET_QUERY, '$1[REDACTED]');
  if (output !== value) findings.push({ path, category: 'secret_query', fingerprint: sha256(value) });
  if (AUTH_VALUE.test(output)) {
    findings.push({ path, category: 'authorization_value', fingerprint: sha256(output) });
    output = REDACTED_VALUE;
  } else if (COOKIE_VALUE.test(output)) {
    findings.push({ path, category: 'cookie_value', fingerprint: sha256(output) });
    output = REDACTED_VALUE;
  } else if (EMAIL_VALUE.test(output)) {
    findings.push({ path, category: 'email', fingerprint: sha256(output) });
    output = output.replace(EMAIL_VALUE, REDACTED_VALUE);
  }
  return output;
}

function walk(value, findings, path, seen) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value, findings, path);
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (seen.has(value)) throw new TypeError('evidence payload must not contain circular references');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => walk(item, findings, `${path}[${index}]`, seen));
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const itemPath = path ? `${path}.${key}` : key;
      if (SENSITIVE_KEY.test(key)) {
        findings.push({ path: itemPath, category: 'sensitive_key', fingerprint: sha256(item ?? '') });
        output[key] = REDACTED_VALUE;
        continue;
      }
      output[key] = walk(item, findings, itemPath, seen);
    }
    return output;
  } finally {
    seen.delete(value);
  }
}

export function redactEvidencePayload(payload) {
  const findings = [];
  const value = walk(payload, findings, '$', new WeakSet());
  return Object.freeze({
    value,
    redaction_result: 'passed',
    sensitive_auth_data_present: findings.length > 0,
    findings: Object.freeze(findings.map((finding) => Object.freeze(finding)))
  });
}

export function assertRedactedEvidence(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const querySanitized = serialized.replace(SECRET_QUERY, '$1[REDACTED]');
  SECRET_QUERY.lastIndex = 0;
  if (AUTH_VALUE.test(serialized) || COOKIE_VALUE.test(serialized) || EMAIL_VALUE.test(serialized) || querySanitized !== serialized) {
    throw new Error('evidence payload contains sensitive authentication or account data');
  }
  return true;
}

export function redactLogValue(value) {
  return redactEvidencePayload(value).value;
}
