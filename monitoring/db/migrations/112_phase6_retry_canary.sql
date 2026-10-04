-- Durable Phase 6 prerequisite canaries for controlled structural retries.
-- Applying this migration always disarms live/paid transport.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

UPDATE phase6_feature_flags SET
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  approved_budget_micro_usd=0,
  updated_at=NOW()
WHERE scope_key='global';

CREATE TABLE IF NOT EXISTS phase6_retry_canaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  surface TEXT NOT NULL,
  source_item_key TEXT NOT NULL,
  route_policy TEXT NOT NULL,
  selected_route TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  requested_geo JSONB NOT NULL CHECK (jsonb_typeof(requested_geo)='object'),
  prompt_sha256 TEXT NOT NULL CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'prepared',
  permit_id UUID,
  max_cost_micro_usd BIGINT CHECK (max_cost_micro_usd > 0),
  settled_cost_micro_usd BIGINT CHECK (settled_cost_micro_usd >= 0),
  cost_basis TEXT,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT phase6_retry_canary_surface_ck CHECK (surface='chatgpt_ui'),
  CONSTRAINT phase6_retry_canary_status_ck CHECK (
    status IN ('prepared','running','passed','failed')
  ),
  UNIQUE(smoke_run_id,authority_ref)
);

CREATE TABLE IF NOT EXISTS phase6_retry_canary_evidence_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canary_id UUID NOT NULL REFERENCES phase6_retry_canaries(id) ON DELETE CASCADE,
  object_path TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_size_bytes BIGINT NOT NULL CHECK (content_size_bytes > 0),
  status TEXT NOT NULL DEFAULT 'prepared',
  retention_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  CONSTRAINT phase6_retry_canary_evidence_status_ck CHECK (
    status IN ('prepared','verified','failed')
  ),
  UNIQUE(canary_id,object_path)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phase6_one_active_retry_canary_per_run
  ON phase6_retry_canaries(smoke_run_id)
  WHERE status IN ('prepared','running');
