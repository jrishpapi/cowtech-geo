CREATE TABLE IF NOT EXISTS article_production_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  content_brief_id UUID REFERENCES content_briefs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'geoflow',
  production_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_for_external_production',
  outbound_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  callback_contract JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_draft_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_article_production_handoffs_run ON article_production_handoffs (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_production_handoffs_draft ON article_production_handoffs (article_draft_id);
CREATE INDEX IF NOT EXISTS idx_article_production_handoffs_status ON article_production_handoffs (status);
CREATE INDEX IF NOT EXISTS idx_article_production_handoffs_provider ON article_production_handoffs (provider);
