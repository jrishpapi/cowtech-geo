import { runIsolatedBrowserObservation } from './phase2-browser-core.js';
import { PHASE3_STARTER_SURFACES } from './phase3-starter-contract.js';
import { pool as defaultPool } from './db.js';

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

function assertRuntimeGate(config, surface) {
  if (config.phase3StarterEnabled !== true) throw new Error('Phase 3 Starter runtime is disabled');
  if (config.liveProviderTestingEnabled !== true) throw new Error('live provider testing is disabled');
  if (config.externalSpendMode !== 'allow') throw new Error('external spend mode denies Phase 3 transport');
  if (config.pocPaidRunEnabled !== true) throw new Error('paid POC gate is disabled');
  if (surface === 'google_aio' && config.phase3GoogleAioEnabled !== true) {
    throw new Error('Phase 3 Google AIO runtime is disabled');
  }
  if (surface !== 'google_aio' && config.phase3GuestUiEnabled !== true) {
    throw new Error('Phase 3 guest UI runtime is disabled');
  }
}

export async function readPhase3ExecutionGate(pool = defaultPool) {
  const result = await pool.query(
    `SELECT *
       FROM phase3_feature_flags
      WHERE scope_key = 'global'`
  );
  const flags = result.rows[0];
  if (!flags) return Object.freeze({ allowed: false, reason: 'phase3_feature_flags_missing' });
  const allowed =
    flags.starter_contract_enabled === true &&
    flags.chatgpt_guest_enabled === true &&
    flags.perplexity_guest_enabled === true &&
    flags.google_aio_enabled === true &&
    flags.ops_metrics_enabled === true &&
    flags.smoke_execution_enabled === true &&
    flags.live_connectivity_enabled === true &&
    flags.paid_transport_enabled === true &&
    flags.external_spend_enabled === true;
  return Object.freeze({
    allowed,
    reason: allowed ? 'armed' : 'phase3_database_gates_disabled',
    flags: Object.freeze({ ...flags })
  });
}

export class Phase3StarterRunner {
  constructor({ config, sessionPool, adapters = {}, googleAioProvider, gateReader = readPhase3ExecutionGate } = {}) {
    if (!config) throw new TypeError('config is required');
    if (typeof gateReader !== 'function') throw new TypeError('gateReader must be a function');
    this.config = config;
    this.sessionPool = sessionPool;
    this.adapters = adapters;
    this.googleAioProvider = googleAioProvider;
    this.gateReader = gateReader;
  }

  async run({
    requestedSurface,
    promptText,
    requestedGeo,
    estimatedCostMicroUsd,
    transportPermit,
    signal
  } = {}) {
    const surface = nonEmpty(requestedSurface, 'requestedSurface');
    if (!PHASE3_STARTER_SURFACES[surface]) throw new TypeError('requestedSurface is not a Starter surface');
    const exactPrompt = typeof promptText === 'string' && promptText.trim() ? promptText : null;
    if (!exactPrompt) throw new TypeError('promptText must be a non-empty string');
    assertRuntimeGate(this.config, surface);
    const databaseGate = await this.gateReader();
    if (databaseGate?.allowed !== true) {
      throw new Error(`Phase 3 database execution gate is disabled: ${databaseGate?.reason || 'unknown'}`);
    }

    if (surface === 'google_aio') {
      if (!this.googleAioProvider || typeof this.googleAioProvider.runPrompt !== 'function') {
        throw new TypeError('googleAioProvider.runPrompt is required');
      }
      const providerResult = await this.googleAioProvider.runPrompt({
        prompt: { prompt_text: exactPrompt },
        transport_permit: transportPermit,
        region: requestedGeo?.region,
        language: requestedGeo?.language,
        device: requestedGeo?.device
      });
      return Object.freeze({
        requested_surface: surface,
        acquisition_mode: 'serpapi_aio',
        outcome: providerResult.normalized_answer.outcome,
        provider_result: providerResult
      });
    }

    if (!this.sessionPool || typeof this.sessionPool.lease !== 'function') {
      throw new TypeError('sessionPool.lease is required');
    }
    const adapter = this.adapters[surface];
    if (!adapter || typeof adapter.observe !== 'function') throw new TypeError(`adapter is missing for ${surface}`);
    const lease = await this.sessionPool.lease({
      surface,
      environment: 'phase3_guest',
      requestedGeo,
      estimatedCostMicroUsd,
      signal
    });
    try {
      const observation = await runIsolatedBrowserObservation(
        lease.connection,
        { resourcePolicy: 'conservative', signal },
        ({ page, context }) => adapter.observe({ page, context, promptText: exactPrompt })
      );
      lease.release();
      return Object.freeze({
        requested_surface: surface,
        acquisition_mode: 'web_ui',
        outcome: 'web_ui_observed',
        warm_session: lease.warm,
        session_use_count: lease.use_count,
        telemetry: observation.telemetry,
        provider_result: observation.value
      });
    } catch (error) {
      await lease.destroy().catch(() => undefined);
      throw error;
    }
  }
}
