import { pool } from './db.js';
import { generateArticleExports, listArticleExports } from './article-exports.js';

const PREVIEW_LIMIT = 600;

function previewOf(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (text.length <= PREVIEW_LIMIT) return text;
  return `${text.slice(0, PREVIEW_LIMIT).trim()}...`;
}

function packageFiles(files = []) {
  return files.map((file) => ({
    filename: file.filename,
    content_type: file.content_type,
    size_bytes: Buffer.byteLength(file.body || '', 'utf8'),
    preview: previewOf(file.body),
    body: file.body
  }));
}

function primaryPreview(files = []) {
  const markdown = files.find((file) => file.filename === 'article.md');
  const html = files.find((file) => file.filename === 'article.html');
  return {
    markdown: markdown ? previewOf(markdown.body) : null,
    html: html ? previewOf(html.body) : null
  };
}

export function buildArticleExportPackage(exportRow) {
  const exportPayload = exportRow.export_payload || {};
  if (exportPayload.status !== 'ready_for_download' || exportRow.status !== 'ready_for_download') {
    return {
      status: 'blocked',
      article_export_id: exportRow.id,
      blockers: ['article export is not ready_for_download']
    };
  }

  const files = packageFiles(exportPayload.files || []);
  const metadata = exportPayload.metadata || {};

  return {
    schema_version: 'phase4-export-package-v1',
    status: 'ready_for_dashboard',
    tracking_run_id: exportRow.tracking_run_id,
    article_export_id: exportRow.id,
    article_quality_review_id: exportRow.article_quality_review_id,
    article_draft_expansion_id: exportRow.article_draft_expansion_id,
    article_draft_id: exportRow.article_draft_id,
    dashboard_summary: {
      title: metadata.title || 'Untitled article export',
      content_type: metadata.content_type || null,
      primary_prompt: metadata.primary_prompt || null,
      export_status: exportRow.status,
      publish_status: metadata.publish_status || 'not_published',
      quality_review_status: metadata.quality_review_status || null,
      human_review_status: metadata.human_review_status || null,
      retest_target: exportPayload.retest_notes?.target_metric || null
    },
    preview: primaryPreview(exportPayload.files || []),
    files,
    metadata,
    internal_links: exportPayload.internal_links || [],
    retest_notes: exportPayload.retest_notes || {},
    delivery_guardrails: exportPayload.delivery_guardrails || [],
    handoff_state: {
      current_step: 'customer_review',
      publish_handoff_status: 'not_started',
      customer_action_required: true,
      allowed_next_actions: ['preview', 'download', 'request_changes', 'approve_for_publish_handoff'],
      blocked_actions: ['auto_publish'],
      guardrail: 'Do not publish automatically from the dashboard handoff payload.'
    }
  };
}

function normalizePackageRow(row) {
  return {
    ...row,
    package_payload: row.package_payload || {}
  };
}

export async function listArticleExportPackages(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_export_packages
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizePackageRow);
}

export async function generateArticleExportPackages(trackingRunId) {
  let exports = await listArticleExports(trackingRunId);
  if (!exports.length) {
    await generateArticleExports(trackingRunId);
    exports = await listArticleExports(trackingRunId);
  }

  const saved = [];
  const blocked = [];
  for (const articleExport of exports) {
    const exportPackage = buildArticleExportPackage(articleExport);
    if (exportPackage.status !== 'ready_for_dashboard') {
      blocked.push(exportPackage);
      continue;
    }

    const packageKey = `${articleExport.id}:dashboard-package`;
    const result = await pool.query(
      `INSERT INTO article_export_packages (
         tracking_run_id,
         article_export_id,
         package_key,
         status,
         package_payload
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (article_export_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         package_payload = EXCLUDED.package_payload,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        articleExport.id,
        packageKey,
        exportPackage.status,
        JSON.stringify(exportPackage)
      ]
    );
    saved.push(normalizePackageRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    packaged_count: saved.length,
    blocked_count: blocked.length,
    packages: saved,
    blocked_packages: blocked
  };
}
