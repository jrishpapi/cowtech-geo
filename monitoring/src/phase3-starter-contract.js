export const PHASE3_STARTER_CONTRACT_VERSION = 'phase3-starter-surfaces-v1';

export const PHASE3_STARTER_SURFACES = Object.freeze({
  chatgpt_ui: Object.freeze({ route: 'bright_data_guest', native_mode: 'web_ui', fallback: 'openrouter_api' }),
  perplexity_ui: Object.freeze({ route: 'bright_data_guest', native_mode: 'web_ui', fallback: 'sonar_api' }),
  google_aio: Object.freeze({ route: 'serpapi_google_ai_overview', native_mode: 'serpapi_aio', fallback: null })
});

const VALID_OUTCOMES = Object.freeze({
  chatgpt_ui: new Set(['web_ui_observed', 'api_fallback', 'surface_unavailable', 'technical_failed']),
  perplexity_ui: new Set(['web_ui_observed', 'api_fallback', 'surface_unavailable', 'technical_failed']),
  google_aio: new Set(['serpapi_aio_observed', 'aio_not_triggered', 'surface_unavailable', 'technical_failed'])
});

export function assertPhase3Provenance(record) {
  const surface = String(record?.requested_surface || '');
  const contract = PHASE3_STARTER_SURFACES[surface];
  if (!contract) throw new TypeError('requested_surface is not a Starter surface');
  if (!VALID_OUTCOMES[surface].has(record.outcome)) throw new TypeError('outcome is invalid for requested_surface');
  if (record.outcome === 'web_ui_observed' && record.acquisition_mode !== 'web_ui') {
    throw new Error('web UI observation must use web_ui acquisition mode');
  }
  if (record.outcome === 'api_fallback' && record.acquisition_mode !== 'api_fallback') {
    throw new Error('API fallback provenance mismatch');
  }
  if (surface === 'google_aio' && ['serpapi_aio_observed', 'aio_not_triggered'].includes(record.outcome) &&
      record.acquisition_mode !== 'serpapi_aio') {
    throw new Error('Google AIO observation must use serpapi_aio acquisition mode');
  }
  if (record.outcome === 'api_fallback' && record.credit_settled === true) {
    throw new Error('API fallback cannot settle native UI credit');
  }
  return true;
}

export function calculatePhase3OpsMetrics(records, { plannedBySurface } = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const surfaces = {};
  for (const surface of Object.keys(PHASE3_STARTER_SURFACES)) {
    const planned = Number(plannedBySurface?.[surface] || 0);
    if (!Number.isSafeInteger(planned) || planned < 0) throw new TypeError(`plannedBySurface.${surface} is invalid`);
    const subset = records.filter((record) => record.requested_surface === surface);
    for (const record of subset) assertPhase3Provenance(record);
    const native = subset.filter((record) =>
      record.outcome === 'web_ui_observed' ||
      record.outcome === 'serpapi_aio_observed' ||
      record.outcome === 'aio_not_triggered'
    ).length;
    const fallback = subset.filter((record) => record.outcome === 'api_fallback').length;
    const terminal = subset.filter((record) =>
      !['queued', 'leased', 'retry_wait'].includes(record.status)
    ).length;
    surfaces[surface] = Object.freeze({
      planned,
      terminal,
      native_valid: native,
      fallback,
      native_success_rate: planned ? native / planned : null,
      fallback_rate: planned ? fallback / planned : null
    });
  }
  const blockers = [];
  if ((surfaces.perplexity_ui.fallback_rate || 0) > 0.05) blockers.push('sonar_fallback_rate_above_0.05');
  for (const [surface, metrics] of Object.entries(surfaces)) {
    if (metrics.terminal > metrics.planned) blockers.push(`${surface}_terminal_above_planned`);
  }
  return Object.freeze({
    contract_version: PHASE3_STARTER_CONTRACT_VERSION,
    surfaces: Object.freeze(surfaces),
    smoke_ready: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}
