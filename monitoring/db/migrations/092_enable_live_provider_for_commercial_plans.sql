UPDATE plans
SET live_provider_enabled = TRUE,
    live_provider_status = 'enabled',
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
