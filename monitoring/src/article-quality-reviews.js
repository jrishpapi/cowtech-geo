import { pool } from './db.js';
import { expandArticleDrafts, listArticleDraftExpansions } from './article-draft-expansions.js';

function check(name, passed, evidence = {}) {
  return {
    name,
    passed: passed === true,
    evidence
  };
}

function allPassed(checks) {
  return checks.every((item) => item.passed === true);
}

function forbiddenClaimCheck(expansion) {
  const safety = expansion.safety_review || {};
  return check('forbidden_claims', safety.passed === true, {
    source: 'safety_review',
    violations: safety.violations || []
  });
}

function promptCoverageCheck(expansion) {
  const prompts = expansion.target_prompts || [];
  const sections = expansion.sections || [];
  const sectionsWithPrompt = sections.filter((section) => section.target_prompt).length;
  return check('validated_prompt_coverage', prompts.length > 0 && sectionsWithPrompt === sections.length, {
    target_prompt_count: prompts.length,
    section_count: sections.length,
    sections_with_prompt: sectionsWithPrompt
  });
}

function factsCoverageCheck(expansion) {
  const sections = expansion.sections || [];
  const sectionsWithFacts = sections.filter((section) => (section.facts_used || []).length > 0).length;
  return check('facts_coverage', sections.length > 0 && sectionsWithFacts === sections.length, {
    section_count: sections.length,
    sections_with_facts: sectionsWithFacts
  });
}

function evidenceRequirementsCheck(expansion) {
  const sections = expansion.sections || [];
  const sectionsWithEvidence = sections.filter((section) => (section.citations_needed || []).length > 0).length;
  return check('evidence_requirements', sections.length > 0 && sectionsWithEvidence === sections.length, {
    section_count: sections.length,
    sections_with_evidence: sectionsWithEvidence
  });
}

function internalLinksCheck(expansion) {
  const links = expansion.internal_link_targets || [];
  return check('internal_links', links.length > 0, {
    internal_link_count: links.length
  });
}

function retestPlanCheck(expansion) {
  const retestPlan = expansion.retest_plan || {};
  return check('retest_plan', Boolean(retestPlan.target_metric), {
    target_metric: retestPlan.target_metric || null
  });
}

function humanReviewCheck(humanReviewStatus) {
  return check('human_review', humanReviewStatus === 'approved', {
    human_review_status: humanReviewStatus
  });
}

function reviewStatus({ machinePassed, humanReviewStatus }) {
  if (!machinePassed) return 'blocked_by_quality_gate';
  if (humanReviewStatus !== 'approved') return 'needs_human_review';
  return 'approved_for_export';
}

export function buildArticleQualityReview({ expansionRow, humanReviewStatus = 'pending' }) {
  const expansion = expansionRow.expansion_payload || {};
  const machineChecks = [
    forbiddenClaimCheck(expansion),
    promptCoverageCheck(expansion),
    factsCoverageCheck(expansion),
    evidenceRequirementsCheck(expansion),
    internalLinksCheck(expansion),
    retestPlanCheck(expansion)
  ];
  const machinePassed = allPassed(machineChecks);
  const humanCheck = humanReviewCheck(humanReviewStatus);
  const status = reviewStatus({ machinePassed, humanReviewStatus });

  return {
    schema_version: 'phase4-article-quality-review-v1',
    tracking_run_id: expansionRow.tracking_run_id,
    article_draft_expansion_id: expansionRow.id,
    article_draft_id: expansionRow.article_draft_id,
    title: expansion.title,
    status,
    human_review_status: humanReviewStatus,
    machine_passed: machinePassed,
    publish_ready: status === 'approved_for_export',
    machine_checks: machineChecks,
    human_review_check: humanCheck,
    next_step:
      status === 'approved_for_export'
        ? 'Ready for export or publish handoff.'
        : status === 'needs_human_review'
          ? 'Send to human review before export or publish.'
          : 'Fix failed quality checks before review.',
    guardrail: 'Do not publish or export unless status is approved_for_export.'
  };
}

function normalizeReviewRow(row) {
  return {
    ...row,
    review_payload: row.review_payload || {},
    machine_checks: row.machine_checks || {}
  };
}

export async function listArticleQualityReviews(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_quality_reviews
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeReviewRow);
}

export async function reviewArticleDraftExpansions(trackingRunId, { human_review_status = 'pending' } = {}) {
  let expansions = await listArticleDraftExpansions(trackingRunId);
  if (!expansions.length) {
    const expanded = await expandArticleDrafts(trackingRunId, { provider_mode: 'mock' });
    expansions = expanded.expansions;
  }

  const saved = [];
  for (const expansionRow of expansions) {
    const review = buildArticleQualityReview({
      expansionRow,
      humanReviewStatus: human_review_status
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
        trackingRunId,
        expansionRow.id,
        expansionRow.article_draft_id,
        reviewKey,
        review.status,
        human_review_status,
        JSON.stringify(review),
        JSON.stringify(review.machine_checks)
      ]
    );
    saved.push(normalizeReviewRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    reviewed_count: saved.length,
    approved_count: saved.filter((row) => row.status === 'approved_for_export').length,
    needs_human_review_count: saved.filter((row) => row.status === 'needs_human_review').length,
    blocked_count: saved.filter((row) => row.status === 'blocked_by_quality_gate').length,
    reviews: saved
  };
}
