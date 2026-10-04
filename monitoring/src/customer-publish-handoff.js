import { pool } from './db.js';
import { getArticleDashboardAggregate } from './article-dashboard.js';
import { performOpsArticleAction } from './article-ops-actions.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function handoffActionFor(status) {
  if (status !== 'handoff_prepared') return [];
  return [
    {
      type: 'mark_published_externally',
      label: 'Mark published',
      enabled: true,
      required_fields: ['url_or_external_reference'],
      next_step: 'Record the external published URL or reference. This does not schedule retest.'
    }
  ];
}

function nextStep(status) {
  const map = {
    customer_review: 'Customer approval is still needed before publish handoff.',
    changes_requested: 'The team should revise the article before publish handoff.',
    approved_for_publish_handoff: 'The team should prepare the manual publish handoff.',
    handoff_prepared: 'Record the external published URL or reference after the article is live.',
    published_externally: 'External publication is confirmed. Retest scheduling belongs to R6.2.',
    retest_scheduled: 'Retest is scheduled. R6.1 does not execute retests.'
  };
  return map[status] || 'Publish handoff is not ready.';
}

function safeHandoff(article) {
  const handoff = article.publish_handoff;
  if (!handoff) return null;
  const status = handoff.status || 'not_started';
  const preparation = handoff.handoff_preparation || {};
  const external = handoff.external_publish || {};
  const retest = handoff.retest_schedule || {};

  return {
    schema_version: 'r6-1-customer-publish-handoff-item-v1',
    article: {
      article_draft_id: article.article.article_draft_id,
      title: article.article.title,
      content_type: article.article.content_type
    },
    publish_handoff: {
      id: handoff.id,
      status,
      publish_status: handoff.publish_status || 'not_published',
      next_step: nextStep(status),
      state_machine: {
        current: status,
        allowed_actions: handoffActionFor(status).map((action) => action.type),
        blocked_actions: ['auto_publish', 'cms_publish_without_customer_confirmation', 'schedule_retest_until_R6_2']
      },
      handoff_preparation: {
        prepared: Boolean(preparation.prepared),
        prepared_at: preparation.prepared_at || null,
        prepared_by: preparation.prepared_by || null,
        channel: preparation.channel || null
      },
      external_publish: {
        confirmed: Boolean(external.confirmed),
        url: external.url || null,
        external_reference: external.external_reference || null,
        published_at: external.published_at || null,
        confirmed_by: external.confirmed_by || null
      },
      retest_schedule: {
        scheduled: Boolean(retest.scheduled),
        scheduled_for: retest.scheduled_for || null,
        status: retest.scheduled ? 'scheduled_outside_R6_1' : 'not_started_until_R6_2'
      }
    },
    customer_actions: handoffActionFor(status),
    guardrails: [
      'R6.1 records publish handoff state only.',
      'Mark published requires an external URL or reference.',
      'This payload does not prepare CMS publication, call webhooks, send email, schedule retests, or claim visibility improvement.'
    ]
  };
}

export function buildCustomerPublishHandoffPayload({ dashboard, generatedAt = new Date().toISOString() }) {
  const handoffs = arrayValue(dashboard.articles).map(safeHandoff).filter(Boolean);
  return {
    schema_version: 'r6-1-customer-publish-handoff-v1',
    generated_at: generatedAt,
    tracking_run_id: dashboard.tracking_run_id,
    status: handoffs.length ? 'ready' : 'empty',
    brand: {
      id: dashboard.run?.brand_id || null,
      name: dashboard.run?.brand_name || null,
      website_url: dashboard.run?.website_url || null
    },
    summary: {
      handoff_count: handoffs.length,
      approved_count: handoffs.filter((item) => item.publish_handoff.status === 'approved_for_publish_handoff').length,
      prepared_count: handoffs.filter((item) => item.publish_handoff.status === 'handoff_prepared').length,
      published_count: handoffs.filter((item) => item.publish_handoff.status === 'published_externally').length,
      mark_published_available_count: handoffs.filter((item) =>
        item.customer_actions.some((action) => action.type === 'mark_published_externally')
      ).length
    },
    handoffs,
    guardrails: [
      'R6.1 is limited to publish handoff state and external publication confirmation.',
      'External publication confirmation is workflow state, not evidence of AI visibility improvement.',
      'Retest scheduling and before/after reporting are R6.2.'
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
           FROM article_publish_handoffs aph
           WHERE aph.tracking_run_id = tr.id
         ) THEN 0
         ELSE 1
       END,
       tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getCustomerPublishHandoffPayload(options = {}) {
  const trackingRunId = await resolveTrackingRun(options);
  if (!trackingRunId) return null;
  const dashboard = await getArticleDashboardAggregate(trackingRunId, {
    article_draft_id: options.article_draft_id
  });
  return buildCustomerPublishHandoffPayload({ dashboard });
}

export async function markCustomerPublishHandoffPublished({
  handoff_id: handoffId,
  url,
  external_reference: externalReference,
  published_at: publishedAt,
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
    const error = new Error('customer publish handoff not found');
    error.code = 'customer_publish_handoff_not_found';
    throw error;
  }
  const result = await performOpsArticleAction({
    handoff_id: handoffId,
    action: 'mark_published_externally',
    actor: actor || 'customer_dashboard',
    note: note || 'External publication was confirmed from the customer dashboard.',
    url,
    external_reference: externalReference,
    published_at: publishedAt,
    create_retest_schedule: false
  });

  return {
    schema_version: 'r6-1-customer-publish-confirmation-v1',
    status: 'accepted',
    publish_handoff: {
      id: result.handoff.id,
      status: result.handoff.status,
      publish_status: result.handoff.publish_status,
      external_publish: result.handoff.handoff_payload?.external_publish || {}
    },
    guardrails: [
      'This records external publication confirmation only.',
      'It does not publish content, call CMS/webhooks, send email, schedule retests, or claim AI visibility improvement.'
    ]
  };
}
