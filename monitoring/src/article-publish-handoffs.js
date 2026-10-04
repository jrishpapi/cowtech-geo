import { pool } from './db.js';
import { generateArticleExportPackages, listArticleExportPackages } from './article-export-packages.js';

export const PUBLISH_HANDOFF_STATES = [
  'customer_review',
  'changes_requested',
  'approved_for_publish_handoff',
  'handoff_prepared',
  'published_externally',
  'retest_scheduled'
];

const ACTIONS = {
  request_changes: {
    from: ['customer_review', 'approved_for_publish_handoff', 'handoff_prepared'],
    to: 'changes_requested'
  },
  resume_customer_review: {
    from: ['changes_requested'],
    to: 'customer_review'
  },
  approve_for_publish_handoff: {
    from: ['customer_review'],
    to: 'approved_for_publish_handoff'
  },
  prepare_handoff: {
    from: ['approved_for_publish_handoff'],
    to: 'handoff_prepared'
  },
  mark_published_externally: {
    from: ['handoff_prepared'],
    to: 'published_externally',
    requireExternalPublish: true
  },
  schedule_retest: {
    from: ['published_externally'],
    to: 'retest_scheduled',
    requireRetestSchedule: true
  }
};

function nowIso() {
  return new Date().toISOString();
}

function blockedHandoff(packageRow, blockers) {
  return {
    status: 'blocked',
    article_export_package_id: packageRow?.id || null,
    blockers
  };
}

function allowedActionsFor(status) {
  return Object.entries(ACTIONS)
    .filter(([, config]) => config.from.includes(status))
    .map(([action]) => action);
}

function publishStatusFor(status) {
  if (status === 'published_externally' || status === 'retest_scheduled') {
    return 'published_externally';
  }
  return 'not_published';
}

function timelineEntry({ from, to, action, actor = 'system', note = null }) {
  return {
    at: nowIso(),
    actor,
    action,
    from,
    to,
    note
  };
}

function nextStepFor(status) {
  const map = {
    customer_review: 'customer_approval_or_changes',
    changes_requested: 'revise_export_package_then_resume_review',
    approved_for_publish_handoff: 'prepare_manual_or_cms_handoff',
    handoff_prepared: 'wait_for_external_publish_confirmation',
    published_externally: 'schedule_retest',
    retest_scheduled: 'wait_for_retest_run'
  };
  return map[status] || 'customer_review';
}

export function buildArticlePublishHandoff(packageRow) {
  const pkg = packageRow.package_payload || {};
  if (packageRow.status !== 'ready_for_dashboard' || pkg.status !== 'ready_for_dashboard') {
    return blockedHandoff(packageRow, ['article export package is not ready_for_dashboard']);
  }

  if ((pkg.dashboard_summary?.publish_status || 'not_published') !== 'not_published') {
    return blockedHandoff(packageRow, ['article export package must start from not_published']);
  }

  const current = 'customer_review';
  return {
    schema_version: 'phase4-publish-handoff-v1',
    status: current,
    publish_status: 'not_published',
    tracking_run_id: packageRow.tracking_run_id,
    article_export_package_id: packageRow.id,
    article_export_id: packageRow.article_export_id,
    source_package: {
      schema_version: pkg.schema_version,
      status: pkg.status,
      dashboard_summary: pkg.dashboard_summary || {},
      files: (pkg.files || []).map((file) => ({
        filename: file.filename,
        content_type: file.content_type,
        size_bytes: file.size_bytes
      }))
    },
    state_machine: {
      states: PUBLISH_HANDOFF_STATES,
      current,
      allowed_actions: allowedActionsFor(current),
      blocked_actions: ['auto_publish', 'cms_publish_without_customer_approval'],
      next_step: nextStepFor(current)
    },
    customer_review: {
      required: true,
      decision: 'pending',
      requested_changes: []
    },
    handoff_preparation: {
      prepared: false,
      channel: null,
      instructions: null
    },
    external_publish: {
      confirmed: false,
      url: null,
      published_at: null,
      confirmed_by: null
    },
    retest_schedule: {
      scheduled: false,
      target_metric: pkg.retest_notes?.target_metric || null,
      desired_direction: pkg.retest_notes?.desired_direction || null,
      scheduled_for: null
    },
    timeline: [
      timelineEntry({
        from: null,
        to: current,
        action: 'create_publish_handoff',
        note: 'Dashboard package is ready for customer review.'
      })
    ],
    guardrails: [
      'Do not publish automatically from this state machine.',
      'Customer approval is required before publish handoff preparation.',
      'External publication must be confirmed by URL or external reference before retest scheduling.',
      'Do not claim AI visibility improvement until the retest confirms movement.'
    ]
  };
}

function normalizeHandoffRow(row) {
  return {
    ...row,
    handoff_payload: row.handoff_payload || {}
  };
}

export async function listArticlePublishHandoffs(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_publish_handoffs
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeHandoffRow);
}

export async function generateArticlePublishHandoffs(trackingRunId) {
  let packages = await listArticleExportPackages(trackingRunId);
  if (!packages.length) {
    await generateArticleExportPackages(trackingRunId);
    packages = await listArticleExportPackages(trackingRunId);
  }

  const saved = [];
  const blocked = [];
  for (const articlePackage of packages) {
    const handoff = buildArticlePublishHandoff(articlePackage);
    if (handoff.status !== 'customer_review') {
      blocked.push(handoff);
      continue;
    }

    const handoffKey = `${articlePackage.id}:publish-handoff`;
    const result = await pool.query(
      `INSERT INTO article_publish_handoffs (
         tracking_run_id,
         article_export_package_id,
         article_export_id,
         handoff_key,
         status,
         publish_status,
         handoff_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_export_package_id)
       DO NOTHING
       RETURNING *`,
      [
        trackingRunId,
        articlePackage.id,
        articlePackage.article_export_id,
        handoffKey,
        handoff.status,
        handoff.publish_status,
        JSON.stringify(handoff)
      ]
    );
    if (result.rowCount) {
      saved.push(normalizeHandoffRow(result.rows[0]));
      continue;
    }

    const existing = await pool.query(
      `SELECT *
       FROM article_publish_handoffs
       WHERE article_export_package_id = $1`,
      [articlePackage.id]
    );
    saved.push(normalizeHandoffRow(existing.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    handoff_count: saved.length,
    blocked_count: blocked.length,
    handoffs: saved,
    blocked_handoffs: blocked
  };
}

function applyTransitionPayload(payload, action, nextStatus, options = {}) {
  const current = payload.status;
  const updated = {
    ...payload,
    status: nextStatus,
    publish_status: publishStatusFor(nextStatus),
    state_machine: {
      ...(payload.state_machine || {}),
      current: nextStatus,
      allowed_actions: allowedActionsFor(nextStatus),
      blocked_actions: ['auto_publish', 'cms_publish_without_customer_approval'],
      next_step: nextStepFor(nextStatus)
    },
    timeline: [
      ...(payload.timeline || []),
      timelineEntry({
        from: current,
        to: nextStatus,
        action,
        actor: options.actor || 'system',
        note: options.note || null
      })
    ]
  };

  if (action === 'request_changes') {
    updated.customer_review = {
      ...(payload.customer_review || {}),
      required: true,
      decision: 'changes_requested',
      requested_changes: [
        ...((payload.customer_review || {}).requested_changes || []),
        {
          requested_at: nowIso(),
          requested_by: options.actor || 'customer',
          note: options.note || 'Changes requested before publish handoff.'
        }
      ]
    };
  }

  if (action === 'resume_customer_review') {
    updated.customer_review = {
      ...(payload.customer_review || {}),
      required: true,
      decision: 'pending'
    };
  }

  if (action === 'approve_for_publish_handoff') {
    updated.customer_review = {
      ...(payload.customer_review || {}),
      required: false,
      decision: 'approved_for_publish_handoff',
      approved_at: nowIso(),
      approved_by: options.actor || 'customer'
    };
  }

  if (action === 'prepare_handoff') {
    updated.handoff_preparation = {
      prepared: true,
      prepared_at: nowIso(),
      prepared_by: options.actor || 'system',
      channel: options.channel || 'manual',
      instructions: options.instructions || 'Use the exported Markdown, HTML, and metadata package for manual publication.'
    };
  }

  if (action === 'mark_published_externally') {
    updated.external_publish = {
      confirmed: true,
      url: options.url || null,
      external_reference: options.external_reference || null,
      published_at: options.published_at || nowIso(),
      confirmed_by: options.actor || 'customer'
    };
  }

  if (action === 'schedule_retest') {
    updated.retest_schedule = {
      ...(payload.retest_schedule || {}),
      scheduled: true,
      scheduled_for: options.scheduled_for,
      scheduled_by: options.actor || 'system',
      scheduled_at: nowIso()
    };
  }

  return updated;
}

function assertTransitionAllowed(payload, action, options) {
  const config = ACTIONS[action];
  if (!config) {
    const error = new Error(`unsupported publish handoff action: ${action}`);
    error.code = 'invalid_publish_handoff_action';
    throw error;
  }

  if (!config.from.includes(payload.status)) {
    const error = new Error(`cannot ${action} from ${payload.status}`);
    error.code = 'invalid_publish_handoff_transition';
    throw error;
  }

  if (config.requireExternalPublish && !options.url && !options.external_reference) {
    const error = new Error('external publish confirmation requires url or external_reference');
    error.code = 'external_publish_confirmation_required';
    throw error;
  }

  if (config.requireRetestSchedule && !options.scheduled_for) {
    const error = new Error('retest scheduling requires scheduled_for');
    error.code = 'retest_schedule_required';
    throw error;
  }
}

export async function transitionArticlePublishHandoff(handoffId, action, options = {}) {
  const existing = await pool.query('SELECT * FROM article_publish_handoffs WHERE id = $1', [handoffId]);
  if (!existing.rowCount) {
    const error = new Error('article publish handoff not found');
    error.code = 'article_publish_handoff_not_found';
    throw error;
  }

  const row = normalizeHandoffRow(existing.rows[0]);
  assertTransitionAllowed(row.handoff_payload, action, options);
  const nextStatus = ACTIONS[action].to;
  const payload = applyTransitionPayload(row.handoff_payload, action, nextStatus, options);
  const result = await pool.query(
    `UPDATE article_publish_handoffs
     SET status = $2,
         publish_status = $3,
         handoff_payload = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [handoffId, payload.status, payload.publish_status, JSON.stringify(payload)]
  );

  return normalizeHandoffRow(result.rows[0]);
}
