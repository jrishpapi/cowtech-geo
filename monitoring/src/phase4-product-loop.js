import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const PHASE4_SCHEMA_VERSION = 'phase4-georankhub-parity-loop-v1';
export const PAGE_READINESS_WEIGHTS = Object.freeze({
  schema: 30,
  content: 30,
  meta: 20,
  citation: 20
});
export const PROMPT_DIMENSIONS = Object.freeze([
  'brand_awareness',
  'category_recommendation',
  'problem_solution',
  'competitor_comparison',
  'purchase_intent',
  'alternative_search',
  'source_seeking',
  'geo_language'
]);
export const PHASE4_ARTIFACT_TYPES = Object.freeze([
  'json_ld',
  'llms_txt',
  'geo_title_pack',
  'knowledge_base_draft'
]);

const REAL_METRIC_PROVIDERS = new Set([
  'gsc',
  'dataforseo',
  'serp',
  'aivgl_observation',
  'site_coverage',
  'competitor_gap'
]);
const PRIVATE_HOSTS = new Set(['localhost', 'localhost.localdomain']);
const REVIEW_STATES = new Set(['needs_review', 'approved', 'rejected']);
const ARTIFACT_TRANSITIONS = Object.freeze({
  generated: ['validated'],
  validated: ['approved'],
  approved: ['published_dry_run'],
  published_dry_run: ['retest_handoff'],
  retest_handoff: []
});

function sha256(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function compactText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&(?:nbsp|amp|quot|#39);/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function textBetween(html, expression) {
  return expression.exec(String(html || ''))?.[1]?.replace(/\s+/gu, ' ').trim() || null;
}

function sourceLocation(html, needle) {
  if (!needle) return null;
  const offset = String(html || '').toLowerCase().indexOf(String(needle).toLowerCase());
  if (offset < 0) return null;
  return {
    byte_offset: offset,
    line: String(html || '').slice(0, offset).split(/\r?\n/u).length
  };
}

function evidence({ rule, passed, category, weight, message, value, html, needle, locale }) {
  return {
    rule,
    passed,
    category,
    weight,
    message,
    value: value ?? null,
    source: {
      type: 'deterministic_page_snapshot',
      location: sourceLocation(html, needle),
      evidence_sha256: sha256(`${rule}|${passed}|${String(value ?? '')}`)
    },
    locale
  };
}

function ruleScore(rules) {
  if (!rules.length) return 0;
  return Number(
    rules.reduce((sum, rule) => sum + (rule.passed ? rule.weight : 0), 0).toFixed(2)
  );
}

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 0
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export function assertSafePublicHttpsUrl(value, { resolvedAddresses = [] } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('invalid_url');
  }
  if (url.protocol !== 'https:') throw new Error('https_required');
  if (url.username || url.password) throw new Error('url_credentials_forbidden');
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (!hostname || PRIVATE_HOSTS.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('private_hostname_forbidden');
  }
  const addresses = unique([...(isIP(hostname) ? [hostname] : []), ...resolvedAddresses]);
  for (const address of addresses) {
    const family = isIP(address);
    if ((family === 4 && isPrivateIpv4(address)) || (family === 6 && isPrivateIpv6(address))) {
      throw new Error('private_address_forbidden');
    }
  }
  url.hash = '';
  return url;
}

export async function fetchCompanyPages({
  websiteUrl,
  paths = ['/', '/about', '/product'],
  fetchImpl = fetch,
  resolveHost = async () => [],
  timeoutMs = 10000,
  maxRedirects = 3
}) {
  const root = assertSafePublicHttpsUrl(websiteUrl, {
    resolvedAddresses: await resolveHost(new URL(websiteUrl).hostname)
  });
  const selected = unique(paths).slice(0, 3);
  const pages = [];
  for (const path of selected) {
    let current = assertSafePublicHttpsUrl(new URL(path, root).toString(), {
      resolvedAddresses: await resolveHost(new URL(path, root).hostname)
    });
    let redirects = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(current, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'CowTech-Phase4-CompanyIntake/1.0'
          }
        });
      } finally {
        clearTimeout(timer);
      }
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        redirects += 1;
        if (redirects > maxRedirects) throw new Error('redirect_limit_exceeded');
        const next = new URL(response.headers.get('location'), current);
        current = assertSafePublicHttpsUrl(next.toString(), {
          resolvedAddresses: await resolveHost(next.hostname)
        });
        continue;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('unsupported_content_type');
      }
      const html = await response.text();
      pages.push({
        requested_url: new URL(path, root).toString(),
        final_url: current.toString(),
        status: response.status,
        fetched_at: new Date().toISOString(),
        content_sha256: sha256(html),
        html
      });
      break;
    }
  }
  return pages;
}

export function buildCompanyIntake({ tenantId, brandId, pages, locale = 'en' }) {
  if (!tenantId || !brandId) throw new Error('tenant_and_brand_required');
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 3) {
    throw new Error('one_to_three_pages_required');
  }
  const facts = [];
  const addFact = ({ type, value, page, confidence, selector }) => {
    if (!value) return;
    facts.push({
      fact_id: sha256(`${tenantId}|${brandId}|${type}|${value}`).slice(0, 24),
      tenant_id: tenantId,
      brand_id: brandId,
      fact_type: type,
      value,
      confidence,
      review_status: 'needs_review',
      publish_eligible: false,
      lineage: {
        source_url: page.final_url || page.url,
        fetched_at: page.fetched_at,
        source_content_sha256: page.content_sha256 || sha256(page.html),
        selector
      }
    });
  };
  for (const page of pages) {
    const html = String(page.html || '');
    const title = textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/iu);
    const description =
      textBetween(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/iu) ||
      textBetween(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/iu);
    const h1 = textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/iu);
    const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)];
    addFact({ type: 'page_title', value: title, page, confidence: 0.98, selector: 'title' });
    addFact({ type: 'meta_description', value: description, page, confidence: 0.98, selector: 'meta[name=description]' });
    addFact({ type: 'positioning', value: compactText(h1), page, confidence: 0.84, selector: 'h1:first-of-type' });
    for (const [index, match] of jsonLdBlocks.entries()) {
      const data = safeJson(match[1], null);
      const nodes = Array.isArray(data) ? data : data?.['@graph'] || [data];
      for (const node of nodes.filter(Boolean)) {
        addFact({ type: 'company_name', value: node.name, page, confidence: 0.96, selector: `json-ld[${index}].name` });
        addFact({ type: 'product_name', value: node?.offers?.name || (node['@type'] === 'Product' ? node.name : null), page, confidence: 0.92, selector: `json-ld[${index}]` });
      }
    }
  }
  const chunks = pages.map((page, index) => ({
    chunk_id: sha256(`${tenantId}|${brandId}|${page.final_url || page.url}|${index}`).slice(0, 24),
    tenant_id: tenantId,
    brand_id: brandId,
    source_url: page.final_url || page.url,
    text: compactText(page.html).slice(0, 6000),
    source_content_sha256: page.content_sha256 || sha256(page.html),
    review_status: 'needs_review',
    publish_eligible: false
  }));
  const companyName = facts.find((fact) => fact.fact_type === 'company_name')?.value;
  const positioning = facts.find((fact) => fact.fact_type === 'positioning')?.value;
  const productNames = unique(facts.filter((fact) => fact.fact_type === 'product_name').map((fact) => fact.value));
  const promptSeeds = [
    companyName ? `What is ${companyName} known for?` : null,
    positioning ? `Which solutions help teams with ${positioning.toLowerCase()}?` : null,
    ...productNames.map((product) => `What are the best alternatives to ${product}?`)
  ].filter(Boolean).map((text, index) => ({
    seed_id: sha256(`${tenantId}|${brandId}|${text}`).slice(0, 24),
    text,
    dimension: PROMPT_DIMENSIONS[index % PROMPT_DIMENSIONS.length],
    review_status: 'needs_review',
    publish_eligible: false,
    source_fact_ids: facts.slice(0, 3).map((fact) => fact.fact_id)
  }));
  return {
    schema_version: PHASE4_SCHEMA_VERSION,
    tenant_id: tenantId,
    brand_id: brandId,
    locale,
    status: facts.length ? 'needs_human_review' : 'insufficient_evidence',
    facts,
    destinations: {
      onboarding: facts,
      brand_profile: facts.filter((fact) => ['company_name', 'positioning'].includes(fact.fact_type)),
      competitor_profile: [],
      knowledge_base_chunks: chunks,
      prompt_seeds: promptSeeds,
      geoflow_content_materials: chunks
    },
    gates: {
      human_review_required: true,
      low_confidence_auto_publish_forbidden: true,
      tenant_isolated: true
    }
  };
}

export function reviewIntakeFact(fact, { status, reviewerId }) {
  if (!REVIEW_STATES.has(status)) throw new Error('invalid_review_status');
  if (!reviewerId) throw new Error('reviewer_required');
  return {
    ...fact,
    review_status: status,
    publish_eligible: status === 'approved' && Number(fact.confidence) >= 0.7,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  };
}

export function assessGeoPageReadiness({
  tenantId,
  brandId,
  url,
  html,
  headers = {},
  locale = 'en',
  previousSnapshot = null
}) {
  assertSafePublicHttpsUrl(url);
  const body = String(html || '');
  const plain = compactText(body);
  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  const jsonLd = [...body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)];
  const validJsonLd = jsonLd.filter((match) => safeJson(match[1], null)).length;
  const title = textBetween(body, /<title[^>]*>([\s\S]*?)<\/title>/iu);
  const description =
    textBetween(body, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/iu) ||
    textBetween(body, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/iu);
  const canonical = textBetween(body, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/iu);
  const h1Count = (body.match(/<h1\b/giu) || []).length;
  const rules = [
    evidence({ rule: 'schema.valid_json_ld', passed: validJsonLd > 0, category: 'schema', weight: 18, message: validJsonLd ? 'Valid JSON-LD found.' : 'Add valid JSON-LD.', value: validJsonLd, html: body, needle: 'application/ld+json', locale }),
    evidence({ rule: 'schema.organization_or_product', passed: /"@type"\s*:\s*"(?:Organization|Product|Service)"/iu.test(body), category: 'schema', weight: 12, message: 'Declare the primary entity type.', value: null, html: body, needle: '@type', locale }),
    evidence({ rule: 'content.substantive', passed: plain.length >= 600, category: 'content', weight: 12, message: 'Provide at least 600 characters of indexable content.', value: plain.length, html: body, needle: plain.slice(0, 24), locale }),
    evidence({ rule: 'content.single_h1', passed: h1Count === 1, category: 'content', weight: 8, message: 'Use exactly one descriptive H1.', value: h1Count, html: body, needle: '<h1', locale }),
    evidence({ rule: 'content.answer_structure', passed: /<(?:h2|h3|ul|ol|table)\b/iu.test(body), category: 'content', weight: 10, message: 'Use headings, lists, or tables for extractable answers.', value: null, html: body, needle: '<h2', locale }),
    evidence({ rule: 'meta.title', passed: Boolean(title && title.length >= 20 && title.length <= 70), category: 'meta', weight: 8, message: 'Set a descriptive 20–70 character title.', value: title, html: body, needle: title, locale }),
    evidence({ rule: 'meta.description', passed: Boolean(description && description.length >= 70 && description.length <= 180), category: 'meta', weight: 7, message: 'Set a 70–180 character meta description.', value: description, html: body, needle: description, locale }),
    evidence({ rule: 'meta.canonical', passed: Boolean(canonical), category: 'meta', weight: 5, message: 'Declare a canonical URL.', value: canonical, html: body, needle: canonical, locale }),
    evidence({ rule: 'citation.outbound_sources', passed: (body.match(/<a\b[^>]+href=["']https?:\/\//giu) || []).length >= 2, category: 'citation', weight: 10, message: 'Cite at least two relevant external sources.', value: (body.match(/<a\b[^>]+href=["']https?:\/\//giu) || []).length, html: body, needle: 'href="http', locale }),
    evidence({ rule: 'citation.recency_or_authorship', passed: /<(?:time|address)\b|datePublished|dateModified|author/iu.test(body), category: 'citation', weight: 6, message: 'Expose authorship or publication recency.', value: null, html: body, needle: 'dateModified', locale }),
    evidence({ rule: 'citation.indexability', passed: !/noindex/iu.test(lowerHeaders['x-robots-tag'] || '') && !/<meta[^>]+content=["'][^"']*noindex/iu.test(body), category: 'citation', weight: 4, message: 'Keep the page indexable.', value: lowerHeaders['x-robots-tag'] || null, html: body, needle: 'robots', locale })
  ];
  const categoryScores = Object.fromEntries(
    Object.keys(PAGE_READINESS_WEIGHTS).map((category) => [
      category,
      ruleScore(rules.filter((rule) => rule.category === category))
    ])
  );
  const total = Number(Object.values(categoryScores).reduce((sum, value) => sum + value, 0).toFixed(2));
  const snapshotHash = sha256(JSON.stringify({ url, body: sha256(body), headers: lowerHeaders, rules }));
  const snapshot = {
    schema_version: PHASE4_SCHEMA_VERSION,
    assessment_type: 'geo_page_readiness',
    explicitly_not: ['ai_agent_readiness', 'aivgl_ai_visibility'],
    tenant_id: tenantId,
    brand_id: brandId,
    url,
    locale,
    score: total,
    weights: PAGE_READINESS_WEIGHTS,
    category_scores: categoryScores,
    evidence: rules,
    recommendations: rules.filter((rule) => !rule.passed).map((rule) => ({
      rule: rule.rule,
      category: rule.category,
      recommendation: rule.message,
      evidence_sha256: rule.source.evidence_sha256
    })),
    source_snapshot: {
      html_sha256: sha256(body),
      headers_sha256: sha256(JSON.stringify(lowerHeaders)),
      snapshot_sha256: snapshotHash
    }
  };
  snapshot.diff = previousSnapshot
    ? {
        previous_snapshot_sha256: previousSnapshot.source_snapshot?.snapshot_sha256 || null,
        score_delta: Number((total - Number(previousSnapshot.score || 0)).toFixed(2)),
        changed_rules: rules
          .filter((rule) => previousSnapshot.evidence?.find((item) => item.rule === rule.rule)?.passed !== rule.passed)
          .map((rule) => rule.rule)
      }
    : null;
  return snapshot;
}

function normalizeMetricEvidence(items) {
  return normalizeArray(items)
    .filter((item) => REAL_METRIC_PROVIDERS.has(item.provider))
    .filter((item) => item.collected_at && item.sample_scope)
    .map((item) => ({
      provider: item.provider,
      collected_at: item.collected_at,
      sample_scope: item.sample_scope,
      confidence: clamp(item.confidence, 0, 1),
      metric: item.metric,
      value: clamp(item.value),
      source_ref: item.source_ref || null
    }))
    .filter((item) => item.metric && item.value !== null);
}

export function buildEvidenceDrivenPromptDiscovery({ tenantId, brandId, candidates, metricEvidence = [] }) {
  const evidence = normalizeMetricEvidence(metricEvidence);
  const byCandidate = new Map();
  for (const item of evidence) {
    const key = item.sample_scope.candidate_id || '*';
    if (!byCandidate.has(key)) byCandidate.set(key, []);
    byCandidate.get(key).push(item);
  }
  const output = normalizeArray(candidates).map((candidate, index) => {
    const candidateId = candidate.id || sha256(`${brandId}|${candidate.text}`).slice(0, 24);
    const items = [...(byCandidate.get('*') || []), ...(byCandidate.get(candidateId) || [])];
    const metrics = {};
    for (const metric of ['recommendation', 'commercial', 'opportunity', 'search_demand', 'site_coverage', 'competitor_gap', 'visibility', 'citation']) {
      const metricItems = items.filter((item) => item.metric === metric);
      const confidenceWeight = metricItems.reduce((sum, item) => sum + (item.confidence ?? 0.5), 0);
      metrics[metric] = metricItems.length
        ? {
            status: 'available',
            value: Number((metricItems.reduce((sum, item) => sum + item.value * (item.confidence ?? 0.5), 0) / confidenceWeight).toFixed(2)),
            evidence: metricItems
          }
        : { status: 'unavailable', value: null, evidence: [] };
    }
    const available = Object.values(metrics).filter((metric) => metric.status === 'available');
    const priority = available.length
      ? Number((available.reduce((sum, metric) => sum + metric.value, 0) / available.length).toFixed(2))
      : null;
    const dimension = PROMPT_DIMENSIONS.includes(candidate.dimension)
      ? candidate.dimension
      : PROMPT_DIMENSIONS[index % PROMPT_DIMENSIONS.length];
    return {
      id: candidateId,
      text: candidate.text,
      dimension,
      status: candidate.status || 'suggested',
      metrics,
      priority: {
        status: priority === null ? 'unavailable' : 'available',
        value: priority,
        method: priority === null ? null : 'mean_of_available_evidence_metrics_v1',
        evidence_count: items.length
      },
      provenance: {
        candidate_source: candidate.source || 'intake_prompt_seed',
        metric_providers: unique(items.map((item) => item.provider)),
        no_hash_or_template_score: true
      }
    };
  });
  return {
    schema_version: PHASE4_SCHEMA_VERSION,
    tenant_id: tenantId,
    brand_id: brandId,
    dimensions: PROMPT_DIMENSIONS,
    candidates: output.sort((left, right) => {
      if (left.priority.value === null && right.priority.value !== null) return 1;
      if (left.priority.value !== null && right.priority.value === null) return -1;
      return (right.priority.value || 0) - (left.priority.value || 0);
    }),
    export: output.map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      dimension: candidate.dimension,
      priority: candidate.priority.value,
      priority_status: candidate.priority.status
    })),
    guarantees: {
      real_provider_allowlist: [...REAL_METRIC_PROVIDERS],
      missing_metrics_are_unavailable: true,
      synthetic_scores_forbidden: true
    }
  };
}

export function buildEvidencePlanBacklog({
  tenantId,
  brandId,
  readiness,
  promptDiscovery,
  observations = [],
  plan = {},
  ownerDirectory = {}
}) {
  const items = [];
  const add = ({ kind, title, evidenceRefs, priority, dependencyIds = [], acceptanceMetric, retestAfterDays = 14 }) => {
    const id = sha256(`${tenantId}|${brandId}|${kind}|${title}`).slice(0, 24);
    items.push({
      id,
      tenant_id: tenantId,
      brand_id: brandId,
      kind,
      title,
      evidence_refs: evidenceRefs,
      owner: ownerDirectory[kind] || 'unassigned',
      priority,
      dependencies: dependencyIds,
      acceptance_metric: acceptanceMetric,
      due_at: new Date(Date.now() + (priority === 'high' ? 14 : 30) * 86400000).toISOString(),
      retest_at: new Date(Date.now() + (priority === 'high' ? 14 + retestAfterDays : 30 + retestAfterDays) * 86400000).toISOString(),
      geoflow_state: 'draft',
      dispatch_allowed: false
    });
  };
  for (const recommendation of readiness?.recommendations || []) {
    add({
      kind: 'page_readiness_fix',
      title: recommendation.recommendation,
      evidenceRefs: [recommendation.evidence_sha256],
      priority: recommendation.category === 'schema' || recommendation.category === 'content' ? 'high' : 'medium',
      acceptanceMetric: `${recommendation.rule}=passed`
    });
  }
  for (const candidate of promptDiscovery?.candidates || []) {
    const gap = candidate.metrics?.competitor_gap;
    if (gap?.status !== 'available' || gap.value < 50) continue;
    add({
      kind: 'prompt_gap',
      title: `Close prompt gap: ${candidate.text}`,
      evidenceRefs: gap.evidence.map((item) => item.source_ref).filter(Boolean),
      priority: gap.value >= 75 ? 'high' : 'medium',
      acceptanceMetric: `competitor_gap<${gap.value}`
    });
  }
  for (const observation of observations.filter((item) => item.outcome === 'brand_not_mentioned')) {
    add({
      kind: 'visibility_gap',
      title: `Improve visibility for ${observation.prompt_text}`,
      evidenceRefs: [observation.evidence_sha256],
      priority: 'high',
      acceptanceMetric: 'brand_mentioned=true'
    });
  }
  const maxItems = Number(plan.max_backlog_items || items.length);
  return {
    schema_version: PHASE4_SCHEMA_VERSION,
    horizon: {
      days_30: items.filter((item) => item.priority === 'high').map((item) => item.id),
      days_60: items.filter((item) => item.priority === 'medium').map((item) => item.id),
      days_90: items.filter((item) => item.priority === 'low').map((item) => item.id),
      months_6: items.map((item) => item.id)
    },
    items: items.slice(0, maxItems),
    geoflow: {
      mode: 'dry_run',
      dispatch_allowed: false,
      external_request_executed: false
    }
  };
}

function artifactContent(type, context) {
  const approvedFacts = normalizeArray(context.facts).filter((fact) => fact.review_status === 'approved');
  const companyName = approvedFacts.find((fact) => fact.fact_type === 'company_name')?.value || context.brandName;
  const positioning = approvedFacts.find((fact) => fact.fact_type === 'positioning')?.value || '';
  if (type === 'json_ld') {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: companyName,
      url: context.url,
      description: positioning
    }, null, 2);
  }
  if (type === 'llms_txt') {
    return [`# ${companyName}`, '', `> ${positioning}`, '', `- Website: ${context.url}`].join('\n');
  }
  if (type === 'geo_title_pack') {
    return JSON.stringify({
      title: `${companyName}: ${positioning}`.slice(0, 70),
      h1: positioning || companyName,
      answer_heading: `What does ${companyName} do?`
    }, null, 2);
  }
  return approvedFacts.map((fact) => `- ${fact.fact_type}: ${fact.value} [${fact.lineage.source_url}]`).join('\n');
}

export function generateRemediationArtifacts({ tenantId, brandId, context }) {
  return PHASE4_ARTIFACT_TYPES.map((type) => {
    const content = artifactContent(type, context);
    return {
      id: sha256(`${tenantId}|${brandId}|${type}|${content}`).slice(0, 24),
      tenant_id: tenantId,
      brand_id: brandId,
      type,
      version: 1,
      state: 'generated',
      content,
      content_sha256: sha256(content),
      validation: {
        status: 'pending',
        errors: []
      },
      publish: {
        mode: 'dry_run',
        external_publish_executed: false
      },
      history: [{ state: 'generated', at: new Date().toISOString() }]
    };
  });
}

export function transitionArtifact(artifact, { toState, reviewerId = null }) {
  const allowed = ARTIFACT_TRANSITIONS[artifact.state] || [];
  if (!allowed.includes(toState)) throw new Error('invalid_artifact_transition');
  if (toState === 'approved' && !reviewerId) throw new Error('reviewer_required');
  let validation = artifact.validation;
  if (toState === 'validated') {
    const errors = [];
    if (!artifact.content.trim()) errors.push('content_empty');
    if (artifact.type === 'json_ld' && !safeJson(artifact.content, null)) errors.push('invalid_json_ld');
    validation = { status: errors.length ? 'failed' : 'passed', errors };
    if (errors.length) throw new Error('artifact_validation_failed');
  }
  if (toState === 'published_dry_run' && artifact.publish.mode !== 'dry_run') {
    throw new Error('phase4_real_publish_forbidden');
  }
  return {
    ...artifact,
    state: toState,
    validation,
    reviewed_by: toState === 'approved' ? reviewerId : artifact.reviewed_by,
    history: [...artifact.history, { state: toState, at: new Date().toISOString(), reviewer_id: reviewerId }]
  };
}

export function answerReportQuestion({
  tenantId,
  conversationId,
  question,
  contextDocuments,
  history = []
}) {
  if (!tenantId || !conversationId || !question) throw new Error('conversation_input_required');
  const documents = normalizeArray(contextDocuments).filter((document) => document.tenant_id === tenantId);
  const terms = compactText(question).toLowerCase().split(/\s+/u).filter((term) => term.length > 2);
  const ranked = documents
    .map((document) => ({
      ...document,
      relevance: terms.reduce((score, term) => score + (String(document.text || '').toLowerCase().includes(term) ? 1 : 0), 0)
    }))
    .filter((document) => document.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, 5);
  const citations = ranked.map((document, index) => ({
    ref: `C${index + 1}`,
    document_id: document.id,
    source_type: document.source_type,
    source_ref: document.source_ref,
    evidence_sha256: document.evidence_sha256 || sha256(document.text)
  }));
  const answer = ranked.length
    ? ranked.map((document, index) => `${document.text} [C${index + 1}]`).join('\n')
    : 'No tenant-scoped evidence supports an answer yet.';
  return {
    schema_version: PHASE4_SCHEMA_VERSION,
    tenant_id: tenantId,
    conversation_id: conversationId,
    turn: history.length + 1,
    question,
    answer,
    citations,
    status: ranked.length ? 'answered_with_evidence' : 'insufficient_evidence',
    streaming_chunks: answer.match(/.{1,120}(?:\s|$)/gu) || [answer],
    history: [...history, { role: 'user', content: question }, { role: 'assistant', content: answer, citations }],
    share: { allowed: true, redaction_required: true },
    export: { formats: ['json', 'markdown'] },
    feedback: { allowed: true, values: ['helpful', 'not_helpful', 'incorrect_citation'] },
    suggested_task: ranked.length
      ? {
          status: 'pending_review',
          direct_publish_allowed: false,
          title: `Review report recommendation for: ${question}`
        }
      : null
  };
}

export function runPhase4DarkLoop({
  tenantId,
  brandId,
  pages,
  metricEvidence,
  observations = [],
  plan = {},
  reviewerId = 'phase4-fixture-reviewer'
}) {
  const intake = buildCompanyIntake({ tenantId, brandId, pages });
  intake.facts = intake.facts.map((fact) => reviewIntakeFact(fact, { status: 'approved', reviewerId }));
  const readiness = assessGeoPageReadiness({
    tenantId,
    brandId,
    url: pages[0].final_url || pages[0].url,
    html: pages[0].html,
    headers: pages[0].headers || {}
  });
  const promptDiscovery = buildEvidenceDrivenPromptDiscovery({
    tenantId,
    brandId,
    candidates: intake.destinations.prompt_seeds,
    metricEvidence
  });
  const backlog = buildEvidencePlanBacklog({
    tenantId,
    brandId,
    readiness,
    promptDiscovery,
    observations,
    plan
  });
  const artifacts = generateRemediationArtifacts({
    tenantId,
    brandId,
    context: {
      facts: intake.facts,
      brandName: intake.facts.find((fact) => fact.fact_type === 'company_name')?.value || 'Unknown brand',
      url: pages[0].final_url || pages[0].url
    }
  }).map((artifact) => {
    let next = transitionArtifact(artifact, { toState: 'validated' });
    next = transitionArtifact(next, { toState: 'approved', reviewerId });
    next = transitionArtifact(next, { toState: 'published_dry_run' });
    return transitionArtifact(next, { toState: 'retest_handoff' });
  });
  const qa = answerReportQuestion({
    tenantId,
    conversationId: sha256(`${tenantId}|${brandId}|phase4-dark-loop`).slice(0, 24),
    question: 'Which high priority item should we fix first?',
    contextDocuments: backlog.items.map((item) => ({
      id: item.id,
      tenant_id: tenantId,
      source_type: 'geoflow_backlog',
      source_ref: item.id,
      text: `${item.priority} priority: ${item.title}`,
      evidence_sha256: sha256(JSON.stringify(item.evidence_refs))
    }))
  });
  return {
    schema_version: PHASE4_SCHEMA_VERSION,
    mode: 'fixture_dark_loop',
    external_calls_executed: false,
    real_publish_executed: false,
    stages: { intake, readiness, prompt_discovery: promptDiscovery, backlog, artifacts, report_qa: qa },
    exit_handoff: {
      status: 'ready_for_phase4_engineering_review',
      retest_handoff_created: artifacts.every((artifact) => artifact.state === 'retest_handoff')
    }
  };
}
