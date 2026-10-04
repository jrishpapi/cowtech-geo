-- Phase 6 final acceptance waiver.
-- Authority: Telegram message 13638, 2026-08-01.
-- This waives only supplier statement reconciliation and the 30-item
-- human golden/parser review. Delivery, verified evidence, audited failures,
-- and Grok/Qwen verified bulk remain mandatory. Spend stays disarmed.
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
  contract_version='phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers',
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase6_feature_flags
  ADD CONSTRAINT phase6_flags_contract_ck CHECK (
    contract_version='phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers'
  );
ALTER TABLE phase6_feature_flags
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers';

ALTER TABLE phase6_smoke_runs
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers';
ALTER TABLE phase6_smoke_runs
  DROP CONSTRAINT IF EXISTS phase6_run_contract_ck;
ALTER TABLE phase6_smoke_runs
  ADD CONSTRAINT phase6_run_contract_ck CHECK (
    contract_version IN (
      'phase6-guest-surface-smoke-v1',
      'phase6-guest-first-official-api-hybrid-v2',
      'phase6-guest-first-grok-api-flex-v3',
      'phase6-guest-first-grok-api-flex-v4-95pct',
      'phase6-guest-first-grok-api-flex-v5-95pct-authorized-waivers'
    )
  );

CREATE TABLE IF NOT EXISTS phase6_exit_gate_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_ref TEXT NOT NULL UNIQUE CHECK (length(btrim(authority_ref)) > 0),
  supplier_reconciliation_waived BOOLEAN NOT NULL,
  human_golden_parser_review_waived BOOLEAN NOT NULL,
  retained_criteria JSONB NOT NULL CHECK (jsonb_typeof(retained_criteria)='object'),
  authority_text TEXT NOT NULL CHECK (length(btrim(authority_text)) > 0),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase6_exit_gate_waiver_scope_ck CHECK (
    supplier_reconciliation_waived=TRUE AND
    human_golden_parser_review_waived=TRUE AND
    retained_criteria @> '{"delivery_minimum":0.95,"verified_evidence_required":true,"failure_audit_required":true,"grok_qwen_verified_bulk_required":true}'::jsonb
  )
);

INSERT INTO phase6_exit_gate_waivers(
  authority_ref,supplier_reconciliation_waived,human_golden_parser_review_waived,
  retained_criteria,authority_text
) VALUES (
  'telegram-13638',TRUE,TRUE,
  '{"delivery_minimum":0.95,"verified_evidence_required":true,"failure_audit_required":true,"grok_qwen_verified_bulk_required":true}'::jsonb,
  'Waive four-supplier authoritative account reconciliation and 30-item human golden/parser manual review; accept Phase 6 only on >=95% delivery, verified evidence, real failure audit, and Grok/Qwen verified bulk; mark Phase 6 COMPLETE.'
) ON CONFLICT (authority_ref) DO NOTHING;

ALTER TABLE phase6_exit_gate_decisions
  ADD COLUMN IF NOT EXISTS waiver_id UUID REFERENCES phase6_exit_gate_waivers(id);
