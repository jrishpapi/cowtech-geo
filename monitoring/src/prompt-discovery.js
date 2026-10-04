import { assertProviderConfigured } from './provider-configuration.js';
import { createHash } from 'node:crypto';
import { getConfig } from './config.js';
import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';
import { buildMarketEvidenceQueries, collectRawPromptEvidence } from './prompt-evidence-providers.js';

export const PROMPT_DISCOVERY_SCHEMA_VERSION = 'prompt-discovery-mvp-v1';
export const OPERATOR_PROMPT_DISCOVERY_SCHEMA_VERSION = 'prompt-discovery-operator-mvp-v1';
export const CANDIDATE_SCORE_VERSION = 'prompt-candidate-score-v1';

const GROUPS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'awareness', label: 'Awareness' },
  { id: 'problem_led', label: 'Problem-led' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'purchase_intent', label: 'Purchase intent' },
  { id: 'brand_defense', label: 'Brand defense' },
  { id: 'source_seeking', label: 'Source seeking' },
  { id: 'geo_language', label: 'Geo / language' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'confirmed', label: 'Confirmed' }
];

const CATEGORY_META = {
  'brand-awareness': {
    topic: 'Brand awareness',
    intent: 'awareness',
    funnel_stage: 'awareness',
    gap_type: 'untested',
    group_id: 'awareness',
    commercial: 55,
    competitor: 25,
    insight: 70,
    tracking: 85,
    gap: 45,
    source: 45,
    volume: 40
  },
  'category-recommendation': {
    topic: 'Category recommendation',
    intent: 'awareness',
    funnel_stage: 'consideration',
    gap_type: 'missing',
    group_id: 'recommended',
    commercial: 80,
    competitor: 65,
    insight: 75,
    tracking: 90,
    gap: 75,
    source: 55,
    volume: 65
  },
  'problem-solution': {
    topic: 'Problem-led',
    intent: 'problem_led',
    funnel_stage: 'consideration',
    gap_type: 'weak',
    group_id: 'problem_led',
    commercial: 78,
    competitor: 45,
    insight: 85,
    tracking: 88,
    gap: 70,
    source: 50,
    volume: 55
  },
  'competitor-comparison': {
    topic: 'Comparison',
    intent: 'comparison',
    funnel_stage: 'decision',
    gap_type: 'competitor_pressure',
    group_id: 'comparison',
    commercial: 88,
    competitor: 95,
    insight: 70,
    tracking: 92,
    gap: 82,
    source: 60,
    volume: 60
  },
  'buying-guide': {
    topic: 'Purchase intent',
    intent: 'purchase_intent',
    funnel_stage: 'decision',
    gap_type: 'missing',
    group_id: 'purchase_intent',
    commercial: 92,
    competitor: 70,
    insight: 80,
    tracking: 92,
    gap: 80,
    source: 60,
    volume: 70
  },
  'source-seeking': {
    topic: 'Source seeking',
    intent: 'source_seeking',
    funnel_stage: 'awareness',
    gap_type: 'source_gap',
    group_id: 'source_seeking',
    commercial: 55,
    competitor: 35,
    insight: 80,
    tracking: 76,
    gap: 72,
    source: 92,
    volume: 45
  },
  'alternative-search': {
    topic: 'Alternatives',
    intent: 'alternative_search',
    funnel_stage: 'decision',
    gap_type: 'competitor_pressure',
    group_id: 'comparison',
    commercial: 84,
    competitor: 90,
    insight: 72,
    tracking: 88,
    gap: 78,
    source: 55,
    volume: 58
  },
  'regulated-education': {
    topic: 'Education',
    intent: 'education',
    funnel_stage: 'awareness',
    gap_type: 'weak',
    group_id: 'awareness',
    commercial: 50,
    competitor: 30,
    insight: 82,
    tracking: 70,
    gap: 58,
    source: 70,
    volume: 35
  }
};

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stableKey(parts) {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 24);
}

function verticalLabel(vertical) {
  return String(vertical || 'category').replaceAll('_', ' ');
}

function extractPrimaryProblem(prompts = [], vertical = '') {
  const problemPrompt = prompts.find((prompt) => prompt.category === 'problem-solution')?.prompt_text;
  if (problemPrompt) {
    return problemPrompt
      .replace(/^What tools help\s+/i, '')
      .replace(/\?$/u, '')
      .trim();
  }
  return `${verticalLabel(vertical)} buyers solve their evaluation problem`;
}

function sourceLabel(sourceType) {
  const labels = {
    customer_seed: 'From your setup',
    category_template: 'Category template',
    competitor_gap: 'Competitor gap',
    model_suggestion: 'MiniMax discovery',
    existing_opportunity: 'Existing opportunity',
    report_gap: 'Existing opportunity',
    operator_manual: 'Operator added'
  };
  return labels[sourceType] || 'Category template';
}

function priorityBand(score) {
  if (score >= 75) return 'High';
  if (score >= 55) return 'Medium';
  return 'Low';
}

function groupForIntent(intent) {
  const groups = {
    awareness: 'awareness',
    problem_led: 'problem_led',
    comparison: 'comparison',
    purchase_intent: 'purchase_intent',
    brand_defense: 'brand_defense',
    source_seeking: 'source_seeking',
    alternative_search: 'comparison',
    education: 'awareness',
    unknown: 'recommended'
  };
  return groups[intent] || 'recommended';
}

function scoreCandidate({ meta, duplicate_penalty = 0, sourceBoost = 0 }) {
  const commercial_value_score = Math.min(100, meta.commercial + sourceBoost);
  const competitor_relevance_score = Math.min(100, meta.competitor + sourceBoost);
  const insight_value_score = Math.min(100, meta.insight + sourceBoost);
  const tracking_value_score = Math.min(100, meta.tracking + sourceBoost);
  const gap_severity_score = Math.min(100, meta.gap + sourceBoost);
  const source_opportunity_score = Math.min(100, meta.source + sourceBoost);
  const volume_signal_score = Math.min(100, meta.volume + sourceBoost);
  const priority_score = Math.max(
    0,
    Math.min(
      100,
      commercial_value_score * 0.2 +
        competitor_relevance_score * 0.2 +
        insight_value_score * 0.15 +
        tracking_value_score * 0.15 +
        gap_severity_score * 0.15 +
        source_opportunity_score * 0.1 +
        volume_signal_score * 0.05 -
        duplicate_penalty
    )
  );

  return {
    score_version: CANDIDATE_SCORE_VERSION,
    commercial_value_score,
    competitor_relevance_score,
    insight_value_score,
    tracking_value_score,
    gap_severity_score,
    source_opportunity_score,
    volume_signal_score,
    duplicate_penalty,
    priority_score: Number(priority_score.toFixed(2))
  };
}

function makeCandidate({
  brand,
  text,
  category,
  source_type,
  source_ref_id = null,
  source_payload = {},
  source_confidence = 0.8,
  recommendation_reason,
  tags = [],
  created_by = 'system',
  sourceBoost = 0
}) {
  const meta = CATEGORY_META[category] || CATEGORY_META['category-recommendation'];
  const normalized_text = normalizeText(text);
  const duplicate_key = stableKey([brand.id || brand.name, normalized_text]);
  const score = scoreCandidate({ meta, sourceBoost });

  return {
    candidate_key: duplicate_key,
    brand_id: brand.id,
    candidate_text: text,
    normalized_text,
    language: brand.locale || 'en',
    market: brand.market || null,
    topic: {
      name: meta.topic,
      slug: slugify(meta.topic)
    },
    tags: [
      { tag_type: 'intent', name: meta.intent.replaceAll('_', ' '), slug: slugify(meta.intent) },
      { tag_type: 'funnel_stage', name: meta.funnel_stage.replaceAll('_', ' '), slug: slugify(meta.funnel_stage) },
      ...tags
    ],
    intent: meta.intent,
    funnel_stage: meta.funnel_stage,
    gap_type: meta.gap_type,
    group_id: meta.group_id,
    provenance: source_type === 'customer_seed' ? 'observed' : 'synthetic',
    recommendation_reason,
    source: {
      source_type,
      source_ref_id,
      source_payload,
      source_confidence
    },
    source_label: sourceLabel(source_type),
    quota_impact: 1,
    duplicate_key,
    duplicate_risk: 0,
    status: 'suggested',
    created_by,
    score,
    priority_band: priorityBand(score.priority_score),
    allowed_actions: ['shortlist', 'edit', 'reject', 'details']
  };
}

function dedupeCandidates(candidates) {
  const seen = new Map();
  const output = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.normalized_text)) {
      const original = seen.get(candidate.normalized_text);
      original.duplicate_risk = Math.max(original.duplicate_risk, 80);
      continue;
    }
    seen.set(candidate.normalized_text, candidate);
    output.push(candidate);
  }
  return output.map((candidate) => ({
    ...candidate,
    duplicate_risk: candidate.duplicate_risk || (candidate.normalized_text.length < 36 ? 35 : 0)
  }));
}

function cleanWebsiteText(html) {
  return String(html || '')
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
    .slice(0, 14000);
}

async function fetchWebsiteEvidence(url, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  if (!url) {
    return { ok: false, url: null, text: '', error: 'website_url_missing' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': 'AIVisibilityGrowthLoop/1.0 PromptDiscovery',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5'
      },
      signal: controller.signal
    });
    const body = await response.text();
    return {
      ok: response.ok,
      url,
      status: response.status,
      text: cleanWebsiteText(body),
      error: response.ok ? null : `website_fetch_${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      url,
      text: '',
      error: error.name === 'AbortError' ? 'website_fetch_timeout' : 'website_fetch_failed'
    };
  } finally {
    clearTimeout(timeout);
  }
}

function promptDiscoverySystemPrompt() {
  return [
    'You generate GEO tracking prompt candidates for an AI visibility SaaS.',
    'Return only valid JSON. Do not wrap in markdown.',
    'Generate prompts that real buyers, researchers, or category evaluators would ask an AI before choosing a product.',
    'Avoid generic prompts such as "Which web3 companies do you recommend?" unless the category is specific and commercially meaningful.',
    'Do not invent private facts. Use website evidence and supplied brand context.'
  ].join(' ');
}

function promptDiscoveryUserPrompt({ context, websiteEvidence, candidateCount }) {
  return JSON.stringify(
    {
      task: 'Generate high-signal GEO prompt discovery candidates.',
      output_schema: {
        brand_summary: {
          positioning: 'string',
          product_category: 'string',
          target_customers: ['string'],
          buyer_use_cases: ['string']
        },
        prompts: [
          {
            category:
              'brand-awareness | category-recommendation | problem-solution | competitor-comparison | buying-guide | source-seeking | alternative-search | regulated-education',
            prompt_text: 'string',
            why_this_matters: 'string',
            expected_signal: 'visibility | source_quality | competitor_pressure | buying_intent',
            source_basis: 'website | customer_input | competitor | model_inference',
            confidence: 0.8
          }
        ]
      },
      requirements: {
        candidate_count: candidateCount,
        language: context.brand.locale || 'en',
        include_mix: [
          'category recommendation',
          'problem-led buying intent',
          'competitor comparison',
          'alternative search',
          'source seeking',
          'brand awareness'
        ],
        reject: [
          'broad industry-only prompts with no buyer intent',
          'prompts unrelated to the product category',
          'prompts that only ask whether the brand exists',
          'duplicate wording'
        ]
      },
      brand: {
        name: context.brand.name,
        website_url: context.brand.website_url,
        vertical: context.brand.vertical,
        locale: context.brand.locale || 'en',
        market: context.brand.market || null
      },
      competitors: context.competitors.slice(0, 8).map((competitor) => ({
        name: competitor.name,
        website_url: competitor.website_url || null
      })),
      existing_active_prompts: context.prompts.slice(0, 12).map((prompt) => ({
        category: prompt.category,
        prompt_text: prompt.prompt_text
      })),
      website_evidence: {
        ok: websiteEvidence.ok,
        url: websiteEvidence.url,
        fetch_error: websiteEvidence.error,
        text_excerpt: websiteEvidence.text.slice(0, 12000)
      }
    },
    null,
    2
  );
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('minimax_prompt_discovery_empty_response');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('minimax_prompt_discovery_json_missing');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function normalizeModelCategory(category) {
  const normalized = slugify(category || '').replaceAll('_', '-');
  const aliases = {
    awareness: 'brand-awareness',
    recommendation: 'category-recommendation',
    category: 'category-recommendation',
    comparison: 'competitor-comparison',
    alternatives: 'alternative-search',
    alternative: 'alternative-search',
    purchase: 'buying-guide',
    buying: 'buying-guide',
    source: 'source-seeking',
    problem: 'problem-solution'
  };
  return CATEGORY_META[normalized] ? normalized : aliases[normalized] || 'category-recommendation';
}

function confidenceValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.72;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

function evidenceSeedQueries(context) {
  const vertical = verticalLabel(context.brand.vertical);
  const competitors = context.competitors.map((competitor) => competitor.name).filter(Boolean).slice(0, 4);
  return [
    `best ${vertical} software`,
    `${vertical} tools comparison`,
    `how to choose ${vertical} software`,
    `${context.brand.name} alternatives`,
    ...competitors.flatMap((competitor) => [
      `${competitor} alternatives`,
      `${context.brand.name} vs ${competitor}`
    ])
  ].slice(0, 12);
}

function evidenceDiscoverySystemPrompt() {
  return [
    'You build evidence-backed GEO prompt libraries for an AI visibility SaaS.',
    'Use web search evidence before proposing prompts.',
    'Return only valid JSON. Do not wrap in markdown.',
    'Every generated prompt must cite at least one evidence item from the evidence_items array.',
    'Do not invent private facts. Prefer buyer-intent questions, comparison prompts, alternatives prompts, source-seeking prompts, and problem-led prompts.'
  ].join(' ');
}

function evidenceDiscoveryUserPrompt({ context, queries, candidateCount, rawEvidenceItems = [] }) {
  return JSON.stringify(
    {
      task: rawEvidenceItems.length
        ? 'Generate an evidence-backed prompt library from the supplied raw market evidence.'
        : 'Search the web and generate an evidence-backed prompt library.',
      brand: {
        name: context.brand.name,
        website_url: context.brand.website_url,
        vertical: context.brand.vertical,
        locale: context.brand.locale || 'en',
        market: context.brand.market || 'US'
      },
      competitors: context.competitors.slice(0, 8).map((competitor) => ({
        name: competitor.name,
        website_url: competitor.website_url || null
      })),
      seed_queries: queries,
      existing_prompts: context.prompts.slice(0, 12).map((prompt) => ({
        category: prompt.category,
        prompt_text: prompt.prompt_text
      })),
      raw_market_evidence: rawEvidenceItems.slice(0, 50).map((item) => ({
        ref: item.ref,
        source_type: item.source_type,
        source_url: item.source_url,
        source_domain: item.source_domain,
        query_text: item.query_text,
        title: item.title,
        evidence_text: item.evidence_text,
        confidence: item.confidence
      })),
      output_schema: {
        evidence_items: [
          {
            ref: 'E1',
            source_type: 'paa_question | serp_title | competitor_page | review_page | forum_question | ai_answer | llm_web_search',
            query_text: 'string',
            evidence_text: 'string',
            title: 'string',
            source_url: 'https://example.com',
            market: 'US',
            language: 'en',
            confidence: 0.8
          }
        ],
        prompts: [
          {
            category:
              'brand-awareness | category-recommendation | problem-solution | competitor-comparison | buying-guide | source-seeking | alternative-search | regulated-education',
            prompt_text: 'string',
            why_this_matters: 'string',
            expected_signal: 'visibility | source_quality | competitor_pressure | buying_intent',
            source_basis: 'web_search | competitor_page | review_page | forum_question | ai_answer',
            confidence: 0.8,
            evidence_refs: ['E1']
          }
        ]
      },
      requirements: {
        candidate_count: candidateCount,
        evidence_item_count: Math.max(12, Math.min(40, candidateCount * 2)),
        reject: [
          'generic prompts not tied to evidence',
          'questions unrelated to the brand category',
          'prompts that cite no evidence_refs',
          rawEvidenceItems.length ? 'prompts that cite evidence refs outside raw_market_evidence' : null,
          'prompts that only ask if the brand exists'
        ].filter(Boolean)
      }
    },
    null,
    2
  );
}

async function callOpenRouterEvidenceDiscovery({
  context,
  queries,
  candidateCount,
  config = getConfig(),
  fetchImpl = fetch,
  rawEvidenceItems = [],
  useWebSearch = true
}) {
  if (!config.openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is required for evidence-backed prompt discovery');
  }
  const response = await fetchImpl(`${config.openrouterBaseUrl.replace(/\/+$/u, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openrouterEvidenceModel,
      messages: [
        { role: 'system', content: evidenceDiscoverySystemPrompt() },
        { role: 'user', content: evidenceDiscoveryUserPrompt({ context, queries, candidateCount, rawEvidenceItems }) }
      ],
      temperature: 0.15,
      max_tokens: 5000,
      ...(useWebSearch ? { tools: [{ type: 'openrouter:web_search' }] } : {})
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.message || `OpenRouter evidence discovery returned ${response.status}`);
    error.code = 'openrouter_evidence_discovery_failed';
    error.statusCode = response.status;
    throw error;
  }
  return {
    provider_response_id: body.id || null,
    usage: body.usage || {},
    raw_payload: extractJsonObject(body.choices?.[0]?.message?.content || '')
  };
}

function normalizeEvidenceItems(rawItems = [], context) {
  return rawItems
    .map((item, index) => {
      const evidenceText = String(item.evidence_text || item.question || item.snippet || item.title || '').trim();
      if (!evidenceText || evidenceText.length < 12) return null;
      const sourceUrl = item.source_url || item.url || null;
      const sourceType = [
        'paa_question',
        'serp_title',
        'competitor_page',
        'review_page',
        'forum_question',
        'ai_answer',
        'llm_web_search'
      ].includes(item.source_type)
        ? item.source_type
        : 'llm_web_search';
      const ref = item.ref || `E${index + 1}`;
      return {
        ref,
        source_type: sourceType,
        source_url: sourceUrl,
        source_domain: domainFromUrl(sourceUrl),
        query_text: item.query_text || item.query || null,
        evidence_text: evidenceText.slice(0, 1600),
        title: item.title || null,
        market: item.market || context.brand.market || 'US',
        language: item.language || context.brand.locale || 'en',
        confidence: confidenceValue(item.confidence),
        evidence_payload: {
          ref,
          source_basis: item.source_basis || null
        },
        evidence_hash: stableKey([context.brand.id, sourceType, sourceUrl, evidenceText])
      };
    })
    .filter(Boolean);
}

function buildCandidatesFromEvidenceOutput({ context, modelPayload, evidenceItems, model }) {
  const prompts = Array.isArray(modelPayload?.prompts) ? modelPayload.prompts : [];
  const evidenceByRef = new Map(evidenceItems.map((item) => [item.ref, item]));
  return dedupeCandidates(
    prompts
      .map((item, index) => {
        const text = String(item.prompt_text || item.question || '').trim();
        const refs = Array.isArray(item.evidence_refs) ? item.evidence_refs : [];
        const linkedEvidence = refs.map((ref) => evidenceByRef.get(ref)).filter(Boolean);
        if (!text || candidateTextIsTooGeneric(text, context.brand) || !linkedEvidence.length) return null;
        const confidence = confidenceValue(item.confidence);
        return makeCandidate({
          brand: context.brand,
          text,
          category: normalizeModelCategory(item.category),
          source_type: 'model_suggestion',
          source_ref_id: `openrouter-web-search:${index + 1}`,
          source_payload: {
            model,
            generator: 'openrouter_evidence_backed_prompt_discovery',
            evidence_refs: linkedEvidence.map((evidence) => evidence.ref),
            evidence_hashes: linkedEvidence.map((evidence) => evidence.evidence_hash),
            evidence_urls: linkedEvidence.map((evidence) => evidence.source_url).filter(Boolean),
            expected_signal: item.expected_signal || null,
            source_basis: item.source_basis || 'web_search'
          },
          source_confidence: confidence,
          recommendation_reason:
            item.why_this_matters ||
            `Generated from ${linkedEvidence.length} market evidence item${linkedEvidence.length === 1 ? '' : 's'}.`,
          created_by: 'openrouter_evidence_discovery',
          sourceBoost: confidence >= 0.8 ? 8 : confidence >= 0.65 ? 4 : 1
        });
      })
      .filter(Boolean)
  )
    .sort((a, b) => b.score.priority_score - a.score.priority_score || a.candidate_text.localeCompare(b.candidate_text))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function candidateTextIsTooGeneric(text, brand) {
  const normalized = normalizeText(text);
  if (normalized.length < 28) return true;
  const vertical = normalizeText(brand.vertical);
  const weakPatterns = [
    /^which [a-z0-9 ]+ companies do you recommend$/,
    /^what [a-z0-9 ]+ tools or companies help customers solve this problem$/,
    /^do you know [a-z0-9 ]+$/
  ];
  if (weakPatterns.some((pattern) => pattern.test(normalized))) return true;
  return vertical && normalized === `which ${vertical} companies do you recommend`;
}

export function buildCandidatesFromModelOutput({ context, modelPayload, websiteEvidence, model }) {
  const prompts = Array.isArray(modelPayload?.prompts) ? modelPayload.prompts : [];
  const evidenceHash = stableKey([websiteEvidence.url, websiteEvidence.text.slice(0, 2000)]);
  const candidates = prompts
    .map((item, index) => {
      const text = String(item.prompt_text || item.question || '').trim();
      if (!text || candidateTextIsTooGeneric(text, context.brand)) return null;
      const category = normalizeModelCategory(item.category);
      const confidence = confidenceValue(item.confidence);
      return makeCandidate({
        brand: context.brand,
        text,
        category,
        source_type: 'model_suggestion',
        source_ref_id: `${model}:${index + 1}`,
        source_payload: {
          model,
          generator: 'minimax_prompt_discovery',
          expected_signal: item.expected_signal || null,
          source_basis: item.source_basis || null,
          why_this_matters: item.why_this_matters || item.recommendation_reason || null,
          website_url: websiteEvidence.url,
          website_fetch_ok: websiteEvidence.ok,
          website_fetch_error: websiteEvidence.error,
          website_evidence_hash: evidenceHash,
          brand_summary: modelPayload.brand_summary || {}
        },
        source_confidence: confidence,
        recommendation_reason:
          item.why_this_matters ||
          item.recommendation_reason ||
          'MiniMax generated this prompt from website evidence and brand setup context.',
        created_by: 'minimax_prompt_discovery',
        sourceBoost: confidence >= 0.8 ? 5 : confidence >= 0.65 ? 2 : 0
      });
    })
    .filter(Boolean);

  return dedupeCandidates(candidates)
    .sort((a, b) => b.score.priority_score - a.score.priority_score || a.candidate_text.localeCompare(b.candidate_text))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

async function callMinimaxPromptDiscovery({ context, websiteEvidence, candidateCount, config = getConfig(), fetchImpl = fetch }) {
  if (!config.minimaxApiKey) {
    throw new Error('MINIMAX_API_KEY is required for MiniMax Prompt Discovery');
  }
  const body = {
    model: config.minimaxModel,
    messages: [
      { role: 'system', content: promptDiscoverySystemPrompt() },
      { role: 'user', content: promptDiscoveryUserPrompt({ context, websiteEvidence, candidateCount }) }
    ],
    temperature: 0.2,
    max_completion_tokens: 5000,
    thinking: { type: 'disabled' }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const response = await fetchImpl(`${config.minimaxBaseUrl.replace(/\/+$/u, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.minimaxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = responseBody?.error?.message || responseBody?.message || `MiniMax Prompt Discovery returned ${response.status}`;
    const error = new Error(message);
    error.code = 'minimax_prompt_discovery_provider_error';
    error.statusCode = response.status;
    throw error;
  }
  const content = responseBody.choices?.[0]?.message?.content;
  const parsed = extractJsonObject(content);
  return {
    provider_response_id: responseBody.id || null,
    usage: responseBody.usage || {},
    raw_payload: parsed
  };
}

export function buildDeterministicPromptCandidates({
  brand,
  competitors = [],
  prompts = [],
  promptTaxonomy = [],
  opportunities = []
}) {
  const candidates = [];
  const vertical = verticalLabel(brand.vertical);
  const primaryProblem = extractPrimaryProblem(prompts, brand.vertical);
  const competitorNames = competitors.map((competitor) => competitor.name).filter(Boolean);
  const competitorList = competitorNames.slice(0, 3).join(', ');

  for (const prompt of prompts) {
    candidates.push(
      makeCandidate({
        brand,
        text: prompt.prompt_text,
        category: prompt.category,
        source_type: 'customer_seed',
        source_ref_id: prompt.id || prompt.category,
        source_payload: {
          prompt_id: prompt.id || null,
          prompt_set_id: prompt.prompt_set_id || null,
          category: prompt.category
        },
        source_confidence: 0.95,
        recommendation_reason: 'This existing seed prompt already maps to a measurable tracking intent.'
      })
    );
  }

  for (const competitor of competitors.slice(0, 5)) {
    candidates.push(
      makeCandidate({
        brand,
        text: `Compare ${brand.name} vs ${competitor.name} for ${vertical} buyers.`,
        category: 'competitor-comparison',
        source_type: 'competitor_gap',
        source_ref_id: competitor.id || competitor.name,
        source_payload: {
          competitor_id: competitor.id || null,
          competitor_name: competitor.name,
          website_url: competitor.website_url || null
        },
        recommendation_reason: `${competitor.name} is a configured competitor, so comparison prompts should be tracked explicitly.`,
        sourceBoost: 4
      })
    );
    candidates.push(
      makeCandidate({
        brand,
        text: `What are the best alternatives to ${competitor.name} for ${vertical} teams?`,
        category: 'alternative-search',
        source_type: 'competitor_gap',
        source_ref_id: competitor.id || competitor.name,
        source_payload: {
          competitor_id: competitor.id || null,
          competitor_name: competitor.name,
          website_url: competitor.website_url || null
        },
        recommendation_reason: `Alternative-search prompts test whether ${brand.name} appears when buyers consider ${competitor.name}.`,
        sourceBoost: 3
      })
    );
  }

  candidates.push(
    makeCandidate({
      brand,
      text: `Which ${vertical} tools do buyers shortlist when evaluating ${brand.name} and ${competitorList || 'similar competitors'}?`,
      category: 'buying-guide',
      source_type: 'category_template',
      source_payload: { vertical: brand.vertical, competitors: competitorNames.slice(0, 3) },
      recommendation_reason: 'Buying-guide prompts capture high-intent shortlisting behavior before tracking starts.',
      sourceBoost: 2
    })
  );
  candidates.push(
    makeCandidate({
      brand,
      text: `What problems does ${brand.name} solve for ${vertical} teams?`,
      category: 'problem-solution',
      source_type: 'category_template',
      source_payload: { vertical: brand.vertical, problem: primaryProblem },
      recommendation_reason: 'Problem-led prompts reveal whether AI answers connect the brand to buyer pain points.',
      sourceBoost: 1
    })
  );
  candidates.push(
    makeCandidate({
      brand,
      text: `Is ${brand.name} a trusted option for ${vertical} teams compared with ${competitorList || 'other vendors'}?`,
      category: 'brand-awareness',
      source_type: 'category_template',
      source_payload: { vertical: brand.vertical, competitors: competitorNames.slice(0, 3) },
      recommendation_reason: 'Brand-defense prompts test whether the model can explain trust and positioning.',
      tags: [{ tag_type: 'operator', name: 'brand defense', slug: 'brand-defense' }],
      sourceBoost: 2
    })
  );
  candidates.push(
    makeCandidate({
      brand,
      text: `Where should buyers research ${vertical} tools like ${brand.name}?`,
      category: 'source-seeking',
      source_type: 'category_template',
      source_payload: { vertical: brand.vertical },
      recommendation_reason: 'Source-seeking prompts expose whether AI answers cite the brand, competitors, or third-party proof.',
      sourceBoost: 1
    })
  );

  for (const taxonomy of promptTaxonomy) {
    const appliesTo = Array.isArray(taxonomy.applies_to) ? taxonomy.applies_to : [];
    if (appliesTo.length && !appliesTo.includes(brand.vertical)) continue;
    if (prompts.some((prompt) => prompt.category === taxonomy.id)) continue;
    candidates.push(
      makeCandidate({
        brand,
        text: `What should ${vertical} buyers ask about ${taxonomy.label.toLowerCase()} when evaluating ${brand.name}?`,
        category: taxonomy.id,
        source_type: 'category_template',
        source_ref_id: taxonomy.id,
        source_payload: {
          taxonomy_id: taxonomy.id,
          label: taxonomy.label,
          description: taxonomy.description
        },
        recommendation_reason: `The ${taxonomy.label} category applies to this brand profile and fills a missing prompt group.`,
        sourceBoost: 1
      })
    );
  }

  for (const opportunity of opportunities.slice(0, 6)) {
    const category = opportunity.target_categories?.[0] || 'category-recommendation';
    const format = String(opportunity.recommended_format || opportunity.opportunity_type || 'content gap').replaceAll('_', ' ');
    candidates.push(
      makeCandidate({
        brand,
        text: `Which ${vertical} resources help buyers evaluate ${format} for ${brand.name}?`,
        category,
        source_type: 'existing_opportunity',
        source_ref_id: opportunity.id || opportunity.opportunity_key,
        source_payload: {
          opportunity_id: opportunity.id || null,
          opportunity_key: opportunity.opportunity_key || null,
          opportunity_type: opportunity.opportunity_type || null,
          priority: opportunity.priority || null
        },
        recommendation_reason: 'This candidate comes from an existing measured content opportunity.',
        sourceBoost: opportunity.priority === 'high' ? 5 : 2
      })
    );
  }

  return dedupeCandidates(candidates)
    .sort((a, b) => {
      const scoreDelta = b.score.priority_score - a.score.priority_score;
      if (scoreDelta !== 0) return scoreDelta;
      return a.candidate_text.localeCompare(b.candidate_text);
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));
}

function candidateToCustomer(candidate) {
  const cluster = promptClusterMeta(candidate);
  const sourcePayload = candidate.source?.source_payload || {};
  const evidenceRefs = Array.isArray(sourcePayload.evidence_refs) ? sourcePayload.evidence_refs.slice(0, 6) : [];
  const evidenceUrls = Array.isArray(sourcePayload.evidence_urls) ? sourcePayload.evidence_urls.filter(Boolean).slice(0, 6) : [];
  const evidenceDomains = evidenceUrls.map((url) => domainFromUrl(url)).filter(Boolean);
  return {
    id: candidate.id || candidate.candidate_key,
    candidate_text: candidate.candidate_text,
    topic: candidate.topic,
    tags: candidate.tags,
    cluster,
    commercial_intent: commercialIntentLabel(candidate.intent, candidate.funnel_stage),
    intent: candidate.intent,
    funnel_stage: candidate.funnel_stage,
    gap_type: candidate.gap_type,
    priority_band: candidate.priority_band,
    priority_score: candidate.score?.priority_score ?? null,
    recommendation_reason: candidate.recommendation_reason,
    prompt_level_opportunity: promptOpportunity(candidate),
    source_label: candidate.source_label,
    evidence_summary: {
      evidence_backed: evidenceRefs.length > 0 || evidenceUrls.length > 0,
      source_count: Math.max(evidenceRefs.length, evidenceUrls.length),
      source_domains: [...new Set(evidenceDomains)],
      source_urls: evidenceUrls,
      confidence: candidate.source?.source_confidence ?? null
    },
    provenance: candidate.provenance,
    duplicate_risk: candidate.duplicate_risk,
    quota_impact: candidate.quota_impact,
    status: candidate.status,
    group_id: candidate.group_id,
    allowed_actions: candidate.allowed_actions
  };
}

function candidateToOperator(candidate) {
  return {
    ...candidateToCustomer(candidate),
    duplicate_key: candidate.duplicate_key,
    normalized_text: candidate.normalized_text,
    score_components: candidate.score,
    source_confidence: candidate.source?.source_confidence ?? null,
    source_payload: candidate.source?.source_payload || {},
    gap_payload: candidate.gap_payload || {},
    selection_events: candidate.selection_events || [],
    operator_blockers: candidate.operator_blockers || [],
    override_options: ['approve', 'reject', 'edit', 'replace', 'confirm', 'block_confirmation', 'override_quota']
  };
}

function groupCandidates(candidates) {
  return GROUPS.map((group) => {
    const candidateIds =
      group.id === 'recommended'
        ? candidates.filter((candidate) => candidate.priority_band === 'High' && candidate.status !== 'rejected').map((candidate) => candidate.id || candidate.candidate_key)
        : group.id === 'rejected'
          ? candidates.filter((candidate) => candidate.status === 'rejected').map((candidate) => candidate.id || candidate.candidate_key)
          : group.id === 'confirmed'
            ? candidates.filter((candidate) => candidate.status === 'confirmed').map((candidate) => candidate.id || candidate.candidate_key)
            : candidates
                .filter((candidate) => candidate.group_id === group.id && !['rejected', 'confirmed'].includes(candidate.status))
                .map((candidate) => candidate.id || candidate.candidate_key);
    return {
      ...group,
      count: candidateIds.length,
      candidate_ids: candidateIds
    };
  });
}

function commercialIntentLabel(intent, funnelStage) {
  const labels = {
    awareness: 'Awareness demand',
    problem_led: 'Problem-led demand',
    comparison: 'Competitive comparison',
    purchase_intent: 'Buying shortlist',
    brand_defense: 'Brand defense',
    source_seeking: 'Citation discovery',
    alternative_search: 'Alternative search',
    education: 'Education demand'
  };
  return labels[intent] || `${String(funnelStage || 'buyer').replaceAll('_', ' ')} intent`;
}

function promptClusterMeta(candidate) {
  const labels = {
    awareness: 'Brand familiarity',
    problem_led: 'Problem-led demand',
    recommended: 'Category recommendation',
    comparison: 'Competitive alternatives',
    purchase_intent: 'Buying shortlist',
    brand_defense: 'Brand defense',
    source_seeking: 'Citation discovery',
    geo_language: 'Market and language demand'
  };
  const clusterId = groupForIntent(candidate.intent || candidate.group_id);
  return {
    id: clusterId,
    label: labels[clusterId] || labels[candidate.group_id] || 'Category recommendation'
  };
}

function opportunityMetric(candidate) {
  const metricByGap = {
    competitor_pressure: 'competitor_pressure_score',
    source_gap: 'source_quality_score',
    missing: 'visibility_score',
    weak: 'visibility_score',
    untested: 'brand_mention_rate'
  };
  return metricByGap[candidate.gap_type] || 'visibility_score';
}

function promptOpportunity(candidate) {
  const cluster = promptClusterMeta(candidate);
  const metric = opportunityMetric(candidate);
  const actionByGap = {
    competitor_pressure: 'Create comparison or alternative-search content that directly answers this prompt.',
    source_gap: 'Build or earn citation-ready sources that AI answers can reference for this prompt.',
    missing: 'Add a page section or article that gives a direct answer to this prompt.',
    weak: 'Strengthen existing content with clearer facts, comparisons, and source evidence.',
    untested: 'Track this prompt to establish a baseline before content work.'
  };
  return {
    candidate_id: candidate.id || candidate.candidate_key,
    cluster_id: cluster.id,
    cluster_label: cluster.label,
    opportunity_type: candidate.gap_type || 'visibility_gap',
    target_metric: metric,
    priority_band: candidate.priority_band,
    priority_score: candidate.score?.priority_score ?? null,
    recommended_action: actionByGap[candidate.gap_type] || actionByGap.missing,
    expected_retest_metric: metric,
    why_it_matters: candidate.recommendation_reason
  };
}

function buildPromptLibrary({ brand, candidates = [], confirmedPrompts = [], seedCount = 0 }) {
  const confirmedIds = new Set(confirmedPrompts.map((prompt) => normalizeText(prompt.prompt_text)));
  const candidateIdsByCluster = new Map();
  const clusters = [];

  for (const candidate of candidates) {
    const cluster = promptClusterMeta(candidate);
    const key = cluster.id;
    const existing =
      candidateIdsByCluster.get(key) ||
      {
        id: key,
        label: cluster.label,
        candidate_ids: [],
        total_priority_score: 0,
        high_priority_count: 0,
        selected_count: 0,
        confirmed_count: 0,
        opportunity_metrics: new Map()
      };
    existing.candidate_ids.push(candidate.id || candidate.candidate_key);
    existing.total_priority_score += toNumber(candidate.score?.priority_score);
    if (candidate.priority_band === 'High') existing.high_priority_count += 1;
    if (['shortlisted', 'approved', 'edited'].includes(candidate.status)) existing.selected_count += 1;
    if (candidate.status === 'confirmed' || confirmedIds.has(candidate.normalized_text)) existing.confirmed_count += 1;
    const metric = opportunityMetric(candidate);
    existing.opportunity_metrics.set(metric, (existing.opportunity_metrics.get(metric) || 0) + 1);
    candidateIdsByCluster.set(key, existing);
  }

  for (const cluster of candidateIdsByCluster.values()) {
    const topMetric = [...cluster.opportunity_metrics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'visibility_score';
    clusters.push({
      id: cluster.id,
      label: cluster.label,
      candidate_count: cluster.candidate_ids.length,
      high_priority_count: cluster.high_priority_count,
      selected_count: cluster.selected_count,
      confirmed_count: cluster.confirmed_count,
      avg_priority_score: cluster.candidate_ids.length
        ? Number((cluster.total_priority_score / cluster.candidate_ids.length).toFixed(2))
        : 0,
      target_metric: topMetric,
      candidate_ids: cluster.candidate_ids.slice(0, 12)
    });
  }

  const intentLayers = ['awareness', 'consideration', 'decision']
    .map((stage) => {
      const stageCandidates = candidates.filter((candidate) => candidate.funnel_stage === stage);
      return {
        id: stage,
        label: `${stage[0].toUpperCase()}${stage.slice(1)} intent`,
        candidate_count: stageCandidates.length,
        high_priority_count: stageCandidates.filter((candidate) => candidate.priority_band === 'High').length,
        selected_count: stageCandidates.filter((candidate) => ['shortlisted', 'approved', 'edited'].includes(candidate.status)).length,
        top_candidate_ids: stageCandidates
          .slice()
          .sort((a, b) => toNumber(b.score?.priority_score) - toNumber(a.score?.priority_score))
          .slice(0, 5)
          .map((candidate) => candidate.id || candidate.candidate_key)
      };
    })
    .filter((layer) => layer.candidate_count > 0);

  const sourceMix = candidates.reduce((acc, candidate) => {
    const label = candidate.source_label || sourceLabel(candidate.source?.source_type);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const priorityQueue = candidates
    .slice()
    .sort((a, b) => toNumber(b.score?.priority_score) - toNumber(a.score?.priority_score))
    .slice(0, 10)
    .map((candidate) => ({
      candidate_id: candidate.id || candidate.candidate_key,
      candidate_text: candidate.candidate_text,
      priority_band: candidate.priority_band,
      priority_score: candidate.score?.priority_score ?? null,
      cluster: promptClusterMeta(candidate),
      commercial_intent: commercialIntentLabel(candidate.intent, candidate.funnel_stage),
      target_metric: opportunityMetric(candidate),
      status: candidate.status
    }));

  return {
    schema_version: 'prompt-library-commercial-v1',
    summary: {
      brand_name: brand.name,
      vertical: brand.vertical,
      market: brand.market || null,
      seed_prompt_count: seedCount,
      candidate_count: candidates.length,
      cluster_count: clusters.length,
      high_priority_count: candidates.filter((candidate) => candidate.priority_band === 'High').length,
      prompt_level_opportunity_count: candidates.length,
      confirmed_prompt_count: confirmedPrompts.length
    },
    industry_prompt_generation: {
      status: candidates.length ? 'ready' : 'not_ready',
      method: 'deterministic_industry_prompt_library',
      generated_from: ['brand profile', 'configured competitors', 'active prompt set', 'prompt taxonomy', 'measured opportunities'],
      source_mix: sourceMix
    },
    clusters: clusters.sort((a, b) => b.avg_priority_score - a.avg_priority_score || b.candidate_count - a.candidate_count),
    intent_layers: intentLayers,
    priority_queue: priorityQueue,
    prompt_level_opportunities: candidates
      .slice()
      .sort((a, b) => toNumber(b.score?.priority_score) - toNumber(a.score?.priority_score))
      .slice(0, 12)
      .map(promptOpportunity)
  };
}

function readiness({ seedCount, candidateCount, confirmedPromptCount, selectedCount, planLimit }) {
  let status = 'not_started';
  let selection_status = 'not_started';
  const warnings = [];

  if (seedCount === 0) {
    status = 'needs_seed_data';
  } else if (candidateCount === 0) {
    status = 'not_started';
  } else if (confirmedPromptCount > 0) {
    status = 'confirmed';
    selection_status = 'confirmed';
  } else {
    status = 'ready_for_selection';
    selection_status = selectedCount > 0 ? 'in_progress' : 'not_started';
  }

  if (planLimit > 0 && selectedCount > planLimit) {
    selection_status = 'over_limit';
    warnings.push('selected_candidates_exceed_plan_limit');
  }

  return {
    status,
    selection_status,
    can_enter_tracking: confirmedPromptCount > 0,
    next_step:
      confirmedPromptCount > 0
        ? 'Confirmed prompts are ready for tracking.'
        : candidateCount > 0
          ? 'Review and confirm candidate prompts before tracking.'
          : 'Generate deterministic candidates from setup data.',
    warnings
  };
}

function customerSafeProviderRun(run = {}) {
  return {
    provider: run.provider || 'unknown',
    status: run.status || 'unknown',
    reason: run.reason || null,
    item_count: toNumber(run.item_count),
    usage: run.usage || {}
  };
}

function buildEvidenceCollectionSummary(discoveryRun = null) {
  const providerRuns = Array.isArray(discoveryRun?.summary_payload?.provider_runs)
    ? discoveryRun.summary_payload.provider_runs.map(customerSafeProviderRun)
    : [];
  const completed = providerRuns.filter((run) => run.status === 'completed');
  const skipped = providerRuns.filter((run) => run.status === 'skipped');
  const failed = providerRuns.filter((run) => run.status === 'failed');

  return {
    schema_version: 'prompt-discovery-evidence-collection-v1',
    status: providerRuns.length ? 'reported' : 'not_reported',
    provider_runs: providerRuns,
    summary: {
      provider_count: providerRuns.length,
      completed_count: completed.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      evidence_item_count: providerRuns.reduce((sum, run) => sum + toNumber(run.item_count), 0)
    }
  };
}

export function buildPromptDiscoveryPayload({
  brand,
  customer,
  plan,
  discoveryRun = null,
  candidates = [],
  confirmedPrompts = [],
  seedCount = 0,
  includeOperator = false,
  generatedAt = new Date().toISOString()
}) {
  const planLimit = toNumber(plan.monthly_prompt_limit);
  const selectedCandidateIds = candidates
    .filter((candidate) => ['shortlisted', 'approved', 'edited'].includes(candidate.status))
    .map((candidate) => candidate.id || candidate.candidate_key);
  const candidateItems = candidates.map((candidate) => (includeOperator ? candidateToOperator(candidate) : candidateToCustomer(candidate)));
  const ready = readiness({
    seedCount,
    candidateCount: candidates.length,
    confirmedPromptCount: confirmedPrompts.length,
    selectedCount: selectedCandidateIds.length,
    planLimit
  });

  return {
    schema_version: includeOperator ? OPERATOR_PROMPT_DISCOVERY_SCHEMA_VERSION : PROMPT_DISCOVERY_SCHEMA_VERSION,
    generated_at: generatedAt,
    brand: {
      id: brand.id,
      name: brand.name,
      website_url: brand.website_url,
      vertical: brand.vertical,
      locale: brand.locale,
      market: brand.market || null
    },
    customer: customer
      ? {
          id: customer.id,
          external_customer_id: customer.external_customer_id,
          email: customer.email,
          status: customer.status,
          plan_code: customer.plan_code
        }
      : null,
    plan: {
      id: plan.id,
      name: plan.name,
      prompt_limit: planLimit
    },
    readiness: ready,
    discovery_run: discoveryRun
      ? {
          id: discoveryRun.id,
          status: discoveryRun.status,
          run_type: discoveryRun.run_type,
          provider_mode: discoveryRun.provider_mode,
          source_mode: discoveryRun.source_mode,
          started_at: discoveryRun.started_at || null,
          finished_at: discoveryRun.finished_at || null
        }
      : null,
    evidence_collection: buildEvidenceCollectionSummary(discoveryRun),
    quota: {
      confirmed_prompt_count: confirmedPrompts.length,
      plan_prompt_limit: planLimit,
      remaining_prompt_slots: Math.max(planLimit - confirmedPrompts.length, 0),
      selected_candidate_count: selectedCandidateIds.length,
      candidate_generation_counts_quota: false,
      candidate_selection_counts_quota: false,
      confirmation_counts_quota: true,
      quota_impact_per_candidate: 1
    },
    groups: groupCandidates(candidates),
    prompt_library: buildPromptLibrary({ brand, candidates, confirmedPrompts, seedCount }),
    candidates: candidateItems,
    selected_candidate_ids: selectedCandidateIds,
    confirmed_prompts: confirmedPrompts.map((prompt) => ({
      id: prompt.id,
      prompt_text: prompt.prompt_text,
      category: prompt.category,
      status: prompt.status,
      quota_unit: toNumber(prompt.quota_unit, 1)
    })),
    warnings: ready.warnings,
    allowed_actions: includeOperator
      ? ['review_candidates', 'approve', 'reject', 'edit', 'replace', 'confirm', 'block_confirmation', 'override_quota']
      : ['review_candidates', 'shortlist', 'edit', 'reject', 'confirm']
  };
}

async function resolveBrandId({ brand_id, brand_name } = {}) {
  if (brand_id) return brand_id;
  if (brand_name) {
    const result = await pool.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1) LIMIT 1', [brand_name]);
    if (result.rowCount) return result.rows[0].id;
    return null;
  }
  const result = await pool.query('SELECT id FROM brands ORDER BY created_at ASC LIMIT 1');
  return result.rows[0]?.id || null;
}

async function resolveCustomerVisibleBrandId({ brand_id, brand_name } = {}) {
  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (brand_id) {
    values.push(brand_id);
    filters.push(`b.id = $${values.length}`);
  }
  if (brand_name) {
    values.push(brand_name);
    filters.push(`LOWER(b.name) = LOWER($${values.length})`);
  }
  const result = await pool.query(
    `SELECT b.id
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE ${filters.join(' AND ')}
     ORDER BY b.created_at ASC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

async function loadPromptDiscoveryContext(options = {}) {
  const customerVisibleOnly = options.customer_visible_only === true;
  const brandId = customerVisibleOnly
    ? await resolveCustomerVisibleBrandId(options)
    : await resolveBrandId(options);
  if (!brandId) return null;

  const brandResult = await pool.query(
    `SELECT b.*, c.id AS customer_id, c.external_customer_id, c.email, c.plan_code, c.status AS customer_status
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE b.id = $1
       ${customerVisibleOnly ? `AND ${customerVisibleTenantPredicate('c')}` : ''}`,
    [brandId]
  );
  if (!brandResult.rowCount) return null;
  const brand = brandResult.rows[0];

  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [brand.plan_code]);
  if (!planResult.rowCount) return null;

  const promptSetResult = await pool.query(
    `SELECT *
     FROM prompt_sets
     WHERE brand_id = $1 AND status = 'active'
     ORDER BY version_number DESC, created_at DESC
     LIMIT 1`,
    [brandId]
  );
  const promptSet = promptSetResult.rows[0] || null;

  const [competitorResult, promptResult, taxonomyResult, opportunityResult] = await Promise.all([
    pool.query('SELECT * FROM competitors WHERE brand_id = $1 ORDER BY created_at ASC', [brandId]),
    promptSet
      ? pool.query(
          `SELECT *
           FROM prompts
           WHERE prompt_set_id = $1 AND COALESCE(status, 'active') = 'active'
           ORDER BY priority DESC, created_at ASC`,
          [promptSet.id]
        )
      : { rows: [] },
    pool.query('SELECT * FROM prompt_taxonomy ORDER BY id ASC'),
    pool.query(
      `SELECT *
       FROM content_opportunities
       WHERE brand_id = $1 AND status IN ('proposed', 'briefed')
       ORDER BY created_at DESC
       LIMIT 8`,
      [brandId]
    )
  ]);

  return {
    brand,
    customer: {
      id: brand.customer_id,
      external_customer_id: brand.external_customer_id,
      email: brand.email,
      plan_code: brand.plan_code,
      status: brand.customer_status
    },
    plan: planResult.rows[0],
    competitors: competitorResult.rows,
    promptSet,
    prompts: promptResult.rows,
    promptTaxonomy: taxonomyResult.rows,
    opportunities: opportunityResult.rows
  };
}

async function upsertTopic(client, brandId, topic) {
  const result = await client.query(
    `INSERT INTO prompt_topics (brand_id, name, slug, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (brand_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       status = 'active',
       updated_at = NOW()
     RETURNING id, name, slug`,
    [brandId, topic.name, topic.slug]
  );
  return result.rows[0];
}

async function upsertTag(client, brandId, tag) {
  const result = await client.query(
    `INSERT INTO prompt_tags (brand_id, tag_type, name, slug, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (brand_id, tag_type, slug) DO UPDATE SET
       name = EXCLUDED.name,
       status = 'active'
     RETURNING id, tag_type, name, slug`,
    [brandId, tag.tag_type, tag.name, tag.slug]
  );
  return result.rows[0];
}

async function loadCandidatesForRun(discoveryRunId, includeOperator = false) {
  const candidateResult = await pool.query(
    `SELECT pc.*,
            pt.name AS topic_name,
            pt.slug AS topic_slug,
            pcs.commercial_value_score,
            pcs.competitor_relevance_score,
            pcs.insight_value_score,
            pcs.tracking_value_score,
            pcs.gap_severity_score,
            pcs.source_opportunity_score,
            pcs.volume_signal_score,
            pcs.duplicate_penalty,
            pcs.priority_score,
            pcs.score_payload,
            pcs.score_version,
            pcs_src.source_type,
            pcs_src.source_ref_id,
            pcs_src.source_payload,
            pcs_src.source_confidence
     FROM prompt_candidates pc
     LEFT JOIN prompt_topics pt ON pt.id = pc.topic_id
     LEFT JOIN LATERAL (
       SELECT *
       FROM prompt_candidate_scores score
       WHERE score.prompt_candidate_id = pc.id
       ORDER BY score.created_at DESC
       LIMIT 1
     ) pcs ON true
     LEFT JOIN prompt_candidate_sources pcs_src ON pcs_src.id = pc.primary_source_id
     WHERE pc.discovery_run_id = $1
     ORDER BY pcs.priority_score DESC NULLS LAST, pc.created_at ASC`,
    [discoveryRunId]
  );
  const ids = candidateResult.rows.map((row) => row.id);
  const tagResult = ids.length
    ? await pool.query(
        `SELECT link.prompt_candidate_id, tag.tag_type, tag.name, tag.slug
         FROM prompt_candidate_tag_links link
         JOIN prompt_tags tag ON tag.id = link.tag_id
         WHERE link.prompt_candidate_id = ANY($1)`,
        [ids]
      )
    : { rows: [] };
  const eventResult =
    includeOperator && ids.length
      ? await pool.query(
          `SELECT prompt_candidate_id, prompt_id, event_type, actor_type, actor_id, event_payload, created_at
           FROM prompt_selection_events
           WHERE prompt_candidate_id = ANY($1)
           ORDER BY created_at ASC`,
          [ids]
        )
      : { rows: [] };
  const gapResult =
    includeOperator && ids.length
      ? await pool.query(
          `SELECT prompt_candidate_id,
                  jsonb_agg(
                    jsonb_build_object(
                      'id', id,
                      'competitor_id', competitor_id,
                      'gap_type', gap_type,
                      'gap_label', gap_label,
                      'gap_payload', gap_payload,
                      'severity_score', severity_score,
                      'status', status,
                      'created_at', created_at
                    )
                    ORDER BY severity_score DESC, created_at DESC
                  ) AS gaps
           FROM competitor_prompt_gaps
           WHERE prompt_candidate_id = ANY($1)
           GROUP BY prompt_candidate_id`,
          [ids]
        )
      : { rows: [] };
  const tagMap = new Map();
  for (const row of tagResult.rows) {
    const tags = tagMap.get(row.prompt_candidate_id) || [];
    tags.push({ tag_type: row.tag_type, name: row.name, slug: row.slug });
    tagMap.set(row.prompt_candidate_id, tags);
  }
  const eventMap = new Map();
  for (const row of eventResult.rows) {
    const events = eventMap.get(row.prompt_candidate_id) || [];
    events.push({
      prompt_id: row.prompt_id,
      event_type: row.event_type,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      event_payload: row.event_payload || {},
      created_at: row.created_at
    });
    eventMap.set(row.prompt_candidate_id, events);
  }
  const gapMap = new Map(gapResult.rows.map((row) => [row.prompt_candidate_id, { gaps: row.gaps || [] }]));

  return candidateResult.rows.map((row, index) => {
    const score = {
      score_version: row.score_version || CANDIDATE_SCORE_VERSION,
      commercial_value_score: toNumber(row.commercial_value_score),
      competitor_relevance_score: toNumber(row.competitor_relevance_score),
      insight_value_score: toNumber(row.insight_value_score),
      tracking_value_score: toNumber(row.tracking_value_score),
      gap_severity_score: toNumber(row.gap_severity_score),
      source_opportunity_score: toNumber(row.source_opportunity_score),
      volume_signal_score: toNumber(row.volume_signal_score),
      duplicate_penalty: toNumber(row.duplicate_penalty),
      priority_score: toNumber(row.priority_score)
    };
    const operatorBlockers = [];
    const sourceConfidence = row.source_confidence == null ? null : toNumber(row.source_confidence);
    if (toNumber(row.duplicate_risk) >= 70) operatorBlockers.push('duplicate_risk_high');
    if (sourceConfidence !== null && sourceConfidence < 0.7) operatorBlockers.push('source_confidence_low');
    if (score.priority_score < 55) operatorBlockers.push('priority_score_low');
    if (row.status === 'rejected') operatorBlockers.push('customer_rejected');
    if (row.status === 'archived') operatorBlockers.push('candidate_archived');
    return {
      id: row.id,
      candidate_key: row.duplicate_key,
      candidate_text: row.candidate_text,
      normalized_text: row.normalized_text,
      language: row.language,
      market: row.market,
      topic: { id: row.topic_id, name: row.topic_name, slug: row.topic_slug },
      tags: tagMap.get(row.id) || [],
      intent: row.intent,
      funnel_stage: row.funnel_stage,
      gap_type: row.gap_type,
      group_id: groupForIntent(row.intent),
      provenance: row.provenance,
      recommendation_reason: row.recommendation_reason,
      source: {
        source_type: row.source_type,
        source_ref_id: row.source_ref_id,
        source_payload: row.source_payload || {},
        source_confidence: sourceConfidence
      },
      source_label: sourceLabel(row.source_type),
      quota_impact: row.quota_impact,
      duplicate_key: row.duplicate_key,
      duplicate_risk: toNumber(row.duplicate_risk),
      status: row.status,
      score,
      priority_band: priorityBand(score.priority_score),
      rank: index + 1,
      gap_payload: includeOperator ? gapMap.get(row.id) || { gaps: [] } : {},
      selection_events: includeOperator ? eventMap.get(row.id) || [] : [],
      operator_blockers: includeOperator ? operatorBlockers : [],
      allowed_actions: ['shortlist', 'edit', 'reject', 'details']
    };
  });
}

async function loadConfirmedPrompts(brandId) {
  const result = await pool.query(
    `SELECT p.*
     FROM prompts p
     JOIN prompt_sets ps ON ps.id = p.prompt_set_id
     WHERE ps.brand_id = $1
       AND COALESCE(p.status, 'active') = 'active'
       AND p.confirmed_from_candidate_id IS NOT NULL
     ORDER BY p.created_at ASC`,
    [brandId]
  );
  return result.rows;
}

export async function createPromptDiscoveryRun(options = {}) {
  assertProviderConfigured('fixture');
  const context = await loadPromptDiscoveryContext(options);
  if (!context) return null;

  const idempotencyKey =
    options.idempotency_key ||
    `prompt-discovery-mvp:${context.brand.id}:${stableKey([
      context.brand.updated_at?.toISOString?.() || context.brand.updated_at || '',
      context.prompts.length,
      context.competitors.length,
      context.opportunities.length
    ])}`;

  const existing = await pool.query('SELECT * FROM prompt_discovery_runs WHERE idempotency_key = $1', [idempotencyKey]);
  if (existing.rowCount) {
    return getPromptDiscoveryPayload({ discovery_run_id: existing.rows[0].id, includeOperator: options.includeOperator });
  }

  const candidates = buildDeterministicPromptCandidates(context);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `INSERT INTO prompt_discovery_runs (
        brand_id, customer_id, status, run_type, provider_mode, source_mode,
        input_payload, summary_payload, idempotency_key, started_at, finished_at
      )
      VALUES ($1, $2, 'completed', $3, 'fixture', $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        context.brand.id,
        context.customer.id,
        options.run_type || 'initial_setup',
        options.source_mode || 'seed_plus_existing_results',
        JSON.stringify({
          prompt_count: context.prompts.length,
          competitor_count: context.competitors.length,
          taxonomy_count: context.promptTaxonomy.length,
          opportunity_count: context.opportunities.length
        }),
        JSON.stringify({
          candidate_count: candidates.length,
          generator: PROMPT_DISCOVERY_SCHEMA_VERSION,
          paid_provider_call_executed: false
        }),
        idempotencyKey
      ]
    );
    const run = runResult.rows[0];

    for (const candidate of candidates) {
      const topic = await upsertTopic(client, context.brand.id, candidate.topic);
      const sourceResult = await client.query(
        `INSERT INTO prompt_candidate_sources (
          brand_id, discovery_run_id, source_type, source_ref_id, source_payload, source_confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          context.brand.id,
          run.id,
          candidate.source.source_type,
          candidate.source.source_ref_id,
          JSON.stringify(candidate.source.source_payload),
          candidate.source.source_confidence
        ]
      );
      const insertedCandidate = await client.query(
        `INSERT INTO prompt_candidates (
          brand_id, discovery_run_id, primary_source_id, topic_id, candidate_text, normalized_text,
          language, market, intent, funnel_stage, gap_type, provenance, recommendation_reason,
          quota_impact, duplicate_key, duplicate_risk, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15, 'suggested', $16)
        RETURNING id`,
        [
          context.brand.id,
          run.id,
          sourceResult.rows[0].id,
          topic.id,
          candidate.candidate_text,
          candidate.normalized_text,
          candidate.language,
          candidate.market,
          candidate.intent,
          candidate.funnel_stage,
          candidate.gap_type,
          candidate.provenance,
          candidate.recommendation_reason,
          candidate.duplicate_key,
          candidate.duplicate_risk,
          candidate.created_by
        ]
      );
      const candidateId = insertedCandidate.rows[0].id;
      for (const tag of candidate.tags) {
        const insertedTag = await upsertTag(client, context.brand.id, tag);
        await client.query(
          `INSERT INTO prompt_candidate_tag_links (prompt_candidate_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT (prompt_candidate_id, tag_id) DO NOTHING`,
          [candidateId, insertedTag.id]
        );
      }
      await client.query(
        `INSERT INTO prompt_candidate_scores (
          prompt_candidate_id, score_version, commercial_value_score, competitor_relevance_score,
          insight_value_score, tracking_value_score, gap_severity_score, source_opportunity_score,
          volume_signal_score, duplicate_penalty, priority_score, score_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          candidateId,
          candidate.score.score_version,
          candidate.score.commercial_value_score,
          candidate.score.competitor_relevance_score,
          candidate.score.insight_value_score,
          candidate.score.tracking_value_score,
          candidate.score.gap_severity_score,
          candidate.score.source_opportunity_score,
          candidate.score.volume_signal_score,
          candidate.score.duplicate_penalty,
          candidate.score.priority_score,
          JSON.stringify({
            candidate_key: candidate.candidate_key,
            rank: candidate.rank,
            formula: CANDIDATE_SCORE_VERSION
          })
        ]
      );
      if (candidate.source.source_type === 'competitor_gap') {
        await client.query(
          `INSERT INTO competitor_prompt_gaps (
            brand_id, competitor_id, topic_id, prompt_candidate_id, gap_type, gap_label,
            gap_payload, severity_score, status
          )
          VALUES ($1, $2, $3, $4, 'competitor_mentioned_brand_missing', $5, $6, $7, 'candidate_created')`,
          [
            context.brand.id,
            candidate.source.source_payload.competitor_id || null,
            topic.id,
            candidateId,
            candidate.recommendation_reason,
            JSON.stringify(candidate.source.source_payload),
            candidate.score.gap_severity_score
          ]
        );
      }
    }

    await client.query('COMMIT');
    return getPromptDiscoveryPayload({ discovery_run_id: run.id, includeOperator: options.includeOperator });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createMinimaxPromptDiscoveryRun(options = {}) {
  const context = await loadPromptDiscoveryContext(options);
  if (!context) return null;

  const candidateCount = Math.max(5, Math.min(Number(options.candidate_count) || 20, 40));
  const idempotencyKey =
    options.idempotency_key ||
    `minimax-prompt-discovery:${context.brand.id}:${Date.now()}:${stableKey([
      context.brand.website_url,
      context.prompts.length,
      context.competitors.length,
      candidateCount
    ])}`;

  const existing = await pool.query('SELECT * FROM prompt_discovery_runs WHERE idempotency_key = $1', [idempotencyKey]);
  if (existing.rowCount) {
    return getPromptDiscoveryPayload({ discovery_run_id: existing.rows[0].id, includeOperator: options.includeOperator });
  }

  const config = options.config || getConfig();
  const client = await pool.connect();
  let run = null;
  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `INSERT INTO prompt_discovery_runs (
        brand_id, customer_id, status, run_type, provider_mode, source_mode,
        input_payload, summary_payload, idempotency_key, started_at
      )
      VALUES ($1, $2, 'running', $3, 'minimax', 'full_available_context', $4, $5, $6, NOW())
      RETURNING *`,
      [
        context.brand.id,
        context.customer.id,
        options.run_type || 'operator_refresh',
        JSON.stringify({
          generator: 'minimax_prompt_discovery',
          model: config.minimaxModel,
          candidate_count: candidateCount,
          prompt_count: context.prompts.length,
          competitor_count: context.competitors.length,
          website_url: context.brand.website_url
        }),
        JSON.stringify({
          generator: 'minimax_prompt_discovery',
          status: 'running',
          paid_openrouter_call_executed: false
        }),
        idempotencyKey
      ]
    );
    run = runResult.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    const websiteEvidence = await fetchWebsiteEvidence(context.brand.website_url, {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.website_timeout_ms || 12000
    });
    const modelResult = options.modelResult || (await callMinimaxPromptDiscovery({
      context,
      websiteEvidence,
      candidateCount,
      config,
      fetchImpl: options.fetchImpl
    }));
    const candidates = buildCandidatesFromModelOutput({
      context,
      modelPayload: modelResult.raw_payload,
      websiteEvidence,
      model: config.minimaxModel
    }).slice(0, candidateCount);

    if (!candidates.length) {
      throw new Error('minimax_prompt_discovery_no_valid_candidates');
    }

    const writeClient = await pool.connect();
    try {
      await writeClient.query('BEGIN');
      for (const candidate of candidates) {
        const topic = await upsertTopic(writeClient, context.brand.id, candidate.topic);
        const sourceResult = await writeClient.query(
          `INSERT INTO prompt_candidate_sources (
            brand_id, discovery_run_id, source_type, source_ref_id, source_payload, source_confidence
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
          [
            context.brand.id,
            run.id,
            candidate.source.source_type,
            candidate.source.source_ref_id,
            JSON.stringify(candidate.source.source_payload),
            candidate.source.source_confidence
          ]
        );
        const insertedCandidate = await writeClient.query(
          `INSERT INTO prompt_candidates (
            brand_id, discovery_run_id, primary_source_id, topic_id, candidate_text, normalized_text,
            language, market, intent, funnel_stage, gap_type, provenance, recommendation_reason,
            quota_impact, duplicate_key, duplicate_risk, status, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'model_inferred', $12, 1, $13, $14, 'suggested', $15)
          RETURNING id`,
          [
            context.brand.id,
            run.id,
            sourceResult.rows[0].id,
            topic.id,
            candidate.candidate_text,
            candidate.normalized_text,
            candidate.language,
            candidate.market,
            candidate.intent,
            candidate.funnel_stage,
            candidate.gap_type,
            candidate.recommendation_reason,
            candidate.duplicate_key,
            candidate.duplicate_risk,
            candidate.created_by
          ]
        );
        const candidateId = insertedCandidate.rows[0].id;
        for (const tag of candidate.tags) {
          const insertedTag = await upsertTag(writeClient, context.brand.id, tag);
          await writeClient.query(
            `INSERT INTO prompt_candidate_tag_links (prompt_candidate_id, tag_id)
             VALUES ($1, $2)
             ON CONFLICT (prompt_candidate_id, tag_id) DO NOTHING`,
            [candidateId, insertedTag.id]
          );
        }
        await writeClient.query(
          `INSERT INTO prompt_candidate_scores (
            prompt_candidate_id, score_version, commercial_value_score, competitor_relevance_score,
            insight_value_score, tracking_value_score, gap_severity_score, source_opportunity_score,
            volume_signal_score, duplicate_penalty, priority_score, score_payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            candidateId,
            candidate.score.score_version,
            candidate.score.commercial_value_score,
            candidate.score.competitor_relevance_score,
            candidate.score.insight_value_score,
            candidate.score.tracking_value_score,
            candidate.score.gap_severity_score,
            candidate.score.source_opportunity_score,
            candidate.score.volume_signal_score,
            candidate.score.duplicate_penalty,
            candidate.score.priority_score,
            JSON.stringify({
              candidate_key: candidate.candidate_key,
              rank: candidate.rank,
              formula: CANDIDATE_SCORE_VERSION,
              generator: 'minimax_prompt_discovery',
              provider_response_id: modelResult.provider_response_id,
              usage: modelResult.usage || {}
            })
          ]
        );
      }
      await writeClient.query(
        `UPDATE prompt_discovery_runs
         SET status = 'completed',
             summary_payload = $2,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          run.id,
          JSON.stringify({
            generator: 'minimax_prompt_discovery',
            model: config.minimaxModel,
            candidate_count: candidates.length,
            website_fetch_ok: websiteEvidence.ok,
            website_fetch_error: websiteEvidence.error,
            paid_openrouter_call_executed: false,
            provider_response_id_present: Boolean(modelResult.provider_response_id),
            usage: modelResult.usage || {}
          })
        ]
      );
      await writeClient.query('COMMIT');
    } catch (error) {
      await writeClient.query('ROLLBACK');
      throw error;
    } finally {
      writeClient.release();
    }
    return getPromptDiscoveryPayload({ discovery_run_id: run.id, includeOperator: options.includeOperator });
  } catch (error) {
    await pool.query(
      `UPDATE prompt_discovery_runs
       SET status = 'failed',
           error_code = $2,
           error_message = $3,
           summary_payload = jsonb_set(summary_payload, '{status}', '"failed"', true),
           finished_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [run.id, error.code || error.message || 'minimax_prompt_discovery_failed', error.message || String(error)]
    );
    throw error;
  }
}

export async function createEvidenceBackedPromptDiscoveryRun(options = {}) {
  const context = await loadPromptDiscoveryContext(options);
  if (!context) return null;

  const config = options.config || getConfig();
  const candidateCount = Math.max(8, Math.min(Number(options.candidate_count) || 24, 40));
  const rawEvidenceCollectionEnabled = Boolean(options.raw_evidence_collection);
  const providerMode = rawEvidenceCollectionEnabled ? 'multi_source_evidence' : 'openrouter_web_search';
  const generator = rawEvidenceCollectionEnabled
    ? 'multi_source_raw_evidence_prompt_discovery'
    : 'openrouter_evidence_backed_prompt_discovery';
  const queries = options.queries?.length
    ? options.queries.slice(0, 16)
    : rawEvidenceCollectionEnabled
      ? buildMarketEvidenceQueries(context, 16)
      : evidenceSeedQueries(context);
  const idempotencyKey =
    options.idempotency_key ||
    `${providerMode}-prompt-discovery:${context.brand.id}:${Date.now()}:${stableKey([
      context.brand.website_url,
      queries.join('~'),
      candidateCount
    ])}`;

  const existing = await pool.query('SELECT * FROM prompt_discovery_runs WHERE idempotency_key = $1', [idempotencyKey]);
  if (existing.rowCount) {
    return getPromptDiscoveryPayload({ discovery_run_id: existing.rows[0].id, includeOperator: options.includeOperator });
  }

  const client = await pool.connect();
  let run = null;
  let evidenceRun = null;
  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `INSERT INTO prompt_discovery_runs (
        brand_id, customer_id, status, run_type, provider_mode, source_mode,
        input_payload, summary_payload, idempotency_key, started_at
      )
      VALUES ($1, $2, 'running', $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *`,
      [
        context.brand.id,
        context.customer.id,
        options.run_type || 'operator_refresh',
        providerMode,
        rawEvidenceCollectionEnabled ? 'raw_market_evidence' : 'full_available_context',
        JSON.stringify({
          generator,
          model: config.openrouterEvidenceModel,
          candidate_count: candidateCount,
          seed_queries: queries,
          prompt_count: context.prompts.length,
          competitor_count: context.competitors.length,
          raw_evidence_collection: rawEvidenceCollectionEnabled
        }),
        JSON.stringify({
          generator,
          status: 'running',
          paid_provider_call_executed: true
        }),
        idempotencyKey
      ]
    );
    run = runResult.rows[0];
    const evidenceRunResult = await client.query(
      `INSERT INTO prompt_evidence_runs (
        brand_id, prompt_discovery_run_id, provider_mode, status, query_payload, summary_payload, started_at
      )
      VALUES ($1, $2, $3, 'running', $4, $5, NOW())
      RETURNING *`,
      [
        context.brand.id,
        run.id,
        providerMode,
        JSON.stringify({ seed_queries: queries, candidate_count: candidateCount }),
        JSON.stringify({ status: 'running', generator })
      ]
    );
    evidenceRun = evidenceRunResult.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    const rawEvidenceCollection = rawEvidenceCollectionEnabled
      ? await collectRawPromptEvidence({
          context,
          config,
          queries,
          fetchImpl: options.fetchImpl,
          includeOpenRouterSurface: options.include_openrouter_ai_surface !== false
        })
      : null;
    const rawEvidenceItems = rawEvidenceCollection?.items || [];
    const modelResult = options.modelResult || (await callOpenRouterEvidenceDiscovery({
      context,
      queries,
      candidateCount,
      config,
      fetchImpl: options.fetchImpl,
      rawEvidenceItems,
      useWebSearch: options.use_web_search === true || !rawEvidenceItems.length
    }));
    const evidenceItems = rawEvidenceItems.length ? rawEvidenceItems : normalizeEvidenceItems(modelResult.raw_payload?.evidence_items || [], context);
    if (!evidenceItems.length) {
      throw new Error('evidence_prompt_discovery_no_evidence_items');
    }
    const candidates = buildCandidatesFromEvidenceOutput({
      context,
      modelPayload: modelResult.raw_payload,
      evidenceItems,
      model: config.openrouterEvidenceModel
    }).slice(0, candidateCount);
    if (!candidates.length) {
      throw new Error('evidence_prompt_discovery_no_valid_candidates');
    }

    const writeClient = await pool.connect();
    const evidenceIdByHash = new Map();
    try {
      await writeClient.query('BEGIN');
      for (const evidence of evidenceItems) {
        const insertedEvidence = await writeClient.query(
          `INSERT INTO prompt_evidence_items (
            evidence_run_id, brand_id, source_type, source_url, source_domain, query_text,
            evidence_text, title, market, language, confidence, evidence_payload, evidence_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id`,
          [
            evidenceRun.id,
            context.brand.id,
            evidence.source_type,
            evidence.source_url,
            evidence.source_domain,
            evidence.query_text,
            evidence.evidence_text,
            evidence.title,
            evidence.market,
            evidence.language,
            evidence.confidence,
            JSON.stringify(evidence.evidence_payload),
            evidence.evidence_hash
          ]
        );
        evidenceIdByHash.set(evidence.evidence_hash, insertedEvidence.rows[0].id);
      }

      for (const candidate of candidates) {
        const topic = await upsertTopic(writeClient, context.brand.id, candidate.topic);
        const sourceResult = await writeClient.query(
          `INSERT INTO prompt_candidate_sources (
            brand_id, discovery_run_id, source_type, source_ref_id, source_payload, source_confidence
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
          [
            context.brand.id,
            run.id,
            candidate.source.source_type,
            candidate.source.source_ref_id,
            JSON.stringify(candidate.source.source_payload),
            candidate.source.source_confidence
          ]
        );
        const insertedCandidate = await writeClient.query(
          `INSERT INTO prompt_candidates (
            brand_id, discovery_run_id, primary_source_id, topic_id, candidate_text, normalized_text,
            language, market, intent, funnel_stage, gap_type, provenance, recommendation_reason,
            quota_impact, duplicate_key, duplicate_risk, status, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'model_inferred', $12, 1, $13, $14, 'suggested', $15)
          RETURNING id`,
          [
            context.brand.id,
            run.id,
            sourceResult.rows[0].id,
            topic.id,
            candidate.candidate_text,
            candidate.normalized_text,
            candidate.language,
            candidate.market,
            candidate.intent,
            candidate.funnel_stage,
            candidate.gap_type,
            candidate.recommendation_reason,
            candidate.duplicate_key,
            candidate.duplicate_risk,
            candidate.created_by
          ]
        );
        const candidateId = insertedCandidate.rows[0].id;
        for (const tag of candidate.tags) {
          const insertedTag = await upsertTag(writeClient, context.brand.id, tag);
          await writeClient.query(
            `INSERT INTO prompt_candidate_tag_links (prompt_candidate_id, tag_id)
             VALUES ($1, $2)
             ON CONFLICT (prompt_candidate_id, tag_id) DO NOTHING`,
            [candidateId, insertedTag.id]
          );
        }
        for (const [index, hash] of (candidate.source.source_payload.evidence_hashes || []).entries()) {
          const evidenceId = evidenceIdByHash.get(hash);
          if (!evidenceId) continue;
          await writeClient.query(
            `INSERT INTO prompt_evidence_candidate_links (
              prompt_candidate_id, prompt_evidence_item_id, link_role, confidence
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (prompt_candidate_id, prompt_evidence_item_id) DO NOTHING`,
            [candidateId, evidenceId, index === 0 ? 'primary' : 'supporting', candidate.source.source_confidence]
          );
        }
        await writeClient.query(
          `INSERT INTO prompt_candidate_scores (
            prompt_candidate_id, score_version, commercial_value_score, competitor_relevance_score,
            insight_value_score, tracking_value_score, gap_severity_score, source_opportunity_score,
            volume_signal_score, duplicate_penalty, priority_score, score_payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            candidateId,
            candidate.score.score_version,
            candidate.score.commercial_value_score,
            candidate.score.competitor_relevance_score,
            candidate.score.insight_value_score,
            candidate.score.tracking_value_score,
            candidate.score.gap_severity_score,
            candidate.score.source_opportunity_score,
            candidate.score.volume_signal_score,
            candidate.score.duplicate_penalty,
            candidate.score.priority_score,
            JSON.stringify({
              candidate_key: candidate.candidate_key,
              rank: candidate.rank,
              formula: CANDIDATE_SCORE_VERSION,
              generator: 'openrouter_evidence_backed_prompt_discovery',
              raw_evidence_collection: Boolean(rawEvidenceCollection),
              provider_response_id: modelResult.provider_response_id,
              usage: modelResult.usage || {}
            })
          ]
        );
      }

      await writeClient.query(
        `UPDATE prompt_evidence_runs
         SET status = 'completed',
             summary_payload = $2,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          evidenceRun.id,
          JSON.stringify({
            generator,
            evidence_item_count: evidenceItems.length,
            candidate_count: candidates.length,
            provider_runs: rawEvidenceCollection?.provider_runs || [],
            provider_response_id_present: Boolean(modelResult.provider_response_id),
            usage: modelResult.usage || {}
          })
        ]
      );
      await writeClient.query(
        `UPDATE prompt_discovery_runs
         SET status = 'completed',
             summary_payload = $2,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          run.id,
          JSON.stringify({
            generator,
            model: config.openrouterEvidenceModel,
            evidence_run_id: evidenceRun.id,
            evidence_item_count: evidenceItems.length,
            candidate_count: candidates.length,
            provider_runs: rawEvidenceCollection?.provider_runs || [],
            raw_evidence_collection: Boolean(rawEvidenceCollection),
            paid_provider_call_executed: true,
            provider_response_id_present: Boolean(modelResult.provider_response_id),
            usage: modelResult.usage || {}
          })
        ]
      );
      await writeClient.query('COMMIT');
    } catch (error) {
      await writeClient.query('ROLLBACK');
      throw error;
    } finally {
      writeClient.release();
    }
    return getPromptDiscoveryPayload({ discovery_run_id: run.id, includeOperator: options.includeOperator });
  } catch (error) {
    await pool.query(
      `UPDATE prompt_discovery_runs
       SET status = 'failed',
           error_code = $2,
           error_message = $3,
           summary_payload = jsonb_set(summary_payload, '{status}', '"failed"', true),
           finished_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [run.id, error.code || error.message || 'evidence_prompt_discovery_failed', error.message || String(error)]
    );
    await pool.query(
      `UPDATE prompt_evidence_runs
       SET status = 'failed',
           error_code = $2,
           error_message = $3,
           summary_payload = jsonb_set(summary_payload, '{status}', '"failed"', true),
           finished_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [evidenceRun.id, error.code || error.message || 'evidence_prompt_discovery_failed', error.message || String(error)]
    );
    throw error;
  }
}

export async function createMultiSourcePromptDiscoveryRun(options = {}) {
  return createEvidenceBackedPromptDiscoveryRun({
    ...options,
    raw_evidence_collection: true,
    use_web_search: options.use_web_search === true
  });
}

export async function getPromptDiscoveryPayload(options = {}) {
  const includeOperator = Boolean(options.includeOperator);
  const customerVisibleOnly = options.customer_visible_only === true;
  let run = null;
  if (options.discovery_run_id) {
    const runResult = await pool.query(
      `SELECT pdr.*
       FROM prompt_discovery_runs pdr
       JOIN brands b ON b.id = pdr.brand_id
       JOIN customers c ON c.id = b.customer_id
       WHERE pdr.id = $1
         ${customerVisibleOnly ? `AND ${customerVisibleTenantPredicate('c')}` : ''}`,
      [options.discovery_run_id]
    );
    run = runResult.rows[0] || null;
    if (!run) return null;
  }
  if (!run) {
    const brandId = customerVisibleOnly ? await resolveCustomerVisibleBrandId(options) : await resolveBrandId(options);
    if (!brandId) return null;
    const runResult = await pool.query(
      `SELECT *
       FROM prompt_discovery_runs
       WHERE brand_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [brandId]
    );
    run = runResult.rows[0] || null;
  }
  if (!run) return null;

  const context = await loadPromptDiscoveryContext({
    brand_id: run.brand_id,
    customer_visible_only: customerVisibleOnly
  });
  if (!context) return null;

  const [candidates, confirmedPrompts, seedResult] = await Promise.all([
    loadCandidatesForRun(run.id, includeOperator),
    loadConfirmedPrompts(run.brand_id),
    pool.query('SELECT COUNT(*)::int AS count FROM prompt_seeds WHERE brand_id = $1 AND status = $2', [run.brand_id, 'active'])
  ]);
  const seedCount = Math.max(toNumber(seedResult.rows[0]?.count), context.prompts.length + context.competitors.length);

  return buildPromptDiscoveryPayload({
    brand: context.brand,
    customer: context.customer,
    plan: context.plan,
    discoveryRun: run,
    candidates,
    confirmedPrompts,
    seedCount,
    includeOperator
  });
}
