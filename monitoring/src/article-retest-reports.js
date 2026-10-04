import { pool } from './db.js';
import { generateArticleRetestSchedules, listArticleRetestSchedules } from './article-retests.js';

function formatScore(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function metricTitle(metric) {
  const titles = {
    visibility_score: 'Visibility',
    source_quality_score: 'Source quality',
    competitor_pressure_score: 'Competitor pressure'
  };
  return titles[metric] || metric;
}

function outcomeLabel(outcome) {
  if (outcome === 'improved') return 'improved';
  if (outcome === 'declined') return 'declined';
  return 'unchanged';
}

function metricCopy(metric, delta) {
  const title = metricTitle(metric);
  const direction = delta.direction === 'lower_is_better' ? 'lower is better' : 'higher is better';
  return `${title} is ${outcomeLabel(delta.outcome)} at ${formatScore(delta.after)} after the retest, moving ${delta.delta} points from ${formatScore(delta.before)}. This metric is ${direction}.`;
}

function nextActionsFor(comparison) {
  const actions = [];
  const target = comparison.target_metric || {};

  if (target.outcome === 'improved') {
    actions.push({
      priority: 'medium',
      type: 'monitor',
      title: 'Keep the article live and monitor the same prompt set in the next scheduled cycle.'
    });
  } else if (target.outcome === 'declined') {
    actions.push({
      priority: 'high',
      type: 'review_article_and_sources',
      title: 'Review the published article, cited evidence, and competing sources before the next retest.'
    });
  } else {
    actions.push({
      priority: 'medium',
      type: 'wait_for_more_observations',
      title: 'Keep monitoring before claiming impact because this retest did not show measured movement.'
    });
  }

  if (comparison.metrics?.source_quality_score?.outcome === 'declined') {
    actions.push({
      priority: 'medium',
      type: 'strengthen_sources',
      title: 'Add or improve official and neutral proof sources before the next retest.'
    });
  }

  if (comparison.metrics?.competitor_pressure_score?.outcome !== 'improved') {
    actions.push({
      priority: 'medium',
      type: 'competitor_pressure_followup',
      title: 'Expand comparison coverage or internal links if competitor pressure is still not improving.'
    });
  }

  return actions.slice(0, 4);
}

function headlineFor(comparison) {
  const target = comparison.target_metric || {};
  if (target.outcome === 'improved') {
    return `The post-publish retest showed measured improvement in ${metricTitle(target.target_metric)}.`;
  }
  if (target.outcome === 'declined') {
    return `The post-publish retest showed ${metricTitle(target.target_metric)} moved in the wrong direction.`;
  }
  return `The post-publish retest showed no measured movement yet in ${metricTitle(target.target_metric)}.`;
}

function scorecardsFor(comparison) {
  return Object.entries(comparison.metrics || {}).map(([metric, delta]) => ({
    metric,
    title: metricTitle(metric),
    before: formatScore(delta.before),
    after: formatScore(delta.after),
    delta: formatScore(delta.delta),
    direction: delta.direction,
    outcome: delta.outcome,
    customer_copy: metricCopy(metric, delta)
  }));
}

function buildCustomerReportBlock({ comparison, schedule }) {
  const scorecards = scorecardsFor(comparison);
  const target = comparison.target_metric || {};
  return {
    schema_version: 'phase4-retest-customer-report-block-v1',
    title: 'Post-publish retest result',
    one_line_summary: headlineFor(comparison),
    customer_summary: [
      `The published article was retested against the tracked AI visibility metrics after external publication was confirmed.`,
      headlineFor(comparison),
      `The target metric was ${metricTitle(target.target_metric)} and the measured outcome was ${outcomeLabel(target.outcome)}.`
    ],
    score_narratives: scorecards.map((scorecard) => ({
      metric: scorecard.metric,
      title: scorecard.title,
      customer_copy: scorecard.customer_copy
    })),
    target_metric_result: {
      metric: target.target_metric || null,
      title: metricTitle(target.target_metric),
      outcome: target.outcome || 'not_evaluated',
      delta: target.delta ?? null,
      direction: target.direction || null,
      customer_copy: `Target metric outcome: ${outcomeLabel(target.outcome)}${target.delta === undefined ? '' : ` with a ${target.delta} point delta`}.`
    },
    next_actions: nextActionsFor(comparison),
    evidence_caveats: [
      'This block reports observed deltas from one retest and does not prove causation.',
      'Do not claim AI visibility improvement unless the measured target metric improved.',
      'Keep the prompt set and model context stable when comparing future retests.'
    ],
    source_context: {
      baseline_tracking_run_id: comparison.baseline_tracking_run_id,
      retest_tracking_run_id: comparison.retest_tracking_run_id,
      scheduled_for: schedule.scheduled_for,
      completed_at: schedule.completed_at
    }
  };
}

export function buildArticleRetestDashboardReport(scheduleRow) {
  const comparison = scheduleRow.comparison_payload || {};
  const baseline = scheduleRow.baseline_payload || {};

  if (scheduleRow.status !== 'completed' || comparison.status !== 'completed') {
    return {
      status: 'blocked',
      article_retest_schedule_id: scheduleRow.id,
      blockers: ['retest comparison is not completed']
    };
  }

  if (!baseline.source_scores) {
    return {
      status: 'blocked',
      article_retest_schedule_id: scheduleRow.id,
      blockers: ['baseline scores are missing']
    };
  }

  const scorecards = scorecardsFor(comparison);
  const target = comparison.target_metric || {};

  return {
    schema_version: 'phase4-retest-dashboard-report-v1',
    status: 'ready_for_dashboard',
    tracking_run_id: scheduleRow.tracking_run_id,
    article_retest_schedule_id: scheduleRow.id,
    retest_tracking_run_id: scheduleRow.retest_tracking_run_id,
    dashboard_card: {
      title: 'Post-publish retest',
      headline: headlineFor(comparison),
      status_label: outcomeLabel(target.outcome),
      target_metric: target,
      scorecards,
      source_context: {
        baseline_tracking_run_id: comparison.baseline_tracking_run_id,
        retest_tracking_run_id: comparison.retest_tracking_run_id,
        scheduled_for: scheduleRow.scheduled_for,
        completed_at: scheduleRow.completed_at
      }
    },
    customer_report: buildCustomerReportBlock({ comparison, schedule: scheduleRow }),
    guardrails: [
      'Show measured deltas only.',
      'Do not claim causation from one retest.',
      'Do not claim AI visibility improvement unless the target metric outcome is improved.'
    ]
  };
}

function normalizeRetestReportRow(row) {
  return {
    ...row,
    report_payload: row.report_payload || {}
  };
}

export async function listArticleRetestReports(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_retest_reports
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeRetestReportRow);
}

export async function generateArticleRetestReports(trackingRunId) {
  let schedules = await listArticleRetestSchedules(trackingRunId);
  if (!schedules.length) {
    await generateArticleRetestSchedules(trackingRunId);
    schedules = await listArticleRetestSchedules(trackingRunId);
  }

  const saved = [];
  const blocked = [];

  for (const schedule of schedules) {
    const report = buildArticleRetestDashboardReport(schedule);
    if (report.status !== 'ready_for_dashboard') {
      blocked.push(report);
      continue;
    }

    const reportKey = `${schedule.id}:dashboard-retest-report`;
    const result = await pool.query(
      `INSERT INTO article_retest_reports (
         tracking_run_id,
         article_retest_schedule_id,
         retest_tracking_run_id,
         report_key,
         status,
         report_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (article_retest_schedule_id)
       DO UPDATE SET
         retest_tracking_run_id = EXCLUDED.retest_tracking_run_id,
         status = EXCLUDED.status,
         report_payload = EXCLUDED.report_payload,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        schedule.id,
        schedule.retest_tracking_run_id,
        reportKey,
        report.status,
        JSON.stringify(report)
      ]
    );
    saved.push(normalizeRetestReportRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    retest_report_count: saved.length,
    blocked_count: blocked.length,
    reports: saved,
    blocked_reports: blocked
  };
}
