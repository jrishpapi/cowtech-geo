CREATE INDEX IF NOT EXISTS idx_tracking_runs_brand_status ON tracking_runs (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_tracking_runs_created_at ON tracking_runs (created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_results_run ON prompt_results (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_prompt_results_status ON prompt_results (status);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_customer_created ON usage_ledger (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_brand_created ON usage_ledger (brand_id, created_at);
