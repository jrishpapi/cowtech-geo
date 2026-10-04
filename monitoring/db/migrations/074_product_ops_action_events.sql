CREATE TABLE IF NOT EXISTS product_ops_action_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL,
  actor TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_visible_impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_ops_action_events_action_created
  ON product_ops_action_events (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_ops_action_events_target
  ON product_ops_action_events (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_product_ops_action_events_status
  ON product_ops_action_events (status);
