CREATE TABLE IF NOT EXISTS deep_article_evidence_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  pack_key TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_mode TEXT NOT NULL DEFAULT 'mock',
  pack_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deep_article_evidence_packs_status_check CHECK (
    status IN ('needs_review', 'verified_with_measured_result')
  ),
  CONSTRAINT deep_article_evidence_packs_provider_mode_check CHECK (
    provider_mode IN ('mock', 'manual', 'paid_provider_gated', 'multi_source_evidence', 'openrouter_web_search')
  ),
  UNIQUE (article_draft_id, pack_key)
);

CREATE INDEX IF NOT EXISTS idx_deep_article_evidence_packs_tracking
  ON deep_article_evidence_packs (tracking_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deep_article_evidence_packs_status
  ON deep_article_evidence_packs (status, updated_at DESC);
