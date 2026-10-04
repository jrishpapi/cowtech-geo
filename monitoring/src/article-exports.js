import { pool } from './db.js';
import { reviewArticleDraftExpansions } from './article-quality-reviews.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownFor(expansion) {
  if (expansion.provider_output?.article_markdown) {
    return String(expansion.provider_output.article_markdown).trim() + '\n';
  }

  const lines = [`# ${expansion.title}`, '', expansion.introduction, ''];
  for (const section of expansion.sections || []) {
    lines.push(`## ${section.heading}`, '', section.body, '');
  }
  lines.push('## Conclusion', '', expansion.conclusion, '');

  if ((expansion.internal_link_targets || []).length) {
    lines.push('## Internal Links', '');
    for (const link of expansion.internal_link_targets) {
      lines.push(`- [${link.label}](${link.url}) - ${link.reason || 'Supporting source'}`);
    }
    lines.push('');
  }

  if (expansion.retest_plan?.target_metric) {
    lines.push('## Retest Notes', '');
    lines.push(`- Target metric: ${expansion.retest_plan.target_metric}`);
    if (expansion.retest_plan.desired_direction) {
      lines.push(`- Desired direction: ${expansion.retest_plan.desired_direction}`);
    }
    lines.push('- Do not claim improvement until a future retest confirms movement.', '');
  }

  return lines.join('\n').trim() + '\n';
}

function htmlFor(expansion) {
  if (expansion.provider_output?.article_html) {
    return String(expansion.provider_output.article_html).trim();
  }

  const sections = (expansion.sections || [])
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`
    )
    .join('\n');
  const links = (expansion.internal_link_targets || [])
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a> - ${escapeHtml(
          link.reason || 'Supporting source'
        )}</li>`
    )
    .join('\n');

  return [
    '<article>',
    `<h1>${escapeHtml(expansion.title)}</h1>`,
    `<p>${escapeHtml(expansion.introduction)}</p>`,
    sections,
    '<section><h2>Conclusion</h2>',
    `<p>${escapeHtml(expansion.conclusion)}</p></section>`,
    links ? `<section><h2>Internal Links</h2><ul>${links}</ul></section>` : '',
    '</article>'
  ]
    .filter(Boolean)
    .join('\n');
}

function metadataFor({ expansion, review }) {
  return {
    title: expansion.title,
    content_type: expansion.content_type,
    primary_prompt: expansion.primary_prompt,
    target_prompt_count: (expansion.target_prompts || []).length,
    internal_link_count: (expansion.internal_link_targets || []).length,
    source_draft_schema: expansion.source_draft_schema,
    expansion_schema: expansion.schema_version,
    production_source: expansion.provider_mode || null,
    source_provider_job_id: expansion.source_provider_job_id || null,
    source_production_handoff_id: expansion.source_production_handoff_id || null,
    quality_review_schema: review.schema_version,
    quality_review_status: review.status,
    human_review_status: review.human_review_status,
    publish_ready: review.publish_ready,
    publish_status: 'not_published',
    export_status: 'ready_for_download'
  };
}

export function buildArticleExport({ reviewRow, expansionRow }) {
  const review = reviewRow.review_payload || {};
  const expansion = expansionRow.expansion_payload || {};
  if (review.status !== 'approved_for_export' || review.publish_ready !== true) {
    return {
      status: 'blocked',
      article_quality_review_id: reviewRow.id,
      article_draft_expansion_id: expansionRow.id,
      blockers: ['quality review is not approved_for_export']
    };
  }

  const markdown = markdownFor(expansion);
  const html = htmlFor(expansion);

  return {
    schema_version: 'phase4-article-export-v1',
    status: 'ready_for_download',
    article_quality_review_id: reviewRow.id,
    article_draft_expansion_id: expansionRow.id,
    article_draft_id: expansionRow.article_draft_id,
    tracking_run_id: expansionRow.tracking_run_id,
    metadata: metadataFor({ expansion, review }),
    files: [
      {
        filename: 'article.md',
        content_type: 'text/markdown',
        body: markdown
      },
      {
        filename: 'article.html',
        content_type: 'text/html',
        body: html
      },
      {
        filename: 'article.metadata.json',
        content_type: 'application/json',
        body: JSON.stringify(metadataFor({ expansion, review }), null, 2)
      }
    ],
    internal_links: expansion.internal_link_targets || [],
    retest_notes: {
      target_metric: expansion.retest_plan?.target_metric || null,
      desired_direction: expansion.retest_plan?.desired_direction || null,
      guardrail: 'Do not claim AI visibility improvement until a future retest confirms movement.'
    },
    delivery_guardrails: [
      'This export is not automatically published.',
      'Publish only after customer approval or configured CMS handoff.',
      'Keep the quality review record attached to the exported article.'
    ]
  };
}

function normalizeExportRow(row) {
  return {
    ...row,
    export_payload: row.export_payload || {}
  };
}

async function approvedReviewsWithExpansions(trackingRunId) {
  const result = await pool.query(
    `SELECT aqr.*,
            ade.expansion_payload,
            ade.article_draft_id,
            ade.id AS expansion_id
     FROM article_quality_reviews aqr
     JOIN article_draft_expansions ade ON ade.id = aqr.article_draft_expansion_id
     WHERE aqr.tracking_run_id = $1
     ORDER BY aqr.created_at ASC`,
    [trackingRunId]
  );

  return result.rows.map((row) => ({
    reviewRow: {
      id: row.id,
      tracking_run_id: row.tracking_run_id,
      article_draft_expansion_id: row.article_draft_expansion_id,
      article_draft_id: row.article_draft_id,
      status: row.status,
      human_review_status: row.human_review_status,
      review_payload: row.review_payload || {}
    },
    expansionRow: {
      id: row.expansion_id,
      tracking_run_id: row.tracking_run_id,
      article_draft_id: row.article_draft_id,
      expansion_payload: row.expansion_payload || {}
    }
  }));
}

export async function listArticleExports(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_exports
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeExportRow);
}

export async function generateArticleExports(trackingRunId) {
  let reviewPairs = await approvedReviewsWithExpansions(trackingRunId);
  if (!reviewPairs.length) {
    await reviewArticleDraftExpansions(trackingRunId, {
      human_review_status: 'pending'
    });
    reviewPairs = await approvedReviewsWithExpansions(trackingRunId);
  }

  const saved = [];
  const blocked = [];
  for (const pair of reviewPairs) {
    const articleExport = buildArticleExport(pair);
    if (articleExport.status !== 'ready_for_download') {
      blocked.push(articleExport);
      continue;
    }

    const exportKey = `${pair.reviewRow.id}:export`;
    const result = await pool.query(
      `INSERT INTO article_exports (
         tracking_run_id,
         article_quality_review_id,
         article_draft_expansion_id,
         article_draft_id,
         export_key,
         status,
         export_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_quality_review_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         export_payload = EXCLUDED.export_payload,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        pair.reviewRow.id,
        pair.expansionRow.id,
        pair.expansionRow.article_draft_id,
        exportKey,
        articleExport.status,
        JSON.stringify(articleExport)
      ]
    );
    saved.push(normalizeExportRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    exported_count: saved.length,
    blocked_count: blocked.length,
    exports: saved,
    blocked_exports: blocked
  };
}
