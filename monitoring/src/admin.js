import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function toNumber(value) {
  return Number(value || 0);
}

export async function listTrackingRuns({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const result = await pool.query(
    `SELECT tr.id,
            tr.status,
            tr.run_type,
            tr.idempotency_key,
            tr.started_at,
            tr.finished_at,
            tr.created_at,
            b.id AS brand_id,
            b.name AS brand_name,
            b.website_url,
            c.plan_code,
            COUNT(pr.id)::int AS result_count,
            COUNT(pr.id) FILTER (WHERE pr.status = 'completed')::int AS completed_count,
            COUNT(pr.id) FILTER (WHERE pr.status = 'failed')::int AS failed_count,
            COALESCE(SUM(pr.cost_estimate_usd), 0)::numeric AS result_cost_estimate_usd
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN prompt_results pr ON pr.tracking_run_id = tr.id
     WHERE ${customerVisibleTenantPredicate('c')}
     GROUP BY tr.id, b.id, b.name, b.website_url, c.plan_code
     ORDER BY tr.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    ...row,
    result_cost_estimate_usd: toNumber(row.result_cost_estimate_usd)
  }));
}

export async function getTrackingRunSummary(trackingRunId) {
  const runResult = await pool.query(
    `SELECT tr.*,
            b.name AS brand_name,
            b.website_url,
            b.vertical,
            c.plan_code,
            c.id AS customer_id
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [trackingRunId]
  );

  if (runResult.rowCount !== 1) return null;
  const run = runResult.rows[0];

  const statusCounts = await pool.query(
    `SELECT status,
            COUNT(*)::int AS count,
            COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost_estimate_usd
     FROM prompt_results
     WHERE tracking_run_id = $1
     GROUP BY status
     ORDER BY status`,
    [trackingRunId]
  );

  const modelCounts = await pool.query(
    `SELECT model_id,
            provider_id,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
            COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost_estimate_usd
     FROM prompt_results
     WHERE tracking_run_id = $1
     GROUP BY model_id, provider_id
     ORDER BY provider_id, model_id`,
    [trackingRunId]
  );

  const categoryCounts = await pool.query(
    `SELECT p.category,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE pr.status = 'completed')::int AS completed_count,
            COUNT(*) FILTER (WHERE pr.status = 'failed')::int AS failed_count
     FROM prompt_results pr
     LEFT JOIN prompts p ON p.id = pr.prompt_id
     WHERE pr.tracking_run_id = $1
     GROUP BY p.category
     ORDER BY p.category`,
    [trackingRunId]
  );

  const usage = await pool.query(
    `SELECT COUNT(*)::int AS provider_calls,
            COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost_estimate_usd
     FROM usage_ledger
     WHERE metadata->>'tracking_run_id' = $1`,
    [trackingRunId]
  );

  const parser = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE parser_output IS NOT NULL)::int AS parsed_count,
            COUNT(*) FILTER (WHERE parser_output->'summary'->>'brand_mentioned' = 'true')::int AS brand_mention_count,
            COALESCE(SUM((parser_output->'summary'->>'competitor_mentions')::int), 0)::int AS competitor_mention_count,
            COALESCE(SUM((parser_output->'summary'->>'source_url_count')::int), 0)::int AS source_url_count,
            COALESCE(SUM((parser_output->'summary'->>'source_domain_count')::int), 0)::int AS source_domain_count,
            COALESCE(SUM((parser_output->'summary'->>'official_source_count')::int), 0)::int AS official_source_count,
            COALESCE(SUM((parser_output->'summary'->>'competitor_source_count')::int), 0)::int AS competitor_source_count,
            COALESCE(SUM((parser_output->'summary'->>'third_party_source_count')::int), 0)::int AS third_party_source_count,
            COALESCE(SUM((parser_output->'summary'->>'unknown_source_count')::int), 0)::int AS unknown_source_count,
            COALESCE(AVG(parser_confidence), 0)::numeric AS avg_parser_confidence
     FROM prompt_results
     WHERE tracking_run_id = $1`,
    [trackingRunId]
  );

  const score = await pool.query(
    `SELECT visibility_score,
            source_quality_score,
            competitor_pressure_score,
            scoring_output,
            updated_at
     FROM run_scores
     WHERE tracking_run_id = $1`,
    [trackingRunId]
  );

  const reportState = buildReportState(run, statusCounts.rows);

  return {
    run,
    report_state: reportState,
    status_counts: statusCounts.rows.map((row) => ({
      ...row,
      cost_estimate_usd: toNumber(row.cost_estimate_usd)
    })),
    model_counts: modelCounts.rows.map((row) => ({
      ...row,
      cost_estimate_usd: toNumber(row.cost_estimate_usd)
    })),
    category_counts: categoryCounts.rows,
    usage: {
      provider_calls: usage.rows[0]?.provider_calls || 0,
      cost_estimate_usd: toNumber(usage.rows[0]?.cost_estimate_usd)
    },
    parser: {
      parsed_count: parser.rows[0]?.parsed_count || 0,
      brand_mention_count: parser.rows[0]?.brand_mention_count || 0,
      competitor_mention_count: parser.rows[0]?.competitor_mention_count || 0,
      source_url_count: parser.rows[0]?.source_url_count || 0,
      source_domain_count: parser.rows[0]?.source_domain_count || 0,
      official_source_count: parser.rows[0]?.official_source_count || 0,
      competitor_source_count: parser.rows[0]?.competitor_source_count || 0,
      third_party_source_count: parser.rows[0]?.third_party_source_count || 0,
      unknown_source_count: parser.rows[0]?.unknown_source_count || 0,
      avg_parser_confidence: toNumber(parser.rows[0]?.avg_parser_confidence)
    },
    scores: score.rowCount
      ? {
          visibility_score: toNumber(score.rows[0].visibility_score),
          source_quality_score: toNumber(score.rows[0].source_quality_score),
          competitor_pressure_score: toNumber(score.rows[0].competitor_pressure_score),
          grade: score.rows[0].scoring_output?.grade || 'D',
          components: score.rows[0].scoring_output?.components || {},
          updated_at: score.rows[0].updated_at
        }
      : {
          visibility_score: null,
          source_quality_score: null,
          competitor_pressure_score: null,
          grade: null,
          components: {},
          updated_at: null
        }
  };
}

export function buildReportState(run, statusRows) {
  const total = statusRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const failed = statusRows
    .filter((row) => row.status === 'failed')
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const completed = statusRows
    .filter((row) => row.status === 'completed')
    .reduce((sum, row) => sum + Number(row.count || 0), 0);

  if (!total || run.status === 'queued' || run.status === 'running') return 'not_ready';
  if (run.status === 'failed' || failed === total) return 'failed';
  if (failed > 0 && completed > 0) return 'partial';
  if (completed === total) return 'ready';
  return 'not_ready';
}

export async function getUsageSummary({ brand_id, customer_id } = {}) {
  const filters = ["ul.event_type = 'provider_call'"];
  const values = [];

  if (brand_id) {
    values.push(brand_id);
    filters.push(`ul.brand_id = $${values.length}`);
  }

  if (customer_id) {
    values.push(customer_id);
    filters.push(`ul.customer_id = $${values.length}`);
  }

  const result = await pool.query(
    `SELECT b.id AS brand_id,
            b.name AS brand_name,
            c.plan_code,
            COUNT(*)::int AS provider_calls,
            COALESCE(SUM(ul.cost_estimate_usd), 0)::numeric AS cost_estimate_usd,
            MIN(ul.created_at) AS first_event_at,
            MAX(ul.created_at) AS last_event_at
     FROM usage_ledger ul
     LEFT JOIN brands b ON b.id = ul.brand_id
     LEFT JOIN customers c ON c.id = ul.customer_id
     WHERE ${filters.join(' AND ')}
     GROUP BY b.id, b.name, c.plan_code
     ORDER BY b.name`,
    values
  );

  return result.rows.map((row) => ({
    ...row,
    cost_estimate_usd: toNumber(row.cost_estimate_usd)
  }));
}
