ALTER TABLE brand_monitoring_configs
  ADD COLUMN IF NOT EXISTS live_provider_gate JSONB NOT NULL DEFAULT '{}'::jsonb;
