import { pool } from './db.js';

const STAGE_ORDER = [
  'brief',
  'draft_skeleton',
  'draft_expansion',
  'quality_review',
  'export',
  'dashboard_package',
  'publish_handoff',
  'external_publish',
  'retest_schedule',
  'retest_result',
  'dashboard_report'
];

function asPayload(value) {
  return value || {};
}

function complete(value) {
  return Boolean(value);
}

function stage({ key, label, status, entity_type, entity_id, source_status = null, at = null, summary = null }) {
  return {
    key,
    label,
    status,
    entity_type,
    entity_id: entity_id || null,
    source_status,
    at,
    summary
  };
}

function stageStatus(condition, blocked = false) {
  if (condition) return 'complete';
  return blocked ? 'blocked' : 'pending';
}

function currentStage(stages) {
  const blocked = stages.find((item) => item.status === 'blocked');
  if (blocked) return blocked.key;
  const pending = stages.find((item) => item.status === 'pending');
  if (pending) return pending.key;
  return stages[stages.length - 1]?.key || 'not_started';
}

function nextActionFor(stageKey) {
  const map = {
    brief: 'generate_article_draft',
    draft_skeleton: 'expand_article_draft',
    draft_expansion: 'run_quality_review',
    quality_review: 'approve_quality_review_for_export',
    export: 'build_dashboard_package',
    dashboard_package: 'start_customer_review',
    publish_handoff: 'confirm_external_publication',
    external_publish: 'schedule_retest',
    retest_schedule: 'run_due_retest',
    retest_result: 'generate_dashboard_report',
    dashboard_report: 'generate_dashboard_report'
  };
  return map[stageKey] || 'continue_workflow';
}

function auditEvent({ at, actor = 'system', action, entity_type, entity_id, status, note = null, source = 'workflow' }) {
  return {
    at,
    actor,
    action,
    entity_type,
    entity_id: entity_id || null,
    status,
    note,
    source
  };
}

function handoffAuditEvents(row) {
  const handoff = asPayload(row.handoff_payload);
  return (handoff.timeline || []).map((event) =>
    auditEvent({
      at: event.at,
      actor: event.actor || 'system',
      action: event.action,
      entity_type: 'article_publish_handoff',
      entity_id: row.article_publish_handoff_id,
      status: event.to || row.handoff_status,
      note: event.note || null,
      source: 'publish_handoff_timeline'
    })
  );
}

function buildStages(row) {
  const briefReady = row.brief_status === 'draft';
  const draftReady = row.draft_status === 'draft_skeleton';
  const expansionReady = row.expansion_status === 'expanded_draft';
  const reviewReady = row.review_status === 'approved_for_export';
  const exportReady = row.export_status === 'ready_for_download';
  const packageReady = row.package_status === 'ready_for_dashboard';
  const handoffReady = complete(row.article_publish_handoff_id);
  const externalPublished = row.publish_status === 'published_externally';
  const retestScheduled = complete(row.article_retest_schedule_id);
  const retestCompleted = row.retest_status === 'completed';
  const reportReady = row.retest_report_status === 'ready_for_dashboard';

  return [
    stage({
      key: 'brief',
      label: 'Content brief',
      status: stageStatus(briefReady, !briefReady),
      entity_type: 'content_brief',
      entity_id: row.content_brief_id,
      source_status: row.brief_status,
      at: row.brief_created_at,
      summary: row.brief_title
    }),
    stage({
      key: 'draft_skeleton',
      label: 'Draft skeleton',
      status: stageStatus(draftReady),
      entity_type: 'article_draft',
      entity_id: row.article_draft_id,
      source_status: row.draft_status,
      at: row.draft_created_at,
      summary: row.draft_title
    }),
    stage({
      key: 'draft_expansion',
      label: 'Expanded draft',
      status: stageStatus(expansionReady),
      entity_type: 'article_draft_expansion',
      entity_id: row.article_draft_expansion_id,
      source_status: row.expansion_status,
      at: row.expansion_created_at,
      summary: asPayload(row.expansion_payload).provider_mode || row.provider_mode || null
    }),
    stage({
      key: 'quality_review',
      label: 'Quality review',
      status: stageStatus(reviewReady, row.review_status === 'blocked_by_quality_gate'),
      entity_type: 'article_quality_review',
      entity_id: row.article_quality_review_id,
      source_status: row.review_status,
      at: row.review_created_at,
      summary: row.human_review_status
    }),
    stage({
      key: 'export',
      label: 'Article export',
      status: stageStatus(exportReady),
      entity_type: 'article_export',
      entity_id: row.article_export_id,
      source_status: row.export_status,
      at: row.export_created_at,
      summary: 'download package source'
    }),
    stage({
      key: 'dashboard_package',
      label: 'Dashboard package',
      status: stageStatus(packageReady),
      entity_type: 'article_export_package',
      entity_id: row.article_export_package_id,
      source_status: row.package_status,
      at: row.package_created_at,
      summary: asPayload(row.package_payload).dashboard_summary?.title || null
    }),
    stage({
      key: 'publish_handoff',
      label: 'Customer publish handoff',
      status: stageStatus(handoffReady),
      entity_type: 'article_publish_handoff',
      entity_id: row.article_publish_handoff_id,
      source_status: row.handoff_status,
      at: row.handoff_created_at,
      summary: asPayload(row.handoff_payload).state_machine?.next_step || null
    }),
    stage({
      key: 'external_publish',
      label: 'External publication',
      status: stageStatus(externalPublished),
      entity_type: 'article_publish_handoff',
      entity_id: row.article_publish_handoff_id,
      source_status: row.publish_status,
      at: asPayload(row.handoff_payload).external_publish?.published_at || row.handoff_updated_at,
      summary: asPayload(row.handoff_payload).external_publish?.url || null
    }),
    stage({
      key: 'retest_schedule',
      label: 'Retest scheduled',
      status: stageStatus(retestScheduled),
      entity_type: 'article_retest_schedule',
      entity_id: row.article_retest_schedule_id,
      source_status: row.retest_status,
      at: row.scheduled_for,
      summary: asPayload(row.baseline_payload).target_metric || asPayload(row.comparison_payload).target_metric || null
    }),
    stage({
      key: 'retest_result',
      label: 'Retest completed',
      status: stageStatus(retestCompleted),
      entity_type: 'article_retest_schedule',
      entity_id: row.article_retest_schedule_id,
      source_status: row.retest_status,
      at: row.retest_completed_at,
      summary: asPayload(row.comparison_payload).target_metric?.outcome || null
    }),
    stage({
      key: 'dashboard_report',
      label: 'Retest dashboard report',
      status: stageStatus(reportReady),
      entity_type: 'article_retest_report',
      entity_id: row.article_retest_report_id,
      source_status: row.retest_report_status,
      at: row.retest_report_created_at,
      summary: asPayload(row.retest_report_payload).dashboard_card?.status_label || null
    })
  ];
}

function buildAuditTrail(row, stages) {
  const generated = stages
    .filter((item) => item.entity_id)
    .map((item) =>
      auditEvent({
        at: item.at,
        action: `${item.key}_${item.status}`,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        status: item.source_status || item.status,
        note: item.summary,
        source: 'delivery_timeline_builder'
      })
    );

  return [...generated, ...handoffAuditEvents(row)]
    .filter((event) => event.at || event.entity_id)
    .sort((a, b) => {
      const aTime = Date.parse(a.at || '') || 0;
      const bTime = Date.parse(b.at || '') || 0;
      return aTime - bTime;
    });
}

export function buildArticleDeliveryTimeline(row) {
  const stages = buildStages(row);
  const activeStage = currentStage(stages);
  const ready = stages.every((item) => item.status === 'complete');
  const blocked = stages.some((item) => item.status === 'blocked');
  const status = ready ? 'ready_for_dashboard' : blocked ? 'blocked' : 'in_progress';
  const packagePayload = asPayload(row.package_payload);
  const handoffPayload = asPayload(row.handoff_payload);
  const reportPayload = asPayload(row.retest_report_payload);

  return {
    schema_version: 'phase4-customer-delivery-timeline-v1',
    status,
    tracking_run_id: row.tracking_run_id,
    article_draft_id: row.article_draft_id,
    article_export_package_id: row.article_export_package_id || null,
    article_retest_report_id: row.article_retest_report_id || null,
    title:
      packagePayload.dashboard_summary?.title ||
      row.draft_title ||
      row.brief_title ||
      'Untitled delivery timeline',
    dashboard_summary: {
      current_stage: activeStage,
      next_action: ready ? 'monitor_next_cycle' : nextActionFor(activeStage),
      completed_stage_count: stages.filter((item) => item.status === 'complete').length,
      total_stage_count: STAGE_ORDER.length,
      publish_status: row.publish_status || 'not_started',
      retest_status: row.retest_status || 'not_started',
      report_status: row.retest_report_status || 'not_started',
      customer_action_required: ['publish_handoff', 'external_publish'].includes(activeStage),
      latest_report_headline: reportPayload.dashboard_card?.headline || null
    },
    stages,
    audit_trail: buildAuditTrail(row, stages),
    data_lineage: {
      content_brief_id: row.content_brief_id,
      article_draft_id: row.article_draft_id,
      article_draft_expansion_id: row.article_draft_expansion_id || null,
      article_quality_review_id: row.article_quality_review_id || null,
      article_export_id: row.article_export_id || null,
      article_export_package_id: row.article_export_package_id || null,
      article_publish_handoff_id: row.article_publish_handoff_id || null,
      article_retest_schedule_id: row.article_retest_schedule_id || null,
      retest_tracking_run_id: row.retest_tracking_run_id || null,
      article_retest_report_id: row.article_retest_report_id || null
    },
    customer_context: {
      package_title: packagePayload.dashboard_summary?.title || null,
      external_publish_url: handoffPayload.external_publish?.url || null,
      retest_outcome: reportPayload.dashboard_card?.status_label || null
    },
    guardrails: [
      'Timeline events are derived from persisted workflow records only.',
      'Do not present pending stages as completed customer work.',
      'External publication requires explicit handoff confirmation.',
      'Retest impact claims must come from the retest dashboard report.'
    ]
  };
}

function normalizeTimelineRow(row) {
  return {
    ...row,
    timeline_payload: row.timeline_payload || {}
  };
}

async function deliveryRows(trackingRunId) {
  const result = await pool.query(
    `SELECT
       ad.tracking_run_id,
       cb.id AS content_brief_id,
       cb.status AS brief_status,
       cb.title AS brief_title,
       cb.created_at AS brief_created_at,
       ad.id AS article_draft_id,
       ad.status AS draft_status,
       ad.title AS draft_title,
       ad.created_at AS draft_created_at,
       ade.id AS article_draft_expansion_id,
       ade.status AS expansion_status,
       ade.provider_mode,
       ade.expansion_payload,
       ade.created_at AS expansion_created_at,
       aqr.id AS article_quality_review_id,
       aqr.status AS review_status,
       aqr.human_review_status,
       aqr.review_payload,
       aqr.created_at AS review_created_at,
       ae.id AS article_export_id,
       ae.status AS export_status,
       ae.export_payload,
       ae.created_at AS export_created_at,
       aep.id AS article_export_package_id,
       aep.status AS package_status,
       aep.package_payload,
       aep.created_at AS package_created_at,
       aph.id AS article_publish_handoff_id,
       aph.status AS handoff_status,
       aph.publish_status,
       aph.handoff_payload,
       aph.created_at AS handoff_created_at,
       aph.updated_at AS handoff_updated_at,
       ars.id AS article_retest_schedule_id,
       ars.status AS retest_status,
       ars.scheduled_for,
       ars.completed_at AS retest_completed_at,
       ars.retest_tracking_run_id,
       ars.baseline_payload,
       ars.comparison_payload,
       arr.id AS article_retest_report_id,
       arr.status AS retest_report_status,
       arr.report_payload AS retest_report_payload,
       arr.created_at AS retest_report_created_at
     FROM article_drafts ad
     JOIN content_briefs cb ON cb.id = ad.content_brief_id
     LEFT JOIN article_draft_expansions ade ON ade.article_draft_id = ad.id
     LEFT JOIN article_quality_reviews aqr ON aqr.article_draft_id = ad.id
     LEFT JOIN article_exports ae ON ae.article_draft_id = ad.id
     LEFT JOIN article_export_packages aep ON aep.article_export_id = ae.id
     LEFT JOIN article_publish_handoffs aph ON aph.article_export_package_id = aep.id
     LEFT JOIN article_retest_schedules ars ON ars.article_publish_handoff_id = aph.id
     LEFT JOIN article_retest_reports arr ON arr.article_retest_schedule_id = ars.id
     WHERE ad.tracking_run_id = $1
     ORDER BY ad.created_at ASC`,
    [trackingRunId]
  );
  return result.rows;
}

export async function listArticleDeliveryTimelines(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_delivery_timelines
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeTimelineRow);
}

export async function generateArticleDeliveryTimelines(trackingRunId) {
  const rows = await deliveryRows(trackingRunId);
  const saved = [];
  const blocked = [];

  if (!rows.length) {
    return {
      tracking_run_id: trackingRunId,
      timeline_count: 0,
      blocked_count: 1,
      timelines: [],
      blocked_timelines: [
        {
          status: 'blocked',
          tracking_run_id: trackingRunId,
          blockers: ['no article drafts found for tracking run']
        }
      ]
    };
  }

  for (const row of rows) {
    const timeline = buildArticleDeliveryTimeline(row);
    if (timeline.status === 'blocked') {
      blocked.push(timeline);
    }

    const timelineKey = `${row.article_draft_id}:customer-delivery-timeline`;
    const result = await pool.query(
      `INSERT INTO article_delivery_timelines (
         tracking_run_id,
         article_draft_id,
         article_export_package_id,
         article_retest_report_id,
         timeline_key,
         status,
         timeline_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_draft_id)
       DO UPDATE SET
         article_export_package_id = EXCLUDED.article_export_package_id,
         article_retest_report_id = EXCLUDED.article_retest_report_id,
         status = EXCLUDED.status,
         timeline_payload = EXCLUDED.timeline_payload,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        row.article_draft_id,
        row.article_export_package_id,
        row.article_retest_report_id,
        timelineKey,
        timeline.status,
        JSON.stringify(timeline)
      ]
    );
    saved.push(normalizeTimelineRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    timeline_count: saved.length,
    blocked_count: blocked.length,
    timelines: saved,
    blocked_timelines: blocked
  };
}
