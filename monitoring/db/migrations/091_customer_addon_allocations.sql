CREATE TABLE IF NOT EXISTS customer_addon_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  addon_code TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  billing_status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'paypal_addon_bridge',
  cycle_month TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addon_allocations_customer
  ON customer_addon_allocations (customer_id, cycle_month DESC);

CREATE INDEX IF NOT EXISTS idx_customer_addon_allocations_code
  ON customer_addon_allocations (addon_code, billing_status);
