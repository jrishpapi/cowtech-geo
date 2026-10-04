import { createHash } from 'node:crypto';

export const PHASE6_CONTROLLED_RETRY_RULES = Object.freeze({
  answer_timeout: Object.freeze({ classification: 'transient', max_retries: 1 }),
  phase2_browser_transport_failed: Object.freeze({ classification: 'transient', max_retries: 1 }),
  'phase6_observation.prepare_session_failed': Object.freeze({ classification: 'transient', max_retries: 1 }),
  phase2_observation_deadline_exceeded: Object.freeze({ classification: 'transient', max_retries: 1 }),
  serpapi_provider_error: Object.freeze({ classification: 'transient', max_retries: 1 }),
  surface_login_wall: Object.freeze({
    classification: 'structural_hold',
    max_retries: 1,
    prerequisite: 'fresh_same-route_guest-access_canary'
  })
});

export function hashPhase6ReplaySelection(itemKeys = []) {
  const normalized = [...itemKeys].map(String).sort();
  if (!normalized.length || new Set(normalized).size !== normalized.length) {
    throw new Error('Phase 6 replay selection must contain unique item keys');
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function classifyPhase6ControlledRetry(resultPayload = {}) {
  const errorCode = String(resultPayload?.error_code || 'unknown_failure');
  const rule = PHASE6_CONTROLLED_RETRY_RULES[errorCode];
  if (!rule) {
    return Object.freeze({ error_code: errorCode, classification: 'structural_hold', max_retries: 0 });
  }
  return Object.freeze({ error_code: errorCode, ...rule });
}

export function buildPhase6ControlledRetryPlan(items = []) {
  const rows = items.map((item) => {
    if (item.status !== 'failed') throw new Error('controlled retry planning accepts failed items only');
    return Object.freeze({
      item_key: item.item_key,
      surface: item.surface,
      ...classifyPhase6ControlledRetry(item.result_payload)
    });
  });
  return Object.freeze({
    schema_version: 'phase6-controlled-retry-v1',
    total_failed: rows.length,
    transient_eligible: rows.filter((row) => row.classification === 'transient').length,
    structural_hold: rows.filter((row) => row.classification === 'structural_hold').length,
    rules: Object.freeze(rows)
  });
}

export function assertPhase6ReplayResultAccepted(result = {}) {
  if (result.delivery_valid !== true) throw new Error('replay result is not delivery-valid');
  if (result.evidence_verified !== true) throw new Error('replay result evidence is not verified');
  if (!result.provider_id || !result.model_id) throw new Error('replay result provenance is incomplete');
  return true;
}
