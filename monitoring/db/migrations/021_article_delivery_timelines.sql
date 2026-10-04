CREATE TABLE IF NOT EXISTS article_delivery_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_draft_id UUID NOT NULL REFERENCES article_drafts(id) ON DELETE CASCADE,
  article_export_package_id UUID REFERENCES article_export_packages(id) ON DELETE SET NULL,
  article_retest_report_id UUID REFERENCES article_retest_reports(id) ON DELETE SET NULL,
  timeline_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  timeline_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_draft_id)
);

CREATE INDEX IF NOT EXISTS idx_article_delivery_timelines_run ON article_delivery_timelines (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_delivery_timelines_draft ON article_delivery_timelines (article_draft_id);
CREATE INDEX IF NOT EXISTS idx_article_delivery_timelines_package ON article_delivery_timelines (article_export_package_id);
CREATE INDEX IF NOT EXISTS idx_article_delivery_timelines_report ON article_delivery_timelines (article_retest_report_id);
CREATE INDEX IF NOT EXISTS idx_article_delivery_timelines_status ON article_delivery_timelines (status);
