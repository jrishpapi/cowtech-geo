-- Phase 8 addendum: integrate Phase 4 commercial contracts and fulfillment wiring.
-- This migration is dark by default and cannot activate billing, dispatch or publishing.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase4_customer_entitlements
  ADD COLUMN IF NOT EXISTS plan_code TEXT,
  ADD COLUMN IF NOT EXISTS contract_version TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ref TEXT,
  ADD COLUMN IF NOT EXISTS billing_event_ref TEXT,
  ADD COLUMN IF NOT EXISTS quota_contract JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(quota_contract)='object');

CREATE UNIQUE INDEX IF NOT EXISTS idx_phase4_entitlement_billing_event
  ON phase4_customer_entitlements(billing_event_ref)
  WHERE billing_event_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS phase8_customer_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  intake_id UUID REFERENCES phase4_company_intakes(id) ON DELETE SET NULL,
  source_fact_id TEXT NOT NULL,
  chunk_payload JSONB NOT NULL CHECK (jsonb_typeof(chunk_payload)='object'),
  human_review_status TEXT NOT NULL DEFAULT 'needs_review',
  production_apply_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id,brand_id,source_fact_id),
  CONSTRAINT phase8_knowledge_review_ck CHECK (
    human_review_status IN ('needs_review','approved','rejected')
  ),
  CONSTRAINT phase8_knowledge_dark_ck CHECK (production_apply_allowed=FALSE)
);

CREATE TABLE IF NOT EXISTS phase8_geoflow_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  backlog_item_id UUID REFERENCES phase4_geoflow_backlog_items(id) ON DELETE SET NULL,
  material_payload JSONB NOT NULL CHECK (jsonb_typeof(material_payload)='object'),
  human_review_status TEXT NOT NULL DEFAULT 'needs_review',
  dispatch_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_geoflow_material_review_ck CHECK (
    human_review_status IN ('needs_review','approved','rejected')
  ),
  CONSTRAINT phase8_geoflow_material_dark_ck CHECK (
    dispatch_allowed=FALSE AND dispatched_at IS NULL
  )
);

CREATE TABLE IF NOT EXISTS phase8_real_order_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter','pro','god')),
  checks JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checks)='object'),
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs)='array'),
  status TEXT NOT NULL DEFAULT 'commercial_blocked',
  authoritative BOOLEAN NOT NULL DEFAULT FALSE,
  production_apply_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_order_acceptance_status_ck CHECK (
    status IN ('commercial_blocked','ready_for_review','accepted','rejected')
  ),
  CONSTRAINT phase8_order_acceptance_dark_ck CHECK (
    status='commercial_blocked'
    AND authoritative=FALSE
    AND production_apply_allowed=FALSE
  )
);

ALTER TABLE phase8_feature_flags
  ADD COLUMN IF NOT EXISTS billing_entitlement_apply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intake_projection_apply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS geoflow_dispatch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS real_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS real_order_acceptance_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE phase8_feature_flags
SET billing_entitlement_apply_enabled=FALSE,
    intake_projection_apply_enabled=FALSE,
    geoflow_dispatch_enabled=FALSE,
    real_publish_enabled=FALSE,
    real_order_acceptance_enabled=FALSE,
    updated_at=NOW();
