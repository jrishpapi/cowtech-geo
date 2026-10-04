import { pool } from './db.js';

function clampScore(value) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function gradeFor(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function calculateRunScores(parserRows) {
  const parsedRows = parserRows.filter((row) => row.parser_output);
  const parsedCount = parsedRows.length;
  if (!parsedCount) {
    return {
      visibility_score: 0,
      source_quality_score: 0,
      competitor_pressure_score: 0,
      grade: 'D',
      components: {
        parsed_count: 0
      }
    };
  }

  let brandMentioned = 0;
  let anySource = 0;
  let officialSource = 0;
  let competitorSource = 0;
  let thirdPartySource = 0;
  let competitorMentionRows = 0;
  let competitorOnlyRows = 0;

  for (const row of parsedRows) {
    const summary = row.parser_output.summary || {};
    const brandHit = summary.brand_mentioned === true;
    const competitorHit = Number(summary.competitor_mentions || 0) > 0;
    const sourceHit = Number(summary.source_url_count || 0) > 0;
    const officialHit = Number(summary.official_source_count || 0) > 0;
    const competitorSourceHit = Number(summary.competitor_source_count || 0) > 0;
    const thirdPartyHit = Number(summary.third_party_source_count || 0) > 0;

    if (brandHit) brandMentioned += 1;
    if (sourceHit) anySource += 1;
    if (officialHit) officialSource += 1;
    if (competitorSourceHit) competitorSource += 1;
    if (thirdPartyHit) thirdPartySource += 1;
    if (competitorHit) competitorMentionRows += 1;
    if (!brandHit && competitorHit) competitorOnlyRows += 1;
  }

  const brandMentionRate = ratio(brandMentioned, parsedCount);
  const sourceCoverageRate = ratio(anySource, parsedCount);
  const officialSourceRate = ratio(officialSource, parsedCount);
  const thirdPartySourceRate = ratio(thirdPartySource, parsedCount);
  const competitorSourceRate = ratio(competitorSource, parsedCount);
  const competitorMentionRate = ratio(competitorMentionRows, parsedCount);
  const competitorOnlyRate = ratio(competitorOnlyRows, parsedCount);

  const visibilityScore = clampScore(
    brandMentionRate * 60 +
      sourceCoverageRate * 15 +
      officialSourceRate * 15 +
      thirdPartySourceRate * 10 -
      competitorOnlyRate * 15
  );

  const sourceQualityScore = clampScore(
    officialSourceRate * 50 +
      thirdPartySourceRate * 30 +
      sourceCoverageRate * 20 -
      competitorSourceRate * 25
  );

  const competitorPressureScore = clampScore(competitorMentionRate * 60 + competitorSourceRate * 40);

  return {
    visibility_score: visibilityScore,
    source_quality_score: sourceQualityScore,
    competitor_pressure_score: competitorPressureScore,
    grade: gradeFor(visibilityScore),
    components: {
      parsed_count: parsedCount,
      brand_mention_rate: Number(brandMentionRate.toFixed(4)),
      source_coverage_rate: Number(sourceCoverageRate.toFixed(4)),
      official_source_rate: Number(officialSourceRate.toFixed(4)),
      third_party_source_rate: Number(thirdPartySourceRate.toFixed(4)),
      competitor_source_rate: Number(competitorSourceRate.toFixed(4)),
      competitor_mention_rate: Number(competitorMentionRate.toFixed(4)),
      competitor_only_rate: Number(competitorOnlyRate.toFixed(4))
    },
    rationale: {
      visibility_score:
        'Measures whether the brand appears and whether the answer cites usable sources, with a penalty when competitors appear without the brand.',
      source_quality_score:
        'Measures whether cited sources are owned or neutral third-party sources, with a penalty for competitor-owned sources.',
      competitor_pressure_score:
        'Measures how strongly competitors appear in answers and sources. Higher means more competitive pressure, not better performance.'
    }
  };
}

export async function scoreTrackingRun(trackingRunId) {
  const rows = await pool.query(
    `SELECT id, parser_output
     FROM prompt_results
     WHERE tracking_run_id = $1 AND status = 'completed'
     ORDER BY created_at ASC`,
    [trackingRunId]
  );

  const scores = calculateRunScores(rows.rows);
  await pool.query(
    `INSERT INTO run_scores (
       tracking_run_id,
       visibility_score,
       source_quality_score,
       competitor_pressure_score,
       scoring_output
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tracking_run_id)
     DO UPDATE SET
       visibility_score = EXCLUDED.visibility_score,
       source_quality_score = EXCLUDED.source_quality_score,
       competitor_pressure_score = EXCLUDED.competitor_pressure_score,
       scoring_output = EXCLUDED.scoring_output,
       updated_at = NOW()`,
    [
      trackingRunId,
      scores.visibility_score,
      scores.source_quality_score,
      scores.competitor_pressure_score,
      JSON.stringify(scores)
    ]
  );

  return {
    tracking_run_id: trackingRunId,
    ...scores
  };
}
