CREATE TABLE IF NOT EXISTS article_export_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_export_id UUID NOT NULL REFERENCES article_exports(id) ON DELETE CASCADE,
  package_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_for_dashboard',
  package_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_export_id)
);

CREATE INDEX IF NOT EXISTS idx_article_export_packages_run ON article_export_packages (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_export_packages_export ON article_export_packages (article_export_id);
CREATE INDEX IF NOT EXISTS idx_article_export_packages_status ON article_export_packages (status);
