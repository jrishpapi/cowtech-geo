import { pool } from './db.js';
import { getConfig } from './config.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import { buildMarketEvidenceQueries, collectRawPromptEvidence } from './prompt-evidence-providers.js';

function cleanText(value, max = 2000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./u, '').toLowerCase();
  } catch {
    return '';
  }
}

function articleUrls(articleMarkdown) {
  const text = String(articleMarkdown || '');
  const markdownUrls = [...text.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/giu)].map((match) => match[1]);
  const rawUrls = [...text.matchAll(/https?:\/\/[^\s)"'<>]+/giu)].map((match) => match[0]);
  return unique([...markdownUrls, ...rawUrls].map((url) => url.replace(/[.,;:!?]+$/u, '')));
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectArticleCitationFetchChecks({ article_markdown = '', fetchImpl = fetch } = {}) {
  const urls = articleUrls(article_markdown).slice(0, 20);
  const checks = [];
  for (const url of urls) {
    try {
      let response = await fetchWithTimeout(
        fetchImpl,
        url,
        {
          method: 'HEAD',
          headers: {
            'User-Agent': 'AIVisibilityGrowthLoop/1.0 DeepArticleCitationCheck',
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5'
          },
          redirect: 'follow'
        },
        8000
      );
      if ([405, 403].includes(response.status)) {
        response = await fetchWithTimeout(
          fetchImpl,
          url,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'AIVisibilityGrowthLoop/1.0 DeepArticleCitationCheck',
              Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5'
            },
            redirect: 'follow'
          },
          10000
        );
      }
      checks.push({
        url,
        ok: response.ok,
        status: response.status,
        final_url: response.url || url
      });
    } catch (error) {
      checks.push({
        url,
        ok: false,
        status: null,
        error: error?.name === 'AbortError' ? 'timeout' : cleanText(error?.message || error, 240)
      });
    }
  }
  return checks;
}

function draftTargetPrompts(draft = {}) {
  return (draft.target_prompts || [])
    .map((prompt) => (typeof prompt === 'string' ? prompt : prompt.prompt_text))
    .filter(Boolean);
}

export function buildDeepArticleResearchQueries({ brand = {}, draft = {}, competitors = [], limit = 12 } = {}) {
  const baseContext = {
    brand: {
      name: brand.name || draft.brand_name || 'brand',
      vertical: brand.vertical || draft.content_type || 'software'
    },
    competitors
  };
  const prompts = draftTargetPrompts(draft);
  const title = draft.title || draft.article_title;
  const competitorNames = competitors.map((competitor) => competitor.name).filter(Boolean).slice(0, 4);
  return unique([
    ...prompts,
    title,
    `${brand.name || ''} ${draft.primary_prompt || ''}`.trim(),
    `${brand.name || ''} alternatives`.trim(),
    `${brand.name || ''} reviews`.trim(),
    ...competitorNames.map((name) => `${brand.name || ''} vs ${name}`.trim()),
    ...buildMarketEvidenceQueries(baseContext, limit)
  ]).slice(0, limit);
}

function evidenceForUrl(url, evidenceItems = []) {
  const domain = domainFromUrl(url);
  return (evidenceItems || []).filter((item) => {
    const sourceUrl = item.source_url || item.url || '';
    const sourceDomain = String(item.source_domain || domainFromUrl(sourceUrl)).toLowerCase();
    if (sourceUrl && sourceUrl === url) return true;
    if (domain && sourceDomain === domain) return true;
    return domain && cleanText(item.evidence_text, 500).toLowerCase().includes(domain);
  });
}

export function verifyArticleCitations({
  article_markdown = '',
  evidence_items = [],
  fetch_checks = []
} = {}) {
  const urls = articleUrls(article_markdown);
  const fetchByUrl = new Map(fetch_checks.map((check) => [check.url, check]));
  const citations = urls.map((url) => {
    const matchingEvidence = evidenceForUrl(url, evidence_items);
    const fetchCheck = fetchByUrl.get(url);
    let status = 'unsupported';
    if (matchingEvidence.length) status = 'verified_by_evidence';
    if (!matchingEvidence.length && fetchCheck?.ok === true) status = 'reachable_but_not_in_evidence_pack';
    if (fetchCheck && fetchCheck.ok === false) status = 'broken_or_unreachable';
    return {
      url,
      domain: domainFromUrl(url),
      status,
      verified: status === 'verified_by_evidence',
      evidence_refs: matchingEvidence.slice(0, 5).map((item) => item.ref || item.id || item.evidence_hash).filter(Boolean),
      evidence_count: matchingEvidence.length,
      fetch_status: fetchCheck?.status || null
    };
  });
  const verifiedCount = citations.filter((citation) => citation.verified).length;
  const brokenCount = citations.filter((citation) => citation.status === 'broken_or_unreachable').length;
  return {
    schema_version: 'deep-article-citation-verification-v1',
    status:
      citations.length === 0
        ? 'needs_citations'
        : brokenCount > 0
          ? 'blocked_by_broken_citations'
          : verifiedCount === citations.length
            ? 'verified'
            : 'needs_source_review',
    citation_count: citations.length,
    verified_count: verifiedCount,
    unsupported_count: citations.length - verifiedCount,
    broken_count: brokenCount,
    coverage_rate: citations.length ? Number(((verifiedCount / citations.length) * 100).toFixed(2)) : 0,
    citations,
    guardrail: 'Citations are verified only when the URL/domain appears in the collected evidence pack.'
  };
}

function forbiddenClaimMatches(articleMarkdown) {
  const serialized = String(articleMarkdown || '').toLowerCase();
  const patterns = [
    'guaranteed improvement',
    'guaranteed ranking',
    'visibility has improved',
    'proven to rank',
    'certified by',
    'award-winning',
    '#1',
    'number one'
  ];
  return patterns.filter((pattern) => serialized.includes(pattern));
}

export function buildMultiModelFactQa({
  article_markdown = '',
  citation_verification,
  reviewer_models = ['openai/gpt-4o-mini', 'google/gemini-2.0-flash'],
  reviewer_results = [],
  unsupported_claims_mode = 'warn',
  citation_mode = 'block'
} = {}) {
  const forbiddenClaims = forbiddenClaimMatches(article_markdown);
  const citations = citation_verification || verifyArticleCitations({ article_markdown });
  const unsupportedClaimsMode = unsupported_claims_mode === 'block' ? 'block' : 'warn';
  const citationMode = citation_mode === 'warn' ? 'warn' : 'block';
  const modelRequests = reviewer_models.map((model_id) => ({
    model_id,
    task: 'fact_check_article_against_verified_evidence',
    required_output_schema: 'deep-article-model-fact-review-v1',
    checks: [
      'unsupported factual claims',
      'invented citations',
      'competitor comparison fairness',
      'visibility improvement claims before retest',
      'commercially risky guarantees'
    ]
  }));
  const normalizedResults = reviewer_results.map((result) => ({
    model_id: result.model_id,
    status: result.status || 'completed',
    passed: result.passed === true,
    unsupported_claims: result.unsupported_claims || [],
    citation_issues: result.citation_issues || [],
    risk_flags: result.risk_flags || []
  }));
  const completedCount = normalizedResults.length;
  const passedCount = normalizedResults.filter((result) => result.passed).length;
  const reviewerFailures = normalizedResults.filter((result) => result.passed !== true);
  const incompleteReviewers = normalizedResults.filter((result) => result.status !== 'completed');
  const reviewerHardFailures = reviewerFailures.filter((result) => {
    const citationIssues = Array.isArray(result.citation_issues) ? result.citation_issues : [];
    const riskFlags = Array.isArray(result.risk_flags) ? result.risk_flags : [];
    const unsupportedClaims = Array.isArray(result.unsupported_claims) ? result.unsupported_claims : [];

    return result.status !== 'completed' ||
      citationIssues.length > 0 ||
      riskFlags.some((flag) => /guarantee|guaranteed|ranking|visibility improved|visibility has improved|#1|number one|certified|award/i.test(String(flag))) ||
      (unsupportedClaimsMode === 'block' && unsupportedClaims.length > 0);
  });
  const modelConsensus =
    completedCount === 0
      ? 'not_run'
      : passedCount === completedCount
        ? 'pass'
        : passedCount === 0
          ? 'fail'
          : 'mixed';
  const machinePassed =
    forbiddenClaims.length === 0 &&
    citations.broken_count === 0 &&
    (citationMode === 'warn' || (citations.status !== 'needs_citations' && citations.unsupported_count === 0)) &&
    reviewerHardFailures.length === 0;
  const hasSoftWarnings = machinePassed && completedCount > 0 && reviewerFailures.length > 0;
  return {
    schema_version: 'deep-article-multi-model-fact-qa-v1',
    status:
      completedCount === 0
        ? 'ready_for_model_review'
        : incompleteReviewers.length > 0
          ? 'qa_incomplete'
        : machinePassed
          ? (hasSoftWarnings ? 'passed_with_warnings' : 'passed')
          : 'blocked_by_fact_qa',
    machine_passed: machinePassed,
    unsupported_claims_mode: unsupportedClaimsMode,
    citation_mode: citationMode,
    soft_warning_count: hasSoftWarnings ? reviewerFailures.length : 0,
    incomplete_review_count: incompleteReviewers.length,
    model_consensus: modelConsensus,
    reviewer_model_count: reviewer_models.length,
    completed_review_count: completedCount,
    forbidden_claims: forbiddenClaims,
    citation_status: citations.status,
    model_review_requests: modelRequests,
    reviewer_results: normalizedResults,
    guardrails: [
      'Human approval is still required before publish.',
      'Do not claim visibility improvement until post-publish retest comparison is completed.',
      'If reviewer models disagree, route to operator review.'
    ]
  };
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function compactEvidenceForReview(evidenceItems = []) {
  return evidenceItems.slice(0, 18).map((item) => ({
    ref: item.ref || item.id || item.evidence_hash || null,
    source_url: item.source_url || null,
    source_domain: item.source_domain || domainFromUrl(item.source_url || ''),
    title: cleanText(item.title || '', 180),
    evidence_text: cleanText(item.evidence_text || '', 900)
  }));
}

export async function runOpenRouterArticleFactQaReviews({
  article_markdown = '',
  evidence_items = [],
  reviewer_models,
  config,
  fetchImpl = fetch
} = {}) {
  const models = (reviewer_models || config?.deepArticleQaModels || ['openai/gpt-4o-mini']).filter(Boolean).slice(0, 3);
  if (!config?.openrouterApiKey) {
    return models.map((model_id) => ({
      model_id,
      status: 'failed',
      passed: false,
      unsupported_claims: [],
      citation_issues: [],
      risk_flags: ['missing_openrouter_api_key']
    }));
  }

  const evidence = compactEvidenceForReview(evidence_items);
  const results = [];
  for (const model_id of models) {
    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        `${config.openrouterBaseUrl.replace(/\/+$/u, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.openrouterApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model_id,
            messages: [
              {
                role: 'system',
                content: [
                  'You are a strict editorial fact-checker for GEO articles.',
                  'Check only against the supplied evidence. Do not browse.',
                  'Return JSON only with keys: passed, unsupported_claims, citation_issues, risk_flags.'
                ].join(' ')
              },
              {
                role: 'user',
                content: JSON.stringify({
                  task: 'fact_check_article_against_verified_evidence',
                  article_markdown: cleanText(article_markdown, 18000),
                  evidence,
                  rules: [
                    'Every factual claim about product capabilities, competitors, rankings, or market position must be supported by evidence.',
                    'Citations must point to URLs/domains present in evidence.',
                    'Block any visibility improvement, guaranteed ranking, or #1 claim unless a completed retest proof is supplied.',
                    'Commercial comparisons must be fair and not invent competitor weaknesses.'
                  ],
                  output_schema: {
                    passed: 'boolean',
                    unsupported_claims: ['string'],
                    citation_issues: ['string'],
                    risk_flags: ['string']
                  }
                })
              }
            ],
            temperature: 0,
            max_tokens: config?.deepArticleQaMaxTokens || 800,
            response_format: { type: 'json_object' }
          })
        },
        60000
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || body?.message || `openrouter_${response.status}`);
      }
      const content = body.choices?.[0]?.message?.content || '';
      const parsed = extractJsonObject(content) || {};
      results.push({
        model_id,
        status: 'completed',
        passed: parsed.passed === true,
        unsupported_claims: Array.isArray(parsed.unsupported_claims) ? parsed.unsupported_claims.map((item) => cleanText(item, 500)) : [],
        citation_issues: Array.isArray(parsed.citation_issues) ? parsed.citation_issues.map((item) => cleanText(item, 500)) : [],
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags.map((item) => cleanText(item, 500)) : [],
        usage: {
          input_tokens: body.usage?.prompt_tokens || 0,
          output_tokens: body.usage?.completion_tokens || 0,
          cost_estimate_usd: Number(body.usage?.cost || body.usage?.total_cost || 0) || 0
        }
      });
    } catch (error) {
      results.push({
        model_id,
        status: 'failed',
        passed: false,
        unsupported_claims: [],
        citation_issues: [],
        risk_flags: [cleanText(error?.message || error, 500)]
      });
    }
  }
  return results;
}

export function buildVisibilityProof({
  baseline_tracking_run_id,
  retest_tracking_run_id,
  comparison,
  article_url,
  target_prompts = []
} = {}) {
  if (!comparison || comparison.status !== 'completed') {
    return {
      schema_version: 'deep-article-visibility-proof-v1',
      status: 'measurement_pending',
      article_url: article_url || null,
      baseline_tracking_run_id: baseline_tracking_run_id || null,
      retest_tracking_run_id: retest_tracking_run_id || null,
      target_prompts,
      proof_level: 'none',
      claim_allowed: false,
      guardrail: 'No visibility improvement claim is allowed before a completed retest comparison.'
    };
  }
  const improvedMetrics = Object.entries(comparison.metrics || {})
    .filter(([, metric]) => metric.outcome === 'improved')
    .map(([metric, payload]) => ({ metric, delta: payload.delta, direction: payload.direction }));
  const targetImproved = comparison.target_metric?.outcome === 'improved';
  return {
    schema_version: 'deep-article-visibility-proof-v1',
    status: targetImproved || improvedMetrics.length ? 'measured_improvement' : 'measured_no_improvement',
    article_url: article_url || null,
    baseline_tracking_run_id: comparison.baseline_tracking_run_id || baseline_tracking_run_id || null,
    retest_tracking_run_id: comparison.retest_tracking_run_id || retest_tracking_run_id || null,
    target_prompts,
    target_metric: comparison.target_metric || null,
    improved_metrics: improvedMetrics,
    proof_level: targetImproved ? 'target_metric_improved' : improvedMetrics.length ? 'supporting_metric_improved' : 'none',
    claim_allowed: targetImproved || improvedMetrics.length > 0,
    caveat: 'Measured movement is correlation from the configured retest, not guaranteed causation.'
  };
}

export function buildDeepArticleEvidencePack({
  tracking_run_id,
  article_draft_id,
  brand = {},
  draft = {},
  article_markdown = '',
  competitors = [],
  evidence_items = [],
  provider_runs = [],
  fetch_checks = [],
  external_article_key,
  reviewer_models,
  reviewer_results,
  retest_comparison,
  article_url,
  config
} = {}) {
  const researchQueries = buildDeepArticleResearchQueries({ brand, draft, competitors });
  const citationVerification = verifyArticleCitations({
    article_markdown,
    evidence_items,
    fetch_checks
  });
  const factQa = buildMultiModelFactQa({
    article_markdown,
    citation_verification: citationVerification,
    reviewer_models,
    reviewer_results,
    unsupported_claims_mode: config?.deepArticleUnsupportedClaimsMode || 'warn',
    citation_mode: config?.deepArticleCitationMode || 'block'
  });
  const visibilityProof = buildVisibilityProof({
    comparison: retest_comparison,
    article_url,
    target_prompts: draftTargetPrompts(draft)
  });
  const citationMode = config?.deepArticleCitationMode === 'warn' ? 'warn' : 'block';
  const citationShouldBlock = citationMode === 'block'
    ? citationVerification.status !== 'verified'
    : citationVerification.broken_count > 0;
  const blockers = [
    evidence_items.length === 0 ? 'no_research_evidence_items' : null,
    citationShouldBlock ? `citation_verification_${citationVerification.status}` : null,
    !['passed', 'passed_with_warnings'].includes(factQa.status) ? `fact_qa_${factQa.status}` : null,
    visibilityProof.status === 'measurement_pending' ? 'visibility_measurement_pending' : null
  ].filter(Boolean);
  return {
    schema_version: 'deep-article-evidence-pack-v1',
    tracking_run_id,
    article_draft_id: article_draft_id || null,
    external_article_key: external_article_key || null,
    status: blockers.length ? 'needs_review' : 'verified_with_measured_result',
    brand: {
      id: brand.id || null,
      name: brand.name || null,
      website_url: brand.website_url || null
    },
    article: {
      title: draft.title || null,
      url: article_url || null,
      target_prompts: draftTargetPrompts(draft)
    },
    research: {
      status: evidence_items.length ? 'completed' : 'needs_research',
      query_count: researchQueries.length,
      queries: researchQueries,
      provider_runs,
      evidence_item_count: evidence_items.length,
      evidence_refs: evidence_items.slice(0, 20).map((item) => item.ref || item.id || item.evidence_hash).filter(Boolean),
      evidence_items: compactEvidenceForReview(evidence_items)
    },
    citation_verification: citationVerification,
    citation_mode: citationMode,
    fact_qa: factQa,
    visibility_proof: visibilityProof,
    blockers,
    guardrails: [
      'This pack can support premium deep article delivery only when blockers is empty.',
      'Article generation remains separate from evidence collection; GeoFlow should consume verified brief facts.',
      'Visibility claims require completed post-publish retest comparison.'
    ],
    generated_at: new Date().toISOString()
  };
}

function normalizePackRow(row) {
  return {
    ...row,
    pack_payload: row.pack_payload || {}
  };
}

export async function listDeepArticleEvidencePacks(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM deep_article_evidence_packs
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizePackRow);
}

export async function createDeepArticleEvidencePack({
  tracking_run_id,
  article_draft_id,
  external_article_key,
  brand,
  draft,
  article_markdown,
  competitors = [],
  evidence_items = [],
  provider_runs = [],
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  run_fact_qa = true,
  reviewer_models,
  reviewer_results,
  fetch_checks = [],
  fetchImpl = fetch,
  config
} = {}) {
  assertPaidProviderAllowed({ provider_mode, allow_paid_provider });
  const effectiveExternalArticleKey = external_article_key || article_draft_id || null;
  let collectedEvidence = { items: evidence_items, provider_runs };
  if (provider_mode !== 'mock' && evidence_items.length === 0) {
    collectedEvidence = await collectRawPromptEvidence({
      context: { brand, competitors },
      config,
      queries: buildDeepArticleResearchQueries({ brand, draft, competitors }),
      fetchImpl
    });
  }
  const citationFetchChecks = await collectArticleCitationFetchChecks({ article_markdown, fetchImpl });
  const modelReviewerResults =
    run_fact_qa === false
      ? reviewer_results
      : await runOpenRouterArticleFactQaReviews({
          article_markdown,
          evidence_items: collectedEvidence.items || [],
          reviewer_models,
          config: config || getConfig(),
          fetchImpl
        });
  const pack = buildDeepArticleEvidencePack({
    tracking_run_id,
    article_draft_id,
    external_article_key: effectiveExternalArticleKey,
    brand,
    draft,
    article_markdown,
    competitors,
    evidence_items: collectedEvidence.items || [],
    provider_runs: collectedEvidence.provider_runs || [],
    fetch_checks: fetch_checks.length ? fetch_checks : citationFetchChecks,
    reviewer_models,
    reviewer_results: modelReviewerResults,
    config: config || getConfig()
  });
  const result = await pool.query(
    `INSERT INTO deep_article_evidence_packs (
       tracking_run_id,
       article_draft_id,
       external_article_key,
       pack_key,
       status,
       provider_mode,
       pack_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (external_article_key, pack_key)
     WHERE external_article_key IS NOT NULL
     DO UPDATE SET
       status = EXCLUDED.status,
       provider_mode = EXCLUDED.provider_mode,
       pack_payload = EXCLUDED.pack_payload,
       updated_at = NOW()
     RETURNING *`,
    [
      tracking_run_id,
      article_draft_id || null,
      effectiveExternalArticleKey,
      `${effectiveExternalArticleKey}:deep-article-evidence-pack`,
      pack.status,
      provider_mode,
      JSON.stringify(pack)
    ]
  );
  return normalizePackRow(result.rows[0]);
}
