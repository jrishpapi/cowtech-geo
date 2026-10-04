function toNumber(value) {
  return Number(value || 0);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function answerExcerpt(row) {
  const answerText =
    row.normalized_answer?.content ||
    row.normalized_answer?.answer ||
    row.normalized_answer?.text ||
    row.raw_answer ||
    '';
  const normalized = normalizeText(answerText);
  return normalized ? `${normalized.slice(0, 260)}${normalized.length > 260 ? '...' : ''}` : '';
}

const DIRECTORY_DOMAIN_HINTS = [
  'alternativeto.net',
  'capterra.com',
  'crunchbase.com',
  'g2.com',
  'github.com',
  'producthunt.com',
  'saasworthy.com',
  'softwareadvice.com',
  'trustpilot.com',
  'wikipedia.org'
];

const REVIEW_SOURCE_HINTS = [
  'capterra.com',
  'g2.com',
  'getapp.com',
  'producthunt.com',
  'saasworthy.com',
  'softwareadvice.com',
  'trustpilot.com'
];

function sourceAssetType(source = {}) {
  if (source.source_type === 'official') return 'owned';
  if (source.source_type === 'competitor') return 'competitor';
  const domain = String(source.domain || '').toLowerCase();
  if (DIRECTORY_DOMAIN_HINTS.some((hint) => domain === hint || domain.endsWith(`.${hint}`))) {
    return 'directory';
  }
  if (domain) return 'earned';
  return 'unknown';
}

function sourceActionType(source = {}, gapType = '') {
  const assetType = source.source_type || sourceAssetType(source);
  const domain = String(source.domain || '').toLowerCase();
  if (assetType === 'competitor') return 'comparison_page';
  if (assetType === 'directory' || REVIEW_SOURCE_HINTS.some((hint) => domain === hint || domain.endsWith(`.${hint}`))) {
    return 'review_placement';
  }
  if (assetType === 'earned') return 'outreach';
  if (assetType === 'owned' || gapType === 'unsourced_answer') return 'content';
  return 'content';
}

function sourceRecommendation(actionType, source = {}) {
  if (actionType === 'review_placement') {
    return 'Win or improve the brand profile, category listing, and review proof on this source.';
  }
  if (actionType === 'comparison_page') {
    return 'Publish or strengthen a comparison/alternative page that directly answers this prompt cluster.';
  }
  if (actionType === 'outreach') {
    return 'Pitch this publisher with evidence, fresh positioning, and a quotable comparison angle.';
  }
  return source.source_type === 'official'
    ? 'Strengthen the cited owned page with clearer proof, comparisons, and answer-ready sections.'
    : 'Create an owned evidence page that can be cited for this exact buying question.';
}

function impactScore(metric = {}) {
  return (
    toNumber(metric.prompt_count) * 4 +
    toNumber(metric.model_count) * 3 +
    toNumber(metric.category_count) * 2 +
    toNumber(metric.citation_count)
  );
}

function summarizeExamples(examples = []) {
  return examples.slice(0, 3).map((example) => ({
    prompt_text: example.prompt_text,
    category: example.category,
    model_id: example.model_id,
    provider_id: example.provider_id,
    brand_mentioned: Boolean(example.brand_mentioned),
    answer_excerpt: example.answer_excerpt
  }));
}

function sourceKeyFor(source = {}) {
  return source.url || `${source.domain || 'unknown'}:${source.source_name || 'source'}`;
}

function incrementMapCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function sourcePromptGap(row) {
  const summary = row.parser_output?.summary || {};
  const urls = row.parser_output?.sources?.urls || [];
  const ownedCount = urls.filter((source) => sourceAssetType(source) === 'owned').length;
  const competitorCount = urls.filter((source) => sourceAssetType(source) === 'competitor').length;

  if (ownedCount === 0 && competitorCount > 0) return 'competitor_sources_without_owned_source';
  if (ownedCount === 0 && toNumber(summary.source_url_count) > 0) return 'no_owned_source';
  if (toNumber(summary.source_url_count) === 0) return 'unsourced_answer';
  return '';
}

export function buildSourceIntelligence(rows = []) {
  const byUrl = new Map();
  const byDomain = new Map();
  const promptGaps = [];
  const competitorLeakage = [];
  let ownedPromptCount = 0;
  const sourceTypes = {
    owned: 0,
    earned: 0,
    competitor: 0,
    directory: 0,
    unknown: 0
  };

  for (const row of rows) {
    const sources = row.parser_output?.sources?.urls || [];
    const promptContext = {
      result_id: row.id,
      provider_id: row.provider_id,
      model_id: row.model_id,
      category: row.category || 'unknown',
      prompt_text: row.prompt_text || '',
      brand_mentioned: row.parser_output?.summary?.brand_mentioned === true,
      answer_excerpt: answerExcerpt(row)
    };
    const rowOwnedSources = sources.filter((source) => sourceAssetType(source) === 'owned');
    const rowCompetitorSources = sources.filter((source) => sourceAssetType(source) === 'competitor');
    const gapType = sourcePromptGap(row);
    if (row.parser_output && rowOwnedSources.length > 0) ownedPromptCount += 1;

    if (row.parser_output && gapType) {
      promptGaps.push({
        ...promptContext,
        gap_type: gapType,
        source_url_count: toNumber(row.parser_output.summary?.source_url_count),
        owned_source_count: rowOwnedSources.length,
        competitor_source_count: rowCompetitorSources.length
      });
    }

    for (const source of sources) {
      const assetType = sourceAssetType(source);
      sourceTypes[assetType] = toNumber(sourceTypes[assetType]) + 1;
      const urlKey = sourceKeyFor(source);
      const domainKey = source.domain || `unknown:${source.source_name || source.url || 'source'}`;

      const urlMetric =
        byUrl.get(urlKey) ||
        {
          url: source.url || '',
          domain: source.domain || '',
          source_name: source.source_name || '',
          parser_source_type: source.source_type || 'unknown',
          source_type: assetType,
          citation_count: 0,
          answer_count: 0,
          prompt_count: 0,
          model_count: 0,
          category_count: 0,
          prompts: new Map(),
          answers: new Map(),
          models: new Map(),
          categories: new Map(),
          examples: []
        };
      urlMetric.citation_count += 1;
      incrementMapCount(urlMetric.answers, row.id);
      incrementMapCount(urlMetric.prompts, row.prompt_text);
      incrementMapCount(urlMetric.models, row.model_id);
      incrementMapCount(urlMetric.categories, row.category || 'unknown');
      if (urlMetric.examples.length < 3) urlMetric.examples.push(promptContext);
      byUrl.set(urlKey, urlMetric);

      const domainMetric =
        byDomain.get(domainKey) ||
        {
          domain: source.domain || '',
          source_name: source.source_name || '',
          parser_source_type: source.source_type || 'unknown',
          source_type: assetType,
          citation_count: 0,
          answer_count: 0,
          url_count: 0,
          prompt_count: 0,
          model_count: 0,
          urls: new Map(),
          answers: new Map(),
          prompts: new Map(),
          models: new Map(),
          categories: new Map(),
          examples: []
        };
      domainMetric.citation_count += 1;
      incrementMapCount(domainMetric.answers, row.id);
      incrementMapCount(domainMetric.urls, source.url || '');
      incrementMapCount(domainMetric.prompts, row.prompt_text);
      incrementMapCount(domainMetric.models, row.model_id);
      incrementMapCount(domainMetric.categories, row.category || 'unknown');
      if (domainMetric.examples.length < 3) domainMetric.examples.push(promptContext);
      byDomain.set(domainKey, domainMetric);

      if (assetType === 'competitor' && competitorLeakage.length < 12) {
        competitorLeakage.push({
          ...promptContext,
          url: source.url || '',
          domain: source.domain || '',
          source_name: source.source_name || ''
        });
      }
    }
  }

  const finalizeSource = (metric) => ({
    ...metric,
    answer_count: metric.answers.size,
    prompt_count: metric.prompts.size,
    model_count: metric.models.size,
    category_count: metric.categories.size,
    prompts: [...metric.prompts.keys()].filter(Boolean).slice(0, 5),
    answers: undefined,
    models: [...metric.models.keys()].filter(Boolean).slice(0, 5),
    categories: [...metric.categories.keys()].filter(Boolean).slice(0, 5),
    urls: metric.urls ? [...metric.urls.keys()].filter(Boolean).slice(0, 8) : undefined
  });

  const topUrls = [...byUrl.values()]
    .map(finalizeSource)
    .sort((a, b) => b.prompt_count - a.prompt_count || b.citation_count - a.citation_count || a.url.localeCompare(b.url));
  const topDomains = [...byDomain.values()]
    .map(finalizeSource)
    .sort((a, b) => b.prompt_count - a.prompt_count || b.citation_count - a.citation_count || a.domain.localeCompare(b.domain));
  const measuredPrompts = rows.filter((row) => row.parser_output).length;
  const ownedPromptCoverage = measuredPrompts
    ? Number(((ownedPromptCount / measuredPrompts) * 100).toFixed(2))
    : 0;
  const influentialSources = topDomains.slice(0, 12).map((source) => ({
    domain: source.domain,
    source_name: source.source_name,
    source_type: source.source_type,
    influence_score: impactScore(source),
    citation_count: source.citation_count,
    prompt_count: source.prompt_count,
    model_count: source.model_count,
    category_count: source.category_count,
    why_it_matters:
      source.source_type === 'competitor'
        ? 'Competitor-owned source is shaping the answer set.'
        : source.source_type === 'directory'
        ? 'Directory or review source can influence category recommendations.'
        : source.source_type === 'owned'
        ? 'Owned source is already cited and should be strengthened.'
        : 'Third-party source is influencing AI answer evidence.',
    examples: summarizeExamples(source.examples)
  }));
  const targetSources = topDomains
    .filter((source) => ['earned', 'directory', 'competitor'].includes(source.source_type))
    .slice(0, 10)
    .map((source) => {
      const action_type = sourceActionType(source);
      return {
        domain: source.domain,
        source_name: source.source_name,
        source_type: source.source_type,
        priority_score: impactScore(source),
        action_type,
        recommendation: sourceRecommendation(action_type, source),
        prompt_count: source.prompt_count,
        cited_urls: (source.urls || []).slice(0, 4),
        examples: summarizeExamples(source.examples)
      };
    });
  const competitorShapingPages = topUrls
    .filter((source) => source.source_type === 'competitor')
    .slice(0, 10)
    .map((source) => ({
      url: source.url,
      domain: source.domain,
      source_name: source.source_name,
      influence_score: impactScore(source),
      prompt_count: source.prompt_count,
      model_count: source.model_count,
      recommended_response: sourceRecommendation('comparison_page', source),
      examples: summarizeExamples(source.examples)
    }));
  const recommendedActions = [
    ...targetSources.slice(0, 6).map((source) => ({
      action_type: source.action_type,
      priority_score: source.priority_score,
      title:
        source.action_type === 'review_placement'
          ? `Win review/directory placement on ${source.domain || source.source_name}`
          : source.action_type === 'comparison_page'
          ? `Counter competitor citation pressure from ${source.domain || source.source_name}`
          : source.action_type === 'outreach'
          ? `Pitch ${source.domain || source.source_name} as an answer source`
          : `Create answer-ready content for ${source.domain || source.source_name}`,
      source_domain: source.domain,
      rationale: source.recommendation,
      success_measure: 'Retest the affected prompts and confirm brand/owned or neutral citations increase.'
    })),
    ...promptGaps.slice(0, 4).map((gap) => ({
      action_type: gap.gap_type === 'unsourced_answer' ? 'content' : 'comparison_page',
      priority_score: 40 + toNumber(gap.source_url_count) * 5 + toNumber(gap.competitor_source_count) * 8,
      title:
        gap.gap_type === 'unsourced_answer'
          ? `Create citable content for "${gap.prompt_text}"`
          : `Build an owned answer for "${gap.prompt_text}"`,
      source_domain: null,
      rationale:
        gap.gap_type === 'competitor_sources_without_owned_source'
          ? 'The answer cites competitor sources but no owned source.'
          : gap.gap_type === 'no_owned_source'
          ? 'The answer uses external sources but does not cite an owned brand page.'
          : 'The answer has no cited source, so an answer-ready page can become the preferred reference.',
      success_measure: 'Retest this prompt and confirm the answer cites the owned asset or a target neutral source.'
    }))
  ].sort((a, b) => b.priority_score - a.priority_score);

  return {
    schema_version: 'source-intelligence-v2',
    summary: {
      measured_prompts: measuredPrompts,
      cited_url_count: topUrls.length,
      cited_domain_count: topDomains.length,
      owned_citation_count: sourceTypes.owned,
      earned_citation_count: sourceTypes.earned,
      competitor_citation_count: sourceTypes.competitor,
      directory_citation_count: sourceTypes.directory,
      unknown_citation_count: sourceTypes.unknown,
      owned_prompt_coverage_rate: ownedPromptCoverage,
      prompt_gap_count: promptGaps.length,
      competitor_leakage_count: competitorLeakage.length
    },
    source_type_mix: sourceTypes,
    top_urls: topUrls,
    top_domains: topDomains,
    prompt_gaps: promptGaps.slice(0, 12),
    competitor_leakage: competitorLeakage,
    missing_official_citation_opportunities: promptGaps
      .filter((gap) => gap.gap_type !== 'unsourced_answer')
      .slice(0, 8)
      .map((gap) => ({
        prompt_text: gap.prompt_text,
        category: gap.category,
        model_id: gap.model_id,
        reason:
          gap.gap_type === 'competitor_sources_without_owned_source'
            ? 'Competitor source appeared without an owned source.'
            : 'AI answer used sources, but no owned source was cited.',
        recommended_asset: 'Create or strengthen an owned evidence/FAQ page for this exact prompt.'
      })),
    citation_gap_decision_layer: {
      schema_version: 'citation-gap-decision-layer-v1',
      influential_sources: influentialSources,
      target_sources_to_win: targetSources,
      competitor_shaping_pages: competitorShapingPages,
      recommended_actions: recommendedActions.slice(0, 12),
      unified_customer_summary:
        recommendedActions.length > 0
          ? 'Prioritize source acquisition and owned comparison/content assets for the sources currently shaping AI answers.'
          : 'No source gap action is required from the current measured answers.'
    }
  };
}
