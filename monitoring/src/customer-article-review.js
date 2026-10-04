import { pool } from './db.js';
import { getArticleDashboardAggregate } from './article-dashboard.js';
import { buildCustomerSafeProductionStatus } from './article-production-handoffs.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

const CUSTOMER_DOWNLOAD_FILENAMES = new Set(['article.md', 'article.html']);

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function textValue(value, fallback = null) {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function previewText(preview = {}) {
  const raw = preview.markdown || preview.html || '';
  return textValue(raw, '')?.slice(0, 4000) || null;
}

function safeFiles(files = [], packageId = null) {
  return files
    .filter((file) => CUSTOMER_DOWNLOAD_FILENAMES.has(file.filename))
    .map((file) => ({
      filename: file.filename,
      content_type: file.content_type,
      size_bytes: file.size_bytes,
      preview: file.preview || null,
      download_url: packageId
        ? `/dashboard/article-export-files/${encodeURIComponent(packageId)}/${encodeURIComponent(file.filename)}`
        : null
    }));
}

function reviewState(article) {
  const handoff = article.publish_handoff || {};
  const customerReview = handoff.customer_review || {};
  const packageStatus = article.dashboard_package?.status || null;
  const reviewStatus = article.dashboard_package?.summary?.quality_review_status || 'not_started';
  const status = handoff.status || (packageStatus === 'ready_for_dashboard' ? 'customer_review' : 'not_ready');
  const requestedChanges = arrayValue(customerReview.requested_changes);

  return {
    status,
    quality_review_status: reviewStatus,
    decision: customerReview.decision || 'pending',
    requested_change_count: requestedChanges.length,
    latest_requested_change: requestedChanges.at(-1)?.note || null,
    ready_for_customer_review: packageStatus === 'ready_for_dashboard' && status !== 'not_ready',
    next_step:
      status === 'changes_requested'
        ? 'The team should revise the article before another review.'
        : status === 'approved_for_publish_handoff'
          ? 'The article is approved for manual publish handoff. Nothing is published automatically.'
          : packageStatus === 'ready_for_dashboard'
            ? 'Customer can review the article preview, request changes, or approve the manual handoff.'
            : 'The article package is still being prepared.'
  };
}

function r52Actions(article) {
  const review = reviewState(article);
  if (review.status !== 'customer_review') return [];

  return arrayValue(article.customer_actions)
    .filter((action) => ['request_changes', 'approve_for_publish_handoff'].includes(action.type) && action.enabled)
    .map((action) => ({
      type: action.type,
      label: action.type === 'approve_for_publish_handoff' ? 'Approve handoff' : 'Request changes',
      enabled: true,
      source: action.source,
      next_step:
        action.type === 'approve_for_publish_handoff'
          ? 'The team can prepare the manual publish handoff. Nothing is published automatically.'
          : 'The article returns to the team for revision before another review.'
    }));
}

function safeTimeline(article) {
  const handoff = article.publish_handoff || {};
  const review = reviewState(article);
  return {
    status: review.status,
    dashboard_summary: {
      current_stage: review.ready_for_customer_review ? 'customer_review' : article.article.current_stage,
      next_action:
        review.status === 'changes_requested'
          ? 'team_revision'
          : review.status === 'approved_for_publish_handoff'
            ? 'manual_publish_handoff'
            : 'approve_or_request_changes'
    },
    stages: [
      {
        label: 'Brief linked',
        status: 'done',
        summary: 'Article starts from a customer-approved content brief.'
      },
      {
        label: 'Article generated',
        status: article.dashboard_package ? 'done' : 'pending',
        summary: article.dashboard_package ? 'Preview package is available.' : 'Waiting for generated article package.'
      },
      {
        label: 'Quality review',
        status: review.quality_review_status === 'approved_for_export' ? 'done' : 'pending',
        summary: review.quality_review_status
      },
      {
        label: 'Customer review',
        status: review.status === 'changes_requested' ? 'changes_requested' : handoff.status || 'pending',
        summary: review.next_step
      }
    ]
  };
}

function safeArticle(article) {
  const pkg = article.dashboard_package;
  const handoff = article.publish_handoff;
  const review = reviewState(article);
  const productionStatus =
    article.production_handoff?.customer_safe_status ||
    buildCustomerSafeProductionStatus({
      status: pkg ? 'production_completed' : article.production_handoff?.status || 'not_started'
    });
  const missingSections = arrayValue(article.integrity?.missing_sections).filter(
    (section) => !['article_retest_report', 'article_delivery_timeline'].includes(section)
  );

  return {
    schema_version: 'r5-2-customer-article-review-item-v1',
    status: pkg ? 'review_ready' : 'in_progress',
    article: {
      article_draft_id: article.article.article_draft_id,
      title: article.article.title,
      content_type: article.article.content_type,
      current_stage: review.ready_for_customer_review ? 'customer_review' : article.article.current_stage,
      next_action:
        review.status === 'changes_requested'
          ? 'team_revision'
          : review.status === 'approved_for_publish_handoff'
            ? 'manual_publish_handoff'
            : 'approve_or_request_changes'
    },
    dashboard_package: pkg
      ? {
          id: pkg.id,
          status: pkg.status,
          summary: {
            title: pkg.summary?.title || article.article.title,
            content_type: pkg.summary?.content_type || article.article.content_type,
            quality_review_status: pkg.summary?.quality_review_status || review.quality_review_status
          },
          preview: {
            markdown: previewText(pkg.preview),
            html: null
          },
          files: safeFiles(pkg.files || [], pkg.id),
          internal_links: pkg.internal_links || [],
          delivery_guardrails: pkg.delivery_guardrails || []
        }
      : null,
    publish_handoff: handoff
      ? {
          id: handoff.id,
          status: handoff.status,
          publish_status: 'not_published',
          state_machine: {
            current: handoff.status,
            next_step: review.next_step,
            allowed_actions: r52Actions(article).map((action) => action.type),
            blocked_actions: ['auto_publish', 'prepare_publish_handoff_until_R6', 'retest_execution_until_R6']
          },
          customer_review: {
            decision: review.decision,
            requested_changes: arrayValue(handoff.customer_review?.requested_changes).map((change) => ({
              requested_at: change.requested_at,
              requested_by: change.requested_by,
              note: change.note
            }))
          },
          guardrails: [
            'R5.2 supports request-changes and approve-for-manual-handoff customer actions.',
            'Approval does not publish content, prepare a handoff packet, call CMS/webhooks, or schedule retests.'
          ]
        }
      : null,
    production_handoff: {
      ...productionStatus,
      provider: 'growth_loop'
    },
    retest_report: null,
    delivery_timeline: {
      id: null,
      status: review.status,
      payload: safeTimeline(article)
    },
    review,
    customer_actions: r52Actions(article),
    integrity: {
      missing_sections: missingSections,
      has_review_package: Boolean(pkg),
      source_ids: {
        content_brief_id: article.integrity?.source_ids?.content_brief_id || null,
        article_draft_id: article.article.article_draft_id,
        article_export_package_id: pkg?.id || null,
        article_publish_handoff_id: handoff?.id || null
      }
    },
    guardrails: [
      'This R5.2 payload is limited to article preview, review state, approve/request actions, and safe article downloads.',
      'File bodies are only available through customer download routes for article.md and article.html.',
      'Provider payloads, internal ops receipts, publish execution, CMS actions, and retest controls are not included.'
    ]
  };
}

export function buildCustomerArticleReviewPayload({
  dashboard,
  generatedAt = new Date().toISOString()
}) {
  const articles = arrayValue(dashboard.articles).map(safeArticle);
  return {
    schema_version: 'r5-2-customer-article-review-v1',
    generated_at: generatedAt,
    tracking_run_id: dashboard.tracking_run_id,
    status: articles.length ? 'ready' : 'empty',
    brand: {
      id: dashboard.run?.brand_id || null,
      name: dashboard.run?.brand_name || null,
      website_url: dashboard.run?.website_url || null
    },
    summary: {
      article_count: articles.length,
      review_ready_count: articles.filter((article) => article.review.ready_for_customer_review).length,
      changes_requested_count: articles.filter((article) => article.review.status === 'changes_requested').length,
      approved_for_handoff_count: articles.filter((article) => article.review.status === 'approved_for_publish_handoff').length,
      request_changes_available_count: articles.filter((article) =>
        article.customer_actions.some((action) => action.type === 'request_changes')
      ).length,
      approve_handoff_available_count: articles.filter((article) =>
        article.customer_actions.some((action) => action.type === 'approve_for_publish_handoff')
      ).length
    },
    articles,
    guardrails: [
      'R5.2 is customer-facing article review, approval handoff, and safe export download only.',
      'Request changes returns the article to the team for revision.',
      'Approve handoff only records customer approval for later manual handoff preparation.',
      'Publish handoff execution, external publishing, and retest execution start in R6 or later.'
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
           FROM article_drafts ad
           WHERE ad.tracking_run_id = tr.id
         ) THEN 0
         ELSE 1
       END,
       tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getCustomerArticleReviewPayload(options = {}) {
  const trackingRunId = await resolveTrackingRun(options);
  if (!trackingRunId) return null;
  const dashboard = await getArticleDashboardAggregate(trackingRunId, {
    article_draft_id: options.article_draft_id
  });
  return buildCustomerArticleReviewPayload({ dashboard });
}

export async function getCustomerArticleExportFile({ package_id: packageId, filename } = {}) {
  if (!packageId || !CUSTOMER_DOWNLOAD_FILENAMES.has(filename)) return null;

  const result = await pool.query(
    `SELECT aep.package_payload
     FROM article_export_packages aep
     JOIN tracking_runs tr ON tr.id = aep.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE aep.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [packageId]
  );
  const payload = result.rows[0]?.package_payload || null;
  if (!payload || payload.status !== 'ready_for_dashboard') return null;

  const file = arrayValue(payload.files).find((candidate) => candidate.filename === filename);
  if (!file || !CUSTOMER_DOWNLOAD_FILENAMES.has(file.filename)) return null;

  return {
    filename: file.filename,
    content_type: file.content_type || 'application/octet-stream',
    body: String(file.body || '')
  };
}
