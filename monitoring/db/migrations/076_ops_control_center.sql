CREATE TABLE IF NOT EXISTS ops_runtime_settings (
  id TEXT PRIMARY KEY,
  live_provider_testing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_provider_mode TEXT NOT NULL DEFAULT 'mock',
  max_estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0.05,
  default_brand_name TEXT NOT NULL DEFAULT '',
  default_prompt_index INTEGER NOT NULL DEFAULT 0,
  default_model_index INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ops_runtime_settings_provider_mode_check
    CHECK (default_provider_mode IN ('mock', 'openrouter')),
  CONSTRAINT ops_runtime_settings_budget_check
    CHECK (max_estimated_cost_usd >= 0 AND max_estimated_cost_usd <= 5),
  CONSTRAINT ops_runtime_settings_prompt_index_check
    CHECK (default_prompt_index >= 0),
  CONSTRAINT ops_runtime_settings_model_index_check
    CHECK (default_model_index >= 0)
);

INSERT INTO ops_runtime_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
