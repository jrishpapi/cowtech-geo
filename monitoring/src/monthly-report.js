import { pool } from './db.js';
import { getTrackingRunReport } from './reporting.js';
import { buildCustomerReportCopy } from './monthly-report-copy.js';

function toNumber(value) {
  return Number(value || 0);
}

function reportMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function scoreRisk(score, threshold, label) {
  if (score === null || score === undefined || score >= threshold) return null;
  return {
    severity: score < threshold - 20 ? 'high' : 'medium',
    type: label,
    title: `${label} needs attention`,
    evidence: {
      score,
      threshold
    }
  };
}

function buildRisks(report) {
  const risks = [
    scoreRisk(report.scorecards.visibility.score, 70, 'visibility'),
    scoreRisk(report.scorecards.source_quality.score, 70, 'source_quality')
  ].filter(Boolean);

  if (report.scorecards.competitor_pressure.score >= 60) {
    risks.push({
      severity: report.scorecards.competitor_pressure.score >= 75 ? 'high' : 'medium',
      type: 'competitor_pressure',
      title: 'Competitors are strongly present in AI answers or sources',
      evidence: {
        score: report.scorecards.competitor_pressure.score,
        competitors: report.competitor_insights.competitors.slice(0, 5)
      }
    });
  }

  if (report.coverage.parser.third_party_source_count === 0) {
    risks.push({
      severity: 'medium',
      type: 'third_party_source_gap',
      title: 'No third-party sources were detected',
      evidence: {
        third_party_source_count: 0
      }
    });
  }

  return risks;
}

function actionPriority(item) {
  if (item.status === 'draft' && item.linked_opportunity_prompts?.length) return 0;
  if (item.status === 'needs_validated_prompt') return 2;
  return 1;
}

function buildExecutionPlan(report) {
  const briefActions = report.content_briefs
    .map((brief) => ({
      type: 'content_brief',
      status: brief.status,
      title: brief.title,
      content_type: brief.content_type,
      opportunity_type: brief.opportunity_type,
      linked_prompt_count: brief.linked_opportunity_prompts?.length || 0,
      target_metric: brief.retest_plan?.target_metric || null
    }))
    .sort((a, b) => actionPriority(a) - actionPriority(b));

  const promptActions = report.prompt_promotions.map((promotion) => ({
    type: 'prompt_promotion',
    status: promotion.status,
    title: `Track promoted prompt: ${promotion.promoted_prompt_text}`,
    target_version_number: promotion.target_version_number,
    score: toNumber(promotion.opportunity_prompt_score)
  }));

  return [...briefActions, ...promptActions].slice(0, 12);
}

function buildPromptStrategy(report) {
  const prompts = report.opportunity_prompts || [];
  const statusCounts = prompts.reduce(
    (counts, prompt) => ({
      ...counts,
      [prompt.status]: (counts[prompt.status] || 0) + 1
    }),
    {}
  );

  return {
    opportunity_prompt_count: prompts.length,
    validated_count: statusCounts.validated || 0,
    candidate_count: statusCounts.candidate || 0,
    promoted_count: statusCounts.promoted || 0,
    rejected_count: statusCounts.rejected || 0,
    promoted_prompt_count: report.prompt_promotions.length,
    top_validated_prompts: prompts
      .filter((prompt) => prompt.status === 'validated' || prompt.status === 'promoted')
      .slice(0, 8)
      .map((prompt) => ({
        prompt_text: prompt.prompt_text,
        score: toNumber(prompt.opportunity_prompt_score),
        source: prompt.prompt_source,
        category: prompt.prompt_category,
        status: prompt.status
      }))
  };
}

function buildContentSummary(report) {
  const articleReady = report.content_briefs.filter((brief) => brief.status === 'draft');
  const blocked = report.content_briefs.filter((brief) => brief.status !== 'draft');
  return {
    opportunity_count: report.content_opportunities.length,
    brief_count: report.content_briefs.length,
    article_ready_brief_count: articleReady.length,
    blocked_brief_count: blocked.length,
    opportunities: report.content_opportunities.map((opportunity) => ({
      key: opportunity.opportunity_key,
      type: opportunity.opportunity_type,
      priority: opportunity.priority,
      title: opportunity.title,
      status: opportunity.status
    })),
    article_ready_briefs: articleReady.map((brief) => ({
      title: brief.title,
      content_type: brief.content_type,
      linked_prompt_count: brief.linked_opportunity_prompts?.length || 0,
      target_metric: brief.retest_plan?.target_metric || null
    })),
    blocked_briefs: blocked.map((brief) => ({
      title: brief.title,
      content_type: brief.content_type,
      status: brief.status,
      reason: 'Needs at least one validated opportunity prompt before article drafting.'
    }))
  };
}

function buildRetestPlan(report) {
  const metricTargets = [
    report.scorecards.visibility.score < 70 ? 'visibility_score' : null,
    report.scorecards.source_quality.score < 70 ? 'source_quality_score' : null,
    report.scorecards.competitor_pressure.score >= 60 ? 'competitor_pressure_score' : null
  ].filter(Boolean);

  return {
    next_run_type: 'scheduled_retest',
    prompt_set_version_context: report.prompt_promotions.length
      ? 'Retest against the promoted prompt set version.'
      : 'Retest against the current stable prompt set.',
    target_metrics: metricTargets.length ? metricTargets : ['trend_confidence'],
    prompts_to_watch: report.opportunity_prompts
      .filter((prompt) => prompt.status === 'validated' || prompt.status === 'promoted')
      .slice(0, 8)
      .map((prompt) => prompt.prompt_text)
  };
}

export function buildMonthlyReportPayload({ report, generatedAt = new Date().toISOString() }) {
  const generatedDate = new Date(generatedAt);
  const payload = {
    schema_version: 'phase3-monthly-report-v1',
    generated_at: generatedAt,
    report_month: reportMonth(generatedDate),
    brand: report.brand,
    run: report.run,
    executive_summary: {
      headline: report.executive_summary.headline,
      bullets: report.executive_summary.bullets,
      caveats: [
        'This report summarizes observed AI answer behavior from tracked prompts.',
        'It does not claim ranking improvement until a later retest confirms movement.'
      ]
    },
    score_snapshot: report.scorecards,
    performance_summary: {
      report_state: report.report_state,
      parser: report.coverage.parser,
      source_mix: report.source_mix,
      competitor_insights: report.competitor_insights,
      breakdowns: report.breakdowns
    },
    risks: buildRisks(report),
    prompt_strategy: buildPromptStrategy(report),
    content_plan: buildContentSummary(report),
    execution_plan: buildExecutionPlan(report),
    retest_plan: buildRetestPlan(report)
  };

  return {
    ...payload,
    customer_report: buildCustomerReportCopy(payload)
  };
}

function normalizeMonthlyReport(row) {
  return {
    ...row,
    report_payload: row.report_payload || {}
  };
}

export async function getMonthlyReport(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM monthly_reports
     WHERE tracking_run_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [trackingRunId]
  );
  return result.rows[0] ? normalizeMonthlyReport(result.rows[0]) : null;
}

export async function listMonthlyReports({ brand_id, limit = 12 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const result = await pool.query(
    `SELECT id,
            tracking_run_id,
            brand_id,
            report_month,
            schema_version,
            status,
            created_at,
            updated_at,
            report_payload->'score_snapshot' AS score_snapshot
     FROM monthly_reports
     WHERE brand_id = $1
     ORDER BY report_month DESC, created_at DESC
     LIMIT $2`,
    [brand_id, safeLimit]
  );
  return result.rows;
}

export async function generateMonthlyReport(trackingRunId, { generated_at } = {}) {
  const report = await getTrackingRunReport(trackingRunId);
  if (!report) {
    throw new Error(`tracking run not found for monthly report: ${trackingRunId}`);
  }

  const payload = buildMonthlyReportPayload({
    report,
    generatedAt: generated_at || new Date().toISOString()
  });

  const result = await pool.query(
    `INSERT INTO monthly_reports (
       tracking_run_id,
       brand_id,
       report_month,
       schema_version,
       status,
       report_payload
     )
     VALUES ($1, $2, $3, $4, 'draft', $5)
     ON CONFLICT (tracking_run_id, report_month)
     DO UPDATE SET
       schema_version = EXCLUDED.schema_version,
       report_payload = EXCLUDED.report_payload,
       updated_at = NOW()
     RETURNING *`,
    [trackingRunId, report.brand.id, payload.report_month, payload.schema_version, JSON.stringify(payload)]
  );

  return normalizeMonthlyReport(result.rows[0]);
}
