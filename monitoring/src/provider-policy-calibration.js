import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseAnswer } from './parser.js';
import { calculateRunScores } from './scoring.js';

export const PROVIDER_POLICY_CALIBRATION_SCHEMA = 'r11-3-provider-policy-calibration-v1';
export const DEFAULT_R11_2_FIXTURE =
  'fixtures/parser/openrouter/calibration.json';

const FIXTURE_ROOT = resolve('fixtures/parser');

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeFixturePath(fixturePath = DEFAULT_R11_2_FIXTURE) {
  const resolved = resolve(fixturePath || DEFAULT_R11_2_FIXTURE);
  if (!resolved.startsWith(`${FIXTURE_ROOT}/`) && resolved !== FIXTURE_ROOT) {
    throw new Error('provider policy calibration fixture must be under fixtures/parser');
  }
  return resolved;
}

function compareFixtureExpectations({ fixture, parsed }) {
  const expected = fixture.expect || {};
  const checks = [
    {
      key: 'brand_mentioned',
      expected: expected.brand_mentioned,
      actual: parsed.summary.brand_mentioned,
      passed: expected.brand_mentioned === undefined || parsed.summary.brand_mentioned === expected.brand_mentioned
    },
    {
      key: 'competitor_mentions',
      expected_min: numberValue(expected.min_competitor_mentions),
      actual: parsed.summary.competitor_mentions,
      passed: parsed.summary.competitor_mentions >= numberValue(expected.min_competitor_mentions)
    },
    {
      key: 'source_url_count',
      expected_min: numberValue(expected.min_source_url_count),
      actual: parsed.summary.source_url_count,
      passed: parsed.summary.source_url_count >= numberValue(expected.min_source_url_count)
    }
  ];

  for (const domain of expected.domains || []) {
    checks.push({
      key: `domain:${domain}`,
      expected: true,
      actual: parsed.sources.domains.includes(domain),
      passed: parsed.sources.domains.includes(domain)
    });
  }

  return {
    passed: checks.every((check) => check.passed),
    checks
  };
}

function buildParserGaps({ parsed, comparison }) {
  return [
    !comparison.passed ? 'fixture_expectation_mismatch' : null,
    parsed.summary.brand_mentioned !== true ? 'brand_mention_not_detected' : null,
    parsed.summary.source_url_count === 0 ? 'no_source_urls_detected' : null,
    parsed.summary.official_source_count === 0 ? 'official_source_missing' : null,
    parsed.confidence < 0.8 ? 'parser_confidence_below_policy_threshold' : null
  ].filter(Boolean);
}

function buildProviderPolicy({ fixture, parsed, scores, parserGaps }) {
  const passed = parserGaps.length === 0 && scores.visibility_score >= 70 && scores.source_quality_score >= 50;
  return {
    recommendation: passed ? 'allow_bounded_fixture_backed_pilots_only' : 'keep_paid_provider_blocked_until_parser_policy_review',
    continuous_paid_usage_allowed: false,
    scheduler_paid_provider_allowed: false,
    max_calls_per_pilot: 1,
    fixture_required: true,
    cost_ledger_required: true,
    human_review_required_before_rollout: true,
    model_policy: {
      provider_id: fixture.provider_id,
      model_id: fixture.model_id,
      status: passed ? 'calibrated_for_single_call_pilot' : 'needs_review',
      min_visibility_score: 70,
      min_source_quality_score: 50,
      observed_visibility_score: scores.visibility_score,
      observed_source_quality_score: scores.source_quality_score,
      observed_competitor_pressure_score: scores.competitor_pressure_score
    },
    required_next_steps: [
      'Use this fixture in R11.3 parser/scoring regression checks.',
      'Keep scheduler provider mode on mock until a separate rollout charter exists.',
      'Require fresh same-turn approval for any additional paid provider request.',
      parsed.summary.third_party_source_count === 0
        ? 'Review whether source policy should reward third-party citations separately from official citations.'
        : null
    ].filter(Boolean)
  };
}

export async function buildProviderPolicyCalibration({ fixture_path = DEFAULT_R11_2_FIXTURE } = {}) {
  const resolvedPath = safeFixturePath(fixture_path);
  const fixture = JSON.parse(await readFile(resolvedPath, 'utf8'));
  const parsed = parseAnswer({
    raw_answer: fixture.raw_answer,
    brand: fixture.brand,
    competitors: fixture.competitors || []
  });
  const scores = calculateRunScores([{ parser_output: parsed }]);
  const comparison = compareFixtureExpectations({ fixture, parsed });
  const parserGaps = buildParserGaps({ parsed, comparison });
  const scoringDrift = {
    status: scores.visibility_score >= 70 ? 'within_policy_band' : 'needs_review',
    grade: scores.grade,
    visibility_score: scores.visibility_score,
    source_quality_score: scores.source_quality_score,
    competitor_pressure_score: scores.competitor_pressure_score,
    notes: [
      scores.competitor_pressure_score >= 60
        ? 'Competitor pressure is high because all configured competitors were mentioned.'
        : null,
      scores.source_quality_score < 80
        ? 'Source quality is capped because the fixture has official citation coverage but no third-party citation diversity.'
        : null
    ].filter(Boolean)
  };
  const risks = {
    malformed_response_risk: fixture.raw_answer ? 'low' : 'high',
    timeout_risk: 'not_observed_in_fixture',
    citation_source_risk:
      parsed.summary.third_party_source_count === 0 ? 'official_only_sources_detected' : 'third_party_sources_detected',
    parser_confidence_risk: parsed.confidence >= 0.8 ? 'low' : 'review'
  };

  return {
    schema_version: PROVIDER_POLICY_CALIBRATION_SCHEMA,
    mode: 'fixture_parser_scoring_policy_calibration',
    generated_at: new Date().toISOString(),
    provider_call_executed: false,
    paid_provider_call_count: 0,
    fixture: {
      path: resolvedPath,
      file: basename(resolvedPath),
      source: fixture.source,
      provider_id: fixture.provider_id,
      model_id: fixture.model_id,
      provider_response_id_present: Boolean(fixture.provider_response_id),
      raw_answer_chars: String(fixture.raw_answer || '').length,
      prompt_category: fixture.prompt_category,
      brand_name: fixture.brand?.name || null,
      competitors: (fixture.competitors || []).map((competitor) => competitor.name)
    },
    parser: {
      parser_version: parsed.parser_version,
      confidence: parsed.confidence,
      summary: parsed.summary,
      domains: parsed.sources.domains,
      unique_domains: parsed.sources.unique_domains
    },
    fixture_comparison: comparison,
    parser_gaps: parserGaps,
    scoring: scores,
    scoring_drift: scoringDrift,
    risks,
    provider_policy: buildProviderPolicy({ fixture, parsed, scores, parserGaps }),
    guardrails: [
      'R11.3 reads the R11.2 fixture only and must not call OpenRouter.',
      'R11.3 does not enable scheduler paid-provider mode or continuous paid jobs.',
      'Any future paid provider request still requires fresh exact same-turn approval.'
    ]
  };
}
