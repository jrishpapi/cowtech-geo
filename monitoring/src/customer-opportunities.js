import { pool } from './db.js';
import { buildContentOpportunities, listContentOpportunities } from './opportunities.js';
import { getTrackingRunReport } from './reporting.js';
import { listCustomerBriefRows } from './customer-briefs.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2
};

function toNumber(value) {
  return Number(value || 0);
}

function evidenceSummary(opportunity) {
  const evidence = opportunity.evidence || {};
  const summary = [];

  if (evidence.visibility_score !== undefined) {
    summary.push(`Visibility score ${toNumber(evidence.visibility_score)}`);
  }
  if (evidence.source_quality_score !== undefined) {
    summary.push(`Source quality score ${toNumber(evidence.source_quality_score)}`);
  }
  if (evidence.competitor_pressure_score !== undefined) {
    summary.push(`Competitor pressure score ${toNumber(evidence.competitor_pressure_score)}`);
  }
  if (evidence.brand_mention_count !== undefined && evidence.parsed_count !== undefined) {
    summary.push(`${toNumber(evidence.brand_mention_count)} of ${toNumber(evidence.parsed_count)} parsed answers mention the brand`);
  }
  if (evidence.official_source_count !== undefined) {
    summary.push(`${toNumber(evidence.official_source_count)} official source mentions`);
  }
  if (evidence.competitor_source_count !== undefined) {
    summary.push(`${toNumber(evidence.competitor_source_count)} competitor-owned source mentions`);
  }
  if (Array.isArray(evidence.competitors) && evidence.competitors.length) {
    summary.push(`Competitors detected: ${evidence.competitors.map((item) => item.name).filter(Boolean).join(', ')}`);
  }
  if (Array.isArray(evidence.top_domains) && evidence.top_domains.length) {
    summary.push(`Top source domains: ${evidence.top_domains.map((item) => item.domain).filter(Boolean).slice(0, 3).join(', ')}`);
  }

  return summary.length ? summary : ['Evidence is based on measured prompt results for this run.'];
}

function expectedImpact(opportunity) {
  const impact = opportunity.expected_impact || {};
  return {
    primary_metric: impact.primary_metric || 'visibility_score',
    secondary_metric: impact.secondary_metric || null,
    desired_direction: impact.desired_direction || 'improve_primary_metric',
    caveat: 'Expected impact is a prioritization signal, not a guaranteed ranking outcome.'
  };
}

function promptEvidence(prompt) {
  return {
    result_id: prompt.result_id || null,
    category: prompt.category,
    prompt_text: prompt.prompt_text,
    provider_id: prompt.provider_id || null,
    model_id: prompt.model_id,
    answer_excerpt: prompt.answer_excerpt || '',
    brand_mentioned: prompt.brand_mentioned === true,
    competitor_mentions: toNumber(prompt.competitor_mentions),
    source_url_count: toNumber(prompt.source_url_count),
    official_source_count: toNumber(prompt.official_source_count),
    competitor_source_count: toNumber(prompt.competitor_source_count)
  };
}

function executionBinding(opportunity, briefs = []) {
  const brief = briefs.find((item) => item.opportunity_id === opportunity.id);
  if (!brief) {
    return {
      status: opportunity.priority === 'high' ? 'brief_pending' : 'brief_optional',
      brief_id: null,
      brief_key: null,
      title: null,
      article_ready: false,
      next_step:
        opportunity.priority === 'high'
          ? 'Generate the high-priority brief for this opportunity.'
          : 'Brief generation can be deferred until high-priority opportunities are covered.'
    };
  }
  const validatedPrompts = (brief.linked_opportunity_prompts || []).filter((prompt) => prompt.status === 'validated');
  return {
    status: validatedPrompts.length ? 'brief_ready' : 'brief_needs_validated_prompt',
    brief_id: brief.id,
    brief_key: brief.brief_key,
    title: brief.title,
    article_ready: brief.status === 'draft' && validatedPrompts.length > 0,
    validated_prompt_count: validatedPrompts.length,
    next_step: validatedPrompts.length
      ? 'Review the linked brief and move it into article workflow when ready.'
      : 'Validate at least one opportunity prompt before article drafting.'
  };
}

export function buildCustomerOpportunitiesPayload({
  tracking_run_id,
  brand = null,
  opportunities = [],
  briefs = [],
  source = 'persisted',
  generatedAt = new Date().toISOString()
}) {
  const items = [...opportunities]
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priorityDelta !== 0) return priorityDelta;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    })
    .map((opportunity) => ({
      id: opportunity.id || null,
      opportunity_key: opportunity.opportunity_key,
      opportunity_type: opportunity.opportunity_type,
      priority: opportunity.priority,
      title: opportunity.title,
      description: opportunity.description,
      recommended_format: opportunity.recommended_format,
      target_categories: opportunity.target_categories || [],
      target_prompts: (opportunity.target_prompts || []).slice(0, 5).map((prompt) => ({
        category: prompt.category,
        prompt_text: prompt.prompt_text,
        model_id: prompt.model_id
      })),
      triggering_evidence: (opportunity.evidence?.triggering_prompts || opportunity.target_prompts || [])
        .slice(0, 5)
        .map(promptEvidence),
      weakness_evidence: Array.isArray(opportunity.evidence?.weakness_evidence)
        ? opportunity.evidence.weakness_evidence
        : evidenceSummary(opportunity),
      evidence_summary: evidenceSummary(opportunity),
      expected_impact: expectedImpact(opportunity),
      execution_binding: executionBinding(opportunity, briefs),
      status: opportunity.status || 'proposed',
      source,
      measured_only_caveat: 'This opportunity is derived from observed AI answers and should be validated by future retests.'
    }));

  return {
    schema_version: 'r4-1-customer-opportunities-v1',
    generated_at: generatedAt,
    tracking_run_id,
    brand,
    summary: {
      opportunity_count: items.length,
      high_priority_count: items.filter((item) => item.priority === 'high').length,
      medium_priority_count: items.filter((item) => item.priority === 'medium').length,
      low_priority_count: items.filter((item) => item.priority === 'low').length
    },
    opportunities: items,
    guardrails: [
      'Opportunities explain what to inspect or improve next.',
      'They are not article briefs; brief detail starts in R4.2.',
      'They do not promise AI ranking improvement.'
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
     ORDER BY tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

export async function getCustomerOpportunitiesPayload(options = {}) {
  const run = await resolveTrackingRun(options);
  if (!run) return null;
  let opportunities = await listContentOpportunities(run.id);
  let briefs = [];
  let source = 'persisted';
  if (!opportunities.length) {
    const report = await getTrackingRunReport(run.id);
    if (report?.scorecards?.visibility?.score !== null && report?.coverage?.parser?.parsed_count > 0) {
      opportunities = buildContentOpportunities(report).map((opportunity) => ({
        ...opportunity,
        id: null,
        status: 'preview'
      }));
      source = 'report_preview';
    }
  } else {
    briefs = await listCustomerBriefRows(run.id);
  }
  return buildCustomerOpportunitiesPayload({
    tracking_run_id: run.id,
    brand: {
      id: run.brand_id,
      name: run.brand_name,
      website_url: run.website_url,
      vertical: run.vertical
    },
    opportunities,
    briefs,
    source
  });
}
