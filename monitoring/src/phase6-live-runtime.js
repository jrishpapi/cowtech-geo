import {
  runIsolatedBrowserObservation,
  verifyPreparedPageCdpGeo
} from './phase2-browser-core.js';
import { assertExternalTransportAllowed } from './costing/external-spend-gate.js';

const WEB_SURFACES = new Set(['chatgpt_ui', 'perplexity_ui', 'gemini_ui', 'grok_ui', 'qwen_ui']);

function exactPrompt(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('prompt_text must be non-empty');
  return value;
}

function supplierFor(item) {
  if (item.acquisition_mode === 'serpapi_aio') {
    return Object.freeze({ budget: 'serpapi', transport: 'serpapi' });
  }
  if (['grok_api', 'official_api'].includes(item.acquisition_mode)) {
    if (!['xai', 'openrouter', 'dashscope'].includes(item.official_api_supplier)) {
      throw new TypeError('unsupported Phase 6 API supplier');
    }
    return Object.freeze({ budget: 'other', transport: item.official_api_supplier });
  }
  return Object.freeze({ budget: 'bright_data', transport: 'bright_data_browser' });
}

function safeFailureDetail(error) {
  const raw = String(error?.diagnostic || error?.message || error?.name || 'unknown_failure');
  return raw
    .replace(/wss?:\/\/[^@\s]+@/gi, 'wss://[redacted]@')
    .replace(/([?&](?:api_key|key|token|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]')
    .slice(0, 4000);
}

export class Phase6PermitIssuer {
  constructor({
    budgetGate,
    persistStart,
    persistFinal,
    brightMaxCostMicroUsd = 50000,
    serpapiMaxCostMicroUsd = 1,
    xaiMaxCostMicroUsd = 50000,
    openrouterMaxCostMicroUsd = 50000,
    dashscopeMaxCostMicroUsd = 50000
  } = {}) {
    if (!budgetGate || typeof budgetGate.reserve !== 'function') throw new TypeError('budgetGate is required');
    if (typeof persistStart !== 'function') throw new TypeError('persistStart is required');
    if (typeof persistFinal !== 'function') throw new TypeError('persistFinal is required');
    this.budgetGate = budgetGate;
    this.persistStart = persistStart;
    this.persistFinal = persistFinal;
    this.maxCosts = Object.freeze({
      bright_data: brightMaxCostMicroUsd,
      serpapi: serpapiMaxCostMicroUsd,
      xai: xaiMaxCostMicroUsd,
      openrouter: openrouterMaxCostMicroUsd,
      dashscope: dashscopeMaxCostMicroUsd
    });
  }

  async issue({ item }) {
    const supplier = supplierFor(item);
    const permit = this.budgetGate.reserve({
      attempt_id: item.item_key,
      supplier: supplier.budget,
      transport_supplier: supplier.transport,
      max_cost_micro_usd: this.maxCosts[supplier.transport === 'bright_data_browser'
        ? 'bright_data'
        : supplier.transport]
    });
    try {
      await this.persistStart({ item, permit });
      return permit;
    } catch (error) {
      this.budgetGate.release({ permit_id: permit.permit_id });
      throw error;
    }
  }

  async finalize({ item, permit, result }) {
    const transportStarted = result?.transport_started === true;
    if (!transportStarted) {
      const released = this.budgetGate.release({ permit_id: permit.permit_id });
      await this.persistFinal({
        item,
        permit: released,
        status: 'released',
        settledCostMicroUsd: null,
        costBasis: null
      });
      return released;
    }
    const actual = Number.isSafeInteger(result?.settled_cost_micro_usd)
      ? result.settled_cost_micro_usd
      : 0;
    let settled;
    try {
      settled = this.budgetGate.settle({
        permit_id: permit.permit_id,
        actual_cost_micro_usd: actual
      });
    } catch (error) {
      if (error?.code === 'phase6_actual_cost_exceeded_reservation') {
        await this.persistFinal({
          item,
          permit,
          status: 'reconciliation_required',
          settledCostMicroUsd: actual,
          costBasis: result?.cost_basis || 'conservative_estimate'
        });
      }
      throw error;
    }
    await this.persistFinal({
      item,
      permit: settled,
      status: 'settled',
      settledCostMicroUsd: actual,
      costBasis: result?.cost_basis || 'conservative_estimate'
    });
    return settled;
  }
}

export class Phase6WebSurfaceRunner {
  constructor({ config, sessionPool, adapter, evidenceStorage, smokeRunId } = {}) {
    if (!config) throw new TypeError('config is required');
    if (!sessionPool || typeof sessionPool.lease !== 'function') throw new TypeError('sessionPool is required');
    if (!adapter || typeof adapter.observe !== 'function') throw new TypeError('adapter is required');
    if (!evidenceStorage || typeof evidenceStorage.putJsonArtifact !== 'function') {
      throw new TypeError('evidenceStorage is required');
    }
    this.config = config;
    this.sessionPool = sessionPool;
    this.adapter = adapter;
    this.evidenceStorage = evidenceStorage;
    this.smokeRunId = smokeRunId;
  }

  async run(item) {
    if (!WEB_SURFACES.has(item.surface)) throw new TypeError('unsupported Phase 6 web surface');
    const promptText = exactPrompt(item.prompt_text);
    assertExternalTransportAllowed({
      config: this.config,
      supplier: 'bright_data_browser',
      transport_permit: item.budgetPermit
    });
    const suppliedEnvironment = String(item.session_environment || '').trim();
    if (item.session_environment !== undefined && !suppliedEnvironment) {
      throw new TypeError('session_environment must be non-empty when supplied');
    }
    const environment = suppliedEnvironment || (item.session_mode === 'cold'
      ? `phase6-cold-${item.item_key}`
      : `phase6-warm-${item.surface}-${item.resource_policy}`);
    let lease;
    let failureStage = 'transport';
    try {
      lease = await this.sessionPool.lease({
        surface: item.surface,
        environment,
        requestedGeo: item.requested_geo,
        estimatedCostMicroUsd: item.budgetPermit.max_cost_micro_usd,
        signal: item.signal
      });
      if (item.force_fresh_session === true && lease.warm === true) {
        await lease.destroy();
        lease = await this.sessionPool.lease({
          surface: item.surface,
          environment,
          requestedGeo: item.requested_geo,
          estimatedCostMicroUsd: item.budgetPermit.max_cost_micro_usd,
          signal: item.signal
        });
        if (lease.warm === true) throw new Error('forced fresh session remained warm');
      }
      failureStage = 'observation';
      const observation = await runIsolatedBrowserObservation(
        lease.connection,
        {
          resourcePolicy: item.resource_policy,
          requestedGeo: item.requested_geo,
          onStage: (stage) => {
            failureStage = `observation.setup.${stage}`;
          },
          signal: item.signal
        },
        ({ page, context }) => this.adapter.observe({
          page,
          context,
          promptText,
          requestedGeo: item.requested_geo,
          verifyLoadedPage: lease.connection.geo_verification_deferred
            ? verifyPreparedPageCdpGeo
            : null,
          onStage: (stage) => {
            failureStage = `observation.${stage}`;
          }
        })
      );
      failureStage = 'evidence';
      const evidence = await this.evidenceStorage.putJsonArtifact({
        collectionTaskId: this.smokeRunId,
        attemptId: item.item_key.replaceAll(':', '-'),
        requestedSurface: item.surface,
        acquisitionMode: 'web_ui',
        requestedGeo: item.requested_geo,
        actualGeo: observation.effective_geo,
        adapterVersion: this.adapter.adapterVersion,
        payload: {
          contract: {
            item_key: item.item_key,
            prompt_sha256: item.prompt_sha256,
            session_mode: item.session_mode,
            resource_policy: item.resource_policy
          },
          telemetry: observation.telemetry,
          provider_result: observation.value
        }
      });
      if (
        item.session_mode === 'cold' ||
        observation.value.conversation_reset_status === 'failed'
      ) {
        await lease.destroy();
      } else {
        lease.release();
      }
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: true,
        native_valid: true,
        acquisition_mode: 'web_ui',
        structural_failure: false,
        evidence_verified: evidence.manifest.artifact_verified === true,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        annotation_status: 'human_review_required',
        transport_started: true,
        settled_cost_micro_usd: item.budgetPermit.max_cost_micro_usd,
        cost_basis: 'conservative_estimate',
        provider_session_id: lease.connection.provider_session_id,
        evidence_manifest: evidence.manifest,
        provider_result: observation.value
      });
    } catch (error) {
      if (lease) await lease.destroy().catch(() => undefined);
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: false,
        native_valid: false,
        acquisition_mode: 'web_ui',
        structural_failure: true,
        evidence_verified: false,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        transport_started: true,
        settled_cost_micro_usd: item.budgetPermit.max_cost_micro_usd,
        cost_basis: 'conservative_estimate',
        failure_stage: failureStage,
        failure_detail: safeFailureDetail(error),
        error_code: error?.code || (
          error?.name && error.name !== 'Error'
            ? error.name
            : `phase6_${failureStage}_failed`
        )
      });
    }
  }
}

export class Phase6GoogleAioRunner {
  constructor({ provider, evidenceStorage, smokeRunId } = {}) {
    if (!provider || typeof provider.runPrompt !== 'function') throw new TypeError('provider is required');
    if (!evidenceStorage || typeof evidenceStorage.putJsonArtifact !== 'function') {
      throw new TypeError('evidenceStorage is required');
    }
    this.provider = provider;
    this.evidenceStorage = evidenceStorage;
    this.smokeRunId = smokeRunId;
  }

  async run(item) {
    try {
      const providerResult = await this.provider.runPrompt({
        prompt: { prompt_text: exactPrompt(item.prompt_text) },
        transport_permit: item.budgetPermit,
        region: item.requested_geo.region,
        language: item.requested_geo.language,
        device: item.requested_geo.device
      });
      const evidence = await this.evidenceStorage.putJsonArtifact({
        collectionTaskId: this.smokeRunId,
        attemptId: item.item_key.replaceAll(':', '-'),
        requestedSurface: item.surface,
        acquisitionMode: 'serpapi_aio',
        requestedGeo: item.requested_geo,
        actualGeo: item.requested_geo,
        adapterVersion: 'serpapi-google-aio-v1',
        payload: {
          contract: { item_key: item.item_key, prompt_sha256: item.prompt_sha256 },
          provider_result: providerResult
        }
      });
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: true,
        native_valid: true,
        acquisition_mode: 'serpapi_aio',
        structural_failure: false,
        evidence_verified: evidence.manifest.artifact_verified === true,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        annotation_status: 'human_review_required',
        transport_started: true,
        settled_cost_micro_usd: 0,
        cost_basis: 'promotional_zero',
        evidence_manifest: evidence.manifest,
        provider_result: providerResult
      });
    } catch (error) {
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: false,
        native_valid: false,
        acquisition_mode: 'serpapi_aio',
        structural_failure: true,
        evidence_verified: false,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        transport_started: true,
        settled_cost_micro_usd: 0,
        cost_basis: 'promotional_zero',
        failure_detail: safeFailureDetail(error),
        error_code: error?.code || 'phase6_google_aio_failed'
      });
    }
  }
}

export class Phase6OfficialApiRunner {
  constructor({
    provider,
    evidenceStorage,
    smokeRunId,
    surface,
    supplier,
    adapterVersion
  } = {}) {
    if (!provider || typeof provider.runPrompt !== 'function') throw new TypeError('provider is required');
    if (!evidenceStorage || typeof evidenceStorage.putJsonArtifact !== 'function') {
      throw new TypeError('evidenceStorage is required');
    }
    if (!['grok_ui', 'qwen_ui'].includes(surface)) throw new TypeError('unsupported official API surface');
    if (!['xai', 'openrouter', 'dashscope'].includes(supplier)) {
      throw new TypeError('unsupported Phase 6 API supplier');
    }
    this.provider = provider;
    this.evidenceStorage = evidenceStorage;
    this.smokeRunId = smokeRunId;
    this.surface = surface;
    this.supplier = supplier;
    this.adapterVersion = adapterVersion;
  }

  async run(item) {
    const expectedMode = this.surface === 'grok_ui' ? 'grok_api' : 'official_api';
    if (item.surface !== this.surface || item.acquisition_mode !== expectedMode) {
      throw new TypeError('Phase 6 API runner item route mismatch');
    }
    try {
      const providerResult = await this.provider.runPrompt({
        prompt: { prompt_text: exactPrompt(item.prompt_text) },
        transport_permit: item.budgetPermit
      });
      const costMicroUsd = Number(providerResult.usage?.cost_estimate_micro_usd || 0);
      if (!Number.isSafeInteger(costMicroUsd) || costMicroUsd <= 0) {
        throw new Error(`${this.supplier} official API usage cost is unavailable`);
      }
      const conservativeCostMicroUsd = Math.max(
        costMicroUsd,
        Number(item.budgetPermit?.max_cost_micro_usd || 0)
      );
      const evidence = await this.evidenceStorage.putJsonArtifact({
        collectionTaskId: this.smokeRunId,
        attemptId: item.item_key.replaceAll(':', '-'),
        requestedSurface: item.surface,
        acquisitionMode: expectedMode,
        requestedGeo: item.requested_geo,
        actualGeo: item.requested_geo,
        adapterVersion: this.adapterVersion,
        payload: {
          contract: {
            item_key: item.item_key,
            prompt_sha256: item.prompt_sha256,
            route_policy: item.route_policy,
            selected_route: item.route
          },
          official_api_supplier: this.supplier,
          provider_result: providerResult
        }
      });
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: true,
        native_valid: false,
        acquisition_mode: expectedMode,
        official_api_supplier: this.supplier,
        structural_failure: false,
        evidence_verified: evidence.manifest.artifact_verified === true,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        annotation_status: 'human_review_required',
        transport_started: true,
        settled_cost_micro_usd: conservativeCostMicroUsd,
        cost_basis: 'conservative_estimate',
        evidence_manifest: evidence.manifest,
        provider_result: providerResult
      });
    } catch (error) {
      return Object.freeze({
        surface: item.surface,
        terminal: true,
        delivery_valid: false,
        native_valid: false,
        acquisition_mode: expectedMode,
        official_api_supplier: this.supplier,
        structural_failure: true,
        evidence_verified: false,
        parser_evaluated_fields: 0,
        parser_correct_fields: 0,
        transport_started: true,
        settled_cost_micro_usd: 0,
        cost_basis: 'usage_pricing_estimate',
        failure_detail: safeFailureDetail(error),
        error_code: error?.code || `phase6_${this.supplier}_official_api_failed`
      });
    }
  }
}
