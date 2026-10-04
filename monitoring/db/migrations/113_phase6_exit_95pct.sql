-- Phase 6 exit amendment: >=95% valid delivery per surface.
-- Authority: telegram-13635. Applying this migration always disarms live spend.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase6_feature_flags
  DROP CONSTRAINT IF EXISTS phase6_flags_contract_ck;
UPDATE phase6_feature_flags SET
  smoke_contract_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  approved_budget_micro_usd=0,
  contract_version='phase6-guest-first-grok-api-flex-v4-95pct',
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase6_feature_flags
  ADD CONSTRAINT phase6_flags_contract_ck CHECK (
    contract_version='phase6-guest-first-grok-api-flex-v4-95pct'
  );
ALTER TABLE phase6_feature_flags
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v4-95pct';

ALTER TABLE phase6_smoke_runs
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v4-95pct';
ALTER TABLE phase6_smoke_runs
  DROP CONSTRAINT IF EXISTS phase6_run_contract_ck;
ALTER TABLE phase6_smoke_runs
  ADD CONSTRAINT phase6_run_contract_ck CHECK (
    contract_version IN (
      'phase6-guest-surface-smoke-v1',
      'phase6-guest-first-official-api-hybrid-v2',
      'phase6-guest-first-grok-api-flex-v3',
      'phase6-guest-first-grok-api-flex-v4-95pct'
    )
  );

CREATE TABLE IF NOT EXISTS phase6_exit_gate_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_ref TEXT NOT NULL UNIQUE CHECK (length(btrim(authority_ref)) > 0),
  previous_delivery_minimum NUMERIC(5,4) NOT NULL,
  amended_delivery_minimum NUMERIC(5,4) NOT NULL,
  criteria JSONB NOT NULL CHECK (jsonb_typeof(criteria)='object'),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase6_exit_threshold_ck CHECK (
    previous_delivery_minimum=0.97 AND amended_delivery_minimum=0.95
  )
);

INSERT INTO phase6_exit_gate_amendments(
  authority_ref,previous_delivery_minimum,amended_delivery_minimum,criteria
) VALUES (
  'telegram-13635',0.97,0.95,
  '{"terminal_failures_preserved":true,"delivery_evidence_required":true,"failed_answer_evidence_not_fabricated":true,"parser_minimum":0.99,"supplier_reconciliation_required":true,"human_golden_required":true,"phase7_separate_authority_required":true}'::jsonb
) ON CONFLICT (authority_ref) DO NOTHING;

CREATE TABLE IF NOT EXISTS phase6_human_golden_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  selection_seed TEXT NOT NULL CHECK (length(btrim(selection_seed)) > 0),
  evidence_ref TEXT NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
  reviewer_id TEXT NOT NULL CHECK (length(btrim(reviewer_id)) > 0),
  reviewed_at TIMESTAMPTZ NOT NULL,
  answer_boundary_correct BOOLEAN NOT NULL,
  citations_correct BOOLEAN NOT NULL,
  brand_mentions_correct BOOLEAN NOT NULL,
  provenance_correct BOOLEAN NOT NULL,
  review_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(review_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(smoke_run_id,item_key,selection_seed)
);

CREATE TABLE IF NOT EXISTS phase6_exit_gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  amendment_id UUID NOT NULL REFERENCES phase6_exit_gate_amendments(id),
  completion_authority_ref TEXT NOT NULL CHECK (length(btrim(completion_authority_ref)) > 0),
  status TEXT NOT NULL,
  smoke_evaluation JSONB NOT NULL CHECK (jsonb_typeof(smoke_evaluation)='object'),
  human_evaluation JSONB NOT NULL CHECK (jsonb_typeof(human_evaluation)='object'),
  supplier_evaluation JSONB NOT NULL CHECK (jsonb_typeof(supplier_evaluation)='object'),
  canary_evaluation JSONB NOT NULL CHECK (jsonb_typeof(canary_evaluation)='object'),
  selected_item_keys JSONB NOT NULL CHECK (jsonb_typeof(selected_item_keys)='array'),
  blockers JSONB NOT NULL CHECK (jsonb_typeof(blockers)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT phase6_exit_decision_status_ck CHECK (
    status IN ('blocked','complete')
  ),
  CONSTRAINT phase6_exit_decision_complete_ck CHECK (
    (status='complete' AND completed_at IS NOT NULL AND jsonb_array_length(blockers)=0)
    OR status='blocked'
  ),
  UNIQUE(smoke_run_id,completion_authority_ref)
);
