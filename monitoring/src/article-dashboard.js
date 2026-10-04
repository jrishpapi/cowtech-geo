import { pool } from './db.js';
import { buildCustomerSafeProductionStatus } from './article-production-handoffs.js';

function payload(value) {
  return value || {};
}

function withoutBodies(files = []) {
  return files.map((file) => ({
    filename: file.filename,
    content_type: file.content_type,
    size_bytes: file.size_bytes,
    preview: file.preview || null
  }));
}

function sourceState(row) {
  const missing = [];
  if (!row.article_export_package_id) missing.push('article_export_package');
  if (!row.article_publish_handoff_id) missing.push('article_publish_handoff');
  if (!row.article_delivery_timeline_id) missing.push('article_delivery_timeline');
  if (!row.article_retest_report_id) missing.push('article_retest_report');
  return missing;
}

function aggregateStatus(row, missing) {
  if (
    missing.length === 0 &&
    payload(row.timeline_payload).status === 'ready_for_dashboard' &&
    row.package_status === 'ready_for_dashboard'
  ) {
    return 'ready_for_dashboard';
  }
  if (!row.article_export_package_id || !row.article_delivery_timeline_id) {
    return 'in_progress';
  }
  if (missing.length) {
    return 'partially_ready';
  }
  return 'in_progress';
}

function customerActions({ timeline, handoff }) {
  const actions = [];
  const nextAction = timeline.dashboard_summary?.next_action;
  if (nextAction) {
    actions.push({
      type: nextAction,
      source: 'delivery_timeline',
      enabled: nextAction !== 'monitor_next_cycle'
    });
  }

  for (const action of handoff.state_machine?.allowed_actions || []) {
    actions.push({
      type: action,
      source: 'publish_handoff',
      enabled: true
    });
  }

  return actions.filter(
    (action, index, all) => all.findIndex((candidate) => candidate.type === action.type) === index
  );
}

export function buildArticleDashboardItem(row) {
  const packagePayload = payload(row.package_payload);
  const handoffPayload = payload(row.handoff_payload);
  const reportPayload = payload(row.report_payload);
  const timelinePayload = payload(row.timeline_payload);
  const missing = sourceState(row);
  const status = aggregateStatus(row, missing);

  return {
    schema_version: 'phase4-article-dashboard-item-v1',
    status,
    article: {
      article_draft_id: row.article_draft_id,
      title: row.article_title || packagePayload.dashboard_summary?.title || 'Untitled article',
      content_type: row.content_type || packagePayload.dashboard_summary?.content_type || null,
      current_stage: timelinePayload.dashboard_summary?.current_stage || 'not_started',
      next_action: timelinePayload.dashboard_summary?.next_action || null
    },
    dashboard_package: row.article_export_package_id
      ? {
          id: row.article_export_package_id,
          status: row.package_status,
          summary: packagePayload.dashboard_summary || {},
          preview: packagePayload.preview || {},
          files: withoutBodies(packagePayload.files || []),
          internal_links: packagePayload.internal_links || [],
          retest_notes: packagePayload.retest_notes || {},
          delivery_guardrails: packagePayload.delivery_guardrails || []
        }
      : null,
    publish_handoff: row.article_publish_handoff_id
      ? {
          id: row.article_publish_handoff_id,
          status: row.handoff_status,
          publish_status: row.publish_status,
          state_machine: handoffPayload.state_machine || {},
          customer_review: handoffPayload.customer_review || {},
          handoff_preparation: handoffPayload.handoff_preparation || {},
          external_publish: handoffPayload.external_publish || {},
          retest_schedule: handoffPayload.retest_schedule || {},
          timeline: handoffPayload.timeline || [],
          guardrails: handoffPayload.guardrails || []
        }
      : null,
    production_handoff: row.article_production_handoff_id
      ? {
          id: row.article_production_handoff_id,
          status: row.production_handoff_status,
          customer_safe_status: buildCustomerSafeProductionStatus({
            status: row.production_handoff_status
          }),
          provider: row.production_handoff_provider,
          outbound_payload: row.production_outbound_payload || {},
          callback_contract: row.production_callback_contract || {},
          provider_result: row.production_provider_result || {}
        }
      : null,
    retest_report: row.article_retest_report_id
      ? {
          id: row.article_retest_report_id,
          status: row.retest_report_status,
          dashboard_card: reportPayload.dashboard_card || {},
          customer_report: reportPayload.customer_report || {},
          guardrails: reportPayload.guardrails || []
        }
      : null,
    delivery_timeline: row.article_delivery_timeline_id
      ? {
          id: row.article_delivery_timeline_id,
          status: row.timeline_status,
          payload: timelinePayload
        }
      : null,
    customer_actions: customerActions({
      timeline: timelinePayload,
      handoff: handoffPayload
    }),
    integrity: {
      missing_sections: missing,
      has_full_delivery_lineage: missing.length === 0,
      source_ids: {
        content_brief_id: row.content_brief_id,
        article_draft_id: row.article_draft_id,
        article_production_handoff_id: row.article_production_handoff_id || null,
        article_export_package_id: row.article_export_package_id || null,
        article_publish_handoff_id: row.article_publish_handoff_id || null,
        article_retest_report_id: row.article_retest_report_id || null,
        article_delivery_timeline_id: row.article_delivery_timeline_id || null
      }
    },
    guardrails: [
      'This aggregate is read-only and derived from persisted article workflow records.',
      'File bodies are not embedded in this dashboard aggregate; use package download routes for full content.',
      'Do not show missing sections as completed work.',
      'Retest claims must come from the attached retest report.'
    ]
  };
}

export function buildArticleDashboardAggregate({ run, rows }) {
  const articles = rows.map(buildArticleDashboardItem);
  const readyCount = articles.filter((article) => article.status === 'ready_for_dashboard').length;
  const partialCount = articles.filter((article) => article.status !== 'ready_for_dashboard').length;

  return {
    schema_version: 'phase4-article-dashboard-aggregate-v1',
    tracking_run_id: run.id,
    status: articles.length && partialCount === 0 ? 'ready_for_dashboard' : articles.length ? 'partially_ready' : 'empty',
    run: {
      id: run.id,
      status: run.status,
      run_type: run.run_type,
      brand_id: run.brand_id,
      brand_name: run.brand_name,
      website_url: run.website_url,
      created_at: run.created_at,
      finished_at: run.finished_at
    },
    summary: {
      article_count: articles.length,
      ready_count: readyCount,
      partial_count: partialCount,
      has_customer_ready_articles: readyCount > 0
    },
    articles,
    guardrails: [
      'This endpoint aggregates existing article delivery records only.',
      'It does not generate drafts, publish content, queue retests, or call LLM providers.',
      'Customer-facing UIs should respect each article integrity.missing_sections list.'
    ]
  };
}

async function dashboardRows({ trackingRunId, articleDraftId = null }) {
  const params = [trackingRunId];
  let articleFilter = '';
  if (articleDraftId) {
    params.push(articleDraftId);
    articleFilter = ` AND ad.id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT
       tr.id,
       tr.status,
       tr.run_type,
       tr.brand_id,
       tr.created_at,
       tr.finished_at,
       b.name AS brand_name,
       b.website_url,
       cb.id AS content_brief_id,
       ad.id AS article_draft_id,
       ad.title AS article_title,
       ad.content_type,
       apho.id AS article_production_handoff_id,
       apho.status AS production_handoff_status,
       apho.provider AS production_handoff_provider,
       apho.outbound_payload AS production_outbound_payload,
       apho.callback_contract AS production_callback_contract,
       apho.provider_result AS production_provider_result,
       aep.id AS article_export_package_id,
       aep.status AS package_status,
       aep.package_payload,
       aph.id AS article_publish_handoff_id,
       aph.status AS handoff_status,
       aph.publish_status,
       aph.handoff_payload,
       arr.id AS article_retest_report_id,
       arr.status AS retest_report_status,
       arr.report_payload,
       adt.id AS article_delivery_timeline_id,
       adt.status AS timeline_status,
       adt.timeline_payload
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN article_drafts ad ON ad.tracking_run_id = tr.id
     JOIN content_briefs cb ON cb.id = ad.content_brief_id
     LEFT JOIN article_production_handoffs apho ON apho.article_draft_id = ad.id
     LEFT JOIN article_export_packages aep ON aep.article_export_id = (
       SELECT ae.id
       FROM article_exports ae
       WHERE ae.article_draft_id = ad.id
       ORDER BY ae.created_at DESC
       LIMIT 1
     )
     LEFT JOIN article_publish_handoffs aph ON aph.article_export_package_id = aep.id
     LEFT JOIN article_retest_schedules ars ON ars.article_publish_handoff_id = aph.id
     LEFT JOIN article_retest_reports arr ON arr.article_retest_schedule_id = ars.id
     LEFT JOIN article_delivery_timelines adt ON adt.article_draft_id = ad.id
     WHERE tr.id = $1${articleFilter}
     ORDER BY ad.created_at ASC`,
    params
  );

  return result.rows;
}

async function trackingRun(trackingRunId) {
  const result = await pool.query(
    `SELECT tr.*, b.name AS brand_name, b.website_url
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  return result.rows[0] || null;
}

export async function getArticleDashboardAggregate(trackingRunId, { article_draft_id } = {}) {
  const run = await trackingRun(trackingRunId);
  if (!run) {
    const error = new Error('tracking run not found');
    error.code = 'tracking_run_not_found';
    throw error;
  }

  const rows = await dashboardRows({ trackingRunId, articleDraftId: article_draft_id });
  return buildArticleDashboardAggregate({ run, rows });
}

export async function getArticleDashboardByDraft(articleDraftId) {
  const draft = await pool.query('SELECT tracking_run_id FROM article_drafts WHERE id = $1', [articleDraftId]);
  if (!draft.rowCount) {
    const error = new Error('article draft not found');
    error.code = 'article_draft_not_found';
    throw error;
  }
  return getArticleDashboardAggregate(draft.rows[0].tracking_run_id, { article_draft_id: articleDraftId });
}
