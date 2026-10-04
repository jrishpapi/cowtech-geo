CREATE TABLE IF NOT EXISTS brand_monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  baseline_tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  prompt_set_id UUID REFERENCES prompt_sets(id) ON DELETE SET NULL,
  cadence_days INTEGER NOT NULL DEFAULT 30,
  provider_mode TEXT NOT NULL DEFAULT 'mock',
  allow_paid_provider BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  alert_thresholds JSONB NOT NULL DEFAULT '{"visibility_drop":5,"source_quality_drop":5,"competitor_pressure_increase":5}'::jsonb,
  next_run_at TIMESTAMPTZ,
  last_scheduled_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_configs_due
  ON brand_monitoring_configs (status, next_run_at);

CREATE TABLE IF NOT EXISTS brand_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES brand_monitoring_configs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_key TEXT,
  previous_value NUMERIC(8,2),
  current_value NUMERIC(8,2),
  delta_value NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  UNIQUE (config_id, tracking_run_id, alert_type, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_alerts_brand_created
  ON brand_monitoring_alerts (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_monitoring_alerts_status
  ON brand_monitoring_alerts (status, severity);
