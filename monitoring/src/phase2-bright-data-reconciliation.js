import { createHash } from 'node:crypto';

const API_ORIGIN = 'https://api.brightdata.com';

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

function safeIdentifier(value, name) {
  const normalized = nonEmpty(value, name);
  if (!/^[A-Za-z0-9_.-]{1,160}$/.test(normalized)) {
    throw new TypeError(`${name} contains unsupported characters`);
  }
  return normalized;
}

function nonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return number;
}

function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }
  return number;
}

function isoDate(value, name) {
  const normalized = nonEmpty(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new TypeError(`${name} must be an ISO date`);
  }
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new TypeError(`${name} must be an ISO date`);
  }
  return normalized;
}

function freeze(value) {
  return Object.freeze(value);
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function optionalTimestamp(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${name} must be a valid date-time`);
  return parsed.toISOString();
}

export class BrightDataAccountApiError extends Error {
  constructor(code = 'bright_data_account_api_failed') {
    super('Bright Data account API request failed');
    this.name = 'BrightDataAccountApiError';
    this.code = code;
  }
}

export function normalizeBrowserSessionPayload(payload, expectedSessionId) {
  const expected = safeIdentifier(expectedSessionId, 'expectedSessionId');
  const session = payload?.session;
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new TypeError('Bright Data browser session payload is missing session');
  }
  const sessionId = safeIdentifier(session.session_id, 'session.session_id');
  if (sessionId !== expected) throw new Error('Bright Data browser session identity mismatch');
  return freeze({
    provider_session_id_hash: sha256(sessionId),
    provider_api_name_hash: session.api_name ? sha256(session.api_name) : null,
    status: nonEmpty(session.status, 'session.status'),
    timestamp: optionalTimestamp(session.timestamp, 'session.timestamp'),
    bandwidth_bytes: nonNegativeInteger(session.bandwidth, 'session.bandwidth'),
    navigations: nonNegativeInteger(session.navigations ?? 0, 'session.navigations'),
    duration_seconds: finiteNonNegative(session.duration ?? 0, 'session.duration'),
    captcha_status: session.captcha ? String(session.captcha) : null,
    provider_error_present: Boolean(session.error),
    captured_at: new Date().toISOString()
  });
}

function selectZoneNode(payload, zone) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Bright Data zone cost payload must be an object');
  }
  if (payload[zone] && typeof payload[zone] === 'object') return payload[zone];
  const keys = Object.keys(payload);
  if (keys.length === 1 && payload[keys[0]] && typeof payload[keys[0]] === 'object') return payload[keys[0]];
  throw new Error('Bright Data zone cost payload does not identify the requested zone');
}

export function normalizeZoneCostPayload(payload, { zone, bucket } = {}) {
  const normalizedZone = safeIdentifier(zone, 'zone');
  const zoneNode = selectZoneNode(payload, normalizedZone);
  let totals = zoneNode;
  let selectedBucket = null;
  if (!Object.hasOwn(zoneNode, 'bw') || !Object.hasOwn(zoneNode, 'cost')) {
    selectedBucket = safeIdentifier(bucket, 'bucket');
    totals = zoneNode[selectedBucket];
  }
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) {
    throw new Error('Bright Data zone cost bucket is missing');
  }
  const costUsd = finiteNonNegative(totals.cost, 'zone.cost');
  return freeze({
    zone_hash: sha256(normalizedZone),
    bucket: selectedBucket,
    billed_bytes: nonNegativeInteger(totals.bw ?? 0, 'zone.bw'),
    billed_cost_micro_usd: Math.round(costUsd * 1_000_000),
    captured_at: new Date().toISOString()
  });
}

export class BrightDataAccountClient {
  #apiToken;
  #fetch;
  #timeoutMs;

  constructor({ apiToken, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    this.#apiToken = nonEmpty(apiToken, 'apiToken');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) {
      throw new TypeError('timeoutMs must be between 1 and 60000');
    }
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
  }

  async #get(pathname, searchParams = {}) {
    const url = new URL(pathname, API_ORIGIN);
    if (url.origin !== API_ORIGIN) throw new Error('Bright Data API origin mismatch');
    for (const [key, value] of Object.entries(searchParams)) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.#apiToken}`, Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal
      });
      if (!response?.ok) throw new BrightDataAccountApiError(`bright_data_account_api_http_${response?.status || 'unknown'}`);
      try {
        return await response.json();
      } catch {
        throw new BrightDataAccountApiError('bright_data_account_api_invalid_json');
      }
    } catch (error) {
      if (error instanceof BrightDataAccountApiError) throw error;
      throw new BrightDataAccountApiError(error?.name === 'AbortError'
        ? 'bright_data_account_api_timeout'
        : 'bright_data_account_api_transport_failed');
    } finally {
      clearTimeout(timer);
    }
  }

  async getBrowserSession(sessionId) {
    const normalizedSessionId = safeIdentifier(sessionId, 'sessionId');
    const payload = await this.#get(`/browser_sessions/${encodeURIComponent(normalizedSessionId)}`);
    return normalizeBrowserSessionPayload(payload, normalizedSessionId);
  }

  async listBrowserSessions({ apiName, startDate, endDate, status = 'finished' } = {}) {
    const normalizedApiName = safeIdentifier(apiName, 'apiName');
    const normalizedStatus = nonEmpty(status, 'status');
    if (!['running', 'finished', 'failed', 'all'].includes(normalizedStatus)) {
      throw new TypeError('status is unsupported');
    }
    const start = new Date(nonEmpty(startDate, 'startDate'));
    const end = new Date(nonEmpty(endDate, 'endDate'));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new TypeError('startDate and endDate must be a valid increasing date-time range');
    }
    const payload = await this.#get('/browser_sessions', {
      api_name: normalizedApiName,
      status: normalizedStatus,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      limit: '100',
      offset: '0'
    });
    if (!Array.isArray(payload?.sessions)) throw new TypeError('Bright Data session list payload is missing sessions');
    if (payload?.pagination?.has_more === true) {
      throw new Error('Bright Data session list exceeds the isolated reconciliation page');
    }
    if (payload.sessions.some((session) => session?.api_name !== normalizedApiName || (
      normalizedStatus !== 'all' && session?.status !== normalizedStatus
    ))) {
      throw new Error('Bright Data session list escaped the requested isolated scope');
    }
    return freeze(payload.sessions.map((session) => normalizeBrowserSessionPayload(
      { session },
      session?.session_id
    )));
  }

  async getZoneCost({ zone, from, to, bucket } = {}) {
    const normalizedZone = safeIdentifier(zone, 'zone');
    const normalizedFrom = isoDate(from, 'from');
    const normalizedTo = isoDate(to, 'to');
    if (normalizedFrom >= normalizedTo) throw new TypeError('to must be after from');
    const payload = await this.#get('/zone/cost', {
      zone: normalizedZone,
      from: normalizedFrom,
      to: normalizedTo
    });
    return normalizeZoneCostPayload(payload, { zone: normalizedZone, bucket });
  }
}

export function buildBrightDataReconciliation({
  sessions,
  zoneCost,
  billingScopeId,
  localBillableUnits,
  maximumDeltaRatio = 0.02
} = {}) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new TypeError('sessions must be a non-empty array');
  }
  const scope = nonEmpty(billingScopeId, 'billingScopeId');
  const units = nonNegativeInteger(localBillableUnits, 'localBillableUnits');
  const allowedDelta = finiteNonNegative(maximumDeltaRatio, 'maximumDeltaRatio');
  if (allowedDelta > 1) throw new TypeError('maximumDeltaRatio must not exceed 1');
  const unique = new Set();
  let sessionBytes = 0;
  for (const session of sessions) {
    const hash = nonEmpty(session?.provider_session_id_hash, 'session.provider_session_id_hash');
    if (!/^[0-9a-f]{64}$/.test(hash) || unique.has(hash)) {
      throw new Error('sessions must contain unique SHA-256 provider session hashes');
    }
    unique.add(hash);
    sessionBytes += nonNegativeInteger(session.bandwidth_bytes, 'session.bandwidth_bytes');
  }
  const supplierBytes = nonNegativeInteger(zoneCost?.billed_bytes, 'zoneCost.billed_bytes');
  const deltaBytes = Math.abs(sessionBytes - supplierBytes);
  const deltaRatio = supplierBytes === 0 ? (sessionBytes === 0 ? 0 : 1) : deltaBytes / supplierBytes;
  const status = deltaRatio <= allowedDelta ? 'reconciled' : 'disputed';
  return freeze({
    supplier: 'bright_data',
    billing_scope_id: scope,
    local_billable_units: units,
    supplier_billable_units: sessions.length,
    session_billed_bytes: sessionBytes,
    billed_bytes: supplierBytes,
    billed_cost_micro_usd: nonNegativeInteger(zoneCost.billed_cost_micro_usd, 'zoneCost.billed_cost_micro_usd'),
    reconciliation_delta_bytes: deltaBytes,
    reconciliation_delta_ratio: deltaRatio,
    reconciliation_status: status,
    commercial_cost_evidence: zoneCost.billed_cost_micro_usd > 0 ? 'actual' : 'zero_or_promotional'
  });
}
