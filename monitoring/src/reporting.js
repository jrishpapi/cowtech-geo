import { pool } from './db.js';
import { getTrackingRunSummary } from './admin.js';
import { buildSourceIntelligence } from './source-intelligence.js';

function toNumber(value) {
  return Number(value || 0);
}

function percent(value) {
  return Number((toNumber(value) * 100).toFixed(2));
}

function scoreBand(score, pressure = false) {
  if (score === null || score === undefined) return 'unknown';
  if (pressure) {
    if (score >= 75) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'weak';
  return 'critical';
}

function emptyMetric() {
  return {
    result_count: 0,
    completed_count: 0,
    failed_count: 0,
    parsed_count: 0,
    brand_mention_count: 0,
    competitor_mention_count: 0,
    source_url_count: 0,
    official_source_count: 0,
    competitor_source_count: 0,
    third_party_source_count: 0,
    unknown_source_count: 0
  };
}

function addParserSummary(metric, parserOutput) {
  metric.parsed_count += parserOutput ? 1 : 0;
  const summary = parserOutput?.summary || {};
  if (summary.brand_mentioned === true) metric.brand_mention_count += 1;
  metric.competitor_mention_count += toNumber(summary.competitor_mentions);
  metric.source_url_count += toNumber(summary.source_url_count);
  metric.official_source_count += toNumber(summary.official_source_count);
  metric.competitor_source_count += toNumber(summary.competitor_source_count);
  metric.third_party_source_count += toNumber(summary.third_party_source_count);
  metric.unknown_source_count += toNumber(summary.unknown_source_count);
}

function withRates(metric) {
  const denominator = metric.parsed_count || metric.completed_count || metric.result_count || 0;
  return {
    ...metric,
    brand_mention_rate: denominator ? percent(metric.brand_mention_count / denominator) : 0,
    source_coverage_rate: denominator ? percent(metric.source_url_count / denominator) : 0,
    official_source_rate: denominator ? percent(metric.official_source_count / denominator) : 0,
    competitor_source_rate: denominator ? percent(metric.competitor_source_count / denominator) : 0,
    third_party_source_rate: denominator ? percent(metric.third_party_source_count / denominator) : 0
  };
}

function aggregateRows(rows) {
  const byModel = new Map();
  const byCategory = new Map();
  const byDomain = new Map();
  const byCompetitor = new Map();
  const highlightedResults = [];
  const evidenceRecords = [];

  for (const row of rows) {
    const modelKey = `${row.provider_id}:${row.model_id}`;
    const modelMetric =
      byModel.get(modelKey) ||
      {
        ...emptyMetric(),
        provider_id: row.provider_id,
        model_id: row.model_id
      };
    modelMetric.result_count += 1;
    if (row.status === 'completed') modelMetric.completed_count += 1;
    if (row.status === 'failed') modelMetric.failed_count += 1;
    addParserSummary(modelMetric, row.parser_output);
    byModel.set(modelKey, modelMetric);

    const category = row.category || 'unknown';
    const categoryMetric =
      byCategory.get(category) ||
      {
        ...emptyMetric(),
        category
      };
    categoryMetric.result_count += 1;
    if (row.status === 'completed') categoryMetric.completed_count += 1;
    if (row.status === 'failed') categoryMetric.failed_count += 1;
    addParserSummary(categoryMetric, row.parser_output);
    byCategory.set(category, categoryMetric);

    for (const source of row.parser_output?.sources?.unique_domains || []) {
      const key = source.domain || `unknown:${source.source_name || 'source'}`;
      const domainMetric =
        byDomain.get(key) ||
        {
          domain: source.domain || '',
          source_type: source.source_type || 'unknown',
          source_name: source.source_name || '',
          result_count: 0,
          url_count: 0
        };
      domainMetric.result_count += 1;
      domainMetric.url_count += toNumber(source.url_count) || 1;
      byDomain.set(key, domainMetric);
    }

    for (const competitor of row.parser_output?.competitors || []) {
      const key = competitor.competitor_id || competitor.name;
      const competitorMetric =
        byCompetitor.get(key) ||
        {
          competitor_id: competitor.competitor_id,
          name: competitor.name,
          mentioned_result_count: 0,
          mention_count: 0
        };
      if (competitor.mentioned) competitorMetric.mentioned_result_count += 1;
      competitorMetric.mention_count += toNumber(competitor.mention_count);
      byCompetitor.set(key, competitorMetric);
    }

    {
      const parserOutput = row.parser_output || {};
      const answerText =
        row.normalized_answer?.content ||
        row.normalized_answer?.answer ||
        row.normalized_answer?.text ||
        row.raw_answer ||
        '';
      const evidenceRecord = {
        result_id: row.id,
        status: row.status,
        provider_id: row.provider_id,
        model_id: row.model_id,
        category: row.category,
        prompt_text: row.prompt_text,
        answer_excerpt: answerText ? `${String(answerText).replace(/\s+/g, ' ').trim().slice(0, 280)}${String(answerText).length > 280 ? '...' : ''}` : '',
        brand_mentioned: parserOutput.summary?.brand_mentioned === true,
        competitor_mentions: toNumber(parserOutput.summary?.competitor_mentions),
        source_url_count: toNumber(parserOutput.summary?.source_url_count),
        official_source_count: toNumber(parserOutput.summary?.official_source_count),
        competitor_source_count: toNumber(parserOutput.summary?.competitor_source_count),
        parser_confidence: toNumber(row.parser_confidence),
        sources: (parserOutput.sources?.urls || []).slice(0, 20).map((source) => ({
          url: source.url || '',
          domain: source.domain || '',
          source_type: source.source_type || 'unknown',
          source_name: source.source_name || ''
        })),
        competitors: (parserOutput.competitors || [])
          .filter((competitor) => competitor.mentioned)
          .map((competitor) => ({
            competitor_id: competitor.competitor_id || '',
            name: competitor.name || '',
            mention_count: toNumber(competitor.mention_count)
          }))
      };
      evidenceRecords.push(evidenceRecord);
      if (row.parser_output && highlightedResults.length < 8) {
        highlightedResults.push(evidenceRecord);
      }
    }
  }

  return {
    models: [...byModel.values()].map(withRates).sort((a, b) => a.model_id.localeCompare(b.model_id)),
    categories: [...byCategory.values()].map(withRates).sort((a, b) => a.category.localeCompare(b.category)),
    top_domains: [...byDomain.values()].sort((a, b) => b.result_count - a.result_count || b.url_count - a.url_count),
    competitors: [...byCompetitor.values()].sort(
      (a, b) => b.mentioned_result_count - a.mentioned_result_count || b.mention_count - a.mention_count
    ),
    highlighted_results: highlightedResults,
    evidence_records: evidenceRecords
  };
}

function buildExecutiveSummary(summary) {
  const scores = summary.scores || {};
  const parser = summary.parser || {};
  const visibilityBand = scoreBand(scores.visibility_score);
  const sourceBand = scoreBand(scores.source_quality_score);
  const pressureBand = scoreBand(scores.competitor_pressure_score, true);

  return {
    headline: `${summary.run.brand_name} has ${visibilityBand} AI visibility with ${sourceBand} source quality and ${pressureBand} competitor pressure.`,
    bullets: [
      `Brand appeared in ${parser.brand_mention_count} of ${parser.parsed_count} parsed answers.`,
      `Sources included ${parser.official_source_count} official, ${parser.competitor_source_count} competitor, and ${parser.third_party_source_count} third-party domains.`,
      `Competitors were mentioned ${parser.competitor_mention_count} times across parsed answers.`
    ],
    caveats: [
      'Scores are deterministic MVP heuristics based on parsed answers.',
      'The payload does not claim ranking improvement and should be calibrated with beta data.'
    ]
  };
}

function buildScorecards(scores) {
  return {
    visibility: {
      label: 'Visibility Score',
      score: scores.visibility_score,
      grade: scores.grade,
      band: scoreBand(scores.visibility_score),
      direction: 'higher_is_better',
      explanation: 'Measures whether the brand appears in AI answers and has source support.'
    },
    source_quality: {
      label: 'Source Quality Score',
      score: scores.source_quality_score,
      band: scoreBand(scores.source_quality_score),
      direction: 'higher_is_better',
      explanation: 'Measures whether cited sources are official or neutral rather than competitor-owned.'
    },
    competitor_pressure: {
      label: 'Competitor Pressure Score',
      score: scores.competitor_pressure_score,
      band: scoreBand(scores.competitor_pressure_score, true),
      direction: 'lower_is_better',
      explanation: 'Measures how often competitors and competitor-owned sources appear.'
    }
  };
}

function promptSamplesForAction(aggregates, categories = []) {
  const categorySet = new Set(categories.filter(Boolean));
  return (aggregates.highlighted_results || [])
    .filter((result) => categorySet.size === 0 || categorySet.has(result.category))
    .map((result) => ({
      category: result.category,
      prompt_text: result.prompt_text,
      model_id: result.model_id,
      brand_mentioned: Boolean(result.brand_mentioned),
      competitor_mentions: toNumber(result.competitor_mentions),
      official_source_count: toNumber(result.official_source_count),
      source_url_count: toNumber(result.source_url_count)
    }))
    .slice(0, 3);
}

function categoriesWhere(aggregates, predicate) {
  return (aggregates.categories || [])
    .filter(predicate)
    .map((category) => category.category)
    .slice(0, 4);
}

function competitorNames(aggregates) {
  return (aggregates.competitors || [])
    .filter((competitor) => toNumber(competitor.mentioned_result_count) > 0)
    .map((competitor) => competitor.name)
    .filter(Boolean)
    .slice(0, 4);
}

function action({
  priority,
  type,
  title,
  evidence = [],
  focus_prompts = [],
  recommended_steps = [],
  deliverable = '',
  success_measure = ''
}) {
  return {
    priority,
    type,
    title,
    evidence,
    focus_prompts,
    recommended_steps,
    deliverable,
    success_measure
  };
}

function buildNextActions(summary, aggregates) {
  const actions = [];
  const scores = summary.scores || {};
  const parser = summary.parser || {};
  const lowVisibilityCategories = categoriesWhere(
    aggregates,
    (category) => category.brand_mention_rate < 75 || category.brand_mention_count === 0
  );
  const weakSourceCategories = categoriesWhere(
    aggregates,
    (category) => category.official_source_count === 0 || category.source_coverage_rate < 75
  );
  const competitorCategories = categoriesWhere(
    aggregates,
    (category) => category.competitor_mention_count > 0 || category.competitor_source_count > 0
  );
  const competitors = competitorNames(aggregates);

  if (scores.visibility_score === null) {
    actions.push({
      priority: 'high',
      type: 'run_scoring',
      title: 'Complete parsing and scoring before publishing a report.',
      evidence: ['No persisted visibility score was available for this run.'],
      recommended_steps: ['Run parser on completed answers.', 'Run scoring after parser output is saved.'],
      deliverable: 'Ready visibility report payload.',
      success_measure: 'Report state is ready and all scorecards have numeric scores.'
    });
    return actions;
  }

  if (scores.visibility_score < 70) {
    actions.push(action({
      priority: 'high',
      type: 'visibility_gap',
      title: 'Build pages for prompts where the brand is missing or weakly mentioned.',
      evidence: [
        `Visibility score is ${toNumber(scores.visibility_score)}.`,
        `${toNumber(parser.brand_mention_count)} of ${toNumber(parser.parsed_count)} parsed answers mention the brand.`,
        `Weak categories: ${lowVisibilityCategories.join(', ') || 'mixed prompt set'}.`
      ],
      focus_prompts: promptSamplesForAction(aggregates, lowVisibilityCategories),
      recommended_steps: [
        'Pick the first weak prompt and write the exact answer the page must satisfy.',
        'Create one category/problem page that names the use case, target buyer, differentiation, and proof.',
        'Add an FAQ block that answers the measured prompt in plain language.',
        'Link the page from the homepage or main product navigation so crawlers can find it.'
      ],
      deliverable: 'One category or problem-led page mapped to the measured prompt.',
      success_measure: 'Next retest should increase brand mentions on the same prompt/model pairs.'
    }));
  }

  if (scores.source_quality_score < 70 || parser.official_source_count === 0) {
    actions.push(action({
      priority: 'high',
      type: 'source_quality_gap',
      title: 'Create citation-ready official evidence for weak-source prompts.',
      evidence: [
        `Source quality score is ${toNumber(scores.source_quality_score)}.`,
        `${toNumber(parser.official_source_count)} official source mentions from ${toNumber(parser.source_url_count)} source URLs.`,
        `Weak source categories: ${weakSourceCategories.join(', ') || 'all measured categories'}.`
      ],
      focus_prompts: promptSamplesForAction(aggregates, weakSourceCategories),
      recommended_steps: [
        'Publish a facts/evidence section with product category, target users, pricing model, supported markets, and concrete proof points.',
        'Add schema-friendly FAQ answers for the measured questions.',
        'Include canonical source links and avoid vague marketing claims without evidence.',
        'Make comparison claims cite official product pages, documentation, or public proof.'
      ],
      deliverable: 'Citation-ready FAQ/evidence hub on the official website.',
      success_measure: 'Next retest should show more official source mentions and fewer unknown or competitor-owned sources.'
    }));
  }

  if (scores.competitor_pressure_score >= 60 || parser.competitor_source_count > 0) {
    actions.push(action({
      priority: 'medium',
      type: 'competitor_pressure',
      title: 'Publish comparison pages for the competitors AI answers already mention.',
      evidence: [
        `Competitor pressure score is ${toNumber(scores.competitor_pressure_score)}.`,
        `Competitors were mentioned ${toNumber(parser.competitor_mention_count)} times.`,
        `Detected competitors: ${competitors.join(', ') || 'see representative answers'}.`
      ],
      focus_prompts: promptSamplesForAction(aggregates, competitorCategories),
      recommended_steps: [
        'Choose the most-mentioned competitor and create a direct comparison page.',
        'Add an alternatives page that frames when the brand is a better fit.',
        'Include a neutral comparison table with use case, data sources, workflow, pricing, and limitations.',
        'Internally link the comparison page from category and FAQ pages.'
      ],
      deliverable: 'One comparison page and one alternatives page for the top mentioned competitor.',
      success_measure: 'Next retest should reduce competitor pressure or make the brand co-mentioned in comparison prompts.'
    }));
  }

  if (parser.third_party_source_count === 0) {
    actions.push(action({
      priority: 'medium',
      type: 'third_party_authority',
      title: 'Get neutral third-party proof into sources AI models can cite.',
      evidence: [
        'No third-party source mentions were detected in parsed answers.',
        `Top measured domains: ${(aggregates.top_domains || []).map((domain) => domain.domain).filter(Boolean).slice(0, 3).join(', ') || 'none detected'}.`
      ],
      focus_prompts: promptSamplesForAction(aggregates, []),
      recommended_steps: [
        'List 5 directories, ecosystem pages, partner pages, or review resources that can mention the brand.',
        'Submit or pitch profiles using consistent category wording and official website links.',
        'Add third-party proof links back into the official evidence hub after they go live.'
      ],
      deliverable: 'Third-party proof source shortlist with submitted profile/pitch status.',
      success_measure: 'Next retest should include at least one neutral third-party source mention.'
    }));
  }

  if (!actions.length) {
    actions.push(action({
      priority: 'medium',
      type: 'retest',
      title: 'Keep the current prompt set stable and retest after the next content update.',
      evidence: ['Current measured scores do not trigger a high-priority content gap.'],
      focus_prompts: promptSamplesForAction(aggregates, []),
      recommended_steps: [
        'Do not change the baseline prompt set before the next retest.',
        'Record which pages changed and when they were published.',
        'Run the same prompt/model matrix after crawlers have had time to pick up changes.'
      ],
      deliverable: 'Stable retest plan for the next measurement cycle.',
      success_measure: 'Before/after report shows whether visibility, source quality, or competitor pressure changed.'
    }));
  }

  return actions;
}

function buildMeasurementState({ summary, rows = [] }) {
  const providerIds = [...new Set(rows.map((row) => row.provider_id).filter(Boolean))];
  const allMock = providerIds.length > 0 && providerIds.every((providerId) => providerId === 'mock');
  const hasLiveProvider = providerIds.some((providerId) => providerId !== 'mock');
  const costEstimateUsd = toNumber(summary.usage?.cost_estimate_usd);

  if (allMock) {
    return {
      mode: 'mock',
      score_meaning: 'pipeline_validation',
      paid_provider_call_executed: false,
      provider_ids: providerIds,
      cost_estimate_usd: costEstimateUsd,
      label: 'Mock pipeline validation',
      caveat:
        'These scores come from simulated provider answers. They validate tracking, parsing, scoring, and report rendering, but they are not real AI visibility measurements.'
    };
  }

  return {
    mode: hasLiveProvider ? 'live_provider' : 'not_measured',
    score_meaning: hasLiveProvider ? 'ai_visibility_measurement' : 'not_ready',
    paid_provider_call_executed: hasLiveProvider,
    provider_ids: providerIds,
    cost_estimate_usd: costEstimateUsd,
    label: hasLiveProvider ? 'Live provider measurement' : 'Not measured',
    caveat: hasLiveProvider
      ? 'Scores are based on persisted live provider answers for this tracking run.'
      : 'No provider answers were available for this report yet.'
  };
}

export function buildRunReportPayload({
  summary,
  rows,
  opportunities = [],
  contentBriefs = [],
  opportunityPrompts = [],
  promptPromotions = [],
  generatedAt = new Date().toISOString()
}) {
  const aggregates = aggregateRows(rows);
  const sourceIntelligence = buildSourceIntelligence(rows);
  const scores = summary.scores || {};
  const measurement = buildMeasurementState({ summary, rows });

  return {
    schema_version: 'phase3-report-v1',
    generated_at: generatedAt,
    report_state: summary.report_state,
    measurement,
    run: {
      id: summary.run.id,
      status: summary.run.status,
      run_type: summary.run.run_type,
      started_at: summary.run.started_at,
      finished_at: summary.run.finished_at,
      created_at: summary.run.created_at
    },
    brand: {
      id: summary.run.brand_id,
      name: summary.run.brand_name,
      website_url: summary.run.website_url,
      vertical: summary.run.vertical,
      plan_code: summary.run.plan_code
    },
    executive_summary: buildExecutiveSummary(summary),
    scorecards: buildScorecards(scores),
    score_components: scores.components || {},
    coverage: {
      status_counts: summary.status_counts,
      usage: summary.usage,
      parser: summary.parser
    },
    source_mix: {
      official_source_count: summary.parser.official_source_count,
      competitor_source_count: summary.parser.competitor_source_count,
      third_party_source_count: summary.parser.third_party_source_count,
      unknown_source_count: summary.parser.unknown_source_count,
      top_domains: aggregates.top_domains
    },
    source_intelligence: sourceIntelligence,
    competitor_insights: {
      pressure_score: scores.competitor_pressure_score,
      competitors: aggregates.competitors
    },
    breakdowns: {
      by_model: aggregates.models,
      by_category: aggregates.categories
    },
    content_opportunities: opportunities,
    content_briefs: contentBriefs,
    opportunity_prompts: opportunityPrompts,
    prompt_promotions: promptPromotions,
    highlighted_results: aggregates.highlighted_results,
    evidence_records: aggregates.evidence_records,
    next_actions: buildNextActions(summary, aggregates)
  };
}

export async function getTrackingRunReport(trackingRunId) {
  const summary = await getTrackingRunSummary(trackingRunId);
  if (!summary) return null;

  const rows = await pool.query(
    `SELECT pr.id,
            pr.status,
            pr.provider_id,
            pr.model_id,
            pr.raw_answer,
            pr.normalized_answer,
            pr.parser_output,
            pr.parser_confidence,
            p.category,
            p.prompt_text
     FROM prompt_results pr
     LEFT JOIN prompts p ON p.id = pr.prompt_id
     WHERE pr.tracking_run_id = $1
     ORDER BY pr.created_at ASC`,
    [trackingRunId]
  );

  const opportunities = await pool.query(
    `SELECT id,
            opportunity_key,
            opportunity_type,
            priority,
            title,
            description,
            recommended_format,
            target_categories,
            target_prompts,
            evidence,
            expected_impact,
            status,
            created_at,
            updated_at
     FROM content_opportunities
     WHERE tracking_run_id = $1
     ORDER BY
       CASE priority
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       created_at ASC`,
    [trackingRunId]
  );

  const briefs = await pool.query(
    `SELECT cb.id,
            cb.opportunity_id,
            cb.brief_key,
            cb.content_type,
            cb.title,
            cb.objective,
            cb.audience,
            cb.target_prompts,
            cb.target_categories,
            cb.outline,
            cb.must_include_facts,
            cb.internal_link_targets,
            cb.evidence_requirements,
            cb.guardrails,
            cb.retest_plan,
            cb.status,
            cb.created_at,
            cb.updated_at,
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

  const opportunityPrompts = await pool.query(
    `SELECT op.id,
            op.opportunity_id,
            op.prompt_text,
            op.prompt_source,
            op.prompt_category,
            op.commercial_intent_score,
            op.gap_severity_score,
            op.competitor_pressure_score,
            op.feasibility_score,
            op.stability_score,
            op.opportunity_prompt_score,
            op.evidence,
            op.status,
            op.promoted_prompt_id,
            op.created_at,
            op.updated_at,
            co.opportunity_key,
            co.opportunity_type,
            co.priority
     FROM opportunity_prompts op
     LEFT JOIN content_opportunities co ON co.id = op.opportunity_id
     WHERE op.tracking_run_id = $1
     ORDER BY op.opportunity_prompt_score DESC, op.created_at ASC`,
    [trackingRunId]
  );

  const promptPromotions = await pool.query(
    `SELECT pp.id,
            pp.opportunity_prompt_id,
            pp.source_prompt_set_id,
            pp.target_prompt_set_id,
            pp.promoted_prompt_id,
            pp.opportunity_prompt_score,
            pp.promotion_reason,
            pp.status,
            pp.created_at,
            op.prompt_text AS opportunity_prompt_text,
            op.prompt_source,
            op.prompt_category,
            ps.version_number AS target_version_number,
            p.prompt_text AS promoted_prompt_text
     FROM prompt_promotions pp
     JOIN opportunity_prompts op ON op.id = pp.opportunity_prompt_id
     JOIN prompt_sets ps ON ps.id = pp.target_prompt_set_id
     JOIN prompts p ON p.id = pp.promoted_prompt_id
     WHERE pp.tracking_run_id = $1
     ORDER BY pp.opportunity_prompt_score DESC, pp.created_at ASC`,
    [trackingRunId]
  );

  return buildRunReportPayload({
    summary,
    rows: rows.rows,
    opportunities: opportunities.rows,
    contentBriefs: briefs.rows,
    opportunityPrompts: opportunityPrompts.rows,
    promptPromotions: promptPromotions.rows
  });
}
