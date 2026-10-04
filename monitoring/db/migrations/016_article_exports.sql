CREATE TABLE IF NOT EXISTS article_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_quality_review_id UUID NOT NULL REFERENCES article_quality_reviews(id) ON DELETE CASCADE,
  article_draft_expansion_id UUID NOT NULL REFERENCES article_draft_expansions(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  export_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_for_download',
  export_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_quality_review_id)
);

CREATE INDEX IF NOT EXISTS idx_article_exports_run ON article_exports (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_exports_review ON article_exports (article_quality_review_id);
CREATE INDEX IF NOT EXISTS idx_article_exports_status ON article_exports (status);
