import { createHash } from 'node:crypto';
import { getConfig } from './config.js';
import { ChatgptApiLikeProvider } from './providers/chatgpt-api-like-provider.js';
import { GoogleAioProvider } from './providers/google-aio-provider.js';
import { OpenRouterProvider } from './providers/openrouter-provider.js';
import { PerplexityProvider } from './providers/perplexity-provider.js';

const THIRD_PARTY_DOMAINS = [
  'g2.com',
  'capterra.com',
  'getapp.com',
  'softwareadvice.com',
  'zapier.com',
  'reddit.com',
  'quora.com',
  'producthunt.com',
  'trustpilot.com'
];

function stableKey(parts) {
  return createHash('sha256')
    .update(parts.map((part) => String(part || '')).join('\u001f'))
    .digest('hex')
    .slice(0, 32);
}

function cleanText(value, max = 1600) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

function confidenceValue(value, fallback = 0.74) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function evidenceItem(context, input) {
  const evidenceText = cleanText(input.evidence_text || input.snippet || input.title || input.query_text || '', 1600);
  if (!evidenceText || evidenceText.length < 12) return null;
  const sourceUrl = input.source_url || input.link || input.url || null;
  const sourceType = input.source_type || 'llm_web_search';
  const title = cleanText(input.title || '', 240) || null;
  return {
    ref: input.ref || null,
    source_type: sourceType,
    source_url: sourceUrl,
    source_domain: domainFromUrl(sourceUrl),
    query_text: input.query_text || null,
    evidence_text: evidenceText,
    title,
    market: input.market || context.brand.market || 'US',
    language: input.language || context.brand.locale || 'en',
    confidence: confidenceValue(input.confidence),
    evidence_payload: {
      provider: input.provider || null,
      raw_type: input.raw_type || null,
      metrics: input.metrics || null
    },
    evidence_hash: stableKey([context.brand.id, sourceType, sourceUrl, input.query_text, evidenceText])
  };
}

export function buildMarketEvidenceQueries(context, limit = 12) {
  const vertical = String(context.brand.vertical || 'software').replace(/[_-]+/g, ' ');
  const competitors = context.competitors.map((competitor) => competitor.name).filter(Boolean).slice(0, 4);
  return [
    `${vertical} software`,
    `best ${vertical} tools`,
    `${vertical} tools comparison`,
    `how to choose ${vertical} software`,
    `${context.brand.name} alternatives`,
    `${context.brand.name} reviews`,
    ...competitors.flatMap((competitor) => [
      `${competitor} alternatives`,
      `${context.brand.name} vs ${competitor}`,
      `best alternatives to ${competitor}`
    ])
  ].slice(0, limit);
}

async function collectGscEvidence({ context, config, limit = 12, now = new Date(), fetchImpl = fetch }) {
  if (!config.gscAccessToken || !config.gscProperty) {
    return { provider: 'gsc', status: 'skipped', reason: 'missing_gsc_access_token_or_property', items: [] };
  }
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const encodedSite = encodeURIComponent(config.gscProperty);
  const response = await fetchImpl(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.gscAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query', 'page', 'country'],
      rowLimit: limit
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { provider: 'gsc', status: 'failed', reason: body?.error?.message || `gsc_${response.status}`, items: [] };
  }
  const items = (body.rows || [])
    .map((row, index) => {
      const [query, page, country] = row.keys || [];
      return evidenceItem(context, {
        ref: `GSC${index + 1}`,
        provider: 'gsc',
        source_type: 'gsc_query',
        source_url: page,
        query_text: query,
        title: query,
        market: country || context.brand.market || 'US',
        evidence_text: `${query} generated ${row.impressions || 0} impressions and ${row.clicks || 0} clicks for ${page || context.brand.name}.`,
        confidence: row.impressions > 0 ? 0.92 : 0.74,
        metrics: {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || null
        }
      });
    })
    .filter(Boolean);
  return { provider: 'gsc', status: 'completed', items };
}

function collectSerpApiItems(context, query, body, limit) {
  const items = [];
  for (const [index, result] of (body.organic_results || []).slice(0, limit).entries()) {
    items.push(
      evidenceItem(context, {
        ref: `SERP${items.length + 1}`,
        provider: 'serpapi',
        source_type: 'serp_title',
        query_text: query,
        source_url: result.link,
        title: result.title,
        evidence_text: [result.title, result.snippet].filter(Boolean).join(' - '),
        confidence: index < 3 ? 0.86 : 0.78
      })
    );
  }
  const questions = body.related_questions || body.people_also_ask || body.inline_people_also_search_for || [];
  for (const question of questions.slice(0, limit)) {
    const text = question.question || question.title || question.query || question.snippet;
    items.push(
      evidenceItem(context, {
        ref: `PAA${items.length + 1}`,
        provider: 'serpapi',
        source_type: 'paa_question',
        query_text: query,
        source_url: question.link,
        title: text,
        evidence_text: text,
        confidence: 0.88
      })
    );
  }
  return items.filter(Boolean);
}

async function collectSerpEvidence({ context, config, queries, perQueryLimit = 4, fetchImpl = fetch }) {
  if (!config.serpapiApiKey && !(config.dataforseoLogin && config.dataforseoPassword)) {
    return { provider: 'serp_paa', status: 'skipped', reason: 'missing_serpapi_or_dataforseo_credentials', items: [] };
  }
  const items = [];
  if (config.serpapiApiKey) {
    for (const query of queries.slice(0, 4)) {
      const url = new URL(config.serpapiBaseUrl);
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', query);
      url.searchParams.set('gl', 'us');
      url.searchParams.set('hl', 'en');
      url.searchParams.set('api_key', config.serpapiApiKey);
      const response = await fetchImpl(url);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) continue;
      items.push(...collectSerpApiItems(context, query, body, perQueryLimit));
    }
    return { provider: 'serpapi_serp_paa', status: items.length ? 'completed' : 'empty', items };
  }

  const auth = Buffer.from(`${config.dataforseoLogin}:${config.dataforseoPassword}`).toString('base64');
  const response = await fetchImpl(`${config.dataforseoBaseUrl.replace(/\/+$/u, '')}/v3/serp/google/organic/live/advanced`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      queries.slice(0, 4).map((keyword) => ({
        keyword,
        location_code: 2840,
        language_code: 'en',
        depth: 10
      }))
    )
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { provider: 'dataforseo_serp_paa', status: 'failed', reason: body?.status_message || `dataforseo_${response.status}`, items: [] };
  }
  for (const task of body.tasks || []) {
    for (const result of task.result || []) {
      for (const item of result.items || []) {
        if (item.type === 'organic') {
          items.push(
            evidenceItem(context, {
              provider: 'dataforseo',
              source_type: 'serp_title',
              query_text: task.data?.keyword,
              source_url: item.url,
              title: item.title,
              evidence_text: [item.title, item.description].filter(Boolean).join(' - '),
              confidence: 0.82
            })
          );
        }
        if (item.type === 'people_also_ask') {
          for (const question of item.items || []) {
            items.push(
              evidenceItem(context, {
                provider: 'dataforseo',
                source_type: 'paa_question',
                query_text: task.data?.keyword,
                source_url: question.url,
                title: question.title,
                evidence_text: question.title || question.expanded_element?.[0]?.description,
                confidence: 0.86
              })
            );
          }
        }
      }
    }
  }
  return { provider: 'dataforseo_serp_paa', status: items.filter(Boolean).length ? 'completed' : 'empty', items: items.filter(Boolean) };
}

function pageCandidatesForUrl(url, brandName) {
  if (!url) return [];
  let base;
  try {
    base = new URL(url);
  } catch {
    return [];
  }
  const origin = base.origin;
  const slug = String(brandName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    origin,
    `${origin}/alternatives`,
    `${origin}/compare`,
    `${origin}/comparison`,
    slug ? `${origin}/${slug}-alternative` : null,
    slug ? `${origin}/${slug}-alternatives` : null
  ].filter(Boolean);
}

async function fetchPageEvidence(context, url, { sourceType, queryText, provider, fetchImpl, timeoutMs = 10000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': 'AIVisibilityGrowthLoop/1.0 PromptEvidence',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5'
      },
      signal: controller.signal
    });
    const body = await response.text();
    if (!response.ok) return null;
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const headings = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map((match) => cleanText(match[1], 180))
      .filter(Boolean)
      .slice(0, 8);
    const text = cleanText([title, ...headings, body].join(' '), 1600);
    return evidenceItem(context, {
      provider,
      source_type: sourceType,
      source_url: url,
      query_text: queryText,
      title: cleanText(title, 180),
      evidence_text: text,
      confidence: headings.length ? 0.8 : 0.68
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectCompetitorPageEvidence({ context, fetchImpl = fetch }) {
  const urls = [];
  for (const competitor of context.competitors.slice(0, 4)) {
    urls.push(...pageCandidatesForUrl(competitor.website_url, context.brand.name).map((url) => ({ url, name: competitor.name })));
  }
  urls.push(...pageCandidatesForUrl(context.brand.website_url, context.brand.name).slice(0, 3).map((url) => ({ url, name: context.brand.name, brand: true })));
  const unique = [...new Map(urls.map((item) => [item.url, item])).values()].slice(0, 14);
  const results = await Promise.all(
    unique.map((item) =>
      fetchPageEvidence(context, item.url, {
        sourceType: item.brand ? 'brand_page' : 'competitor_page',
        queryText: `${context.brand.name} ${item.name} comparison alternatives`,
        provider: 'page_crawler',
        fetchImpl
      })
    )
  );
  return { provider: 'competitor_page_crawler', status: results.filter(Boolean).length ? 'completed' : 'empty', items: results.filter(Boolean) };
}

async function collectThirdPartyEvidence({ context, seedItems = [], fetchImpl = fetch }) {
  const urls = seedItems
    .filter((item) => {
      const domain = item.source_domain || domainFromUrl(item.source_url);
      return domain && THIRD_PARTY_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
    })
    .map((item) => ({ url: item.source_url, query: item.query_text || item.title || item.evidence_text }))
    .filter((item) => item.url)
    .slice(0, 8);
  const results = await Promise.all(
    urls.map((item) =>
      fetchPageEvidence(context, item.url, {
        sourceType: item.url.includes('reddit.com') || item.url.includes('quora.com') ? 'forum_question' : 'review_page',
        queryText: item.query,
        provider: 'third_party_crawler',
        fetchImpl
      })
    )
  );
  return {
    provider: 'third_party_source_crawler',
    status: results.filter(Boolean).length ? 'completed' : urls.length ? 'empty' : 'skipped',
    reason: urls.length ? null : 'no_third_party_urls_from_serp',
    items: results.filter(Boolean)
  };
}

function answerEvidenceFromProvider(context, provider, response, query) {
  if (!response?.raw_answer) return [];
  const citations = response.normalized_answer?.citations || response.normalized_answer?.search_results || [];
  const urls = Array.isArray(citations)
    ? citations
        .map((citation) => (typeof citation === 'string' ? citation : citation.url || citation.link || citation.source_url))
        .filter(Boolean)
    : [];
  return [
    evidenceItem(context, {
      provider,
      source_type: 'ai_answer',
      source_url: urls[0] || null,
      query_text: query,
      title: `${provider} answer for ${query}`,
      evidence_text: response.raw_answer,
      confidence: urls.length ? 0.84 : 0.72,
      metrics: response.usage || {}
    }),
    ...urls.slice(0, 5).map((url) =>
      evidenceItem(context, {
        provider,
        source_type: 'ai_answer',
        source_url: url,
        query_text: query,
        title: `${provider} cited source`,
        evidence_text: `${provider} cited ${url} while answering: ${query}`,
        confidence: 0.82
      })
    )
  ].filter(Boolean);
}

async function collectAiSurfaceEvidence({ context, config, queries, includeOpenRouterSurface = true, fetchImpl = fetch }) {
  const prompt = { prompt_text: queries[0] || `${context.brand.name} alternatives` };
  const providers = [];
  if (config.perplexityApiKey) providers.push(['perplexity', new PerplexityProvider(config, fetchImpl)]);
  if (config.serpapiApiKey) providers.push(['google_ai_overview', new GoogleAioProvider(config, fetchImpl)]);
  if (config.openaiApiKey) providers.push(['chatgpt_api_like', new ChatgptApiLikeProvider(config, fetchImpl)]);
  if (includeOpenRouterSurface && config.openrouterApiKey) providers.push(['openrouter_ai_search', new OpenRouterProvider(config, fetchImpl)]);
  if (!providers.length) {
    return { provider: 'ai_answer_surfaces', status: 'skipped', reason: 'missing_ai_surface_credentials', items: [] };
  }
  const items = [];
  const usage = {};
  for (const [providerName, provider] of providers.slice(0, 3)) {
    try {
      const response = await provider.runPrompt({
        brand: context.brand,
        competitors: context.competitors,
        prompt,
        modelTarget: { model_id: config.openrouterEvidenceModel || 'openai/gpt-4o-mini' }
      });
      usage[providerName] = response.usage || {};
      items.push(...answerEvidenceFromProvider(context, providerName, response, prompt.prompt_text));
    } catch (error) {
      usage[providerName] = { error: error.message || String(error) };
    }
  }
  return {
    provider: 'ai_answer_surfaces',
    status: items.length ? 'completed' : 'empty',
    items,
    usage
  };
}

function dedupeEvidenceItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items.filter(Boolean)) {
    if (seen.has(item.evidence_hash)) continue;
    seen.add(item.evidence_hash);
    output.push({
      ...item,
      ref: item.ref || `E${output.length + 1}`
    });
  }
  return output.map((item, index) => ({ ...item, ref: `E${index + 1}` }));
}

export async function collectRawPromptEvidence(options = {}) {
  const {
    context,
    config = getConfig(),
    queries = buildMarketEvidenceQueries(context),
    fetchImpl = fetch,
    includeOpenRouterSurface = true
  } = options;

  const providerRuns = [];
  const allItems = [];

  for (const collector of [
    () => collectGscEvidence({ context, config, fetchImpl }),
    () => collectSerpEvidence({ context, config, queries, fetchImpl }),
    () => collectCompetitorPageEvidence({ context, fetchImpl })
  ]) {
    const result = await collector();
    providerRuns.push(result);
    allItems.push(...(result.items || []));
  }

  const thirdParty = await collectThirdPartyEvidence({ context, seedItems: allItems, fetchImpl });
  providerRuns.push(thirdParty);
  allItems.push(...(thirdParty.items || []));

  const aiSurface = await collectAiSurfaceEvidence({ context, config, queries, includeOpenRouterSurface, fetchImpl });
  providerRuns.push(aiSurface);
  allItems.push(...(aiSurface.items || []));

  return {
    schema_version: 'raw-prompt-evidence-v1',
    queries,
    provider_runs: providerRuns.map((run) => ({
      provider: run.provider,
      status: run.status,
      reason: run.reason || null,
      item_count: run.items?.length || 0,
      usage: run.usage || {}
    })),
    items: dedupeEvidenceItems(allItems),
    usage: Object.fromEntries(providerRuns.map((run) => [run.provider, run.usage || {}]))
  };
}
