UPDATE plans
SET live_provider_enabled = TRUE,
    live_provider_status = 'enabled',
    monitoring_run_cost_limit_usd = CASE id
      WHEN 'starter' THEN 0.15
      WHEN 'pro' THEN 0.30
      WHEN 'god' THEN 0.60
      ELSE monitoring_run_cost_limit_usd
    END,
    monthly_provider_cost_limit_usd = CASE id
      WHEN 'starter' THEN 75.00
      WHEN 'pro' THEN 250.00
      WHEN 'god' THEN 800.00
      ELSE monthly_provider_cost_limit_usd
    END,
    updated_at = NOW()
WHERE id IN ('starter', 'pro', 'god');
