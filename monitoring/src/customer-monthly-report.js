import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function scoreSnapshot(reportPayload) {
  const scorecards = objectValue(reportPayload.score_snapshot);
  const customerReport = objectValue(reportPayload.customer_report);
  const narratives = arrayValue(customerReport.score_narratives);
  return narratives.map((item) => ({
    metric: item.metric,
    title: item.title,
    score: toNumber(item.score),
    status_label: item.status_label,
    customer_copy: item.customer_copy,
    raw_status: scorecards[item.metric]?.status || null
  }));
}

function contentPlan(reportPayload) {
  const plan = objectValue(reportPayload.content_plan);
  const copy = objectValue(objectValue(reportPayload.customer_report).content_recommendations);
  return {
    opportunity_count: toNumber(plan.opportunity_count),
    brief_count: toNumber(plan.brief_count),
    article_ready_brief_count: toNumber(plan.article_ready_brief_count),
    blocked_brief_count: toNumber(plan.blocked_brief_count),
    primary_action: copy.primary_action || null,
    expected_impacts: arrayValue(copy.expected_impacts),
    blocked_notes: arrayValue(copy.blocked_notes)
  };
}

function promptStrategy(reportPayload) {
  const strategy = objectValue(reportPayload.prompt_strategy);
  const copy = objectValue(objectValue(reportPayload.customer_report).prompt_strategy_copy);
  return {
    opportunity_prompt_count: toNumber(strategy.opportunity_prompt_count),
    validated_count: toNumber(strategy.validated_count),
    candidate_count: toNumber(strategy.candidate_count),
    promoted_count: toNumber(strategy.promoted_count),
    promoted_prompt_count: toNumber(strategy.promoted_prompt_count),
    summary: copy.summary || null,
    top_validated_prompts: arrayValue(strategy.top_validated_prompts).slice(0, 6).map((prompt) => ({
      prompt_text: prompt.prompt_text,
      score: toNumber(prompt.score),
      source: prompt.source,
      category: prompt.category,
      status: prompt.status
    })),
    next_watchlist: arrayValue(copy.next_watchlist).slice(0, 8)
  };
}

function executionOrder(reportPayload) {
  const customerReport = objectValue(reportPayload.customer_report);
  return arrayValue(customerReport.recommended_execution_order).slice(0, 10).map((item) => ({
    order: toNumber(item.order),
    type: item.type,
    status: item.status,
    customer_copy: item.customer_copy
  }));
}

function riskExplanations(reportPayload) {
  const customerReport = objectValue(reportPayload.customer_report);
  return arrayValue(customerReport.risk_explanations).map((risk) => ({
    type: risk.type,
    severity: risk.severity,
    title: risk.title,
    customer_copy: risk.customer_copy
  }));
}

function retestCopy(reportPayload) {
  const retest = objectValue(objectValue(reportPayload.customer_report).retest_copy);
  return {
    summary: retest.summary || null,
    target_metrics: arrayValue(retest.target_metrics),
    guardrail: retest.guardrail || 'Do not claim AI visibility has improved until a later retest confirms movement.'
  };
}

export function buildCustomerMonthlyReportPayload({
  monthlyReport,
  generatedAt = new Date().toISOString()
}) {
  const reportPayload = objectValue(monthlyReport.report_payload);
  const customerReport = objectValue(reportPayload.customer_report);
  const brand = objectValue(reportPayload.brand);
  const run = objectValue(reportPayload.run);

  return {
    schema_version: 'r4-3-customer-monthly-report-v1',
    generated_at: generatedAt,
    report_id: monthlyReport.id || null,
    tracking_run_id: monthlyReport.tracking_run_id || run.id || null,
    report_month: monthlyReport.report_month || reportPayload.report_month || null,
    status: monthlyReport.status || 'draft',
    brand: {
      id: monthlyReport.brand_id || brand.id || null,
      name: brand.name || null,
      website_url: brand.website_url || null,
      vertical: brand.vertical || null
    },
    headline: customerReport.one_line_summary || reportPayload.executive_summary?.headline || 'Monthly visibility report is ready.',
    customer_summary: arrayValue(customerReport.customer_summary),
    score_narratives: scoreSnapshot(reportPayload),
    risk_explanations: riskExplanations(reportPayload),
    content_recommendations: contentPlan(reportPayload),
    execution_order: executionOrder(reportPayload),
    prompt_strategy: promptStrategy(reportPayload),
    retest_watchlist: retestCopy(reportPayload),
    caveats: arrayValue(customerReport.caveats).length
      ? arrayValue(customerReport.caveats)
      : [
          'This report summarizes observed AI answer behavior from tracked prompts.',
          'It does not claim ranking improvement until a later retest confirms movement.'
        ],
    guardrails: [
      'Monthly reports explain observed progress and next actions.',
      'Article preview, review, approval, export, publish handoff, and retest execution start after R4.3.',
      'This surface does not promise AI ranking improvement.'
    ]
  };
}

async function resolveMonthlyReport({ run_id, brand_id, brand_name } = {}) {
  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (run_id) {
    values.push(run_id);
    filters.push(`mr.tracking_run_id = $${values.length}`);
  }
  if (brand_id) {
    values.push(brand_id);
    filters.push(`b.id = $${values.length}`);
  }
  if (brand_name) {
    values.push(brand_name);
    filters.push(`LOWER(b.name) = LOWER($${values.length})`);
  }
  const result = await pool.query(
    `SELECT mr.*
     FROM monthly_reports mr
     JOIN brands b ON b.id = mr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE ${filters.join(' AND ')}
     ORDER BY mr.report_month DESC, mr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

export async function getCustomerMonthlyReportPayload(options = {}) {
  const monthlyReport = await resolveMonthlyReport(options);
  if (!monthlyReport) return null;
  return buildCustomerMonthlyReportPayload({
    monthlyReport
  });
}
