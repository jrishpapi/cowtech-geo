-- Phase 4 GEORankHub parity and CowTech execution loop.
-- Dark by construction: all user-visible enhancement, transport, spend and publish flags remain disabled.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase4_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  page_readiness_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  company_intake_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_prompt_discovery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_backlog_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  remediation_tools_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  report_qa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cowtech_enhancements_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dry_run_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  real_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_version TEXT NOT NULL DEFAULT 'phase4-georankhub-parity-loop-v1',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase4_flags_contract_ck CHECK (contract_version = 'phase4-georankhub-parity-loop-v1'),
  CONSTRAINT phase4_flags_metadata_ck CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase4_flags_enhancement_dependency_ck CHECK (
    NOT cowtech_enhancements_enabled OR (
      page_readiness_enabled AND company_intake_enabled AND evidence_prompt_discovery_enabled
      AND evidence_backlog_enabled AND remediation_tools_enabled AND report_qa_enabled
    )
  ),
  CONSTRAINT phase4_flags_dry_run_dependency_ck CHECK (
    NOT dry_run_execution_enabled OR cowtech_enhancements_enabled
  ),
  CONSTRAINT phase4_flags_live_dependency_ck CHECK (
    NOT live_transport_enabled OR (dry_run_execution_enabled AND external_spend_enabled)
  ),
  CONSTRAINT phase4_flags_paid_dependency_ck CHECK (
    NOT paid_transport_enabled OR (live_transport_enabled AND external_spend_enabled)
  ),
  CONSTRAINT phase4_flags_publish_dependency_ck CHECK (
    NOT real_publish_enabled OR live_transport_enabled
  )
);

INSERT INTO phase4_feature_flags (scope_key) VALUES ('global')
ON CONFLICT (scope_key) DO UPDATE SET
  page_readiness_enabled=FALSE,
  company_intake_enabled=FALSE,
  evidence_prompt_discovery_enabled=FALSE,
  evidence_backlog_enabled=FALSE,
  remediation_tools_enabled=FALSE,
  report_qa_enabled=FALSE,
  cowtech_enhancements_enabled=FALSE,
  dry_run_execution_enabled=FALSE,
  live_transport_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  real_publish_enabled=FALSE,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS phase4_company_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('insufficient_evidence','needs_human_review','approved','rejected')),
  source_pages JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_pages)='array'),
  facts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(facts)='array'),
  destinations JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(destinations)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phase4_intakes_tenant_brand ON phase4_company_intakes(tenant_id, brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS phase4_page_readiness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  assessment JSONB NOT NULL CHECK (jsonb_typeof(assessment)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, page_url, snapshot_sha256)
);
CREATE INDEX IF NOT EXISTS idx_phase4_readiness_tenant_brand ON phase4_page_readiness_snapshots(tenant_id, brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS phase4_prompt_discovery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  dimensions JSONB NOT NULL CHECK (jsonb_typeof(dimensions)='array'),
  candidates JSONB NOT NULL CHECK (jsonb_typeof(candidates)='array'),
  metric_evidence JSONB NOT NULL CHECK (jsonb_typeof(metric_evidence)='array'),
  synthetic_scores_forbidden BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic_scores_forbidden),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phase4_discovery_tenant_brand ON phase4_prompt_discovery_snapshots(tenant_id, brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS phase4_geoflow_backlog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_payload JSONB NOT NULL CHECK (jsonb_typeof(item_payload)='object'),
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','pending_review','approved','dry_run_handoff','retest_handoff')),
  external_dispatch_executed BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT external_dispatch_executed),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, item_key)
);

CREATE TABLE IF NOT EXISTS phase4_artifact_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('json_ld','llms_txt','geo_title_pack','knowledge_base_draft')),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  state TEXT NOT NULL CHECK (state IN ('generated','validated','approved','published_dry_run','retest_handoff')),
  content TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  review_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(review_payload)='object'),
  external_publish_executed BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT external_publish_executed),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, artifact_type, version_number)
);

CREATE TABLE IF NOT EXISTS phase4_report_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  share_token_hash TEXT,
  export_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phase4_conversations_tenant_brand ON phase4_report_conversations(tenant_id, brand_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS phase4_report_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES phase4_report_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(citations)='array'),
  feedback TEXT CHECK (feedback IS NULL OR feedback IN ('helpful','not_helpful','incorrect_citation')),
  suggested_task_status TEXT CHECK (suggested_task_status IS NULL OR suggested_task_status='pending_review'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phase4_messages_conversation ON phase4_report_messages(tenant_id, conversation_id, created_at);
