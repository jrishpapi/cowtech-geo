import { pool } from './db.js';
import { getTrackingRunReport } from './reporting.js';
import { generateContentOpportunities, listContentOpportunities } from './opportunities.js';

function clamp(value) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function unique(items) {
  const seen = new Set();
  const result = [];
  for (const item of items.filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function categoryLabel(category) {
  return String(category || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function brandCategory(report) {
  const categories = report.breakdowns.by_category.map((category) => category.category);
  if (categories.includes('category-recommendation')) return 'category-recommendation';
  return categories[0] || 'category-recommendation';
}

function competitorsFromOpportunity(opportunity) {
  return (opportunity.evidence?.competitors || [])
    .map((competitor) => competitor.name)
    .filter(Boolean)
    .slice(0, 5);
}

function promptsForOpportunity(report, opportunity) {
  const brand = report.brand.name;
  const vertical = categoryLabel(report.brand.vertical);
  const baseCategory = brandCategory(report);
  const competitors = competitorsFromOpportunity(opportunity);

  if (opportunity.opportunity_type === 'competitor_pressure') {
    const competitorPrompts = competitors.flatMap((competitor) => [
      `Compare ${brand} vs ${competitor} for ${vertical} buyers.`,
      `What are the best ${competitor} alternatives for ${vertical} teams?`,
      `Is ${brand} a good alternative to ${competitor}?`
    ]);
    return {
      prompt_source: 'competitor_gap',
      prompt_category: 'competitor-comparison',
      prompts: unique([
        ...competitorPrompts,
        `Which ${vertical} tools should buyers compare against ${brand}?`,
        `What should buyers consider when choosing between ${brand} and competing options?`
      ])
    };
  }

  if (opportunity.opportunity_type === 'third_party_authority') {
    return {
      prompt_source: 'source_gap',
      prompt_category: 'source-seeking',
      prompts: unique([
        `Where can I learn about ${brand} and similar ${vertical} providers?`,
        `What trusted sources explain ${vertical} providers like ${brand}?`,
        `Which directories or resources list credible ${vertical} providers?`
      ])
    };
  }

  if (opportunity.opportunity_type === 'source_quality_gap') {
    return {
      prompt_source: 'source_gap',
      prompt_category: 'source-seeking',
      prompts: unique([
        `What is ${brand} and what official sources explain it?`,
        `Where can buyers verify facts about ${brand}?`,
        `What questions should buyers ask before choosing ${brand}?`
      ])
    };
  }

  if (opportunity.opportunity_type === 'source_coverage_gap') {
    return {
      prompt_source: 'source_gap',
      prompt_category: 'source-seeking',
      prompts: unique([
        `Where can I find reliable information about ${brand}?`,
        `What official pages explain ${brand} for ${vertical} buyers?`
      ])
    };
  }

  if (opportunity.opportunity_type === 'visibility_gap') {
    return {
      prompt_source: 'visibility_gap',
      prompt_category: baseCategory,
      prompts: unique([
        `Which ${vertical} providers do you recommend for buyers evaluating this category?`,
        `What problems does ${brand} solve for ${vertical} buyers?`,
        `Is ${brand} a relevant option for ${vertical} teams?`
      ])
    };
  }

  return {
    prompt_source: 'report_gap',
    prompt_category: opportunity.target_categories?.[0] || baseCategory,
    prompts: unique([
      `What should buyers know about ${brand}?`,
      `When should buyers consider ${brand}?`
    ])
  };
}

function commercialIntentFor(opportunityType) {
  if (opportunityType === 'competitor_pressure') return 95;
  if (opportunityType === 'visibility_gap') return 85;
  if (opportunityType === 'source_quality_gap') return 75;
  if (opportunityType === 'source_coverage_gap') return 70;
  if (opportunityType === 'third_party_authority') return 60;
  return 50;
}

function gapSeverityFor(report, opportunity) {
  if (opportunity.opportunity_type === 'visibility_gap') {
    return clamp(100 - report.scorecards.visibility.score);
  }
  if (opportunity.opportunity_type === 'source_quality_gap') {
    return clamp(100 - report.scorecards.source_quality.score);
  }
  if (opportunity.opportunity_type === 'source_coverage_gap') {
    const parser = report.coverage.parser;
    return parser.parsed_count ? clamp(100 - (parser.source_url_count / parser.parsed_count) * 100) : 50;
  }
  if (opportunity.opportunity_type === 'third_party_authority') {
    return report.coverage.parser.third_party_source_count === 0 ? 85 : 40;
  }
  if (opportunity.opportunity_type === 'competitor_pressure') {
    return clamp(report.scorecards.competitor_pressure.score);
  }
  return 50;
}

function competitorPressureFor(report, opportunity) {
  if (opportunity.opportunity_type === 'competitor_pressure') {
    return clamp(report.scorecards.competitor_pressure.score);
  }
  if (opportunity.evidence?.competitors?.length) {
    return clamp(60 + opportunity.evidence.competitors.length * 8);
  }
  return clamp(report.scorecards.competitor_pressure.score * 0.4);
}

function feasibilityFor(report, opportunity) {
  let score = 70;
  if (report.brand.website_url) score += 10;
  if ((opportunity.target_prompts || []).length) score += 5;
  if (opportunity.recommended_format) score += 5;
  if (opportunity.opportunity_type === 'third_party_authority') score -= 10;
  return clamp(score);
}

function stabilityFor(opportunity) {
  const promptCount = (opportunity.target_prompts || []).length;
  const categoryCount = (opportunity.target_categories || []).length;
  return clamp(45 + Math.min(promptCount, 5) * 8 + Math.min(categoryCount, 4) * 5);
}

export function scoreOpportunityPrompt({ report, opportunity }) {
  const commercial_intent_score = commercialIntentFor(opportunity.opportunity_type);
  const gap_severity_score = gapSeverityFor(report, opportunity);
  const competitor_pressure_score = competitorPressureFor(report, opportunity);
  const feasibility_score = feasibilityFor(report, opportunity);
  const stability_score = stabilityFor(opportunity);
  const opportunity_prompt_score = clamp(
    commercial_intent_score * 0.3 +
      gap_severity_score * 0.25 +
      competitor_pressure_score * 0.2 +
      feasibility_score * 0.15 +
      stability_score * 0.1
  );

  return {
    commercial_intent_score,
    gap_severity_score,
    competitor_pressure_score,
    feasibility_score,
    stability_score,
    opportunity_prompt_score,
    status: opportunity_prompt_score >= 70 ? 'validated' : 'candidate'
  };
}

export function buildOpportunityPrompts({ report, opportunities }) {
  const candidates = [];

  for (const opportunity of opportunities) {
    const generated = promptsForOpportunity(report, opportunity);
    const scores = scoreOpportunityPrompt({ report, opportunity });
    for (const promptText of generated.prompts) {
      candidates.push({
        opportunity_id: opportunity.id,
        prompt_text: promptText,
        prompt_source: generated.prompt_source,
        prompt_category: generated.prompt_category,
        ...scores,
        evidence: {
          opportunity_key: opportunity.opportunity_key,
          opportunity_type: opportunity.opportunity_type,
          opportunity_priority: opportunity.priority,
          target_categories: opportunity.target_categories || [],
          target_prompts: opportunity.target_prompts || [],
          expected_impact: opportunity.expected_impact || {}
        }
      });
    }
  }

  return candidates.sort((a, b) => b.opportunity_prompt_score - a.opportunity_prompt_score);
}

function normalizePromptRow(row) {
  return {
    ...row,
    commercial_intent_score: Number(row.commercial_intent_score),
    gap_severity_score: Number(row.gap_severity_score),
    competitor_pressure_score: Number(row.competitor_pressure_score),
    feasibility_score: Number(row.feasibility_score),
    stability_score: Number(row.stability_score),
    opportunity_prompt_score: Number(row.opportunity_prompt_score),
    evidence: row.evidence || {}
  };
}

export async function listOpportunityPrompts(trackingRunId) {
  const result = await pool.query(
    `SELECT op.*, co.opportunity_key, co.opportunity_type, co.priority
     FROM opportunity_prompts op
     LEFT JOIN content_opportunities co ON co.id = op.opportunity_id
     WHERE op.tracking_run_id = $1
     ORDER BY op.opportunity_prompt_score DESC, op.created_at ASC`,
    [trackingRunId]
  );

  return result.rows.map(normalizePromptRow);
}

export async function discoverOpportunityPrompts(trackingRunId) {
  let opportunities = await listContentOpportunities(trackingRunId);
  if (!opportunities.length) {
    const generated = await generateContentOpportunities(trackingRunId);
    opportunities = generated.opportunities;
  }

  const report = await getTrackingRunReport(trackingRunId);
  if (!report) {
    throw new Error(`tracking run not found for opportunity prompt discovery: ${trackingRunId}`);
  }

  const candidates = buildOpportunityPrompts({ report, opportunities });
  const saved = [];
  for (const candidate of candidates) {
    const result = await pool.query(
      `INSERT INTO opportunity_prompts (
         tracking_run_id,
         brand_id,
         opportunity_id,
         prompt_text,
         prompt_source,
         prompt_category,
         commercial_intent_score,
         gap_severity_score,
         competitor_pressure_score,
         feasibility_score,
         stability_score,
         opportunity_prompt_score,
         evidence,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (tracking_run_id, prompt_text)
       DO UPDATE SET
         opportunity_id = EXCLUDED.opportunity_id,
         prompt_source = EXCLUDED.prompt_source,
         prompt_category = EXCLUDED.prompt_category,
         commercial_intent_score = EXCLUDED.commercial_intent_score,
         gap_severity_score = EXCLUDED.gap_severity_score,
         competitor_pressure_score = EXCLUDED.competitor_pressure_score,
         feasibility_score = EXCLUDED.feasibility_score,
         stability_score = EXCLUDED.stability_score,
         opportunity_prompt_score = EXCLUDED.opportunity_prompt_score,
         evidence = EXCLUDED.evidence,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        report.brand.id,
        candidate.opportunity_id,
        candidate.prompt_text,
        candidate.prompt_source,
        candidate.prompt_category,
        candidate.commercial_intent_score,
        candidate.gap_severity_score,
        candidate.competitor_pressure_score,
        candidate.feasibility_score,
        candidate.stability_score,
        candidate.opportunity_prompt_score,
        JSON.stringify(candidate.evidence),
        candidate.status
      ]
    );
    saved.push(normalizePromptRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    generated_count: saved.length,
    validated_count: saved.filter((prompt) => prompt.status === 'validated').length,
    prompts: saved
  };
}
