CREATE TABLE IF NOT EXISTS article_draft_expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  expansion_key TEXT NOT NULL,
  provider_mode TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'expanded_draft',
  expansion_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_review JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_draft_id, provider_mode)
);

CREATE INDEX IF NOT EXISTS idx_article_draft_expansions_run ON article_draft_expansions (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_draft_expansions_draft ON article_draft_expansions (article_draft_id);
CREATE INDEX IF NOT EXISTS idx_article_draft_expansions_status ON article_draft_expansions (status);
