import dotenv from 'dotenv';

dotenv.config();

function readInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readBool(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function readNonNegativeInt(name, fallback = 0) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a non-negative integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} exceeds the safe integer range`);
  return value;
}

function readExternalSpendMode() {
  const value = String(process.env.EXTERNAL_SPEND_MODE || 'deny').trim().toLowerCase();
  if (!['deny', 'allow'].includes(value)) throw new Error('EXTERNAL_SPEND_MODE must be deny or allow');
  return value;
}

function readPhase0DeploymentMode() {
  const value = String(process.env.PHASE0_DEPLOYMENT_MODE || 'not_deployed').trim().toLowerCase();
  if (!['not_deployed', 'code_only_mock_no_spend'].includes(value)) {
    throw new Error('PHASE0_DEPLOYMENT_MODE must be not_deployed or code_only_mock_no_spend');
  }
  return value;
}

function readPhase1SupplierPermitKeyring() {
  const activeKeyId = String(process.env.PHASE1_SUPPLIER_PERMIT_ACTIVE_KEY_ID || '').trim();
  const keysJson = String(process.env.PHASE1_SUPPLIER_PERMIT_KEYS_JSON || '').trim();
  if (!activeKeyId && !keysJson) return null;
  if (!activeKeyId || !keysJson) {
    throw new Error(
      'PHASE1_SUPPLIER_PERMIT_ACTIVE_KEY_ID and PHASE1_SUPPLIER_PERMIT_KEYS_JSON must be configured together'
    );
  }
  let keys;
  try {
    keys = JSON.parse(keysJson);
  } catch {
    throw new Error('PHASE1_SUPPLIER_PERMIT_KEYS_JSON must be valid JSON');
  }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys) || typeof keys[activeKeyId] !== 'string') {
    throw new Error('PHASE1_SUPPLIER_PERMIT_KEYS_JSON must be an object containing the active key');
  }
  return Object.freeze({ active_key_id: activeKeyId, keys: Object.freeze({ ...keys }) });
}

export function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: readInt('PORT', 18090),
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || 'postgres://avgl:avgl_dev_password@localhost:25432/avgl',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:26379/0',
    jobQueueKey: process.env.JOB_QUEUE_KEY || 'avgl:jobs',
    schedulerEnabled: readBool('SCHEDULER_ENABLED', true),
    schedulerIntervalMs: readInt('SCHEDULER_INTERVAL_MS', 60000),
    schedulerJobMode: process.env.SCHEDULER_JOB_MODE || 'healthcheck',
    schedulerReplaySlaAlertsEnabled: readBool('SCHEDULER_REPLAY_SLA_ALERTS_ENABLED', false),
    schedulerReplaySlaDigestsEnabled: readBool('SCHEDULER_REPLAY_SLA_DIGESTS_ENABLED', false),
    schedulerAnomalySlaDigestsEnabled: readBool('SCHEDULER_ANOMALY_SLA_DIGESTS_ENABLED', false),
    schedulerProviderMode: process.env.SCHEDULER_PROVIDER_MODE || 'unconfigured',
    schedulerAllowPaidProvider: readBool('SCHEDULER_ALLOW_PAID_PROVIDER', false),
    phase1ObservationLedgerEnabled: readBool('PHASE1_OBSERVATION_LEDGER_ENABLED', false),
    phase1DurableQueueWorkerEnabled: readBool('PHASE1_DURABLE_QUEUE_WORKER_ENABLED', false),
    phase1CollectionWorkerEnabled: readBool('PHASE1_COLLECTION_WORKER_ENABLED', false),
    phase1RedisWakeupEnabled: readBool('PHASE1_REDIS_WAKEUP_ENABLED', false),
    phase1LeaseMs: readInt('PHASE1_LEASE_MS', 30000),
    phase1HeartbeatMs: readInt('PHASE1_HEARTBEAT_MS', 15000),
    phase1IntakeMaxAttempts: readInt('PHASE1_INTAKE_MAX_ATTEMPTS', 3),
    phase1IntakeRetryDelayMs: readInt('PHASE1_INTAKE_RETRY_DELAY_MS', 30000),
    phase1SupplierPermitKeyring: readPhase1SupplierPermitKeyring(),
    phase2BrowserCoreEnabled: readBool('PHASE2_BROWSER_CORE_ENABLED', false),
    phase2EvidenceStorageEnabled: readBool('PHASE2_EVIDENCE_STORAGE_ENABLED', false),
    phase2NavigationTimeoutMs: readInt('PHASE2_NAVIGATION_TIMEOUT_MS', 120000),
    phase2SessionMaxAgeMs: readInt('PHASE2_SESSION_MAX_AGE_MS', 3600000),
    phase2SessionMaxIdleMs: readInt('PHASE2_SESSION_MAX_IDLE_MS', 300000),
    phase2LocalBudgetMicroUsd: readNonNegativeInt('PHASE2_LOCAL_BUDGET_MICRO_USD', 0),
    phase2BrightDataCdpEndpoint: process.env.PHASE2_BRIGHT_DATA_CDP_ENDPOINT || '',
    phase2BrightDataCdpAuthHeader: process.env.PHASE2_BRIGHT_DATA_CDP_AUTH_HEADER || '',
    phase2GeoProbeUrl: process.env.PHASE2_GEO_PROBE_URL || '',
    phase2EvidenceEndpoint: process.env.PHASE2_EVIDENCE_ENDPOINT || '',
    phase2EvidenceRegion: process.env.PHASE2_EVIDENCE_REGION || 'auto',
    phase2EvidenceBucket: process.env.PHASE2_EVIDENCE_BUCKET || '',
    phase2EvidencePrefix: process.env.PHASE2_EVIDENCE_PREFIX || 'observation-evidence/v1',
    phase2EvidenceAccessKeyId: process.env.PHASE2_EVIDENCE_ACCESS_KEY_ID || '',
    phase2EvidenceSecretAccessKey: process.env.PHASE2_EVIDENCE_SECRET_ACCESS_KEY || '',
    phase2EvidenceSessionToken: process.env.PHASE2_EVIDENCE_SESSION_TOKEN || '',
    phase3StarterEnabled: readBool('PHASE3_STARTER_ENABLED', false),
    phase3GuestUiEnabled: readBool('PHASE3_GUEST_UI_ENABLED', false),
    phase3GoogleAioEnabled: readBool('PHASE3_GOOGLE_AIO_ENABLED', false),
    phase3SonarFallbackEnabled: readBool('PHASE3_SONAR_FALLBACK_ENABLED', false),
    phase3OpsMetricsEnabled: readBool('PHASE3_OPS_METRICS_ENABLED', false),
    phase5GuestSurfacesEnabled: readBool('PHASE5_GUEST_SURFACES_ENABLED', false),
    phase5OpenRouterFallbackEnabled: readBool('PHASE5_OPENROUTER_FALLBACK_ENABLED', false),
    phase6SmokeEnabled: readBool('PHASE6_SMOKE_ENABLED', false),
    phase6ApprovedBudgetMicroUsd: readNonNegativeInt('PHASE6_APPROVED_BUDGET_MICRO_USD', 0),
    externalSpendMode: readExternalSpendMode(),
    phase0CodeDeploymentPerformed: readBool('PHASE0_CODE_DEPLOYMENT_PERFORMED', false),
    phase0DeploymentMode: readPhase0DeploymentMode(),
    liveProviderTestingEnabled: readBool('LIVE_PROVIDER_TESTING_ENABLED', false),
    liveProviderTestingMaxEstimatedCostUsd: Number(process.env.LIVE_PROVIDER_TESTING_MAX_ESTIMATED_COST_USD || '0.05'),
    pocPaidRunEnabled: readBool('POC_PAID_RUN_ENABLED', false),
    pocScopeId: process.env.POC_SCOPE_ID || '',
    pocBudgetApprovalId: process.env.POC_BUDGET_APPROVAL_ID || '',
    pocBudgetMicroUsd: readNonNegativeInt('POC_BUDGET_MICRO_USD', 0),
    pocSupplierBudgetMicroUsd: {
      bright_data: readNonNegativeInt('POC_BRIGHT_DATA_BUDGET_MICRO_USD', 0),
      serpapi: readNonNegativeInt('POC_SERPAPI_BUDGET_MICRO_USD', 0),
      other: readNonNegativeInt('POC_OTHER_BUDGET_MICRO_USD', 0)
    },
    pocBrightDataAccountId: process.env.POC_BRIGHT_DATA_ACCOUNT_ID || '',
    pocBrightDataProjectId: process.env.POC_BRIGHT_DATA_PROJECT_ID || '',
    pocBrightDataZoneChatgpt: process.env.POC_BRIGHT_DATA_ZONE_CHATGPT || '',
    pocBrightDataZonePerplexity: process.env.POC_BRIGHT_DATA_ZONE_PERPLEXITY || '',
    pocSerpapiAccountId: process.env.POC_SERPAPI_ACCOUNT_ID || '',
    pocCommercialRatesVerified: readBool('POC_COMMERCIAL_RATES_VERIFIED', false),
    pocBrightDataPricingEvidenceRef:
      process.env.POC_BRIGHT_DATA_PRICING_EVIDENCE_REF || process.env.POC_BRIGHT_DATA_QUOTE_ARCHIVE_REF || '',
    pocSerpapiPricingEvidenceRef:
      process.env.POC_SERPAPI_PRICING_EVIDENCE_REF || process.env.POC_SERPAPI_QUOTE_ARCHIVE_REF || '',
    pocSupplierPolicyEvidenceRef: process.env.POC_SUPPLIER_POLICY_EVIDENCE_REF || '',
    pocTargetPolicyEvidenceRef: process.env.POC_TARGET_POLICY_EVIDENCE_REF || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    openrouterEvidenceModel: process.env.OPENROUTER_EVIDENCE_MODEL || 'openai/gpt-4o-mini',
    openrouterGrokModel: process.env.OPENROUTER_GROK_MODEL || 'x-ai/grok-4.20',
    openrouterSearchMaxTokens: readInt('OPENROUTER_SEARCH_MAX_TOKENS', 1200),
    deepArticleQaModels: (process.env.DEEP_ARTICLE_QA_MODELS || 'openai/gpt-4o-mini,google/gemini-2.5-flash')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
    deepArticleQaMaxTokens: readInt('DEEP_ARTICLE_QA_MAX_TOKENS', 800),
    deepArticleUnsupportedClaimsMode: process.env.DEEP_ARTICLE_UNSUPPORTED_CLAIMS_MODE || 'warn',
    deepArticleCitationMode: process.env.DEEP_ARTICLE_CITATION_MODE || 'warn',
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
    perplexityBaseUrl: process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai',
    perplexityModel: process.env.PERPLEXITY_MODEL || 'sonar',
    serpapiApiKey: process.env.SERPAPI_API_KEY || '',
    serpapiBaseUrl: process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search',
    dataforseoLogin: process.env.DATAFORSEO_LOGIN || '',
    dataforseoPassword: process.env.DATAFORSEO_PASSWORD || '',
    dataforseoBaseUrl: process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com',
    gscAccessToken: process.env.GSC_ACCESS_TOKEN || '',
    gscProperty: process.env.GSC_PROPERTY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiSearchModel: process.env.OPENAI_SEARCH_MODEL || 'gpt-4o-mini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    geminiSearchModel: process.env.GEMINI_SEARCH_MODEL || 'gemini-2.5-flash',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    anthropicSearchModel: process.env.ANTHROPIC_SEARCH_MODEL || 'claude-sonnet-4-5',
    xaiApiKey: process.env.XAI_API_KEY || '',
    xaiBaseUrl: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
    xaiSearchModel: process.env.XAI_SEARCH_MODEL || 'grok-4.5',
    xaiInputCostMicroUsdPerMillion:
      readNonNegativeInt('XAI_INPUT_COST_MICRO_USD_PER_MILLION', 2_000_000),
    xaiOutputCostMicroUsdPerMillion:
      readNonNegativeInt('XAI_OUTPUT_COST_MICRO_USD_PER_MILLION', 6_000_000),
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
    dashscopeBaseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
    qwenSearchModel: process.env.QWEN_SEARCH_MODEL || 'qwen-plus',
    qwenInputCostMicroUsdPerMillion:
      readNonNegativeInt('QWEN_INPUT_COST_MICRO_USD_PER_MILLION', 0),
    qwenOutputCostMicroUsdPerMillion:
      readNonNegativeInt('QWEN_OUTPUT_COST_MICRO_USD_PER_MILLION', 0),
    qwenSearchCostMicroUsdPerCall:
      readNonNegativeInt('QWEN_SEARCH_COST_MICRO_USD_PER_CALL', 0),
    minimaxApiKey: process.env.MINIMAX_API_KEY || '',
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    minimaxModel: process.env.MINIMAX_MODEL || 'MiniMax-M3',
    geoflowApiBaseUrl: process.env.GEFLOW_API_BASE_URL || '',
    geoflowApiToken: process.env.GEFLOW_API_TOKEN || '',
    geoflowCreateJobPath: process.env.GEFLOW_CREATE_JOB_PATH || '/api/internal/article-jobs',
    geoflowTimeoutMs: readInt('GEFLOW_TIMEOUT_MS', 15000),
    geoflowMaxRetries: readInt('GEFLOW_MAX_RETRIES', 2),
    geoflowDryRun: readBool('GEFLOW_DRY_RUN', true),
    internalAdminToken: process.env.INTERNAL_ADMIN_TOKEN || '',
    internalAdminCookieName: process.env.INTERNAL_ADMIN_COOKIE_NAME || 'ops_admin_token',
    internalAdminSessionCookieName: process.env.INTERNAL_ADMIN_SESSION_COOKIE_NAME || 'ops_admin_session',
    internalAdminSessionSecret: process.env.INTERNAL_ADMIN_SESSION_SECRET || '',
    internalAdminUsers: process.env.INTERNAL_ADMIN_USERS || ''
  };
}
