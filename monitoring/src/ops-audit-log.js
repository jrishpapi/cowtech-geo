import { pool } from './db.js';
import { listInternalAdminAuditEvents } from './internal-admin-audit-events.js';
import { getOpsAuditRetentionSettings } from './ops-audit-settings.js';

function compact(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  return value;
}

function normalizeFilter(value) {
  return String(value || '').trim().toLowerCase();
}

function eventSearchText(event) {
  return [
    event.category,
    event.action,
    event.actor,
    event.from,
    event.to,
    event.note,
    event.run_type,
    event.brand?.name,
    event.brand?.website_url,
    event.article?.title,
    event.article?.content_type,
    event.ids?.publish_handoff_id,
    event.ids?.internal_admin_audit_event_id,
    event.ids?.target_user_id,
    ...Object.values(event.payload_summary || {})
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();
}

function eventMatchesFilters(event, filters = {}) {
  const category = normalizeFilter(filters.category);
  if (category && category !== 'all' && event.category !== category) return false;

  const action = normalizeFilter(filters.action);
  if (action && !event.action.toLowerCase().includes(action)) return false;

  const actor = normalizeFilter(filters.actor);
  if (actor && !event.actor.toLowerCase().includes(actor)) return false;

  const target = normalizeFilter(filters.target);
  if (target) {
    const targetText = [
      event.payload_summary?.target_username,
      event.article?.title,
      event.brand?.name,
      event.ids?.publish_handoff_id,
      event.ids?.target_user_id
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!targetText.includes(target)) return false;
  }

  const q = normalizeFilter(filters.q);
  if (q && !eventSearchText(event).includes(q)) return false;

  return true;
}

function payloadSummary(payload = {}, action) {
  if (action?.startsWith('admin_user_')) {
    return {
      target_username: compact(payload.target_username),
      target_role: compact(payload.target_role),
      previous_role: compact(payload.previous_role),
      disabled: payload.disabled === undefined ? null : String(payload.disabled),
      previous_disabled: payload.previous_disabled === undefined ? null : String(payload.previous_disabled)
    };
  }
  if (action === 'prepare_handoff') {
    const handoff = payload.handoff_preparation || {};
    return {
      channel: compact(handoff.channel),
      instructions: compact(handoff.instructions)
    };
  }
  if (action === 'mark_published_externally') {
    const external = payload.external_publish || {};
    return {
      url: compact(external.url),
      external_reference: compact(external.external_reference),
      published_at: compact(external.published_at)
    };
  }
  if (action === 'schedule_retest') {
    const retest = payload.retest_schedule || {};
    return {
      scheduled_for: compact(retest.scheduled_for),
      target_metric: compact(retest.target_metric),
      desired_direction: compact(retest.desired_direction)
    };
  }
  if (action === 'request_changes') {
    const changes = payload.customer_review?.requested_changes || [];
    const latest = changes[changes.length - 1] || {};
    return {
      requested_by: compact(latest.requested_by),
      note: compact(latest.note)
    };
  }
  if (action === 'resume_customer_review' || action === 'approve_for_publish_handoff') {
    const review = payload.customer_review || {};
    return {
      decision: compact(review.decision),
      approved_by: compact(review.approved_by)
    };
  }
  return {};
}

function normalizeInternalAdminAuditEvent(event) {
  const before = event.before_payload || {};
  const after = event.after_payload || {};
  return {
    event_id: `internal-admin:${event.id}`,
    category: 'admin',
    at: event.created_at,
    actor: `${event.actor_username}:${event.actor_role}`,
    action: event.action,
    from: before.role || null,
    to: after.role || null,
    note: `Internal admin user ${event.target_username}`,
    payload_summary: payloadSummary(
      {
        target_username: event.target_username,
        target_role: after.role,
        previous_role: before.role,
        disabled: after.disabled,
        previous_disabled: before.disabled
      },
      event.action
    ),
    tracking_run_id: null,
    run_type: 'internal_admin',
    brand: {
      id: null,
      name: 'Internal access',
      website_url: null
    },
    article: {
      article_draft_id: null,
      title: `Admin user: ${event.target_username}`,
      content_type: 'internal_admin_user'
    },
    ids: {
      publish_handoff_id: null,
      export_package_id: null,
      retest_schedule_id: null,
      internal_admin_audit_event_id: event.id,
      target_user_id: event.target_user_id
    },
    route_hints: {
      customer_dashboard_url: null,
      ops_action_endpoint: null
    }
  };
}

function normalizeTimelineEntry(row, event, index) {
  const payload = row.handoff_payload || {};
  return {
    event_id: `${row.publish_handoff_id}:${index}:${event.action}`,
    category: 'workflow',
    at: event.at,
    actor: event.actor || 'system',
    action: event.action,
    from: event.from || null,
    to: event.to || null,
    note: event.note || null,
    payload_summary: payloadSummary(payload, event.action),
    tracking_run_id: row.tracking_run_id,
    run_type: row.run_type,
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      website_url: row.website_url
    },
    article: {
      article_draft_id: row.article_draft_id,
      title: row.article_title,
      content_type: row.content_type
    },
    ids: {
      publish_handoff_id: row.publish_handoff_id,
      export_package_id: row.export_package_id,
      retest_schedule_id: row.retest_schedule_id || null
    },
    route_hints: {
      customer_dashboard_url: `/dashboard/articles?run_id=${row.tracking_run_id}`,
      ops_action_endpoint: `/internal/article-publish-handoffs/${row.publish_handoff_id}/ops-action`
    }
  };
}

function summarizeEvents(events) {
  return events.reduce(
    (acc, event) => {
      acc.total_events += 1;
      acc.by_action[event.action] = (acc.by_action[event.action] || 0) + 1;
      acc.by_actor[event.actor] = (acc.by_actor[event.actor] || 0) + 1;
      acc.by_category[event.category] = (acc.by_category[event.category] || 0) + 1;
      return acc;
    },
    {
      total_events: 0,
      by_action: {},
      by_actor: {},
      by_category: {}
    }
  );
}

function eventWithinRetention(event, retention) {
  if (!retention?.cutoff_at) return true;
  return new Date(event.at) >= new Date(retention.cutoff_at);
}

export function buildOpsAuditLog(
  rows = [],
  { limit = 50, adminEvents = [], filters = {}, retention = null, exportActor = null } = {}
) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const workflowEvents = rows.flatMap((row) =>
    ((row.handoff_payload || {}).timeline || []).map((event, index) => normalizeTimelineEntry(row, event, index))
  );
  const allEvents = [...workflowEvents, ...adminEvents.map(normalizeInternalAdminAuditEvent)]
    .filter((event) => event.at && event.action)
    .filter((event) => eventWithinRetention(event, retention))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const filteredEvents = allEvents.filter((event) => eventMatchesFilters(event, filters));
  const events = filteredEvents.slice(0, safeLimit);
  const summary = summarizeEvents(events);
  const generatedAt = new Date().toISOString();

  return {
    schema_version: 'phase4-ops-audit-log-v1',
    status: events.length ? 'active' : 'empty',
    generated_at: generatedAt,
    summary,
    filters: {
      category: filters.category || 'all',
      action: filters.action || null,
      actor: filters.actor || null,
      target: filters.target || null,
      q: filters.q || null
    },
    retention: retention
      ? {
          retention_days: retention.retention_days,
          cutoff_at: retention.cutoff_at,
          retained_categories: retention.retained_categories
        }
      : null,
    export_metadata: {
      generated_at: generatedAt,
      generated_by: exportActor?.username ? `${exportActor.username}:${exportActor.role}` : null,
      watermark: 'internal_ops_audit_export'
    },
    total_before_filters: allEvents.length,
    total_after_filters: filteredEvents.length,
    events,
    guardrails: [
      'This audit log is derived from persisted internal workflow timelines and admin-user audit events.',
      'It is read-only and does not mutate publish, production, or retest state.',
      'Payload summaries are intentionally compact and should not include full article bodies.',
      'Customer dashboard views must not expose internal actor or endpoint details.'
    ]
  };
}

function csvValue(value) {
  if (value instanceof Date) {
    return `"${value.toISOString()}"`;
  }
  const normalized = String(value ?? '');
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildOpsAuditCsv(auditLog) {
  const headers = [
    'at',
    'category',
    'action',
    'actor',
    'from',
    'to',
    'target',
    'brand',
    'article',
    'event_id',
    'export_generated_at',
    'export_generated_by',
    'export_watermark',
    'retention_days'
  ];
  const lines = [headers.map(csvValue).join(',')];
  for (const event of auditLog.events || []) {
    lines.push(
      [
        event.at,
        event.category,
        event.action,
        event.actor,
        event.from,
        event.to,
        event.payload_summary?.target_username || event.ids?.publish_handoff_id || '',
        event.brand?.name,
        event.article?.title,
        event.event_id,
        auditLog.export_metadata?.generated_at,
        auditLog.export_metadata?.generated_by,
        auditLog.export_metadata?.watermark,
        auditLog.retention?.retention_days
      ]
        .map(csvValue)
        .join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function getOpsAuditLog({
  limit = 50,
  handoff_id: handoffId = null,
  category = 'all',
  action = null,
  actor = null,
  target = null,
  q = null,
  export_actor: exportActor = null
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const retention = await getOpsAuditRetentionSettings();
  const params = [];
  let handoffWhere = '';
  if (handoffId) {
    params.push(handoffId);
    handoffWhere = `WHERE aph.id = $${params.length}`;
  }
  params.push(Math.max(safeLimit, 25));

  const result = await pool.query(
    `SELECT
       tr.id AS tracking_run_id,
       tr.run_type,
       b.id AS brand_id,
       b.name AS brand_name,
       b.website_url,
       ad.id AS article_draft_id,
       ad.title AS article_title,
       ad.content_type,
       aep.id AS export_package_id,
       aph.id AS publish_handoff_id,
       aph.handoff_payload,
       ars.id AS retest_schedule_id,
       aph.updated_at
     FROM article_publish_handoffs aph
     JOIN article_export_packages aep ON aep.id = aph.article_export_package_id
     JOIN article_exports ae ON ae.id = aep.article_export_id
     JOIN article_drafts ad ON ad.id = ae.article_draft_id
     JOIN tracking_runs tr ON tr.id = aph.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     LEFT JOIN article_retest_schedules ars ON ars.article_publish_handoff_id = aph.id
     ${handoffWhere}
     ORDER BY aph.updated_at DESC
     LIMIT $${params.length}`,
    params
  );

  const adminEvents = handoffId
    ? []
    : await listInternalAdminAuditEvents({ limit: Math.max(safeLimit, 50), created_after: retention.cutoff_at });
  return buildOpsAuditLog(result.rows, {
    limit: safeLimit,
    adminEvents,
    retention,
    exportActor,
    filters: {
      category,
      action,
      actor,
      target,
      q
    }
  });
}
