CREATE TABLE IF NOT EXISTS customer_monthly_fulfillment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  cycle_month TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_label TEXT NOT NULL,
  quota_units INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_type TEXT,
  job_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, cycle_month, item_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_monthly_fulfillment_items_due
  ON customer_monthly_fulfillment_items (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_customer_monthly_fulfillment_items_run
  ON customer_monthly_fulfillment_items (tracking_run_id, cycle_month);

CREATE INDEX IF NOT EXISTS idx_customer_monthly_fulfillment_items_brand
  ON customer_monthly_fulfillment_items (brand_id, cycle_month DESC);
