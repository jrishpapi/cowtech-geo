CREATE TABLE IF NOT EXISTS brand_monitoring_surface_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES brand_monitoring_configs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  surface_key TEXT NOT NULL,
  provider_mode TEXT NOT NULL,
  engine_group TEXT NOT NULL,
  cadence_days INTEGER NOT NULL DEFAULT 7,
  allow_paid_provider BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  region TEXT NOT NULL DEFAULT 'US',
  language TEXT NOT NULL DEFAULT 'en',
  next_run_at TIMESTAMPTZ,
  last_scheduled_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (config_id, surface_key)
);

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_surface_configs_due
  ON brand_monitoring_surface_configs (status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_surface_configs_brand
  ON brand_monitoring_surface_configs (brand_id, surface_key, status);
