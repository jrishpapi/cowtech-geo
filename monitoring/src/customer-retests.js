import { pool } from './db.js';
import { getArticleDashboardAggregate } from './article-dashboard.js';
import { performOpsArticleAction } from './article-ops-actions.js';
import {
  compareArticleRetestSchedule,
  listArticleRetestSchedules,
  queueDueArticleRetests
} from './article-retests.js';
import { generateArticleRetestReports, listArticleRetestReports } from './article-retest-reports.js';
import { executeTrackingRun } from './tracking.js';
import { parseTrackingRunResults } from './parser.js';
import { scoreTrackingRun } from './scoring.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function isDue(schedule, dueAt) {
  if (!schedule?.scheduled_for || schedule.status !== 'pending') return false;
  return new Date(schedule.scheduled_for).getTime() <= new Date(dueAt).getTime();
}

function safeScorecards(report) {
  return arrayValue(report?.report_payload?.dashboard_card?.scorecards).map((score) => ({
    metric: score.metric,
    title: score.title,
    before: score.before,
    after: score.after,
    delta: score.delta,
    direction: score.direction,
    outcome: score.outcome
  }));
}

function retestActionFor({ handoff, schedule, due }) {
  const actions = [];
  if (handoff?.status === 'published_externally' && !schedule) {
    actions.push({
      type: 'schedule_retest',
      label: 'Schedule retest',
      enabled: true,
      required_fields: ['scheduled_for'],
      next_step: 'Choose a due date for the controlled post-publish retest.'
    });
  }
  if (due) {
    actions.push({
      type: 'run_due_retest_mock',
      label: 'Run due retest',
      enabled: true,
      provider_mode: 'mock',
      next_step: 'Queue and execute due retests in mock-safe mode only.'
    });
  }
  return actions;
}

function safeRetestItem({ article, schedule, report, dueAt }) {
  const handoff = article.publish_handoff;
  const due = isDue(schedule, dueAt);
  const comparison = schedule?.comparison_payload || {};
  const customerReport = report?.report_payload?.customer_report || null;

  return {
    schema_version: 'r6-2-customer-retest-item-v1',
    article: {
      article_draft_id: article.article.article_draft_id,
      title: article.article.title,
      content_type: article.article.content_type
    },
    publish_handoff: {
      id: handoff?.id || null,
      status: handoff?.status || 'not_started',
      publish_status: handoff?.publish_status || 'not_published',
      published_url: handoff?.external_publish?.url || null,
      external_reference: handoff?.external_publish?.external_reference || null,
      published_at: handoff?.external_publish?.published_at || null
    },
    retest_schedule: schedule
      ? {
          id: schedule.id,
          status: schedule.status,
          scheduled_for: schedule.scheduled_for,
          due_now: due,
          target_metric: schedule.baseline_payload?.target_metric || schedule.comparison_payload?.target_metric || null,
          desired_direction:
            schedule.baseline_payload?.desired_direction || schedule.comparison_payload?.desired_direction || null,
          baseline_tracking_run_id: schedule.tracking_run_id,
          retest_tracking_run_id: schedule.retest_tracking_run_id || null
        }
      : {
          id: null,
          status: handoff?.status === 'published_externally' ? 'ready_to_schedule' : 'not_started',
          scheduled_for: null,
          due_now: false,
          target_metric: handoff?.retest_schedule?.target_metric || null,
          desired_direction: handoff?.retest_schedule?.desired_direction || null,
          baseline_tracking_run_id: null,
          retest_tracking_run_id: null
        },
    comparison:
      comparison.status === 'completed'
        ? {
            schema_version: comparison.schema_version,
            status: comparison.status,
            target_metric: comparison.target_metric || {},
            metrics: comparison.metrics || {},
            guardrail: comparison.guardrail
          }
        : {
            status: comparison.status || (schedule ? 'waiting_for_completed_retest' : 'not_started')
          },
    retest_report: report
      ? {
          id: report.id,
          status: report.status,
          headline: report.report_payload?.dashboard_card?.headline || customerReport?.one_line_summary || null,
          scorecards: safeScorecards(report),
          customer_report: customerReport
            ? {
                schema_version: customerReport.schema_version,
                title: customerReport.title,
                one_line_summary: customerReport.one_line_summary,
                customer_summary: customerReport.customer_summary || [],
                target_metric_result: customerReport.target_metric_result || {},
                next_actions: customerReport.next_actions || [],
                evidence_caveats: customerReport.evidence_caveats || []
              }
            : null
        }
      : null,
    customer_actions: retestActionFor({ handoff, schedule, due }),
    guardrails: [
      'R6.2 reports measured before/after deltas only.',
      'A single retest is not proof of causation.',
      'Due retest execution from the customer surface is mock-safe unless explicitly approved elsewhere.'
    ]
  };
}

function summarize(items) {
  return {
    retest_item_count: items.length,
    scheduled_count: items.filter((item) => item.retest_schedule.id).length,
    due_count: items.filter((item) => item.retest_schedule.due_now).length,
    queued_count: items.filter((item) => item.retest_schedule.status === 'queued').length,
    completed_count: items.filter((item) => item.retest_schedule.status === 'completed').length,
    report_ready_count: items.filter((item) => item.retest_report?.status === 'ready_for_dashboard').length,
    schedule_available_count: items.filter((item) =>
      item.customer_actions.some((action) => action.type === 'schedule_retest')
    ).length
  };
}

export function buildCustomerRetestPayload({
  dashboard,
  schedules = [],
  reports = [],
  dueAt = new Date().toISOString(),
  generatedAt = new Date().toISOString()
}) {
  const scheduleByHandoff = new Map(schedules.map((schedule) => [schedule.article_publish_handoff_id, schedule]));
  const reportBySchedule = new Map(reports.map((report) => [report.article_retest_schedule_id, report]));
  const retests = arrayValue(dashboard.articles)
    .filter((article) => article.publish_handoff)
    .map((article) => {
      const schedule = scheduleByHandoff.get(article.publish_handoff.id) || null;
      const report = schedule ? reportBySchedule.get(schedule.id) || null : null;
      return safeRetestItem({ article, schedule, report, dueAt });
    });

  return {
    schema_version: 'r6-2-customer-retest-v1',
    generated_at: generatedAt,
    due_at: dueAt,
    tracking_run_id: dashboard.tracking_run_id,
    status: retests.length ? 'ready' : 'empty',
    brand: {
      id: dashboard.run?.brand_id || null,
      name: dashboard.run?.brand_name || null,
      website_url: dashboard.run?.website_url || null
    },
    summary: summarize(retests),
    retests,
    guardrails: [
      'Retest execution is controlled and defaults to mock-safe mode.',
      'Before/after reporting uses persisted baseline and retest scores.',
      'Customer copy must not claim causation from a single retest.'
    ]
  };
}

async function resolveTrackingRun({ run_id, brand_id, brand_name } = {}) {
  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (run_id) {
    values.push(run_id);
    filters.push(`tr.id = $${values.length}`);
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
    `SELECT tr.id
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM article_retest_reports arr
           WHERE arr.tracking_run_id = tr.id
         ) THEN 0
         WHEN EXISTS (
           SELECT 1
           FROM article_retest_schedules ars
           WHERE ars.tracking_run_id = tr.id
         ) THEN 1
         WHEN EXISTS (
           SELECT 1
           FROM article_publish_handoffs aph
           WHERE aph.tracking_run_id = tr.id
         ) THEN 2
         ELSE 3
       END,
       tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getCustomerRetestPayload(options = {}) {
  const trackingRunId = await resolveTrackingRun(options);
  if (!trackingRunId) return null;
  const dashboard = await getArticleDashboardAggregate(trackingRunId, {
    article_draft_id: options.article_draft_id
  });
  const schedules = await listArticleRetestSchedules(trackingRunId);
  const reports = await listArticleRetestReports(trackingRunId);
  return buildCustomerRetestPayload({
    dashboard,
    schedules,
    reports,
    dueAt: options.due_at || new Date().toISOString()
  });
}

export async function scheduleCustomerRetest({
  handoff_id: handoffId,
  scheduled_for: scheduledFor,
  actor,
  note
} = {}) {
  const visible = await pool.query(
    `SELECT 1
     FROM article_publish_handoffs aph
     JOIN tracking_runs tr ON tr.id = aph.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE aph.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [handoffId]
  );
  if (!visible.rowCount) {
    const error = new Error('customer retest handoff not found');
    error.code = 'customer_retest_handoff_not_found';
    throw error;
  }
  const result = await performOpsArticleAction({
    handoff_id: handoffId,
    action: 'schedule_retest',
    actor: actor || 'customer_dashboard',
    note: note || 'Post-publish retest scheduled from the customer dashboard.',
    scheduled_for: scheduledFor,
    create_retest_schedule: true
  });

  return {
    schema_version: 'r6-2-customer-retest-schedule-confirmation-v1',
    status: 'accepted',
    publish_handoff: {
      id: result.handoff.id,
      status: result.handoff.status,
      publish_status: result.handoff.publish_status,
      retest_schedule: result.handoff.handoff_payload?.retest_schedule || {}
    },
    retest_schedule_result: {
      retest_schedule_count: result.retest_schedule_result?.retest_schedule_count || 0,
      blocked_count: result.retest_schedule_result?.blocked_count || 0,
      schedules: arrayValue(result.retest_schedule_result?.schedules).map((schedule) => ({
        id: schedule.id,
        status: schedule.status,
        scheduled_for: schedule.scheduled_for,
        baseline_tracking_run_id: schedule.tracking_run_id,
        retest_tracking_run_id: schedule.retest_tracking_run_id || null
      }))
    },
    guardrails: [
      'Scheduling creates a pending retest only.',
      'It does not call LLM providers, CMS, webhooks, or email.',
      'Visibility movement requires completed comparison and report generation.'
    ]
  };
}

export async function runDueCustomerRetests({
  redis,
  due_at: dueAt = new Date().toISOString(),
  limit = 20
} = {}) {
  const queuedResult = await queueDueArticleRetests({
    redis,
    due_at: dueAt,
    provider_mode: 'mock',
    allow_paid_provider: false,
    limit
  });
  const completed = [];
  const reportRunIds = new Set();

  for (const queued of queuedResult.queued) {
    await executeTrackingRun({
      tracking_run_id: queued.retest_tracking_run_id,
      provider_mode: 'mock',
      allow_paid_provider: false
    });
    await parseTrackingRunResults(queued.retest_tracking_run_id);
    await scoreTrackingRun(queued.retest_tracking_run_id);
    const compared = await compareArticleRetestSchedule(queued.id);
    reportRunIds.add(queued.tracking_run_id);
    completed.push({
      article_retest_schedule_id: queued.id,
      baseline_tracking_run_id: queued.tracking_run_id,
      retest_tracking_run_id: queued.retest_tracking_run_id,
      comparison_status: compared.comparison_payload?.status || compared.status
    });
  }

  const reports = [];
  for (const trackingRunId of reportRunIds) {
    reports.push(await generateArticleRetestReports(trackingRunId));
  }

  return {
    schema_version: 'r6-2-customer-due-retest-run-v1',
    status: 'completed',
    due_at: dueAt,
    provider_mode: 'mock',
    queued_count: queuedResult.queued_count,
    completed_count: completed.length,
    completed,
    report_results: reports.map((report) => ({
      tracking_run_id: report.tracking_run_id,
      retest_report_count: report.retest_report_count,
      blocked_count: report.blocked_count
    })),
    guardrails: [
      'This customer route executes due retests in mock mode only.',
      'No paid provider, CMS, webhook, email, Cloudflare, or VPS action is performed.',
      'Reports contain measured deltas only and do not prove causation.'
    ]
  };
}
