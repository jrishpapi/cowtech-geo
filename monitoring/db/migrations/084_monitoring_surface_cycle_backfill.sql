INSERT INTO brand_monitoring_surface_configs (
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
SELECT bmc.id,
       bmc.brand_id,
       CASE
         WHEN bmc.provider_mode = 'perplexity' THEN 'perplexity'
         WHEN bmc.provider_mode = 'google_ai_overview' THEN 'google_aio'
         WHEN bmc.provider_mode = 'chatgpt_api_like' THEN 'chatgpt'
         WHEN bmc.provider_mode = 'gemini_api_like' THEN 'gemini'
         WHEN bmc.provider_mode = 'claude_api_like' THEN 'claude'
         WHEN bmc.provider_mode = 'grok_api_like' THEN 'grok'
         WHEN bmc.provider_mode = 'openrouter' THEN 'openrouter_baseline'
         ELSE 'safe_test'
       END AS surface_key,
       bmc.provider_mode,
       bmc.engine_group,
       bmc.cadence_days,
       bmc.allow_paid_provider,
       CASE
         WHEN bmc.provider_mode = 'mock' THEN bmc.status
         WHEN bmc.allow_paid_provider = TRUE THEN bmc.status
         ELSE 'paused'
       END AS status,
       bmc.region,
       bmc.language,
       bmc.next_run_at
FROM brand_monitoring_configs bmc
WHERE NOT EXISTS (
  SELECT 1
  FROM brand_monitoring_surface_configs bmsc
  WHERE bmsc.config_id = bmc.id
);
