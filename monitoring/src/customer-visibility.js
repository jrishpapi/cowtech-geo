import { pool } from './db.js';
import { getTrackingRunReport } from './reporting.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function toNumber(value) {
  return Number(value || 0);
}

function percentLabel(value) {
  return `${toNumber(value).toFixed(0)}%`;
}

function scoreStatus(score, pressure = false) {
  if (score === null || score === undefined) return 'not_ready';
  if (pressure) {
    if (score >= 75) return 'high_pressure';
    if (score >= 40) return 'medium_pressure';
    return 'low_pressure';
  }
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'weak';
  return 'critical';
}

function compactScorecards(scorecards = {}) {
  return [
    {
      key: 'visibility',
      ...scorecards.visibility,
      status: scoreStatus(scorecards.visibility?.score)
    },
    {
      key: 'source_quality',
      ...scorecards.source_quality,
      status: scoreStatus(scorecards.source_quality?.score)
    },
    {
      key: 'competitor_pressure',
      ...scorecards.competitor_pressure,
      status: scoreStatus(scorecards.competitor_pressure?.score, true)
    }
  ];
}

function safeBreakdown(rows = [], limit = 8) {
  return rows.slice(0, limit).map((row) => ({
    ...row,
    brand_mention_label: percentLabel(row.brand_mention_rate),
    source_coverage_label: percentLabel(row.source_coverage_rate),
    official_source_label: percentLabel(row.official_source_rate),
    competitor_source_label: percentLabel(row.competitor_source_rate)
  }));
}

function customerNextActions(actions = []) {
  return actions.slice(0, 5).map((action) => ({
    priority: action.priority,
    type: action.type,
    title: action.title,
    evidence: Array.isArray(action.evidence) ? action.evidence.slice(0, 4) : [],
    focus_prompts: Array.isArray(action.focus_prompts)
      ? action.focus_prompts.slice(0, 3).map((prompt) => ({
          category: prompt.category,
          prompt_text: prompt.prompt_text,
          model_id: prompt.model_id,
          brand_mentioned: Boolean(prompt.brand_mentioned),
          competitor_mentions: toNumber(prompt.competitor_mentions),
          official_source_count: toNumber(prompt.official_source_count),
          source_url_count: toNumber(prompt.source_url_count)
        }))
      : [],
    recommended_steps: Array.isArray(action.recommended_steps) ? action.recommended_steps.slice(0, 5) : [],
    deliverable: action.deliverable || '',
    success_measure: action.success_measure || '',
    note: 'Recommended from measured prompt results, not a guaranteed ranking outcome.'
  }));
}

function customerScorecards(report, scorecards) {
  const measurement = report.measurement || {};
  if (measurement.score_meaning !== 'pipeline_validation') return scorecards;

  return scorecards.map((scorecard) => ({
    ...scorecard,
    label: scorecard.label.replace('Score', 'Mock Check'),
    display_context: 'mock_pipeline_validation',
    explanation: 'Mock validation metric from simulated provider answers. Not a real AI visibility score.'
  }));
}

function customerSourceIntelligence(sourceIntelligence = {}) {
  const decisionLayer = sourceIntelligence.citation_gap_decision_layer || {};
  return {
    schema_version: sourceIntelligence.schema_version || 'source-intelligence-v2',
    summary: sourceIntelligence.summary || {},
    source_type_mix: sourceIntelligence.source_type_mix || {},
    top_urls: (sourceIntelligence.top_urls || []).slice(0, 12).map((source) => ({
      url: source.url,
      domain: source.domain,
      source_name: source.source_name,
      source_type: source.source_type,
      citation_count: toNumber(source.citation_count),
      prompt_count: toNumber(source.prompt_count),
      model_count: toNumber(source.model_count),
      categories: (source.categories || []).slice(0, 4),
      prompts: (source.prompts || []).slice(0, 3),
      examples: (source.examples || []).slice(0, 2)
    })),
    top_domains: (sourceIntelligence.top_domains || []).slice(0, 12).map((source) => ({
      domain: source.domain,
      source_name: source.source_name,
      source_type: source.source_type,
      citation_count: toNumber(source.citation_count),
      url_count: toNumber(source.url_count),
      prompt_count: toNumber(source.prompt_count),
      model_count: toNumber(source.model_count),
      urls: (source.urls || []).slice(0, 5),
      categories: (source.categories || []).slice(0, 4)
    })),
    prompt_gaps: (sourceIntelligence.prompt_gaps || []).slice(0, 10),
    competitor_leakage: (sourceIntelligence.competitor_leakage || []).slice(0, 10),
    missing_official_citation_opportunities: (sourceIntelligence.missing_official_citation_opportunities || []).slice(0, 8),
    citation_gap_decision_layer: {
      schema_version: decisionLayer.schema_version || 'citation-gap-decision-layer-v1',
      unified_customer_summary: decisionLayer.unified_customer_summary || '',
      influential_sources: (decisionLayer.influential_sources || []).slice(0, 8).map((source) => ({
        domain: source.domain,
        source_name: source.source_name,
        source_type: source.source_type,
        influence_score: toNumber(source.influence_score),
        citation_count: toNumber(source.citation_count),
        prompt_count: toNumber(source.prompt_count),
        model_count: toNumber(source.model_count),
        why_it_matters: source.why_it_matters,
        examples: (source.examples || []).slice(0, 2)
      })),
      target_sources_to_win: (decisionLayer.target_sources_to_win || []).slice(0, 8).map((source) => ({
        domain: source.domain,
        source_name: source.source_name,
        source_type: source.source_type,
        priority_score: toNumber(source.priority_score),
        action_type: source.action_type,
        recommendation: source.recommendation,
        prompt_count: toNumber(source.prompt_count),
        cited_urls: (source.cited_urls || []).slice(0, 3),
        examples: (source.examples || []).slice(0, 2)
      })),
      competitor_shaping_pages: (decisionLayer.competitor_shaping_pages || []).slice(0, 8).map((source) => ({
        url: source.url,
        domain: source.domain,
        source_name: source.source_name,
        influence_score: toNumber(source.influence_score),
        prompt_count: toNumber(source.prompt_count),
        model_count: toNumber(source.model_count),
        recommended_response: source.recommended_response,
        examples: (source.examples || []).slice(0, 2)
      })),
      recommended_actions: (decisionLayer.recommended_actions || []).slice(0, 8).map((action) => ({
        action_type: action.action_type,
        priority_score: toNumber(action.priority_score),
        title: action.title,
        source_domain: action.source_domain,
        rationale: action.rationale,
        success_measure: action.success_measure
      }))
    }
  };
}

export function buildCustomerVisibilityReport(report, { generatedAt = new Date().toISOString() } = {}) {
  if (!report) return null;
  const parser = report.coverage?.parser || {};
  const scorecards = customerScorecards(report, compactScorecards(report.scorecards));
  const measurement = report.measurement || {
    mode: 'not_measured',
    score_meaning: 'not_ready',
    paid_provider_call_executed: false,
    label: 'Not measured',
    caveat: 'No provider measurement metadata was available for this report.'
  };

  return {
    schema_version: 'r3-customer-visibility-report-v1',
    generated_at: generatedAt,
    report_state: report.report_state,
    measurement,
    run: {
      id: report.run.id,
      status: report.run.status,
      run_type: report.run.run_type,
      started_at: report.run.started_at,
      finished_at: report.run.finished_at,
      created_at: report.run.created_at
    },
    brand: report.brand,
    headline: report.executive_summary?.headline || 'Visibility report is being prepared.',
    summary_bullets: report.executive_summary?.bullets || [],
    caveats: [
      ...(measurement.caveat ? [measurement.caveat] : []),
      ...(report.executive_summary?.caveats || []),
      'This dashboard reports observed model answers only; it does not promise AI ranking improvement.'
    ],
    scorecards,
    score_components: report.score_components || {},
    coverage: {
      parsed_answers: toNumber(parser.parsed_count),
      brand_mentions: toNumber(parser.brand_mention_count),
      competitor_mentions: toNumber(parser.competitor_mention_count),
      source_urls: toNumber(parser.source_url_count),
      avg_parser_confidence: toNumber(parser.avg_parser_confidence)
    },
    breakdowns: {
      models: safeBreakdown(report.breakdowns?.by_model),
      categories: safeBreakdown(report.breakdowns?.by_category)
    },
    source_mix: {
      official_source_count: toNumber(report.source_mix?.official_source_count),
      competitor_source_count: toNumber(report.source_mix?.competitor_source_count),
      third_party_source_count: toNumber(report.source_mix?.third_party_source_count),
      unknown_source_count: toNumber(report.source_mix?.unknown_source_count),
      top_domains: (report.source_mix?.top_domains || []).slice(0, 10)
    },
    source_intelligence: customerSourceIntelligence(report.source_intelligence),
    competitor_pressure: {
      score: report.competitor_insights?.pressure_score,
      competitors: (report.competitor_insights?.competitors || []).slice(0, 8)
    },
    highlighted_answers: (report.highlighted_results || []).slice(0, 6).map((item) => ({
      result_id: item.result_id,
      provider_id: item.provider_id,
      model_id: item.model_id,
      category: item.category,
      prompt_text: item.prompt_text,
      answer_excerpt: item.answer_excerpt || '',
      brand_mentioned: Boolean(item.brand_mentioned),
      competitor_mentions: toNumber(item.competitor_mentions),
      source_url_count: toNumber(item.source_url_count),
      official_source_count: toNumber(item.official_source_count),
      competitor_source_count: toNumber(item.competitor_source_count),
      parser_confidence: toNumber(item.parser_confidence),
      sources: (item.sources || []).slice(0, 20),
      competitors: (item.competitors || []).slice(0, 10)
    })),
    evidence_records: (report.evidence_records || []).slice(0, 200).map((item) => ({
      result_id: item.result_id,
      status: item.status,
      provider_id: item.provider_id,
      model_id: item.model_id,
      category: item.category,
      prompt_text: item.prompt_text,
      answer_excerpt: item.answer_excerpt || '',
      brand_mentioned: Boolean(item.brand_mentioned),
      competitor_mentions: toNumber(item.competitor_mentions),
      source_url_count: toNumber(item.source_url_count),
      official_source_count: toNumber(item.official_source_count),
      competitor_source_count: toNumber(item.competitor_source_count),
      parser_confidence: toNumber(item.parser_confidence),
      sources: (item.sources || []).slice(0, 20).map((source) => ({
        url: source.url || '',
        domain: source.domain || '',
        source_type: source.source_type || 'unknown',
        source_name: source.source_name || ''
      })),
      competitors: (item.competitors || []).slice(0, 10).map((competitor) => ({
        competitor_id: competitor.competitor_id || '',
        name: competitor.name || '',
        mention_count: toNumber(competitor.mention_count)
      }))
    })),
    next_actions: customerNextActions(report.next_actions),
    guardrails: [
      'Use this report to decide what to inspect or improve next.',
      'Do not present these scores as proof of future AI ranking movement.',
      'Retest after content changes before claiming measured improvement.'
    ]
  };
}

async function resolveTrackingRunId({ run_id, brand_id, brand_name } = {}) {
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
     ORDER BY tr.created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getCustomerVisibilityReportPayload(options = {}) {
  const trackingRunId = await resolveTrackingRunId(options);
  if (!trackingRunId) return null;

  const report = await getTrackingRunReport(trackingRunId);
  if (!report) return null;

  return buildCustomerVisibilityReport(report);
}
