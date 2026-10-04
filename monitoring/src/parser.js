import { pool } from './db.js';

const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/gi;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMentions(text, terms) {
  const answer = String(text || '');
  const matches = [];

  for (const term of terms.filter(Boolean)) {
    const pattern = new RegExp(`(^|[^a-z0-9])(${escapeRegExp(term)})(?=$|[^a-z0-9])`, 'gi');
    const termMatches = [...answer.matchAll(pattern)];
    if (termMatches.length) {
      matches.push({
        term,
        count: termMatches.length
      });
    }
  }

  return {
    mentioned: matches.length > 0,
    count: matches.reduce((sum, match) => sum + match.count, 0),
    matched_terms: matches
  };
}

export function extractUrls(answer) {
  const urls = [...String(answer || '').matchAll(URL_PATTERN)].map((match) => match[0].replace(/[.,;:!?]+$/, ''));
  const uniqueUrls = [...new Set(urls)];

  return uniqueUrls.map((url) => {
    const domain = extractDomain(url);
    return { url, domain };
  });
}

export function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function domainMatches(domain, candidate) {
  if (!domain || !candidate) return false;
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

function classifySource({ domain, brand, competitors }) {
  const brandDomain = extractDomain(brand.website_url);
  if (domainMatches(domain, brandDomain)) {
    return {
      source_type: 'official',
      source_name: brand.name
    };
  }

  for (const competitor of competitors) {
    const competitorDomain = extractDomain(competitor.website_url);
    if (domainMatches(domain, competitorDomain)) {
      return {
        source_type: 'competitor',
        source_name: competitor.name
      };
    }
  }

  if (domain) {
    return {
      source_type: 'third_party',
      source_name: domain
    };
  }

  return {
    source_type: 'unknown',
    source_name: ''
  };
}

function aggregateDomains(sources) {
  const byDomain = new Map();
  for (const source of sources) {
    const key = source.domain || `unknown:${source.url}`;
    const existing =
      byDomain.get(key) ||
      {
        domain: source.domain,
        source_type: source.source_type,
        source_name: source.source_name,
        url_count: 0
      };
    existing.url_count += 1;
    byDomain.set(key, existing);
  }
  return [...byDomain.values()];
}

function confidenceFor({ status, raw_answer, brandMention, sourceUrls }) {
  if (status !== 'completed' || !raw_answer) return 0;

  let confidence = 0.65;
  if (brandMention.mentioned) confidence += 0.15;
  if (sourceUrls.length > 0) confidence += 0.1;
  if (raw_answer.length >= 120) confidence += 0.05;
  return Math.min(0.95, Number(confidence.toFixed(4)));
}

export function parseAnswer({ raw_answer, status = 'completed', brand, competitors = [] }) {
  const sourceUrls = extractUrls(raw_answer).map((source) => ({
    ...source,
    ...classifySource({
      domain: source.domain,
      brand,
      competitors
    })
  }));
  const brandMention = countMentions(raw_answer, [brand.name, ...(brand.aliases || [])]);
  const competitorMentions = competitors.map((competitor) => {
    const aliases = Array.isArray(competitor.aliases) ? competitor.aliases : [];
    const mention = countMentions(raw_answer, [competitor.name, ...aliases]);
    return {
      competitor_id: competitor.id,
      name: competitor.name,
      mentioned: mention.mentioned,
      mention_count: mention.count,
      matched_terms: mention.matched_terms
    };
  });

  const uniqueDomains = aggregateDomains(sourceUrls);
  const domains = [...new Set(uniqueDomains.map((source) => source.domain).filter(Boolean))];
  const sourceTypeCounts = uniqueDomains.reduce(
    (counts, source) => ({
      ...counts,
      [source.source_type]: (counts[source.source_type] || 0) + 1
    }),
    {}
  );
  const confidence = confidenceFor({
    status,
    raw_answer,
    brandMention,
    sourceUrls
  });

  return {
    parser_version: 'phase3-deterministic-v1',
    parsed_at: new Date().toISOString(),
    brand: {
      brand_id: brand.id,
      name: brand.name,
      mentioned: brandMention.mentioned,
      mention_count: brandMention.count,
      matched_terms: brandMention.matched_terms
    },
    competitors: competitorMentions,
    sources: {
      urls: sourceUrls,
      domains,
      unique_domains: uniqueDomains
    },
    summary: {
      brand_mentioned: brandMention.mentioned,
      competitor_mentions: competitorMentions.filter((competitor) => competitor.mentioned).length,
      source_url_count: sourceUrls.length,
      source_domain_count: domains.length,
      unique_source_domain_count: uniqueDomains.length,
      official_source_count: sourceTypeCounts.official || 0,
      competitor_source_count: sourceTypeCounts.competitor || 0,
      third_party_source_count: sourceTypeCounts.third_party || 0,
      unknown_source_count: sourceTypeCounts.unknown || 0
    },
    confidence
  };
}

export async function parseTrackingRunResults(trackingRunId) {
  const runResult = await pool.query(
    `SELECT tr.id, tr.brand_id, b.name, b.website_url
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  if (runResult.rowCount !== 1) {
    throw new Error(`tracking run not found for parsing: ${trackingRunId}`);
  }

  const run = runResult.rows[0];
  const competitors = await pool.query(
    `SELECT id, name, website_url, aliases
     FROM competitors
     WHERE brand_id = $1
     ORDER BY created_at ASC`,
    [run.brand_id]
  );
  const results = await pool.query(
    `SELECT id, status, raw_answer
     FROM prompt_results
     WHERE tracking_run_id = $1 AND status = 'completed'
     ORDER BY created_at ASC`,
    [trackingRunId]
  );

  let parsed = 0;
  let brandMentions = 0;
  let sourceUrls = 0;

  for (const result of results.rows) {
    const parserOutput = parseAnswer({
      raw_answer: result.raw_answer,
      status: result.status,
      brand: {
        id: run.brand_id,
        name: run.name,
        website_url: run.website_url,
        aliases: []
      },
      competitors: competitors.rows
    });

    await pool.query(
      `UPDATE prompt_results
       SET parser_output = $2,
           parser_confidence = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [result.id, JSON.stringify(parserOutput), parserOutput.confidence]
    );

    parsed += 1;
    if (parserOutput.summary.brand_mentioned) brandMentions += 1;
    sourceUrls += parserOutput.summary.source_url_count;
  }

  return {
    tracking_run_id: trackingRunId,
    parsed_results: parsed,
    brand_mentions: brandMentions,
    source_urls: sourceUrls
  };
}
