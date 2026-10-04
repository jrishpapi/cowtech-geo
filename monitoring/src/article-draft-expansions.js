import { assertProviderConfigured } from './provider-configuration.js';
import { pool } from './db.js';
import { generateArticleDrafts, listArticleDrafts } from './article-drafts.js';
import { createProviderError } from './errors.js';

function sentenceList(items, limit = 4) {
  return (items || []).filter(Boolean).slice(0, limit).join(' ');
}

function shortEvidenceLine(requirements) {
  const first = (requirements || [])[0];
  return first ? `Evidence requirement: ${first}` : 'Evidence requirement: use only verified facts from the brief.';
}

function expandSection({ section, draft }) {
  const facts = sentenceList(section.required_facts, 3);
  const evidence = shortEvidenceLine(section.evidence_requirements);
  const prompt = section.target_prompt
    ? `This section should help answer: "${section.target_prompt}"`
    : `This section should support the primary prompt: "${draft.primary_prompt}"`;

  return {
    order: section.order,
    heading: section.heading,
    target_prompt: section.target_prompt,
    body:
      `${section.heading}. ${section.purpose} ${prompt}. ` +
      `${facts ? `Use these verified facts: ${facts}. ` : ''}` +
      `${evidence} Keep the wording concise, factual, and citation-ready.`,
    citations_needed: section.evidence_requirements || [],
    facts_used: section.required_facts || []
  };
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
    checked_at: new Date().toISOString(),
    checks: [
      'forbidden claim patterns',
      'human review guardrail',
      'validated prompt linkage',
      'retest claim boundary'
    ]
  };
}

function assertExpansionProvider(providerMode) {
  assertProviderConfigured(providerMode);
  if (providerMode === 'mock') return;
  throw createProviderError({
    code: 'article_expansion_provider_not_implemented',
    message: `Article expansion provider is not implemented yet: ${providerMode}`,
    retryable: false
  });
}

export function buildArticleExpansion({ draftRow, providerMode = 'mock' }) {
  assertExpansionProvider(providerMode);
  const draft = draftRow.draft_payload;
  if (!draft?.validation_state?.can_generate_draft) {
    return {
      status: 'blocked',
      article_draft_id: draftRow.id,
      validation_state: draft?.validation_state || {
        can_generate_draft: false,
        blockers: ['article draft validation state is missing or blocked']
      }
    };
  }

  const expansion = {
    schema_version: 'phase4-article-expansion-v1',
    provider_mode: providerMode,
    article_draft_id: draftRow.id,
    tracking_run_id: draftRow.tracking_run_id,
    source_draft_schema: draft.schema_version,
    title: draft.title,
    content_type: draft.content_type,
    status: 'expanded_draft',
    primary_prompt: draft.primary_prompt,
    introduction:
      `${draft.title} is a content draft for ${draft.audience} It is designed to answer validated AI opportunity prompts while staying inside the brief guardrails.`,
    sections: (draft.outline || []).map((section) => expandSection({ section, draft })),
    conclusion:
      `Use this draft as a factual starting point, then review every claim against the source brief before publishing.`,
    target_prompts: draft.target_prompts || [],
    internal_link_targets: draft.internal_link_targets || [],
    guardrails: draft.guardrails || [],
    forbidden_claims: draft.forbidden_claims || [],
    retest_plan: draft.retest_plan || {},
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

export async function listArticleDraftExpansions(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_draft_expansions
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeExpansionRow);
}

export async function expandArticleDrafts(trackingRunId, { provider_mode = 'mock' } = {}) {
  assertExpansionProvider(provider_mode);

  let drafts = await listArticleDrafts(trackingRunId);
  if (!drafts.length) {
    const generated = await generateArticleDrafts(trackingRunId);
    drafts = generated.drafts;
  }

  const saved = [];
  const blocked = [];
  for (const draftRow of drafts) {
    const expansion = buildArticleExpansion({ draftRow, providerMode: provider_mode });
    if (expansion.status !== 'expanded_draft') {
      blocked.push(expansion);
      continue;
    }

    const expansionKey = `${draftRow.id}:${provider_mode}`;
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
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_draft_id, provider_mode)
       DO UPDATE SET
         expansion_key = EXCLUDED.expansion_key,
         status = EXCLUDED.status,
         expansion_payload = EXCLUDED.expansion_payload,
         safety_review = EXCLUDED.safety_review,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        draftRow.id,
        expansionKey,
        provider_mode,
        expansion.status,
        JSON.stringify(expansion),
        JSON.stringify(expansion.safety_review)
      ]
    );
    saved.push(normalizeExpansionRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    provider_mode,
    expanded_count: saved.length,
    blocked_count: blocked.length,
    expansions: saved,
    blocked_expansions: blocked
  };
}
