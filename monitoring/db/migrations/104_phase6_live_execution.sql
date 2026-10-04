-- Durable Phase 6 transport permits, evidence receipts and supplier reconciliation.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase6_smoke_items
  ADD COLUMN IF NOT EXISTS prompt_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS transport_permit_id UUID,
  ADD COLUMN IF NOT EXISTS evidence_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_prompt_sha_ck;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_prompt_sha_ck CHECK (
    prompt_sha256 IS NULL OR prompt_sha256 ~ '^[0-9a-f]{64}$'
  );

CREATE TABLE IF NOT EXISTS phase6_budget_permits (
  id UUID PRIMARY KEY,
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  smoke_item_id UUID NOT NULL REFERENCES phase6_smoke_items(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL,
  max_cost_micro_usd BIGINT NOT NULL CHECK (max_cost_micro_usd > 0),
  settled_cost_micro_usd BIGINT CHECK (settled_cost_micro_usd >= 0),
  cost_basis TEXT,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  UNIQUE(smoke_item_id),
  CONSTRAINT phase6_permit_supplier_ck CHECK (supplier IN ('bright_data','serpapi','other')),
  CONSTRAINT phase6_permit_status_ck CHECK (status IN ('reserved','started','settled','released','reconciliation_required')),
  CONSTRAINT phase6_permit_cost_basis_ck CHECK (
    cost_basis IS NULL OR cost_basis IN ('supplier_actual','conservative_estimate','promotional_zero')
  )
);

CREATE TABLE IF NOT EXISTS phase6_evidence_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  smoke_item_id UUID NOT NULL REFERENCES phase6_smoke_items(id) ON DELETE CASCADE,
  object_path TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_size_bytes BIGINT NOT NULL CHECK (content_size_bytes > 0),
  status TEXT NOT NULL DEFAULT 'prepared',
  retention_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(smoke_item_id,object_path),
  CONSTRAINT phase6_evidence_status_ck CHECK (status IN ('prepared','verified','failed'))
);

CREATE TABLE IF NOT EXISTS phase6_supplier_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL,
  before_units BIGINT CHECK (before_units >= 0),
  after_units BIGINT CHECK (after_units >= 0),
  billed_cost_micro_usd BIGINT CHECK (billed_cost_micro_usd >= 0),
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  evidence_ref TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(smoke_run_id,supplier),
  CONSTRAINT phase6_reconciliation_supplier_ck CHECK (supplier IN ('bright_data','serpapi')),
  CONSTRAINT phase6_reconciliation_status_ck CHECK (
    reconciliation_status IN ('pending','reconciled','mismatch','failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase6_permits_run_status
  ON phase6_budget_permits(smoke_run_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_phase6_evidence_run_status
  ON phase6_evidence_receipts(smoke_run_id,status,created_at);
