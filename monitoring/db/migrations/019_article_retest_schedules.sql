CREATE TABLE IF NOT EXISTS article_retest_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  article_publish_handoff_id UUID NOT NULL REFERENCES article_publish_handoffs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  retest_tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  schedule_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL,
  queued_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  baseline_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_publish_handoff_id)
);

CREATE INDEX IF NOT EXISTS idx_article_retest_schedules_run ON article_retest_schedules (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_schedules_handoff ON article_retest_schedules (article_publish_handoff_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_schedules_brand ON article_retest_schedules (brand_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_schedules_retest_run ON article_retest_schedules (retest_tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_retest_schedules_status_due ON article_retest_schedules (status, scheduled_for);
