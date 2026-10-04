ALTER TABLE brand_monitoring_configs
  ADD COLUMN IF NOT EXISTS engine_group TEXT NOT NULL DEFAULT 'openrouter_llm',
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_configs_engine_region
  ON brand_monitoring_configs (engine_group, region, language, status);

UPDATE tracking_runs
SET region = COALESCE(region, 'US'),
    language = COALESCE(language, 'en')
WHERE region IS NULL OR language IS NULL;

UPDATE prompt_results
SET engine = COALESCE(engine, CASE WHEN provider_id = 'openrouter' THEN 'openrouter_llm' ELSE 'mock_llm' END),
    region = COALESCE(region, 'US'),
    language = COALESCE(language, 'en')
WHERE engine IS NULL OR region IS NULL OR language IS NULL;
