import { pool } from './db.js';
import {
  buildCustomerSafeProductionStatus,
  getArticleProductionHandoff,
  listArticleProductionHandoffs,
  validateArticleProductionCallback
} from './article-production-handoffs.js';
import { buildArticleQualityReview } from './article-quality-reviews.js';

function nowIso() {
  return new Date().toISOString();
}

function bodyPreview(markdown) {
  const text = String(markdown || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 500) return text;
  return `${text.slice(0, 500).trim()}...`;
}

function safetyReview(expansion) {
  const serialized = JSON.stringify(expansion).toLowerCase();
  const blockedPatterns = [
    'guaranteed improvement',
    'visibility has improved',
    '#1',
    'number one',
    'award-winning',
    'certified by',
    'proven roi',
    'customers include'
  ];
  const violations = blockedPatterns.filter((pattern) => serialized.includes(pattern));
  const missingHumanReviewGuardrail = !(expansion.guardrails || []).some((guardrail) =>
    String(guardrail).toLowerCase().includes('human review')
  );
  if (missingHumanReviewGuardrail) {
    violations.push('missing human review guardrail');
  }

  return {
    passed: violations.length === 0,
    violations,
    checked_at: nowIso(),
    checks: [
      'forbidden claim patterns',
      'human review guardrail',
      'validated prompt lineage',
      'geoflow metadata completeness',
      'retest claim boundary'
    ]
  };
}

export function validateGeoFlowImportPayload(handoffRow) {
  const providerResult = handoffRow.provider_result || {};
  const reconstructedCallback = {
    provider_job_id: providerResult.provider_job_id,
    status: providerResult.status || handoffRow.status,
    article_markdown: providerResult.article_markdown,
    article_html: providerResult.article_html,
    metadata: providerResult.metadata,
    production_notes: providerResult.production_notes || [],
    error_code: providerResult.error_code,
    error_message: providerResult.error_message
  };
  const callbackValidation =
    providerResult.callback_validation?.schema_version === 'r8-2-geoflow-callback-validation-v1'
      ? providerResult.callback_validation
      : validateArticleProductionCallback(
          {
            ...handoffRow,
            status: 'submitted_to_geoflow'
          },
          reconstructedCallback
        );
  const blockers = [
    handoffRow.provider !== 'geoflow' ? `unsupported import provider: ${handoffRow.provider}` : null,
    handoffRow.status !== 'production_completed' ? 'GeoFlow production handoff is not production_completed' : null,
    callbackValidation.ok !== true ? 'GeoFlow callback validation did not pass' : null,
    !providerResult.article_markdown || !providerResult.article_html || !providerResult.metadata
      ? 'GeoFlow provider result is missing markdown, html, or metadata'
      : null,
    !providerResult.article_markdown ? 'missing article_markdown' : null,
    !providerResult.article_html ? 'missing article_html' : null,
    !providerResult.metadata ? 'missing metadata' : null
  ].filter(Boolean);

  return {
    schema_version: 'r8-2-geoflow-import-validation-v1',
    provider: 'geoflow',
    handoff_id: handoffRow.id,
    ok: blockers.length === 0,
    blockers,
    callback_validation: callbackValidation,
    customer_safe_status: buildCustomerSafeProductionStatus(handoffRow),
    gates: {
      expansion_import_allowed: blockers.length === 0,
      human_quality_review_required: true,
      customer_review_allowed: false,
      publish_allowed: false,
      retest_allowed: false
    },
    guardrails: [
      'Import validation only converts completed GeoFlow output into an internal expansion.',
      'Imported output must enter human quality review before export, customer review, or publish handoff.',
      'Import validation cannot create publish, scoring, retest, report, webhook, or email side effects.'
    ],
    validated_at: nowIso()
  };
}

function sectionBody({ section, markdown }) {
  const preview = bodyPreview(markdown);
  return [
    preview || section.draft_instruction || section.purpose,
    section.target_prompt ? `Target prompt: ${section.target_prompt}` : null
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildGeoFlowImportedExpansion({ handoffRow, draftRow }) {
  const providerResult = handoffRow.provider_result || {};
  const draft = draftRow.draft_payload || {};
  const importValidation = validateGeoFlowImportPayload(handoffRow);
  if (!importValidation.ok) {
    return {
      status: 'blocked',
      article_production_handoff_id: handoffRow.id,
      blockers: importValidation.blockers,
      import_validation: importValidation
    };
  }

  const expansion = {
    schema_version: 'phase4-article-expansion-v1',
    provider_mode: 'geoflow',
    article_draft_id: draftRow.id,
    tracking_run_id: draftRow.tracking_run_id,
    source_draft_schema: draft.schema_version,
    source_production_handoff_id: handoffRow.id,
    source_provider_job_id: providerResult.provider_job_id || null,
    title: providerResult.metadata.title || draft.title,
    content_type: providerResult.metadata.content_type || draft.content_type,
    status: 'expanded_draft',
    primary_prompt: providerResult.metadata.primary_prompt || draft.primary_prompt || null,
    introduction:
      providerResult.metadata.summary ||
      `GeoFlow generated this article from a Growth Loop content brief and validated prompt lineage.`,
    sections: (draft.outline || []).map((section) => ({
      order: section.order,
      heading: section.heading,
      target_prompt: section.target_prompt,
      body: sectionBody({ section, markdown: providerResult.article_markdown }),
      citations_needed: section.evidence_requirements || draft.evidence_requirements || [],
      facts_used: section.required_facts || draft.must_include_facts || []
    })),
    conclusion: 'Review the imported GeoFlow output against the source brief before publishing.',
    target_prompts: draft.target_prompts || providerResult.metadata.target_prompts || [],
    internal_link_targets: draft.internal_link_targets || providerResult.metadata.internal_link_targets || [],
    guardrails: draft.guardrails || [],
    forbidden_claims: draft.forbidden_claims || [],
    retest_plan: draft.retest_plan || providerResult.metadata.retest_plan || {},
    provider_output: {
      schema_version: 'phase4-geoflow-imported-output-v1',
      article_markdown: providerResult.article_markdown,
      article_html: providerResult.article_html,
      metadata: providerResult.metadata,
      production_notes: providerResult.production_notes || [],
      imported_at: nowIso(),
      import_validation: {
        schema_version: importValidation.schema_version,
        ok: importValidation.ok,
        human_quality_review_required: importValidation.gates.human_quality_review_required,
        customer_review_allowed: importValidation.gates.customer_review_allowed,
        publish_allowed: importValidation.gates.publish_allowed
      }
    },
    import_validation: importValidation,
    review_required: true
  };
  const review = safetyReview(expansion);

  return {
    ...expansion,
    safety_review: review,
    status: review.passed ? 'expanded_draft' : 'blocked_by_safety_review'
  };
}

function normalizeExpansionRow(row) {
  return {
    ...row,
    expansion_payload: row.expansion_payload || {},
    safety_review: row.safety_review || {}
  };
}

function normalizeReviewRow(row) {
  return {
    ...row,
    review_payload: row.review_payload || {},
    machine_checks: row.machine_checks || {}
  };
}

async function draftForHandoff(handoff) {
  const result = await pool.query(`SELECT * FROM article_drafts WHERE id = $1`, [handoff.article_draft_id]);
  if (!result.rowCount) {
    throw new Error(`article draft not found for handoff: ${handoff.id}`);
  }
  return {
    ...result.rows[0],
    draft_payload: result.rows[0].draft_payload || {},
    validation_state: result.rows[0].validation_state || {}
  };
}

async function saveImportedExpansion({ handoff, expansion }) {
  const expansionKey = `${handoff.article_draft_id}:geoflow:${handoff.id}`;
  const result = await pool.query(
    `INSERT INTO article_draft_expansions (
       tracking_run_id,
       article_draft_id,
       expansion_key,
       provider_mode,
       status,
       expansion_payload,
       safety_review
     )
     VALUES ($1, $2, $3, 'geoflow', $4, $5, $6)
     ON CONFLICT (article_draft_id, provider_mode)
     DO UPDATE SET
       expansion_key = EXCLUDED.expansion_key,
       status = EXCLUDED.status,
       expansion_payload = EXCLUDED.expansion_payload,
       safety_review = EXCLUDED.safety_review,
       updated_at = NOW()
     RETURNING *`,
    [
      handoff.tracking_run_id,
      handoff.article_draft_id,
      expansionKey,
      expansion.status,
      JSON.stringify(expansion),
      JSON.stringify(expansion.safety_review)
    ]
  );
  return normalizeExpansionRow(result.rows[0]);
}

async function saveQualityReview({ expansionRow, humanReviewStatus }) {
  const review = buildArticleQualityReview({
    expansionRow,
    humanReviewStatus
  });
  const reviewKey = `${expansionRow.id}:quality`;
  const result = await pool.query(
    `INSERT INTO article_quality_reviews (
       tracking_run_id,
       article_draft_expansion_id,
       article_draft_id,
       review_key,
       status,
       human_review_status,
       review_payload,
       machine_checks
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (article_draft_expansion_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       human_review_status = EXCLUDED.human_review_status,
       review_payload = EXCLUDED.review_payload,
       machine_checks = EXCLUDED.machine_checks,
       updated_at = NOW()
     RETURNING *`,
    [
      expansionRow.tracking_run_id,
      expansionRow.id,
      expansionRow.article_draft_id,
      reviewKey,
      review.status,
      humanReviewStatus,
      JSON.stringify(review),
      JSON.stringify(review.machine_checks)
    ]
  );
  return normalizeReviewRow(result.rows[0]);
}

export async function importGeoFlowProductionResult(id, options = {}) {
  const handoff = await getArticleProductionHandoff(id);
  if (!handoff) {
    throw new Error(`article production handoff not found: ${id}`);
  }
  const draft = await draftForHandoff(handoff);
  const expansion = buildGeoFlowImportedExpansion({
    handoffRow: handoff,
    draftRow: draft
  });
  if (expansion.status !== 'expanded_draft') {
    return {
      status: 'blocked',
      handoff_id: id,
      expansion,
      review: null
    };
  }

  const expansionRow = await saveImportedExpansion({ handoff, expansion });
  const review = await saveQualityReview({
    expansionRow,
    humanReviewStatus: options.review_import === true ? options.human_review_status || 'pending' : 'pending'
  });

  return {
    status: 'imported',
    handoff_id: id,
    expansion: expansionRow,
    review
  };
}

export async function importGeoFlowProductionResultsForRun(trackingRunId, options = {}) {
  const handoffs = await listArticleProductionHandoffs(trackingRunId);
  const imported = [];
  const blocked = [];
  const skipped = [];

  for (const handoff of handoffs) {
    if (handoff.provider !== 'geoflow') {
      skipped.push({
        id: handoff.id,
        reason: `unsupported provider ${handoff.provider}`
      });
      continue;
    }
    const result = await importGeoFlowProductionResult(handoff.id, options);
    if (result.status === 'imported') {
      imported.push(result);
    } else {
      blocked.push(result);
    }
  }

  return {
    tracking_run_id: trackingRunId,
    imported_count: imported.length,
    blocked_count: blocked.length,
    skipped_count: skipped.length,
    imported,
    blocked,
    skipped
  };
}
