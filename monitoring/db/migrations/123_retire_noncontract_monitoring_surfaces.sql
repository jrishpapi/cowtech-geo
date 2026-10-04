-- Historical monitoring rows can outlive a plan change because the surface
-- configurator used to upsert the new matrix without retiring the old one.
-- Preserve the rows for audit history while excluding them from the active
-- customer contract.
UPDATE brand_monitoring_surface_configs AS surface
SET status = 'retired',
    updated_at = NOW()
FROM brands AS brand
JOIN customers AS customer ON customer.id = brand.customer_id
WHERE surface.brand_id = brand.id
  AND surface.status <> 'retired'
  AND (
    (customer.plan_code = 'starter' AND surface.surface_key <> ALL (ARRAY['chatgpt', 'perplexity', 'google_aio']))
    OR
    (customer.plan_code = 'pro' AND surface.surface_key <> ALL (ARRAY['chatgpt', 'perplexity', 'google_aio', 'gemini', 'grok']))
    OR
    (customer.plan_code = 'god' AND surface.surface_key <> ALL (ARRAY['chatgpt', 'perplexity', 'google_aio', 'gemini', 'grok', 'qwen', 'deepseek', 'mistral']))
    OR
    (customer.plan_code NOT IN ('starter', 'pro', 'god'))
  );
