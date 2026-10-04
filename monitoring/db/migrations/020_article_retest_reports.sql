CREATE TABLE IF NOT EXISTS article_retest_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_retest_schedule_id UUID NOT NULL REFERENCES article_retest_schedules(id) ON DELETE CASCADE,
  retest_tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  report_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_for_dashboard',
  report_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_retest_schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_article_retest_reports_run ON article_retest_reports (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_reports_schedule ON article_retest_reports (article_retest_schedule_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_reports_retest_run ON article_retest_reports (retest_tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_reports_status ON article_retest_reports (status);
