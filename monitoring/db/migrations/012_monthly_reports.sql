CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  report_month TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  report_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_run_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_brand_month ON monthly_reports (brand_id, report_month);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_run ON monthly_reports (tracking_run_id);
