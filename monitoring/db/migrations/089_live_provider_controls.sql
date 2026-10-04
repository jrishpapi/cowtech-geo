ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS live_provider_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_provider_status TEXT NOT NULL DEFAULT 'mock_only',
  ADD COLUMN IF NOT EXISTS daily_provider_call_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_provider_cost_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE plans
SET live_provider_enabled = FALSE,
    live_provider_status = 'mock_only',
    daily_provider_call_limit = CASE id
      WHEN 'starter' THEN 150
      WHEN 'pro' THEN 400
      WHEN 'god' THEN 1000
      ELSE daily_provider_call_limit
    END,
    monthly_provider_cost_limit_usd = CASE id
      WHEN 'starter' THEN 75
      WHEN 'pro' THEN 250
      WHEN 'god' THEN 800
      ELSE monthly_provider_cost_limit_usd
    END,
    updated_at = NOW()
WHERE id IN ('starter', 'pro', 'god');
