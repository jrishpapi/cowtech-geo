import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';
import { enqueueJob } from './jobs.js';
import { buildRecurringMonitoringRunKey, createTrackingRun } from './tracking.js';
import { buildLiveProviderGate, getProviderUsageWindow } from './live-provider-controls.js';

function toNumber(value) {
  return Number(value || 0);
}

function delta(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return Number((toNumber(current) - toNumber(previous)).toFixed(2));
}

function scoreTrendLabel(value, lowerIsBetter = false) {
  if (value === null || value === undefined) return 'not_enough_history';
  if (value === 0) return 'unchanged';
  if (lowerIsBetter) return value < 0 ? 'improved' : 'declined';
  return value > 0 ? 'improved' : 'declined';
}

export function monitoringFulfillment(config) {
  const surfaces = Array.isArray(config?.surface_configs) ? config.surface_configs : [];
  const gate = config?.live_provider_gate || {};
  const activeSurfaces = surfaces.filter((surface) => surface.status === 'active');
  const gateForSurface = (surface) => surface.live_provider_gate || gate;
  const mockSurfaceCount = activeSurfaces.filter((surface) => surface.provider_mode === 'mock').length;
  const liveEligibleSurfaces = activeSurfaces.filter(
    (surface) =>
      surface.provider_mode !== 'mock' &&
      surface.allow_paid_provider === true &&
      (gateForSurface(surface).status === 'eligible' || gateForSurface(surface).live_provider_allowed === true)
  );
  const healthyLiveSurfaces = liveEligibleSurfaces.filter((surface) => surface.runtime_health?.status === 'healthy');
  const degradedLiveSurfaces = liveEligibleSurfaces.filter((surface) =>
    ['degraded', 'failed', 'stale'].includes(surface.runtime_health?.status)
  );
  const unverifiedLiveSurfaces = liveEligibleSurfaces.filter(
    (surface) => !surface.runtime_health?.status || ['unknown', 'pending'].includes(surface.runtime_health.status)
  );
  const liveSurfaceCount = healthyLiveSurfaces.length;
  const pendingSurfaceCount = surfaces.filter(
    (surface) =>
      surface.status !== 'active' ||
      (surface.provider_mode !== 'mock' &&
        (surface.allow_paid_provider !== true ||
          !(gateForSurface(surface).status === 'eligible' || gateForSurface(surface).live_provider_allowed === true)))
  ).length;

  if (!config) {
    return {
      schema_version: 'customer-monitoring-fulfillment-v1',
      mode: 'pending',
      status: 'pending_config',
      label: 'Monitoring not configured',
      real_provider_calls_enabled: false,
      mock_surface_count: 0,
      live_surface_count: 0,
      pending_surface_count: 0,
      customer_message: 'Monitoring has not been configured for this brand yet.'
    };
  }

  if (config.status === 'failed') {
    return {
      schema_version: 'customer-monitoring-fulfillment-v1',
      mode: 'failed',
      status: 'failed',
      label: 'Monitoring failed',
      real_provider_calls_enabled: false,
      mock_surface_count: mockSurfaceCount,
      live_surface_count: liveSurfaceCount,
      pending_surface_count: pendingSurfaceCount,
      customer_message: 'Monitoring setup failed and needs operator review before customer delivery can be claimed.'
    };
  }

  if (degradedLiveSurfaces.length > 0) {
    return {
      schema_version: 'customer-monitoring-fulfillment-v1',
      mode: 'degraded',
      status: 'review_required',
      label: 'Monitoring degraded',
      real_provider_calls_enabled: true,
      mock_surface_count: mockSurfaceCount,
      live_surface_count: liveSurfaceCount,
      failed_surface_count: degradedLiveSurfaces.length,
      pending_surface_count: pendingSurfaceCount + unverifiedLiveSurfaces.length,
      failed_surfaces: degradedLiveSurfaces.map((surface) => surface.surface_key),
      live_provider_gate: gate,
      customer_message: 'One or more contracted monitoring surfaces failed their latest production run. Results are incomplete and require review.'
    };
  }

  if (liveSurfaceCount > 0 && unverifiedLiveSurfaces.length === 0) {
    return {
      schema_version: 'customer-monitoring-fulfillment-v1',
      mode: 'live_monitoring',
      status: config.status || 'active',
      label: 'Live monitoring active',
      real_provider_calls_enabled: true,
      mock_surface_count: mockSurfaceCount,
      live_surface_count: liveSurfaceCount,
      pending_surface_count: pendingSurfaceCount,
      live_provider_gate: gate,
      failed_surface_count: 0,
      customer_message: 'All active contracted monitoring surfaces passed their latest production run.'
    };
  }

  if (mockSurfaceCount > 0) {
    return {
      schema_version: 'customer-monitoring-fulfillment-v1',
      mode: 'mock_validation',
      status: config.status || 'active',
      label: 'Mock validation active',
      real_provider_calls_enabled: false,
      mock_surface_count: mockSurfaceCount,
      live_surface_count: 0,
      pending_surface_count: pendingSurfaceCount,
      live_provider_gate: gate,
      customer_message: 'The monitoring schedule is configured, but current runs use mock validation and are not real web-grounded AI measurements.'
    };
  }

  return {
    schema_version: 'customer-monitoring-fulfillment-v1',
    mode: 'pending_live_enablement',
    status: config.status || 'pending',
    label: 'Waiting for live provider enablement',
    real_provider_calls_enabled: false,
    mock_surface_count: 0,
    live_surface_count: 0,
    pending_surface_count: pendingSurfaceCount,
    live_provider_gate: gate,
    customer_message: 'Monitoring surfaces are configured but not active for customer delivery yet.'
  };
}

async function liveProviderGateForMonitoringConfig(config, now = new Date()) {
  if (!config) return null;
  const providerMode = normalizeProviderMode(config.provider_mode);
  const usage = await getProviderUsageWindow({ customer_id: config.customer_id, now });
  return buildLiveProviderGate({
    customer: {
      id: config.customer_id,
      plan_code: config.plan_id || config.plan_code,
      live_provider_enabled: config.customer_live_provider_enabled
    },
    plan: {
      id: config.plan_id || config.plan_code,
      live_provider_enabled: config.live_provider_enabled,
      live_provider_status: config.live_provider_status,
      daily_provider_call_limit: config.daily_provider_call_limit,
      monthly_provider_call_limit: config.monthly_provider_call_limit,
      monitoring_run_cost_limit_usd: config.monitoring_run_cost_limit_usd,
      daily_provider_cost_limit_usd: config.daily_provider_cost_limit_usd,
      monthly_provider_cost_limit_usd: config.monthly_provider_cost_limit_usd
    },
    provider_mode: providerMode,
    allow_paid_provider: config.allow_paid_provider === true,
    requested_calls: 1,
    usage
  });
}

function cadenceFromPlan(planCode = 'basic') {
  if (['enterprise', 'scale', 'pro'].includes(String(planCode).toLowerCase())) return 7;
  if (['growth', 'team'].includes(String(planCode).toLowerCase())) return 14;
  return 30;
}

function addDays(date, days) {
  if (!date) return null;
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString();
}

function normalizeCadenceDays(value, fallback = 30) {
  const number = Number(value || fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(90, Math.max(1, Math.round(number)));
}

function normalizeProviderMode(value = 'unconfigured') {
  const allowed = new Set([
    'mock',
    'openrouter',
    'perplexity',
    'google_ai_overview',
    'chatgpt_api_like',
    'gemini_api_like',
    'claude_api_like',
    'grok_api_like'
  ]);
  const normalized = String(value || 'unconfigured').trim();
  return allowed.has(normalized) ? normalized : 'unconfigured';
}

function normalizeEngineGroup(value, providerMode = 'unconfigured') {
  const byProvider = {
    mock: 'mock_llm',
    openrouter: 'openrouter_llm',
    perplexity: 'perplexity_search',
    google_ai_overview: 'google_aio',
    chatgpt_api_like: 'chatgpt_api_like',
    gemini_api_like: 'gemini_api_like',
    claude_api_like: 'claude_api_like',
    grok_api_like: 'grok_api_like'
  };
  const allowed = new Set(Object.values(byProvider));
  if (allowed.has(value)) return value;
  return byProvider[normalizeProviderMode(providerMode)] || 'unconfigured';
}

function normalizeRegion(value = 'US') {
  return String(value || 'US').trim().toUpperCase() || 'US';
}

function normalizeLanguage(value = 'en') {
  return String(value || 'en').trim().toLowerCase() || 'en';
}

function defaultAlertThresholds(thresholds = {}) {
  return {
    visibility_drop: toNumber(thresholds.visibility_drop) || 5,
    source_quality_drop: toNumber(thresholds.source_quality_drop) || 5,
    competitor_pressure_increase: toNumber(thresholds.competitor_pressure_increase) || 5,
    brand_share_of_voice_drop: toNumber(thresholds.brand_share_of_voice_drop) || 5
  };
}

export const COMMERCIAL_AI_SURFACES = [
  {
    surface_key: 'chatgpt',
    label: 'ChatGPT-like',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'perplexity',
    label: 'Perplexity',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'google_aio',
    label: 'Google AI Overview',
    provider_mode: 'google_ai_overview',
    engine_group: 'google_aio',
    default_cadence_days: 7,
    required_key: 'SERPAPI_API_KEY'
  },
  {
    surface_key: 'gemini',
    label: 'Gemini',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'claude',
    label: 'Claude',
    provider_mode: 'claude_api_like',
    engine_group: 'claude_api_like',
    default_cadence_days: 7,
    required_key: 'ANTHROPIC_API_KEY'
  },
  {
    surface_key: 'grok',
    label: 'Grok',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'qwen',
    label: 'Qwen',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'deepseek',
    label: 'DeepSeek',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  },
  {
    surface_key: 'mistral',
    label: 'Mistral',
    provider_mode: 'openrouter',
    engine_group: 'openrouter_llm',
    default_cadence_days: 7,
    required_key: 'OPENROUTER_API_KEY'
  }
];

const COMMERCIAL_PLAN_SURFACES = Object.freeze({
  starter: Object.freeze(['chatgpt', 'perplexity', 'google_aio']),
  pro: Object.freeze(['chatgpt', 'perplexity', 'google_aio', 'gemini', 'grok']),
  god: Object.freeze([
    'chatgpt', 'perplexity', 'google_aio', 'gemini',
    'grok', 'qwen', 'deepseek', 'mistral'
  ])
});

export function commercialSurfaceKeysForPlan(planCode = '') {
  return [...(COMMERCIAL_PLAN_SURFACES[String(planCode || '').trim().toLowerCase()] || [])];
}

function defaultSurfaceCycle({ cadenceDays, allowPaidProvider, nextRunAt, region, language, planCode }) {
  const entitled = new Set(commercialSurfaceKeysForPlan(planCode));
  return COMMERCIAL_AI_SURFACES.map((surface) => ({
    ...surface,
    cadence_days: normalizeCadenceDays(cadenceDays, surface.default_cadence_days),
    allow_paid_provider: allowPaidProvider === true && entitled.has(surface.surface_key),
    status: entitled.has(surface.surface_key) ? 'active' : 'paused',
    region: normalizeRegion(region),
    language: normalizeLanguage(language),
    next_run_at: nextRunAt
  }));
}

function normalizeSurfaceCycle(surfaceCycle = [], fallback = {}) {
  const byKey = new Map(COMMERCIAL_AI_SURFACES.map((surface) => [surface.surface_key, surface]));
  const entitled = new Set(commercialSurfaceKeysForPlan(fallback.planCode));
  const explicitCycle = Array.isArray(surfaceCycle) ? surfaceCycle : [];
  const explicitByKey = new Map(explicitCycle.map((surface) => [surface.surface_key, surface]));
  const requested = explicitCycle.length
    ? COMMERCIAL_AI_SURFACES.map((surface) => explicitByKey.has(surface.surface_key)
      ? { ...surface, ...explicitByKey.get(surface.surface_key) }
      : { ...surface, status: 'paused', allow_paid_provider: false })
    : defaultSurfaceCycle(fallback);
  return requested
    .map((item) => {
      const base = byKey.get(item.surface_key) || COMMERCIAL_AI_SURFACES.find((surface) => surface.provider_mode === item.provider_mode);
      if (!base) return null;
      const providerMode = normalizeProviderMode(item.provider_mode || base.provider_mode);
      const coreEntitled = base.surface_key === 'claude' || entitled.has(base.surface_key);
      return {
        surface_key: base.surface_key,
        label: base.label,
        provider_mode: providerMode,
        engine_group: normalizeEngineGroup(item.engine_group || base.engine_group, providerMode),
        cadence_days: normalizeCadenceDays(item.cadence_days, fallback.cadenceDays || base.default_cadence_days),
        allow_paid_provider:
          coreEntitled && (item.allow_paid_provider === true || fallback.allowPaidProvider === true),
        status:
          !coreEntitled
            ? 'paused'
            : providerMode !== 'mock' && item.allow_paid_provider !== true && fallback.allowPaidProvider !== true
            ? 'paused'
            : item.status === 'paused'
            ? 'paused'
            : 'active',
        region: normalizeRegion(item.region || fallback.region || 'US'),
        language: normalizeLanguage(item.language || fallback.language || 'en'),
        next_run_at: item.next_run_at || fallback.nextRunAt || null,
        required_key: base.required_key
      };
    })
    .filter(Boolean);
}

export function calculateShareOfVoice(parserOutputs = []) {
  const competitorMap = new Map();
  let brandMentionCount = 0;
  let measuredAnswers = 0;
  let brandMentionedAnswers = 0;

  for (const output of parserOutputs.filter(Boolean)) {
    measuredAnswers += 1;
    const brandCount = toNumber(output.brand?.mention_count);
    if (output.summary?.brand_mentioned || brandCount > 0) brandMentionedAnswers += 1;
    brandMentionCount += brandCount || (output.summary?.brand_mentioned ? 1 : 0);

    for (const competitor of output.competitors || []) {
      const count = toNumber(competitor.mention_count);
      if (!count) continue;
      const key = competitor.name || competitor.competitor_id || 'Unknown competitor';
      const existing =
        competitorMap.get(key) ||
        {
          competitor_id: competitor.competitor_id || null,
          name: key,
          mention_count: 0,
          mentioned_answers: 0
        };
      existing.mention_count += count;
      existing.mentioned_answers += competitor.mentioned ? 1 : 0;
      competitorMap.set(key, existing);
    }
  }

  const competitors = [...competitorMap.values()].sort((a, b) => b.mention_count - a.mention_count);
  const competitorMentionCount = competitors.reduce((sum, competitor) => sum + competitor.mention_count, 0);
  const totalMentions = brandMentionCount + competitorMentionCount;
  const brandShare = totalMentions ? (brandMentionCount / totalMentions) * 100 : 0;

  return {
    schema_version: 'share-of-voice-v1',
    measured_answers: measuredAnswers,
    brand_mention_count: brandMentionCount,
    brand_mentioned_answers: brandMentionedAnswers,
    competitor_mention_count: competitorMentionCount,
    total_voice_mentions: totalMentions,
    brand_share_of_voice: Number(brandShare.toFixed(2)),
    competitors: competitors.slice(0, 8).map((competitor) => ({
      ...competitor,
      share_of_voice: totalMentions ? Number(((competitor.mention_count / totalMentions) * 100).toFixed(2)) : 0
    }))
  };
}

export function calculateModelShareOfVoice(modelParserOutputs = []) {
  const byModel = new Map();
  for (const entry of modelParserOutputs.filter((item) => item?.parser_output)) {
    const modelId = entry.model_id || 'unknown-model';
    const existing =
      byModel.get(modelId) ||
      {
        model_id: modelId,
        provider_id: entry.provider_id || null,
        parser_outputs: []
      };
    existing.parser_outputs.push(entry.parser_output);
    if (!existing.provider_id && entry.provider_id) existing.provider_id = entry.provider_id;
    byModel.set(modelId, existing);
  }

  return [...byModel.values()]
    .map((model) => ({
      model_id: model.model_id,
      provider_id: model.provider_id,
      result_count: model.parser_outputs.length,
      ...calculateShareOfVoice(model.parser_outputs)
    }))
    .sort((a, b) => b.brand_share_of_voice - a.brand_share_of_voice || b.result_count - a.result_count);
}

function buildPoint(row) {
  const shareOfVoice = row.share_of_voice || calculateShareOfVoice(row.parser_outputs || []);
  const modelShareOfVoice = row.model_share_of_voice || calculateModelShareOfVoice(row.model_parser_outputs || []);
  return {
    tracking_run_id: row.tracking_run_id,
    run_type: row.run_type,
    status: row.status,
    created_at: row.created_at,
    finished_at: row.finished_at,
    engine_group: row.engine_group || 'unknown_engine',
    region: row.region || 'US',
    language: row.language || 'en',
    visibility_score: toNumber(row.visibility_score),
    source_quality_score: toNumber(row.source_quality_score),
    competitor_pressure_score: toNumber(row.competitor_pressure_score),
    grade: row.grade || row.scoring_output?.grade || null,
    provider_ids: row.provider_ids || [],
    source_url_count: toNumber(row.source_url_count),
    owned_source_count: toNumber(row.official_source_count),
    competitor_source_count: toNumber(row.competitor_source_count),
    competitor_mentions: toNumber(row.competitor_mention_count),
    share_of_voice: shareOfVoice,
    model_share_of_voice: modelShareOfVoice
  };
}

export function buildRecurringMonitoringPayload({
  currentRun,
  brand,
  scoreRows = [],
  config = null,
  alerts = [],
  generatedAt = new Date().toISOString()
}) {
  if (!currentRun || !brand) return null;
  const points = scoreRows.map(buildPoint).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const current = points.find((point) => point.tracking_run_id === currentRun.id) || points[points.length - 1] || null;
  const baseline =
    points.find((point) => config?.baseline_tracking_run_id && point.tracking_run_id === config.baseline_tracking_run_id) ||
    points.find((point) => current?.tracking_run_id && point.tracking_run_id !== current.tracking_run_id) ||
    current ||
    null;
  const currentIndex = current ? points.findIndex((point) => point.tracking_run_id === current.tracking_run_id) : -1;
  const previous = currentIndex > 0 ? points[currentIndex - 1] : null;
  const cadenceDays = normalizeCadenceDays(config?.cadence_days, cadenceFromPlan(brand.plan_code));
  const fulfillment = monitoringFulfillment(config);
  const visibilityDelta = delta(current?.visibility_score, previous?.visibility_score);
  const sourceDelta = delta(current?.source_quality_score, previous?.source_quality_score);
  const pressureDelta = delta(current?.competitor_pressure_score, previous?.competitor_pressure_score);
  const sovDelta = delta(current?.share_of_voice?.brand_share_of_voice, previous?.share_of_voice?.brand_share_of_voice);

  return {
    schema_version: 'recurring-monitoring-v2',
    generated_at: generatedAt,
    brand: {
      id: brand.id,
      name: brand.name,
      plan_code: brand.plan_code
    },
    cadence: {
      recommended_days: cadenceDays,
      status: config?.status || (points.length >= 2 ? 'monitoring_active' : 'baseline_only'),
      next_retest_window_start:
        config?.next_run_at || addDays(current?.finished_at || current?.created_at || currentRun.created_at, cadenceDays),
      provider_mode: config?.provider_mode || ((current?.provider_ids || []).some((providerId) => providerId && providerId !== 'mock')
        ? 'live_provider'
        : 'mock_or_unmeasured')
    },
    segmentation: {
      engine_group: config?.engine_group || current?.engine_group || 'openrouter_llm',
      region: config?.region || current?.region || 'US',
      language: config?.language || current?.language || 'en',
      current_provider_ids: current?.provider_ids || [],
      supported_surfaces: COMMERCIAL_AI_SURFACES.map((surface) => ({
        surface_key: surface.surface_key,
        label: surface.label,
        provider_mode: surface.provider_mode,
        engine_group: surface.engine_group,
        required_key: surface.required_key
      }))
    },
    configuration: config
      ? {
          id: config.id,
          status: config.status,
          baseline_tracking_run_id: config.baseline_tracking_run_id,
          locked_prompt_set_id: config.prompt_set_id,
          cadence_days: config.cadence_days,
          provider_mode: config.provider_mode,
          engine_group: config.engine_group || normalizeEngineGroup(null, config.provider_mode),
          region: config.region || 'US',
          language: config.language || 'en',
          allow_paid_provider: config.allow_paid_provider === true,
          next_run_at: config.next_run_at,
          last_scheduled_run_id: config.last_scheduled_run_id,
          alert_thresholds: defaultAlertThresholds(config.alert_thresholds)
        }
      : null,
    baseline: baseline
      ? {
          tracking_run_id: baseline.tracking_run_id,
          created_at: baseline.created_at,
          visibility_score: baseline.visibility_score,
          source_quality_score: baseline.source_quality_score,
          competitor_pressure_score: baseline.competitor_pressure_score,
          brand_share_of_voice: baseline.share_of_voice?.brand_share_of_voice ?? 0
        }
      : null,
    current,
    previous,
    deltas: {
      vs_previous: {
        visibility_score: visibilityDelta,
        source_quality_score: sourceDelta,
        competitor_pressure_score: pressureDelta,
        brand_share_of_voice: sovDelta,
        visibility_status: scoreTrendLabel(visibilityDelta),
        source_quality_status: scoreTrendLabel(sourceDelta),
        competitor_pressure_status: scoreTrendLabel(pressureDelta, true),
        brand_share_of_voice_status: scoreTrendLabel(sovDelta)
      },
      vs_baseline: {
        visibility_score: delta(current?.visibility_score, baseline?.visibility_score),
        source_quality_score: delta(current?.source_quality_score, baseline?.source_quality_score),
        competitor_pressure_score: delta(current?.competitor_pressure_score, baseline?.competitor_pressure_score),
        brand_share_of_voice: delta(
          current?.share_of_voice?.brand_share_of_voice,
          baseline?.share_of_voice?.brand_share_of_voice
        )
      }
    },
    trend_points: points.slice(-8),
    alerts: alerts.slice(0, 10).map((alert) => ({
      id: alert.id,
      alert_type: alert.alert_type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metric_key: alert.metric_key,
      previous_value: alert.previous_value === null ? null : toNumber(alert.previous_value),
      current_value: alert.current_value === null ? null : toNumber(alert.current_value),
      delta_value: alert.delta_value === null ? null : toNumber(alert.delta_value),
      status: alert.status,
      created_at: alert.created_at
    })),
    production_cycle: {
      schema_version: 'multi-engine-production-cycle-v1',
      summary: {
        configured_surface_count: config?.surface_configs?.length || 0,
        active_surface_count: (config?.surface_configs || []).filter((surface) => surface.status === 'active').length,
        mock_surface_count: fulfillment.mock_surface_count,
        live_surface_count: fulfillment.live_surface_count,
        pending_surface_count: fulfillment.pending_surface_count,
        fulfillment_mode: fulfillment.mode,
        cadence_mode: 'daily_or_weekly_by_surface',
        unified_customer_output: true
      },
      surfaces: (config?.surface_configs || []).map((surface) => ({
        id: surface.id,
        surface_key: surface.surface_key,
        label:
          COMMERCIAL_AI_SURFACES.find((item) => item.surface_key === surface.surface_key)?.label ||
          surface.surface_key,
        provider_mode: surface.provider_mode,
        engine_group: surface.engine_group,
        cadence_days: surface.cadence_days,
        allow_paid_provider: surface.allow_paid_provider === true,
        status: surface.status,
        region: surface.region,
        language: surface.language,
        next_run_at: surface.next_run_at,
        last_scheduled_run_id: surface.last_scheduled_run_id,
        runtime_health: surface.runtime_health || {
          status: 'unknown',
          tracking_run_id: surface.last_scheduled_run_id || null
        },
        required_key:
          COMMERCIAL_AI_SURFACES.find((item) => item.surface_key === surface.surface_key)?.required_key ||
          null,
        live_provider_gate: surface.live_provider_gate || null
      })),
      customer_positioning:
        'ChatGPT, Perplexity, Google AIO, Gemini, Claude, and Grok are monitored as separate evidence surfaces, then summarized into one customer-facing visibility view.'
    },
    fulfillment,
    readiness: {
      status:
        fulfillment.status === 'review_required' || fulfillment.status === 'failed'
          ? 'review_required'
          : fulfillment.mode === 'live_monitoring' && points.length
            ? 'ready'
            : 'not_ready',
      history_count: points.length,
      next_step:
        config?.status === 'active' && points.length >= 2
          ? 'Recurring monitoring is configured; review alerts after each scheduled cycle.'
          : points.length >= 2
          ? 'Use the same prompt/model matrix for the next cycle and compare score/source movement.'
          : 'Treat this run as the baseline, then retest after content assets have changed.'
    }
  };
}

export function buildMonitoringAlerts({ current, previous, thresholds = {} }) {
  if (!current || !previous) return [];
  const normalizedThresholds = defaultAlertThresholds(thresholds);
  const checks = [
    {
      metric_key: 'visibility_score',
      alert_type: 'visibility_drop',
      threshold: normalizedThresholds.visibility_drop,
      delta: delta(current.visibility_score, previous.visibility_score),
      triggered: (value) => value !== null && value <= -normalizedThresholds.visibility_drop,
      title: 'Visibility score dropped',
      message: 'Brand visibility declined compared with the previous recurring monitoring run.'
    },
    {
      metric_key: 'source_quality_score',
      alert_type: 'source_quality_drop',
      threshold: normalizedThresholds.source_quality_drop,
      delta: delta(current.source_quality_score, previous.source_quality_score),
      triggered: (value) => value !== null && value <= -normalizedThresholds.source_quality_drop,
      title: 'Source quality dropped',
      message: 'Official or neutral citation quality declined compared with the previous run.'
    },
    {
      metric_key: 'competitor_pressure_score',
      alert_type: 'competitor_pressure_increase',
      threshold: normalizedThresholds.competitor_pressure_increase,
      delta: delta(current.competitor_pressure_score, previous.competitor_pressure_score),
      triggered: (value) => value !== null && value >= normalizedThresholds.competitor_pressure_increase,
      title: 'Competitor pressure increased',
      message: 'Competitor mentions or competitor-owned citations increased compared with the previous run.'
    },
    {
      metric_key: 'brand_share_of_voice',
      alert_type: 'brand_share_of_voice_drop',
      threshold: normalizedThresholds.brand_share_of_voice_drop,
      delta: delta(current.share_of_voice?.brand_share_of_voice, previous.share_of_voice?.brand_share_of_voice),
      triggered: (value) => value !== null && value <= -normalizedThresholds.brand_share_of_voice_drop,
      title: 'Brand share of voice dropped',
      message: 'The brand lost answer-level voice share against configured competitors in this engine and region.'
    }
  ];

  return checks
    .filter((check) => check.triggered(check.delta))
    .map((check) => ({
      alert_type: check.alert_type,
      severity: Math.abs(check.delta) >= check.threshold * 2 ? 'high' : 'medium',
      title: check.title,
      message: check.message,
      metric_key: check.metric_key,
      previous_value:
        check.metric_key === 'brand_share_of_voice'
          ? previous.share_of_voice?.brand_share_of_voice
          : previous[check.metric_key],
      current_value:
        check.metric_key === 'brand_share_of_voice'
          ? current.share_of_voice?.brand_share_of_voice
          : current[check.metric_key],
      delta_value: check.delta
    }));
}

async function resolveRun({ run_id, brand_id, brand_name } = {}) {
  if (run_id) {
    const result = await pool.query(
      `SELECT tr.id,
              tr.brand_id,
              tr.prompt_set_id,
              tr.run_type,
              tr.status,
              tr.created_at,
              tr.finished_at,
              tr.region,
              tr.language,
              b.name AS brand_name,
              b.website_url,
              b.vertical,
              c.plan_code,
              c.id AS customer_id,
              c.live_provider_enabled AS customer_live_provider_enabled
       FROM tracking_runs tr
       JOIN brands b ON b.id = tr.brand_id
       JOIN customers c ON c.id = b.customer_id
       WHERE tr.id = $1
         AND ${customerVisibleTenantPredicate('c')}`,
      [run_id]
    );
    return result.rows[0] || null;
  }

  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (brand_id) {
    values.push(brand_id);
    filters.push(`b.id = $${values.length}`);
  }
  if (brand_name) {
    values.push(brand_name);
    filters.push(`LOWER(b.name) = LOWER($${values.length})`);
  }
  const result = await pool.query(
    `SELECT tr.id,
            tr.brand_id,
            tr.prompt_set_id,
            tr.run_type,
            tr.status,
            tr.created_at,
            tr.finished_at,
            tr.region,
            tr.language,
            b.name AS brand_name,
            b.website_url,
            b.vertical,
            c.plan_code,
            c.id AS customer_id,
            c.live_provider_enabled AS customer_live_provider_enabled
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE ${filters.join(' AND ')}
     ORDER BY tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function getMonitoringConfigForBrand(brandId) {
  const result = await pool.query(
    `SELECT bmc.*,
            c.id AS customer_id,
            c.plan_code,
            c.live_provider_enabled AS customer_live_provider_enabled,
            p.id AS plan_id,
            p.live_provider_enabled,
            p.live_provider_status,
            p.daily_provider_call_limit,
            p.monthly_provider_call_limit,
            p.monitoring_run_cost_limit_usd,
            p.daily_provider_cost_limit_usd,
            p.monthly_provider_cost_limit_usd
     FROM brand_monitoring_configs bmc
     JOIN brands b ON b.id = bmc.brand_id
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN plans p ON p.id = c.plan_code
     WHERE bmc.brand_id = $1
       AND ${customerVisibleTenantPredicate('c')}
     LIMIT 1`,
    [brandId]
  );
  const config = result.rows[0] || null;
  if (!config) return null;
  const surfaces = await pool.query(
    `SELECT *
     FROM brand_monitoring_surface_configs
     WHERE config_id = $1
       AND status <> 'retired'
     ORDER BY surface_key ASC`,
    [config.id]
  );
  const surfaceConfigs = await Promise.all(
    surfaces.rows.map(async (surface) => {
      let runtimeHealth = { status: 'unknown', tracking_run_id: surface.last_scheduled_run_id || null };
      if (surface.last_scheduled_run_id) {
        const runtime = await pool.query(
          `SELECT tr.status AS run_status,
                  tr.created_at,
                  tr.finished_at,
                  COUNT(pr.id)::int AS result_count,
                  COUNT(pr.id) FILTER (WHERE pr.status = 'completed')::int AS completed_count,
                  COUNT(pr.id) FILTER (WHERE pr.status = 'failed')::int AS failed_count,
                  COALESCE(array_agg(DISTINCT pr.error_code) FILTER (WHERE pr.error_code IS NOT NULL), ARRAY[]::text[]) AS error_codes
           FROM tracking_runs tr
           LEFT JOIN prompt_results pr ON pr.tracking_run_id = tr.id
           WHERE tr.id = $1
           GROUP BY tr.id`,
          [surface.last_scheduled_run_id]
        );
        const row = runtime.rows[0];
        if (row) {
          const failedCount = Number(row.failed_count || 0);
          const completedCount = Number(row.completed_count || 0);
          runtimeHealth = {
            status:
              row.run_status === 'failed' || (failedCount > 0 && completedCount === 0)
                ? 'failed'
                : failedCount > 0 || row.run_status === 'partial_failed'
                  ? 'degraded'
                  : row.run_status === 'completed' && completedCount > 0
                    ? 'healthy'
                    : ['queued', 'running'].includes(row.run_status)
                      ? 'pending'
                      : 'unknown',
            tracking_run_id: surface.last_scheduled_run_id,
            run_status: row.run_status,
            result_count: Number(row.result_count || 0),
            completed_count: completedCount,
            failed_count: failedCount,
            error_codes: row.error_codes || [],
            created_at: row.created_at,
            finished_at: row.finished_at
          };
        }
      }
      return {
        ...surface,
        runtime_health: runtimeHealth,
        live_provider_gate: await liveProviderGateForMonitoringConfig({
          ...config,
          provider_mode: surface.provider_mode,
          allow_paid_provider: surface.allow_paid_provider
        })
      };
    })
  );
  return {
    ...config,
    surface_configs: surfaceConfigs,
    live_provider_gate: await liveProviderGateForMonitoringConfig(config)
  };
}

async function upsertSurfaceConfigs({ config, surfaces }) {
  const saved = [];
  const contractedSurfaceKeys = [...new Set(surfaces.map((surface) => String(surface.surface_key || '').trim()).filter(Boolean))];

  // Keep historical rows for audit, but remove surfaces that are no longer in
  // the purchased plan from customer-facing fulfillment and quota counts.
  await pool.query(
    `UPDATE brand_monitoring_surface_configs
     SET status = 'retired', updated_at = NOW()
     WHERE config_id = $1
       AND NOT (surface_key = ANY($2::text[]))`,
    [config.id, contractedSurfaceKeys]
  );

  for (const surface of surfaces) {
    const result = await pool.query(
      `INSERT INTO brand_monitoring_surface_configs (
         config_id,
         brand_id,
         surface_key,
         provider_mode,
         engine_group,
         cadence_days,
         allow_paid_provider,
         status,
         region,
         language,
         next_run_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (config_id, surface_key)
       DO UPDATE SET
         provider_mode = EXCLUDED.provider_mode,
         engine_group = EXCLUDED.engine_group,
         cadence_days = EXCLUDED.cadence_days,
         allow_paid_provider = EXCLUDED.allow_paid_provider,
         status = EXCLUDED.status,
         region = EXCLUDED.region,
         language = EXCLUDED.language,
         next_run_at = COALESCE(brand_monitoring_surface_configs.next_run_at, EXCLUDED.next_run_at),
         updated_at = NOW()
       RETURNING *`,
      [
        config.id,
        config.brand_id,
        surface.surface_key,
        surface.provider_mode,
        surface.engine_group,
        surface.cadence_days,
        surface.allow_paid_provider === true,
        surface.status,
        surface.region,
        surface.language,
        surface.next_run_at
      ]
    );
    saved.push(result.rows[0]);
  }
  return saved;
}

async function listAlertsForBrand(brandId) {
  const result = await pool.query(
    `SELECT *
     FROM brand_monitoring_alerts
     WHERE brand_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [brandId]
  );
  return result.rows;
}

async function inferEngineGroupForRun(run, providerMode) {
  const result = await pool.query(
    `SELECT COALESCE(engine, CASE WHEN provider_id = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END) AS engine_group,
            COUNT(*)::int AS result_count
     FROM prompt_results
     WHERE tracking_run_id = $1
     GROUP BY COALESCE(engine, CASE WHEN provider_id = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END)
     ORDER BY result_count DESC
     LIMIT 1`,
    [run.id]
  );
  return result.rows[0]?.engine_group || normalizeEngineGroup(null, providerMode);
}

export async function configureRecurringMonitoring({
  run_id,
  brand_id,
  brand_name,
  cadence_days,
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  status = 'active',
  engine_group,
  region = 'US',
  language = 'en',
  alert_thresholds = {},
  surface_cycle = []
} = {}) {
  const run = await resolveRun({ run_id, brand_id, brand_name });
  if (!run) throw new Error('tracking run not found for recurring monitoring config');
  if (!run.prompt_set_id) throw new Error('tracking run does not have a prompt set to lock');
  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [run.plan_code]);
  const plan = planResult.rows[0] || {};
  const cadenceDays = normalizeCadenceDays(cadence_days, cadenceFromPlan(run.plan_code));
  const thresholds = defaultAlertThresholds(alert_thresholds);
  const nextRunAt = addDays(run.finished_at || run.created_at, cadenceDays);
  const normalizedProviderMode = normalizeProviderMode(provider_mode);
  const requestedSurfaces = Array.isArray(surface_cycle) && surface_cycle.length ? surface_cycle : [];
  const usage = await getProviderUsageWindow({ customer_id: run.customer_id });
  const liveGate = buildLiveProviderGate({
    customer: {
      id: run.customer_id,
      plan_code: run.plan_code,
      live_provider_enabled: run.customer_live_provider_enabled
    },
    plan,
    provider_mode: normalizedProviderMode,
    allow_paid_provider,
    requested_calls: Math.max(1, requestedSurfaces.length || 1),
    usage
  });
  const normalizedEngineGroup = normalizeEngineGroup(
    engine_group || (await inferEngineGroupForRun(run, normalizedProviderMode)),
    normalizedProviderMode
  );
  const result = await pool.query(
    `INSERT INTO brand_monitoring_configs (
       brand_id,
       baseline_tracking_run_id,
       prompt_set_id,
       cadence_days,
       provider_mode,
       engine_group,
       region,
       language,
       allow_paid_provider,
       status,
       alert_thresholds,
       live_provider_gate,
       next_run_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)
     ON CONFLICT (brand_id)
     DO UPDATE SET
       baseline_tracking_run_id = EXCLUDED.baseline_tracking_run_id,
       prompt_set_id = EXCLUDED.prompt_set_id,
       cadence_days = EXCLUDED.cadence_days,
       provider_mode = EXCLUDED.provider_mode,
       engine_group = EXCLUDED.engine_group,
       region = EXCLUDED.region,
       language = EXCLUDED.language,
       allow_paid_provider = EXCLUDED.allow_paid_provider,
       status = EXCLUDED.status,
       alert_thresholds = EXCLUDED.alert_thresholds,
       live_provider_gate = EXCLUDED.live_provider_gate,
       next_run_at = EXCLUDED.next_run_at,
       updated_at = NOW()
     RETURNING *`,
    [
      run.brand_id,
      run.id,
      run.prompt_set_id,
      cadenceDays,
      normalizedProviderMode,
      normalizedEngineGroup,
      normalizeRegion(region || run.region),
      normalizeLanguage(language || run.language),
      allow_paid_provider === true,
      status === 'paused' ? 'paused' : 'active',
      JSON.stringify(thresholds),
      JSON.stringify(liveGate),
      nextRunAt
    ]
  );
  const config = result.rows[0];
  const surfaceConfigs = await upsertSurfaceConfigs({
    config,
    surfaces: normalizeSurfaceCycle(surface_cycle, {
      cadenceDays,
      allowPaidProvider: allow_paid_provider === true,
      nextRunAt,
      region: normalizeRegion(region || run.region),
      language: normalizeLanguage(language || run.language),
      planCode: run.plan_code
    })
  });
  return {
    ...config,
    surface_configs: surfaceConfigs,
    live_provider_gate: liveGate
  };
}

export async function pauseRecurringMonitoring({ brand_id, brand_name, run_id } = {}) {
  const run = await resolveRun({ brand_id, brand_name, run_id });
  if (!run) throw new Error('brand not found for recurring monitoring pause');
  const result = await pool.query(
    `UPDATE brand_monitoring_configs
     SET status = 'paused',
         updated_at = NOW()
     WHERE brand_id = $1
     RETURNING *`,
    [run.brand_id]
  );
  return result.rows[0] || null;
}

async function monitoringRowsForRun(run) {
  const config = await getMonitoringConfigForBrand(run.brand_id);
  const lockedPromptSetId = config?.prompt_set_id || run.prompt_set_id;
  const engineGroup = config?.engine_group || 'openrouter_llm';
  const region = config?.region || run.region || 'US';
  const language = config?.language || run.language || 'en';
  const values = [run.brand_id, engineGroup, region, language];
  let promptSetFilter = '';
  if (lockedPromptSetId) {
    values.push(lockedPromptSetId);
    promptSetFilter = `AND (tr.prompt_set_id = $${values.length} OR tr.id = $${values.length + 1})`;
    values.push(run.id);
  }
  const rows = await pool.query(
    `SELECT tr.id AS tracking_run_id,
            tr.run_type,
            tr.status,
            tr.created_at,
            tr.finished_at,
            COALESCE(pr.engine, CASE WHEN tr.provider_mode = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END) AS engine_group,
            COALESCE(pr.region, tr.region, 'US') AS region,
            COALESCE(pr.language, tr.language, 'en') AS language,
            rs.visibility_score,
            rs.source_quality_score,
            rs.competitor_pressure_score,
            rs.scoring_output,
            COALESCE(array_agg(DISTINCT pr.provider_id) FILTER (WHERE pr.provider_id IS NOT NULL), ARRAY[]::text[]) AS provider_ids,
            COALESCE(jsonb_agg(pr.parser_output) FILTER (WHERE pr.parser_output IS NOT NULL), '[]'::jsonb) AS parser_outputs,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'provider_id', pr.provider_id,
                  'model_id', pr.model_id,
                  'parser_output', pr.parser_output
                )
              ) FILTER (WHERE pr.parser_output IS NOT NULL),
              '[]'::jsonb
            ) AS model_parser_outputs,
            COUNT(pr.id) FILTER (WHERE pr.parser_output IS NOT NULL)::int AS parsed_count,
            COALESCE(SUM((pr.parser_output->'summary'->>'source_url_count')::int), 0)::int AS source_url_count,
            COALESCE(SUM((pr.parser_output->'summary'->>'official_source_count')::int), 0)::int AS official_source_count,
            COALESCE(SUM((pr.parser_output->'summary'->>'competitor_source_count')::int), 0)::int AS competitor_source_count,
            COALESCE(SUM((pr.parser_output->'summary'->>'competitor_mentions')::int), 0)::int AS competitor_mention_count
     FROM tracking_runs tr
     JOIN run_scores rs ON rs.tracking_run_id = tr.id
     LEFT JOIN prompt_results pr ON pr.tracking_run_id = tr.id
     WHERE tr.brand_id = $1
       AND COALESCE(pr.engine, CASE WHEN tr.provider_mode = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END) = $2
       AND COALESCE(pr.region, tr.region, 'US') = $3
       AND COALESCE(pr.language, tr.language, 'en') = $4
       ${promptSetFilter}
     GROUP BY tr.id, rs.tracking_run_id, COALESCE(pr.engine, CASE WHEN tr.provider_mode = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END), COALESCE(pr.region, tr.region, 'US'), COALESCE(pr.language, tr.language, 'en')
     ORDER BY tr.created_at ASC`,
    values
  );
  return { config, rows: rows.rows };
}

export async function generateMonitoringAlertsForRun(trackingRunId) {
  const run = await resolveRun({ run_id: trackingRunId });
  if (!run) return { inserted: 0, alerts: [] };
  const config = await getMonitoringConfigForBrand(run.brand_id);
  if (!config || config.status !== 'active') return { inserted: 0, alerts: [] };
  const { rows } = await monitoringRowsForRun(run);
  const points = rows.map(buildPoint).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const currentIndex = points.findIndex((point) => point.tracking_run_id === trackingRunId);
  const current = currentIndex >= 0 ? points[currentIndex] : points[points.length - 1];
  const previous = currentIndex > 0 ? points[currentIndex - 1] : null;
  const alerts = buildMonitoringAlerts({
    current,
    previous,
    thresholds: config.alert_thresholds
  });
  const availabilityResult = await pool.query(
    `SELECT COUNT(*)::int AS result_count,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
            COALESCE(array_agg(DISTINCT error_code) FILTER (WHERE error_code IS NOT NULL), ARRAY[]::text[]) AS error_codes
     FROM prompt_results
     WHERE tracking_run_id = $1`,
    [trackingRunId]
  );
  const availability = availabilityResult.rows[0] || {};
  const resultCount = Number(availability.result_count || 0);
  const completedCount = Number(availability.completed_count || 0);
  const failedCount = Number(availability.failed_count || 0);
  if (failedCount > 0 || (resultCount > 0 && completedCount === 0)) {
    const paymentRequired = (availability.error_codes || []).includes('provider_payment_required');
    alerts.push({
      alert_type: paymentRequired ? 'provider_payment_required' : 'provider_availability_failure',
      severity: 'high',
      title: paymentRequired ? 'Monitoring provider payment required' : 'Monitoring provider unavailable',
      message: paymentRequired
        ? 'A contracted monitoring surface could not run because the upstream provider requires payment. Customer results are incomplete.'
        : 'A contracted monitoring surface failed its latest production run. Customer results are incomplete.',
      metric_key: 'provider_availability',
      previous_value: null,
      current_value: resultCount > 0 ? Number(((completedCount / resultCount) * 100).toFixed(2)) : 0,
      delta_value: null
    });
  }
  const inserted = [];
  for (const alert of alerts) {
    const result = await pool.query(
      `INSERT INTO brand_monitoring_alerts (
         config_id,
         brand_id,
         tracking_run_id,
         alert_type,
         severity,
         title,
         message,
         metric_key,
         previous_value,
         current_value,
         delta_value
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (config_id, tracking_run_id, alert_type, metric_key)
       DO UPDATE SET
         severity = EXCLUDED.severity,
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         previous_value = EXCLUDED.previous_value,
         current_value = EXCLUDED.current_value,
         delta_value = EXCLUDED.delta_value
       RETURNING *`,
      [
        config.id,
        run.brand_id,
        trackingRunId,
        alert.alert_type,
        alert.severity,
        alert.title,
        alert.message,
        alert.metric_key,
        alert.previous_value,
        alert.current_value,
        alert.delta_value
      ]
    );
    inserted.push(result.rows[0]);
  }
  await pool.query(
    `UPDATE brand_monitoring_configs
     SET next_run_at = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [config.id, addDays(run.finished_at || run.created_at || new Date().toISOString(), config.cadence_days)]
  );
  return { inserted: inserted.length, alerts: inserted };
}

export async function scheduleDueRecurringMonitoringRuns({
  redis,
  now = new Date(),
  provider_mode,
  allow_paid_provider,
  database = pool
} = {}) {
  const due = await database.query(
    `SELECT bmsc.*,
            bmc.prompt_set_id,
            bmc.status AS parent_status,
            b.name AS brand_name,
            c.id AS customer_id,
            c.plan_code,
            c.live_provider_enabled AS customer_live_provider_enabled,
            p.id AS plan_id,
            p.live_provider_enabled,
            p.live_provider_status,
            p.daily_provider_call_limit,
            p.monthly_provider_call_limit,
            p.monitoring_run_cost_limit_usd,
            p.daily_provider_cost_limit_usd,
            p.monthly_provider_cost_limit_usd
     FROM brand_monitoring_surface_configs bmsc
     JOIN brand_monitoring_configs bmc ON bmc.id = bmsc.config_id
     JOIN brands b ON b.id = bmsc.brand_id
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN plans p ON p.id = c.plan_code
     WHERE bmc.status = 'active'
       AND bmsc.status = 'active'
       AND c.tenant_class = 'customer'
       AND c.status IN ('active', 'trialing', 'comped')
       AND bmsc.next_run_at IS NOT NULL
       AND bmsc.next_run_at <= $1
     ORDER BY bmsc.next_run_at ASC`,
    [now.toISOString()]
  );
  const scheduled = [];
  const skipped = [];
  for (const config of due.rows) {
    const requestedProviderMode = normalizeProviderMode(provider_mode || config.provider_mode || 'unconfigured');
    const requestedAllowPaid = allow_paid_provider === true || config.allow_paid_provider === true;
    const liveProviderGate = await liveProviderGateForMonitoringConfig({
      ...config,
      provider_mode: requestedProviderMode,
      allow_paid_provider: requestedAllowPaid
    }, now);
    if (requestedProviderMode === 'unconfigured'
      || (requestedProviderMode === 'mock' && process.env.NODE_ENV !== 'test')
      || (liveProviderGate?.live_provider_requested && !liveProviderGate.live_provider_allowed)) {
      skipped.push({
        config_id: config.id,
        brand_id: config.brand_id,
        reason: requestedProviderMode === 'unconfigured' ? 'provider_not_configured' : 'provider_execution_blocked',
        live_provider_gate: liveProviderGate
      });
      continue;
    }
    const effectiveProviderMode = requestedProviderMode;
    const effectiveAllowPaid = requestedAllowPaid;
    const effectiveEngineGroup = config.engine_group || normalizeEngineGroup(null, effectiveProviderMode);
    const run = await createTrackingRun({
      brand_id: config.brand_id,
      prompt_set_id: config.prompt_set_id,
      run_type: 'scheduled',
      idempotency_key: buildRecurringMonitoringRunKey({ config_id: config.id, date: now }),
      region: config.region || 'US',
      language: config.language || 'en',
      run_payload: {
        source: 'recurring_monitoring',
        monitoring_config_id: config.config_id,
        monitoring_surface_config_id: config.id,
        surface_key: config.surface_key,
        provider_mode: effectiveProviderMode,
        requested_provider_mode: requestedProviderMode,
        engine_group: effectiveEngineGroup,
        region: config.region || 'US',
        language: config.language || 'en',
        live_provider_gate: liveProviderGate
      }
    });
    if (!run.was_created) {
      skipped.push({
        config_id: config.id,
        brand_id: config.brand_id,
        brand_name: config.brand_name,
        tracking_run_id: run.id,
        surface_key: config.surface_key,
        reason: 'duplicate_recurring_monitoring_surface_run'
      });
      continue;
    }
    const job = {
      id: run.id,
      type: 'tracking.recurring_monitoring_cycle',
      tracking_run_id: run.id,
      provider_mode: effectiveProviderMode,
      requested_provider_mode: requestedProviderMode,
      allow_paid_provider: effectiveAllowPaid,
      monitoring_config_id: config.config_id,
      monitoring_surface_config_id: config.id,
      surface_key: config.surface_key,
      live_provider_gate: liveProviderGate,
      created_at: new Date().toISOString()
    };
    await enqueueJob(redis, job);
    await database.query(
      `UPDATE brand_monitoring_surface_configs
       SET last_scheduled_run_id = $2,
           next_run_at = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [config.id, run.id, addDays(now.toISOString(), config.cadence_days)]
    );
    scheduled.push({
      config_id: config.id,
      brand_id: config.brand_id,
      brand_name: config.brand_name,
      tracking_run_id: run.id,
      locked_prompt_set_id: config.prompt_set_id,
      surface_key: config.surface_key,
      engine_group: effectiveEngineGroup,
      region: config.region,
      language: config.language,
      live_provider_gate: liveProviderGate,
      job
    });
  }
  return {
    scheduled,
    skipped,
    total_due_configs: due.rowCount
  };
}

export async function getCustomerMonitoringPayload(options = {}) {
  const run = await resolveRun(options);
  if (!run) return null;
  const { config, rows } = await monitoringRowsForRun(run);
  const alerts = await listAlertsForBrand(run.brand_id);

  return buildRecurringMonitoringPayload({
    currentRun: run,
    brand: {
      id: run.brand_id,
      name: run.brand_name,
      plan_code: run.plan_code
    },
    scoreRows: rows,
    config,
    alerts
  });
}
