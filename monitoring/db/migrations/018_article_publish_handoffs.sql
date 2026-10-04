CREATE TABLE IF NOT EXISTS article_publish_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_export_package_id UUID NOT NULL REFERENCES article_export_packages(id) ON DELETE CASCADE,
  article_export_id UUID NOT NULL REFERENCES article_exports(id) ON DELETE CASCADE,
  handoff_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'customer_review',
  publish_status TEXT NOT NULL DEFAULT 'not_published',
  handoff_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_export_package_id)
);

CREATE INDEX IF NOT EXISTS idx_article_publish_handoffs_run ON article_publish_handoffs (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_publish_handoffs_package ON article_publish_handoffs (article_export_package_id);
CREATE INDEX IF NOT EXISTS idx_article_publish_handoffs_export ON article_publish_handoffs (article_export_id);
CREATE INDEX IF NOT EXISTS idx_article_publish_handoffs_status ON article_publish_handoffs (status);
CREATE INDEX IF NOT EXISTS idx_article_publish_handoffs_publish_status ON article_publish_handoffs (publish_status);
