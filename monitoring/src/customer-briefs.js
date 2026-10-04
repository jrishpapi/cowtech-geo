import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function promptSummary(prompt) {
  return {
    id: prompt.id || null,
    prompt_text: prompt.prompt_text,
    prompt_source: prompt.prompt_source,
    prompt_category: prompt.prompt_category,
    opportunity_prompt_score: toNumber(prompt.opportunity_prompt_score),
    link_role: prompt.link_role || 'supporting'
  };
}

function articleReadiness(brief) {
  const linkedPrompts = arrayValue(brief.linked_opportunity_prompts).filter((prompt) => prompt.status === 'validated');
  if (brief.status === 'draft' && linkedPrompts.length) {
    return {
      status: 'article_ready',
      ready_for_article_workflow: true,
      validated_prompt_count: linkedPrompts.length,
      blockers: [],
      next_step: 'Use this brief as the source for article workflow in R5.'
    };
  }

  const blockers = [];
  if (brief.status !== 'draft') {
    blockers.push(`Brief status is ${brief.status}.`);
  }
  if (!linkedPrompts.length) {
    blockers.push('No validated opportunity prompts are linked yet.');
  }

  return {
    status: 'needs_validated_prompt',
    ready_for_article_workflow: false,
    validated_prompt_count: linkedPrompts.length,
    blockers,
    next_step: 'Validate and bind at least one opportunity prompt before article drafting.'
  };
}

function safeRetestPlan(brief) {
  const plan = objectValue(brief.retest_plan);
  return {
    target_metric: plan.target_metric || 'visibility_score',
    secondary_metric: plan.secondary_metric || null,
    desired_direction: plan.desired_direction || 'improve_primary_metric',
    retest_after: plan.retest_after || 'after_content_publish_and_indexing',
    prompt_categories: arrayValue(plan.prompt_categories),
    prompt_samples: arrayValue(plan.prompt_samples).slice(0, 5)
  };
}

function briefRequirements(brief) {
  const plan = objectValue(brief.retest_plan);
  const requirements = objectValue(plan.brief_requirements);
  return {
    page_type: requirements.page_type || brief.content_type,
    title_suggestion: requirements.title_suggestion || brief.title,
    must_answer_questions: arrayValue(requirements.must_answer_questions).length
      ? arrayValue(requirements.must_answer_questions).slice(0, 8)
      : arrayValue(brief.target_prompts).slice(0, 8),
    competitor_comparison_angle:
      requirements.competitor_comparison_angle ||
      'No direct competitor comparison angle is required unless it appears in the target prompts.',
    source_citation_requirements: arrayValue(requirements.source_citation_requirements).length
      ? arrayValue(requirements.source_citation_requirements)
      : arrayValue(brief.evidence_requirements)
  };
}

function briefDetail(brief) {
  const linkedPrompts = arrayValue(brief.linked_opportunity_prompts)
    .filter((prompt) => prompt.status === 'validated')
    .sort((a, b) => {
      if (a.link_role === 'primary' && b.link_role !== 'primary') return -1;
      if (a.link_role !== 'primary' && b.link_role === 'primary') return 1;
      return toNumber(b.opportunity_prompt_score) - toNumber(a.opportunity_prompt_score);
    });
  const readiness = articleReadiness({ ...brief, linked_opportunity_prompts: linkedPrompts });

  return {
    id: brief.id,
    brief_key: brief.brief_key,
    title: brief.title,
    content_type: brief.content_type,
    status: brief.status,
    objective: brief.objective,
    audience: brief.audience,
    execution_brief: briefRequirements(brief),
    linked_opportunity: {
      id: brief.opportunity_id,
      opportunity_key: brief.opportunity_key,
      opportunity_type: brief.opportunity_type,
      priority: brief.priority,
      title: brief.opportunity_title,
      recommended_format: brief.recommended_format
    },
    target_categories: arrayValue(brief.target_categories),
    target_prompts: arrayValue(brief.target_prompts).slice(0, 8),
    outline: arrayValue(brief.outline),
    must_include_facts: arrayValue(brief.must_include_facts),
    internal_link_targets: arrayValue(brief.internal_link_targets).map((link) => ({
      label: link.label,
      url: link.url,
      reason: link.reason
    })),
    evidence_requirements: arrayValue(brief.evidence_requirements),
    guardrails: arrayValue(brief.guardrails),
    validated_prompt_binding: {
      status: linkedPrompts.length ? 'bound' : 'missing_validated_prompt',
      validated_prompt_count: linkedPrompts.length,
      primary_prompt: linkedPrompts.find((prompt) => prompt.link_role === 'primary') ? promptSummary(linkedPrompts.find((prompt) => prompt.link_role === 'primary')) : null,
      supporting_prompts: linkedPrompts.filter((prompt) => prompt.link_role !== 'primary').slice(0, 6).map(promptSummary)
    },
    article_readiness: readiness,
    retest_plan: safeRetestPlan(brief),
    measured_only_caveat: 'This brief is based on measured prompt results and validated prompt bindings; future movement must be confirmed by retest.'
  };
}

export function buildCustomerBriefsPayload({
  tracking_run_id,
  brand = null,
  briefs = [],
  opportunity_id = null,
  generatedAt = new Date().toISOString()
}) {
  const filteredBriefs = opportunity_id ? briefs.filter((brief) => brief.opportunity_id === opportunity_id) : briefs;
  const items = [...filteredBriefs]
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priorityDelta !== 0) return priorityDelta;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    })
    .map(briefDetail);

  return {
    schema_version: 'r4-2-customer-briefs-v1',
    generated_at: generatedAt,
    tracking_run_id,
    brand,
    summary: {
      brief_count: items.length,
      article_ready_count: items.filter((item) => item.article_readiness.ready_for_article_workflow).length,
      needs_validated_prompt_count: items.filter((item) => !item.article_readiness.ready_for_article_workflow).length,
      validated_prompt_binding_count: items.reduce((sum, item) => sum + item.validated_prompt_binding.validated_prompt_count, 0)
    },
    briefs: items,
    guardrails: [
      'Briefs explain what content should be produced and which validated prompts it should answer.',
      'Article preview, review, approval, and export actions start in R5.',
      'This surface does not promise AI ranking improvement.'
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
    `SELECT tr.id,
            b.id AS brand_id,
            b.name AS brand_name,
            b.website_url,
            b.vertical
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM content_briefs cb
           WHERE cb.tracking_run_id = tr.id
         ) THEN 0
         ELSE 1
       END,
       tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

export async function listCustomerBriefRows(trackingRunId) {
  const result = await pool.query(
    `SELECT cb.*,
            co.opportunity_key,
            co.opportunity_type,
            co.priority,
            co.title AS opportunity_title,
            co.recommended_format,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', op.id,
                  'prompt_text', op.prompt_text,
                  'prompt_source', op.prompt_source,
                  'prompt_category', op.prompt_category,
                  'opportunity_prompt_score', op.opportunity_prompt_score,
                  'status', op.status,
                  'link_role', cbpl.link_role
                )
                ORDER BY
                  CASE cbpl.link_role
                    WHEN 'primary' THEN 1
                    ELSE 2
                  END,
                  op.opportunity_prompt_score DESC
              ) FILTER (WHERE op.id IS NOT NULL),
              '[]'::jsonb
            ) AS linked_opportunity_prompts
     FROM content_briefs cb
     JOIN content_opportunities co ON co.id = cb.opportunity_id
     LEFT JOIN content_brief_prompt_links cbpl ON cbpl.content_brief_id = cb.id
     LEFT JOIN opportunity_prompts op ON op.id = cbpl.opportunity_prompt_id
     WHERE cb.tracking_run_id = $1
     GROUP BY cb.id, co.opportunity_key, co.opportunity_type, co.priority, co.title, co.recommended_format
     ORDER BY
       CASE co.priority
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       cb.created_at ASC`,
    [trackingRunId]
  );

  return result.rows.map((row) => ({
    ...row,
    target_prompts: arrayValue(row.target_prompts),
    target_categories: arrayValue(row.target_categories),
    outline: arrayValue(row.outline),
    must_include_facts: arrayValue(row.must_include_facts),
    internal_link_targets: arrayValue(row.internal_link_targets),
    evidence_requirements: arrayValue(row.evidence_requirements),
    guardrails: arrayValue(row.guardrails),
    retest_plan: objectValue(row.retest_plan),
    linked_opportunity_prompts: arrayValue(row.linked_opportunity_prompts)
  }));
}

export async function getCustomerBriefsPayload(options = {}) {
  const run = await resolveTrackingRun(options);
  if (!run) return null;
  const briefs = await listCustomerBriefRows(run.id);
  return buildCustomerBriefsPayload({
    tracking_run_id: run.id,
    brand: {
      id: run.brand_id,
      name: run.brand_name,
      website_url: run.website_url,
      vertical: run.vertical
    },
    briefs,
    opportunity_id: options.opportunity_id || null
  });
}
