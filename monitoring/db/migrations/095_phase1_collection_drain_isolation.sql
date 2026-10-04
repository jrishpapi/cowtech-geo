-- Keep the internal Phase 1 shadow intake independent from the legacy/generic
-- customer collection queue. This migration is deliberately fail-closed.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase1_feature_flags
  ADD COLUMN IF NOT EXISTS collection_drain_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE phase1_feature_flags
SET collection_drain_enabled = FALSE,
    updated_at = NOW();

ALTER TABLE phase1_feature_flags
  ADD CONSTRAINT phase1_feature_flags_collection_drain_dependency_ck CHECK (
    NOT collection_drain_enabled
    OR (
      worker_drain_enabled
      AND shadow_contract_enabled
      AND durable_queue_enabled
    )
  );
