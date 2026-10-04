INSERT INTO plans (
  id,
  name,
  description,
  monthly_prompt_limit,
  model_limit,
  competitor_limit,
  weekly_runs_per_month,
  included_full_retests,
  content_opportunities_min,
  content_opportunities_max,
  article_drafts_min,
  article_drafts_max,
  openrouter_reserve_usd,
  monthly_provider_call_limit,
  retry_buffer_percent,
  status
)
VALUES
  ('starter', 'Starter', 'Starter AI visibility monitoring plan for one brand.', 12, 3, 3, 90, 1, 2, 4, 2, 2, 5, 4000, 25, 'active'),
  ('pro', 'Pro', 'Main commercial AI visibility loop plan.', 24, 5, 5, 150, 2, 4, 8, 4, 4, 30, 10000, 25, 'active'),
  ('god', 'God', 'High-touch AI visibility and content growth plan.', 50, 8, 10, 240, 4, 10, 20, 8, 8, 200, 25000, 25, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_prompt_limit = EXCLUDED.monthly_prompt_limit,
  model_limit = EXCLUDED.model_limit,
  competitor_limit = EXCLUDED.competitor_limit,
  weekly_runs_per_month = EXCLUDED.weekly_runs_per_month,
  included_full_retests = EXCLUDED.included_full_retests,
  content_opportunities_min = EXCLUDED.content_opportunities_min,
  content_opportunities_max = EXCLUDED.content_opportunities_max,
  article_drafts_min = EXCLUDED.article_drafts_min,
  article_drafts_max = EXCLUDED.article_drafts_max,
  openrouter_reserve_usd = EXCLUDED.openrouter_reserve_usd,
  monthly_provider_call_limit = EXCLUDED.monthly_provider_call_limit,
  retry_buffer_percent = EXCLUDED.retry_buffer_percent,
  status = EXCLUDED.status,
  updated_at = NOW();

UPDATE customers
SET plan_code = 'starter',
    updated_at = NOW()
WHERE plan_code = 'basic';

UPDATE plans
SET status = 'legacy',
    updated_at = NOW()
WHERE id = 'basic';
