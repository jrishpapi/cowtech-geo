ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monitoring_run_cost_limit_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_provider_cost_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS live_provider_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE plans
SET monitoring_run_cost_limit_usd = 0.05,
    daily_provider_cost_limit_usd = 0.50,
    monthly_provider_cost_limit_usd = 5.00,
    updated_at = NOW()
WHERE id = 'starter';

UPDATE plans
SET monitoring_run_cost_limit_usd = 0,
    daily_provider_cost_limit_usd = 0,
    live_provider_enabled = FALSE,
    live_provider_status = 'mock_only',
    updated_at = NOW()
WHERE id IN ('pro', 'god');

UPDATE customers
SET live_provider_enabled = FALSE,
    updated_at = NOW();
