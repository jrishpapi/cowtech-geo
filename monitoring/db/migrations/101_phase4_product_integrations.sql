-- Phase 4 customer entitlement and auditable repository integration.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase4_customer_entitlements (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  page_readiness_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  company_intake_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_prompt_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_backlog_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  remediation_tools_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  report_qa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  entitlement_source TEXT NOT NULL DEFAULT 'not_entitled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase4_entitlement_source_ck CHECK (
    entitlement_source IN ('not_entitled','plan','addon','admin_override','fixture')
  )
);

CREATE TABLE IF NOT EXISTS phase4_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(before_payload)='object'),
  after_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(after_payload)='object'),
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_refs)='array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase4_audit_action_ck CHECK (length(btrim(action)) > 0),
  CONSTRAINT phase4_audit_actor_ck CHECK (length(btrim(actor)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_phase4_audit_tenant_brand
  ON phase4_audit_events(tenant_id, brand_id, created_at DESC);

ALTER TABLE phase4_report_conversations
  ADD CONSTRAINT phase4_report_conversation_id_tenant_uq UNIQUE (id, tenant_id);

ALTER TABLE phase4_report_messages
  DROP CONSTRAINT IF EXISTS phase4_report_messages_conversation_id_fkey;

ALTER TABLE phase4_report_messages
  ADD CONSTRAINT phase4_report_messages_conversation_tenant_fk
  FOREIGN KEY (conversation_id, tenant_id)
  REFERENCES phase4_report_conversations(id, tenant_id)
  ON DELETE CASCADE;
