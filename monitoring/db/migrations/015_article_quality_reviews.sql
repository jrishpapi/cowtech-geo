CREATE TABLE IF NOT EXISTS article_quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_draft_expansion_id UUID NOT NULL REFERENCES article_draft_expansions(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  review_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_human_review',
  human_review_status TEXT NOT NULL DEFAULT 'pending',
  review_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  machine_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_draft_expansion_id)
);

CREATE INDEX IF NOT EXISTS idx_article_quality_reviews_run ON article_quality_reviews (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_quality_reviews_expansion ON article_quality_reviews (article_draft_expansion_id);
CREATE INDEX IF NOT EXISTS idx_article_quality_reviews_status ON article_quality_reviews (status);
CREATE INDEX IF NOT EXISTS idx_article_quality_reviews_human_status ON article_quality_reviews (human_review_status);
