import { pool } from './db.js';
import { getTrackingRunReport } from './reporting.js';
import { generateContentOpportunities, listContentOpportunities } from './opportunities.js';
import { discoverOpportunityPrompts, listOpportunityPrompts } from './opportunity-prompts.js';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function promptTexts(opportunity, opportunityPrompts = []) {
  const validatedTexts = opportunityPrompts
    .filter((prompt) => prompt.status === 'validated')
    .map((prompt) => prompt.prompt_text)
    .filter(Boolean);
  if (validatedTexts.length) return validatedTexts;
  return (opportunity.target_prompts || []).map((prompt) => prompt.prompt_text).filter(Boolean);
}

function baseGuardrails(report) {
  return [
    `Use ${report.brand.name} and ${report.brand.website_url} as the canonical brand identity.`,
    'Do not invent customer names, rankings, awards, certifications, pricing, clinical claims, legal claims, or performance metrics.',
    'Do not claim AI visibility improved until a later retest confirms it.',
    'Keep competitor comparisons factual and avoid unsupported negative claims.',
    'Prefer citation-ready facts, concise definitions, and directly answerable sections.'
  ];
}

function baseFacts(report, opportunity) {
  return uniqueValues([
    `Brand name: ${report.brand.name}`,
    `Official website: ${report.brand.website_url}`,
    `Vertical: ${report.brand.vertical}`,
    `Opportunity type: ${opportunity.opportunity_type}`,
    `Recommended format: ${opportunity.recommended_format}`,
    `Primary expected impact: ${opportunity.expected_impact?.primary_metric || 'visibility_score'}`
  ]);
}

function internalLinks(report, opportunity) {
  const links = [
    {
      label: `${report.brand.name} official website`,
      url: report.brand.website_url,
      reason: 'Canonical brand source'
    }
  ];

  if (opportunity.opportunity_type === 'competitor_pressure') {
    links.push({
      label: 'Comparison or alternatives hub',
      url: '/compare/',
      reason: 'Consolidate competitor comparison evidence'
    });
  }

  if (opportunity.opportunity_type === 'source_quality_gap' || opportunity.opportunity_type === 'source_coverage_gap') {
    links.push({
      label: 'FAQ or evidence hub',
      url: '/faq/',
      reason: 'Provide short citation-ready answers'
    });
  }

  if (opportunity.opportunity_type === 'visibility_gap') {
    links.push({
      label: 'Category landing page',
      url: '/solutions/',
      reason: 'Answer category and problem-led buyer prompts'
    });
  }

  return links;
}

function evidenceRequirements(opportunity) {
  const requirements = [
    'Include explicit brand definition and category positioning.',
    'Include official source links and short factual sections that can be quoted or summarized.',
    'Cover the target prompts directly instead of writing generic marketing copy.'
  ];

  if (opportunity.opportunity_type === 'competitor_pressure') {
    requirements.push('Include a neutral comparison matrix with criteria, use cases, and differentiators.');
  }

  if (opportunity.opportunity_type === 'third_party_authority') {
    requirements.push('Identify external proof targets such as directories, partner listings, review pages, or industry resources.');
  }

  return requirements;
}

function mustAnswerQuestions(opportunity, prompts = []) {
  return uniqueValues([
    ...prompts,
    ...(opportunity.target_prompts || []).map((prompt) => prompt.prompt_text).filter(Boolean)
  ]).slice(0, 8);
}

function competitorAngle(opportunity) {
  const competitors = (opportunity.evidence?.competitors || []).map((competitor) => competitor.name).filter(Boolean);
  if (opportunity.opportunity_type !== 'competitor_pressure' && !competitors.length) {
    return 'No direct competitor comparison angle is required unless it appears in the target prompts.';
  }
  const competitorList = competitors.length ? competitors.join(', ') : 'the competitors detected in AI answers';
  return `Explain where the brand is a better fit than ${competitorList}, using factual criteria and official evidence instead of unsupported negative claims.`;
}

function sourceCitationRequirements(opportunity) {
  const targetPrompts = opportunity.evidence?.triggering_prompts || opportunity.target_prompts || [];
  const promptsWithoutOfficialSources = targetPrompts.filter((prompt) => Number(prompt.official_source_count || 0) === 0);
  const requirements = [
    'Add official, crawlable URLs that answer the target prompts directly.',
    'Use clear headings, FAQ blocks, and factual answer snippets that AI systems can cite.',
    'Include canonical brand facts and links back to the official website.'
  ];
  if (promptsWithoutOfficialSources.length) {
    requirements.push(`${promptsWithoutOfficialSources.length} triggering prompt samples had no official source; prioritize those prompts first.`);
  }
  if (opportunity.opportunity_type === 'third_party_authority') {
    requirements.push('List third-party proof targets and keep descriptions consistent across directories, partner pages, and external profiles.');
  }
  if (opportunity.opportunity_type === 'competitor_pressure') {
    requirements.push('Make comparison claims easy to verify with official feature, market, and risk-positioning sources.');
  }
  return requirements;
}

function outlineFor(report, opportunity) {
  if (opportunity.opportunity_type === 'competitor_pressure') {
    return [
      `What ${report.brand.name} is and when it is relevant`,
      'Competitor alternatives mentioned in AI answers',
      'Comparison criteria buyers should use',
      `${report.brand.name} differentiators with official evidence`,
      'Which option fits which buyer scenario',
      'FAQ for comparison and alternative-search prompts'
    ];
  }

  if (opportunity.opportunity_type === 'third_party_authority') {
    return [
      'Current source gap and why third-party proof matters',
      'Priority external source targets',
      'Profile facts and descriptions to keep consistent',
      'Outreach or listing checklist',
      'Retest plan for third-party source appearance'
    ];
  }

  if (opportunity.opportunity_type === 'source_quality_gap' || opportunity.opportunity_type === 'source_coverage_gap') {
    return [
      `${report.brand.name} canonical facts`,
      'Short answer blocks for target prompts',
      'Source-friendly FAQ',
      'Evidence and proof points to cite',
      'Internal links to supporting pages',
      'Retest questions and expected source changes'
    ];
  }

  if (opportunity.opportunity_type === 'visibility_gap') {
    return [
      'Category definition and buyer problem',
      `${report.brand.name} fit for the problem`,
      'Use cases and decision criteria',
      'How the brand compares with common alternatives',
      'FAQ mapped to missing prompt categories',
      'Official links and next-step proof'
    ];
  }

  return [
    'Current AI visibility state',
    'Assets to maintain',
    'Prompt categories to retest',
    'Signals to watch in the next run'
  ];
}

function contentTypeFor(opportunity) {
  if (opportunity.opportunity_type === 'competitor_pressure') return 'comparison_page';
  if (opportunity.opportunity_type === 'third_party_authority') return 'authority_outreach_brief';
  if (opportunity.opportunity_type === 'source_quality_gap') return 'evidence_hub';
  if (opportunity.opportunity_type === 'source_coverage_gap') return 'source_hub';
  if (opportunity.opportunity_type === 'visibility_gap') return 'category_page';
  if (opportunity.opportunity_type === 'retest') return 'retest_plan';
  return 'planning_brief';
}

function titleFor(report, opportunity) {
  if (opportunity.opportunity_type === 'competitor_pressure') {
    return `${report.brand.name} comparison and alternatives brief`;
  }
  if (opportunity.opportunity_type === 'third_party_authority') {
    return `${report.brand.name} third-party proof source brief`;
  }
  if (opportunity.opportunity_type === 'source_quality_gap') {
    return `${report.brand.name} citation-ready evidence hub brief`;
  }
  if (opportunity.opportunity_type === 'visibility_gap') {
    return `${report.brand.name} category visibility brief`;
  }
  return opportunity.title;
}

export function buildContentBrief({ report, opportunity, opportunityPrompts = [] }) {
  const categories = opportunity.target_categories || [];
  const prompts = promptTexts(opportunity, opportunityPrompts);
  const contentType = contentTypeFor(opportunity);
  const title = titleFor(report, opportunity);
  const briefKey = `${opportunity.opportunity_key}:${slugify(title)}`;
  const linkedOpportunityPrompts = opportunityPrompts
    .filter((prompt) => prompt.status === 'validated')
    .map((prompt, index) => ({
      id: prompt.id,
      prompt_text: prompt.prompt_text,
      prompt_source: prompt.prompt_source,
      prompt_category: prompt.prompt_category,
      opportunity_prompt_score: prompt.opportunity_prompt_score,
      link_role: index === 0 ? 'primary' : 'supporting'
    }));

  return {
    brief_key: briefKey,
    content_type: contentType,
    title,
    page_type: contentType,
    title_suggestion: title,
    objective: opportunity.description,
    audience: `${report.brand.vertical} buyers researching ${report.brand.name} and its alternatives through AI answers.`,
    target_prompts: prompts,
    must_answer_questions: mustAnswerQuestions(opportunity, prompts),
    target_categories: categories,
    outline: outlineFor(report, opportunity),
    must_include_facts: baseFacts(report, opportunity),
    internal_link_targets: internalLinks(report, opportunity),
    evidence_requirements: evidenceRequirements(opportunity),
    source_citation_requirements: sourceCitationRequirements(opportunity),
    competitor_comparison_angle: competitorAngle(opportunity),
    guardrails: baseGuardrails(report),
    linked_opportunity_prompts: linkedOpportunityPrompts,
    retest_plan: {
      tracking_run_id: report.run.id,
      target_metric: opportunity.expected_impact?.primary_metric || 'visibility_score',
      secondary_metric: opportunity.expected_impact?.secondary_metric || null,
      desired_direction: opportunity.expected_impact?.desired_direction || 'improve_primary_metric',
      retest_after: 'after_content_publish_and_indexing',
      prompt_categories: categories,
      prompt_samples: prompts.slice(0, 5),
      brief_requirements: {
        page_type: contentType,
        title_suggestion: title,
        must_answer_questions: mustAnswerQuestions(opportunity, prompts),
        competitor_comparison_angle: competitorAngle(opportunity),
        source_citation_requirements: sourceCitationRequirements(opportunity)
      }
    },
    status: linkedOpportunityPrompts.length ? 'draft' : 'needs_validated_prompt'
  };
}

function normalizeBriefRow(row) {
  return {
    ...row,
    target_prompts: row.target_prompts || [],
    target_categories: row.target_categories || [],
    outline: row.outline || [],
    must_include_facts: row.must_include_facts || [],
    internal_link_targets: row.internal_link_targets || [],
    evidence_requirements: row.evidence_requirements || [],
    guardrails: row.guardrails || [],
    retest_plan: row.retest_plan || {},
    linked_opportunity_prompts: row.linked_opportunity_prompts || []
  };
}

export async function listContentBriefs(trackingRunId) {
  const result = await pool.query(
    `SELECT cb.*,
            co.opportunity_key,
            co.opportunity_type,
            co.priority,
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
     GROUP BY cb.id, co.opportunity_key, co.opportunity_type, co.priority
     ORDER BY
       CASE co.priority
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       cb.created_at ASC`,
    [trackingRunId]
  );

  return result.rows.map(normalizeBriefRow);
}

function priorityMatches(opportunity, priority) {
  if (!priority) return true;
  const priorities = Array.isArray(priority) ? priority : [priority];
  return priorities.includes(opportunity.priority);
}

export async function generateContentBriefs(trackingRunId, options = {}) {
  let opportunities = await listContentOpportunities(trackingRunId);
  if (!opportunities.length) {
    const generated = await generateContentOpportunities(trackingRunId);
    opportunities = generated.opportunities;
  }
  opportunities = opportunities.filter((opportunity) => priorityMatches(opportunity, options.priority));

  let opportunityPrompts = await listOpportunityPrompts(trackingRunId);
  if (!opportunityPrompts.length) {
    const discovered = await discoverOpportunityPrompts(trackingRunId);
    opportunityPrompts = discovered.prompts;
  }

  const report = await getTrackingRunReport(trackingRunId);
  if (!report) {
    throw new Error(`tracking run not found for brief generation: ${trackingRunId}`);
  }

  const saved = [];
  for (const opportunity of opportunities) {
    const promptsForOpportunity = opportunityPrompts.filter(
      (prompt) => prompt.opportunity_id === opportunity.id && prompt.status === 'validated'
    );
    const brief = buildContentBrief({ report, opportunity, opportunityPrompts: promptsForOpportunity });
    const result = await pool.query(
      `INSERT INTO content_briefs (
         tracking_run_id,
         opportunity_id,
         brief_key,
         content_type,
         title,
         objective,
         audience,
         target_prompts,
         target_categories,
         outline,
         must_include_facts,
         internal_link_targets,
         evidence_requirements,
         guardrails,
         retest_plan,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (tracking_run_id, brief_key)
       DO UPDATE SET
         content_type = EXCLUDED.content_type,
         title = EXCLUDED.title,
         objective = EXCLUDED.objective,
         audience = EXCLUDED.audience,
         target_prompts = EXCLUDED.target_prompts,
         target_categories = EXCLUDED.target_categories,
         outline = EXCLUDED.outline,
         must_include_facts = EXCLUDED.must_include_facts,
         internal_link_targets = EXCLUDED.internal_link_targets,
         evidence_requirements = EXCLUDED.evidence_requirements,
         guardrails = EXCLUDED.guardrails,
         retest_plan = EXCLUDED.retest_plan,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        opportunity.id,
        brief.brief_key,
        brief.content_type,
        brief.title,
        brief.objective,
        brief.audience,
        JSON.stringify(brief.target_prompts),
        JSON.stringify(brief.target_categories),
        JSON.stringify(brief.outline),
        JSON.stringify(brief.must_include_facts),
        JSON.stringify(brief.internal_link_targets),
        JSON.stringify(brief.evidence_requirements),
        JSON.stringify(brief.guardrails),
        JSON.stringify(brief.retest_plan),
        brief.status
      ]
    );
    const savedBrief = result.rows[0];
    await pool.query('DELETE FROM content_brief_prompt_links WHERE content_brief_id = $1', [savedBrief.id]);
    for (const [index, prompt] of promptsForOpportunity.entries()) {
      await pool.query(
        `INSERT INTO content_brief_prompt_links (content_brief_id, opportunity_prompt_id, link_role)
         VALUES ($1, $2, $3)
         ON CONFLICT (content_brief_id, opportunity_prompt_id)
         DO UPDATE SET link_role = EXCLUDED.link_role`,
        [savedBrief.id, prompt.id, index === 0 ? 'primary' : 'supporting']
      );
    }
    saved.push(
      normalizeBriefRow({
        ...savedBrief,
        linked_opportunity_prompts: brief.linked_opportunity_prompts
      })
    );
  }

  return {
    tracking_run_id: trackingRunId,
    generated_count: saved.length,
    briefs: saved
  };
}
