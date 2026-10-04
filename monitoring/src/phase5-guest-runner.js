import { runIsolatedBrowserObservation } from './phase2-browser-core.js';
import {
  PHASE5_GUEST_SURFACES,
  Phase5SurfaceRuntimeGuard,
  assertPhase5SurfaceEntitled
} from './phase5-surface-contract.js';
import { pool as defaultPool } from './db.js';

function exactPrompt(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('promptText must be a non-empty string');
  return value;
}

function assertRuntimeGate(config) {
  if (config.phase5GuestSurfacesEnabled !== true) throw new Error('Phase 5 guest surfaces runtime is disabled');
  if (config.liveProviderTestingEnabled !== true) throw new Error('live provider testing is disabled');
  if (config.externalSpendMode !== 'allow') throw new Error('external spend mode denies Phase 5 transport');
  if (config.pocPaidRunEnabled !== true) throw new Error('paid POC gate is disabled');
}

export async function readPhase5ExecutionGate(pool = defaultPool) {
  const result = await pool.query(`SELECT * FROM phase5_feature_flags WHERE scope_key = 'global'`);
  const flags = result.rows[0];
  if (!flags) return Object.freeze({ allowed: false, reason: 'phase5_feature_flags_missing' });
  const allowed =
    flags.surface_contract_enabled === true &&
    flags.gemini_guest_enabled === true &&
    flags.grok_guest_enabled === true &&
    flags.qwen_guest_enabled === true &&
    flags.independent_controls_enabled === true &&
    flags.smoke_execution_enabled === true &&
    flags.live_connectivity_enabled === true &&
    flags.paid_transport_enabled === true &&
    flags.external_spend_enabled === true;
  return Object.freeze({
    allowed,
    reason: allowed ? 'armed' : 'phase5_database_gates_disabled',
    flags: Object.freeze({ ...flags })
  });
}

export class Phase5GuestRunner {
  constructor({
    config,
    sessionPool,
    adapters = {},
    fallbackRouter = null,
    gateReader = readPhase5ExecutionGate,
    runtimeGuard = new Phase5SurfaceRuntimeGuard()
  } = {}) {
    if (!config) throw new TypeError('config is required');
    this.config = config;
    this.sessionPool = sessionPool;
    this.adapters = adapters;
    this.fallbackRouter = fallbackRouter;
    this.gateReader = gateReader;
    this.runtimeGuard = runtimeGuard;
  }

  async run({
    requestedSurface,
    promptText,
    requestedGeo,
    estimatedCostMicroUsd,
    entitlement,
    allowFallback = false,
    fallbackProviderInput,
    signal
  } = {}) {
    if (!PHASE5_GUEST_SURFACES[requestedSurface]) {
      throw new TypeError('requestedSurface is not a Phase 5 guest surface');
    }
    const prompt = exactPrompt(promptText);
    assertRuntimeGate(this.config);
    assertPhase5SurfaceEntitled({ entitlement, requestedSurface });
    const databaseGate = await this.gateReader();
    if (databaseGate?.allowed !== true) {
      throw new Error(`Phase 5 database execution gate is disabled: ${databaseGate?.reason || 'unknown'}`);
    }
    this.runtimeGuard.acquire(requestedSurface);
    if (!this.sessionPool || typeof this.sessionPool.lease !== 'function') {
      throw new TypeError('sessionPool.lease is required');
    }
    const adapter = this.adapters[requestedSurface];
    if (!adapter || typeof adapter.observe !== 'function') {
      throw new TypeError(`adapter is missing for ${requestedSurface}`);
    }
    const lease = await this.sessionPool.lease({
      surface: requestedSurface,
      environment: 'phase5_guest',
      requestedGeo,
      estimatedCostMicroUsd,
      signal
    });
    try {
      const observation = await runIsolatedBrowserObservation(
        lease.connection,
        { resourcePolicy: 'conservative', signal },
        ({ page, context }) => adapter.observe({ page, context, promptText: prompt })
      );
      this.runtimeGuard.recordSuccess(requestedSurface);
      lease.release();
      return Object.freeze({
        requested_surface: requestedSurface,
        acquisition_mode: 'web_ui',
        outcome: 'web_ui_observed',
        credit_settlement: 'settled',
        adapter_version: adapter.adapterVersion,
        warm_session: lease.warm,
        session_use_count: lease.use_count,
        telemetry: observation.telemetry,
        provider_result: observation.value
      });
    } catch (error) {
      this.runtimeGuard.recordFailure(requestedSurface);
      await lease.destroy().catch(() => undefined);
      if (
        allowFallback === true &&
        this.config.phase5OpenRouterFallbackEnabled === true &&
        this.fallbackRouter
      ) {
        return this.fallbackRouter.run({
          requestedSurface,
          failureCode: error.code || 'browser_transport_failed',
          providerInput: fallbackProviderInput
        });
      }
      throw error;
    }
  }
}
