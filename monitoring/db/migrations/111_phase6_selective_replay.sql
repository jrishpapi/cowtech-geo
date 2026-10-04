-- Phase 6 selective replay and permit-overrun reconciliation.
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

CREATE TABLE IF NOT EXISTS phase6_replay_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  selection_kind TEXT NOT NULL,
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  selection_sha256 TEXT NOT NULL CHECK (selection_sha256 ~ '^[0-9a-f]{64}$'),
  selected_count INTEGER NOT NULL CHECK (selected_count > 0),
  protected_completed_count INTEGER NOT NULL CHECK (protected_completed_count >= 0),
  protected_failed_count INTEGER NOT NULL CHECK (protected_failed_count >= 0),
  status TEXT NOT NULL DEFAULT 'prepared',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT phase6_replay_selection_ck CHECK (
    selection_kind IN ('external_blocked','controlled_failed')
  ),
  CONSTRAINT phase6_replay_status_ck CHECK (
    status IN ('prepared','running','completed','failed')
  ),
  UNIQUE(smoke_run_id,authority_ref,selection_sha256)
);

ALTER TABLE phase6_smoke_items
  ADD COLUMN IF NOT EXISTS replay_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_replay_batch_id UUID;
ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_replay_count_ck;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_replay_count_ck CHECK (replay_attempt_count >= 0);
ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_replay_batch_fk;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_replay_batch_fk FOREIGN KEY (current_replay_batch_id)
  REFERENCES phase6_replay_batches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS phase6_replay_items (
  replay_batch_id UUID NOT NULL REFERENCES phase6_replay_batches(id) ON DELETE CASCADE,
  smoke_item_id UUID NOT NULL REFERENCES phase6_smoke_items(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  previous_result_payload JSONB NOT NULL CHECK (jsonb_typeof(previous_result_payload)='object'),
  error_code TEXT,
  retry_classification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'selected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(replay_batch_id,smoke_item_id),
  UNIQUE(replay_batch_id,item_key),
  CONSTRAINT phase6_replay_item_previous_ck CHECK (
    previous_status IN ('failed','external_blocked')
  ),
  CONSTRAINT phase6_replay_item_class_ck CHECK (
    retry_classification IN ('not_started','transient','structural_hold')
  ),
  CONSTRAINT phase6_replay_item_status_ck CHECK (
    status IN ('selected','running','completed','failed','external_blocked')
  )
);

ALTER TABLE phase6_budget_permits
  ADD COLUMN IF NOT EXISTS replay_batch_id UUID REFERENCES phase6_replay_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replay_sequence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliation_authority_ref TEXT,
  ADD COLUMN IF NOT EXISTS overrun_micro_usd BIGINT,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_permit_replay_sequence_ck;
ALTER TABLE phase6_budget_permits
  ADD CONSTRAINT phase6_permit_replay_sequence_ck CHECK (replay_sequence >= 0);
ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_budget_permits_smoke_item_id_key;
ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_permit_item_replay_uk;
ALTER TABLE phase6_budget_permits
  ADD CONSTRAINT phase6_permit_item_replay_uk UNIQUE(smoke_item_id,replay_sequence);
ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_permit_status_ck;
ALTER TABLE phase6_budget_permits
  ADD CONSTRAINT phase6_permit_status_ck CHECK (
    status IN (
      'reserved','started','settled','released','reconciliation_required',
      'reconciled_overrun'
    )
  );
ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_permit_overrun_ck;
ALTER TABLE phase6_budget_permits
  ADD CONSTRAINT phase6_permit_overrun_ck CHECK (
    (status='reconciled_overrun' AND settled_cost_micro_usd > max_cost_micro_usd
      AND overrun_micro_usd = settled_cost_micro_usd - max_cost_micro_usd
      AND reconciliation_authority_ref IS NOT NULL AND reconciled_at IS NOT NULL)
    OR status<>'reconciled_overrun'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_phase6_one_active_replay_per_run
  ON phase6_replay_batches(smoke_run_id)
  WHERE status IN ('prepared','running');
CREATE INDEX IF NOT EXISTS idx_phase6_replay_items_status
  ON phase6_replay_items(replay_batch_id,status,item_key);
