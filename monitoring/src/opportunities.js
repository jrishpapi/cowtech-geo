import { pool } from './db.js';
import { getTrackingRunReport } from './reporting.js';
import { recordQuotaUsageEvent } from './quota-bridge.js';

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2
};

function lowPerformingCategories(report, predicate) {
  return report.breakdowns.by_category
    .filter(predicate)
    .map((category) => category.category)
    .slice(0, 6);
}

function promptSamples(report, categories) {
  const categorySet = new Set(categories);
  return report.highlighted_results
    .filter((result) => categorySet.size === 0 || categorySet.has(result.category))
    .map((result) => ({
      result_id: result.result_id || null,
      category: result.category,
      prompt_text: result.prompt_text,
      provider_id: result.provider_id || null,
      model_id: result.model_id,
      answer_excerpt: result.answer_excerpt || '',
      brand_mentioned: result.brand_mentioned === true,
      competitor_mentions: Number(result.competitor_mentions || 0),
      source_url_count: Number(result.source_url_count || 0),
      official_source_count: Number(result.official_source_count || 0),
      competitor_source_count: Number(result.competitor_source_count || 0)
    }))
    .slice(0, 5);
}

function weaknessEvidenceFor({ report, opportunity_type, scores, parser, categories = [], prompts = [] }) {
  const evidence = [];
  if (opportunity_type === 'visibility_gap') {
    evidence.push(`Visibility score is ${scores.visibility}.`);
    evidence.push(`${parser.brand_mention_count} of ${parser.parsed_count} parsed answers mention the brand.`);
  }
  if (opportunity_type === 'source_quality_gap') {
    evidence.push(`Source quality score is ${scores.sourceQuality}.`);
    evidence.push(`${parser.official_source_count} official source mentions across ${parser.source_url_count} source URLs.`);
  }
  if (opportunity_type === 'competitor_pressure') {
    evidence.push(`Competitor pressure score is ${scores.competitorPressure}.`);
    evidence.push(`${parser.competitor_mention_count} competitor mentions and ${parser.competitor_source_count} competitor-owned source mentions were detected.`);
  }
  if (opportunity_type === 'third_party_authority') {
    evidence.push(`${parser.third_party_source_count} third-party source mentions were detected.`);
  }
  if (categories.length) {
    evidence.push(`Affected prompt categories: ${categories.join(', ')}.`);
  }
  const missingOfficial = prompts.filter((prompt) => Number(prompt.official_source_count || 0) === 0).length;
  if (missingOfficial) {
    evidence.push(`${missingOfficial} target prompt samples have no official source in the parsed answer.`);
  }
  if (report.measurement?.mode) {
    evidence.push(`Measurement mode: ${report.measurement.mode}.`);
  }
  return evidence;
}

function opportunity({
  opportunity_key,
  opportunity_type,
  priority,
  title,
  description,
  recommended_format,
  target_categories = [],
  target_prompts = [],
  evidence = {},
  expected_impact = {}
}) {
  return {
    opportunity_key,
    opportunity_type,
    priority,
    title,
    description,
    recommended_format,
    target_categories,
    target_prompts,
    evidence,
    expected_impact,
    status: 'proposed'
  };
}

export function buildContentOpportunities(report) {
  const opportunities = [];
  const parser = report.coverage.parser;
  const scores = {
    visibility: report.scorecards.visibility.score,
    sourceQuality: report.scorecards.source_quality.score,
    competitorPressure: report.scorecards.competitor_pressure.score
  };

  const lowVisibilityCategories = lowPerformingCategories(
    report,
    (category) => category.brand_mention_rate < 75 || category.brand_mention_count === 0
  );
  const weakSourceCategories = lowPerformingCategories(
    report,
    (category) => category.official_source_count === 0 || category.source_coverage_rate < 75
  );
  const competitorPressureCategories = lowPerformingCategories(
    report,
    (category) => category.competitor_mention_count > 0 || category.competitor_source_count > 0
  );

  if (scores.visibility === null) {
    return [
      opportunity({
        opportunity_key: 'complete-tracking-before-content-plan',
        opportunity_type: 'tracking_readiness',
        priority: 'high',
        title: 'Complete tracking, parsing, and scoring before creating content opportunities',
        description: 'The run does not have enough scored parser data to create content recommendations.',
        recommended_format: 'tracking_run',
        evidence: {
          report_state: report.report_state
        },
        expected_impact: {
          primary_metric: 'report_readiness'
        }
      })
    ];
  }

  if (scores.visibility < 70 || lowVisibilityCategories.length > 0) {
    const targetPrompts = promptSamples(report, lowVisibilityCategories);
    opportunities.push(
      opportunity({
        opportunity_key: 'strengthen-category-visibility',
        opportunity_type: 'visibility_gap',
        priority: scores.visibility < 50 ? 'high' : 'medium',
        title: 'Strengthen category and problem-led pages where the brand is missing',
        description:
          'Create or improve pages that directly answer the buyer prompts where the brand is absent or under-mentioned.',
        recommended_format: 'category_or_problem_page',
        target_categories: lowVisibilityCategories,
        target_prompts: targetPrompts,
        evidence: {
          visibility_score: scores.visibility,
          brand_mention_count: parser.brand_mention_count,
          parsed_count: parser.parsed_count,
          triggering_prompts: targetPrompts,
          weakness_evidence: weaknessEvidenceFor({
            report,
            opportunity_type: 'visibility_gap',
            scores,
            parser,
            categories: lowVisibilityCategories,
            prompts: targetPrompts
          })
        },
        expected_impact: {
          primary_metric: 'visibility_score',
          secondary_metric: 'brand_mention_rate'
        }
      })
    );
  }

  if (scores.sourceQuality < 70 || parser.official_source_count === 0 || weakSourceCategories.length > 0) {
    const targetPrompts = promptSamples(report, weakSourceCategories);
    opportunities.push(
      opportunity({
        opportunity_key: 'build-official-citation-assets',
        opportunity_type: 'source_quality_gap',
        priority: scores.sourceQuality < 50 || parser.official_source_count === 0 ? 'high' : 'medium',
        title: 'Build official citation assets for AI answers to reference',
        description:
          'Add citation-ready brand facts, FAQ sections, comparison proof, and source pages so AI answers can cite the brand website instead of weak or competitor sources.',
        recommended_format: 'faq_or_evidence_hub',
        target_categories: weakSourceCategories,
        target_prompts: targetPrompts,
        evidence: {
          source_quality_score: scores.sourceQuality,
          official_source_count: parser.official_source_count,
          source_url_count: parser.source_url_count,
          triggering_prompts: targetPrompts,
          weakness_evidence: weaknessEvidenceFor({
            report,
            opportunity_type: 'source_quality_gap',
            scores,
            parser,
            categories: weakSourceCategories,
            prompts: targetPrompts
          })
        },
        expected_impact: {
          primary_metric: 'source_quality_score',
          secondary_metric: 'official_source_rate'
        }
      })
    );
  }

  if (scores.competitorPressure >= 60 || parser.competitor_source_count > 0) {
    const competitors = report.competitor_insights.competitors
      .filter((competitor) => competitor.mentioned_result_count > 0)
      .slice(0, 5);
    const targetPrompts = promptSamples(report, competitorPressureCategories);
    opportunities.push(
      opportunity({
        opportunity_key: 'publish-competitor-comparison-assets',
        opportunity_type: 'competitor_pressure',
        priority: scores.competitorPressure >= 75 ? 'high' : 'medium',
        title: 'Publish competitor comparison and alternative pages',
        description:
          'Create pages that compare the brand against frequently mentioned competitors and give AI systems official evidence for differentiation.',
        recommended_format: 'comparison_or_alternatives_page',
        target_categories: competitorPressureCategories,
        target_prompts: targetPrompts,
        evidence: {
          competitor_pressure_score: scores.competitorPressure,
          competitor_source_count: parser.competitor_source_count,
          competitors,
          triggering_prompts: targetPrompts,
          weakness_evidence: weaknessEvidenceFor({
            report,
            opportunity_type: 'competitor_pressure',
            scores,
            parser,
            categories: competitorPressureCategories,
            prompts: targetPrompts
          })
        },
        expected_impact: {
          primary_metric: 'competitor_pressure_score',
          secondary_metric: 'visibility_score',
          desired_direction: 'lower_pressure_higher_visibility'
        }
      })
    );
  }

  if (parser.third_party_source_count === 0) {
    const targetPrompts = promptSamples(report, []);
    opportunities.push(
      opportunity({
        opportunity_key: 'develop-third-party-proof-sources',
        opportunity_type: 'third_party_authority',
        priority: 'medium',
        title: 'Develop third-party proof sources',
        description:
          'Pursue neutral external proof such as directory profiles, partner listings, review pages, industry resources, or earned mentions.',
        recommended_format: 'third_party_proof_plan',
        target_categories: report.breakdowns.by_category.map((category) => category.category).slice(0, 6),
        target_prompts: targetPrompts,
        evidence: {
          third_party_source_count: parser.third_party_source_count,
          top_domains: report.source_mix.top_domains,
          triggering_prompts: targetPrompts,
          weakness_evidence: weaknessEvidenceFor({
            report,
            opportunity_type: 'third_party_authority',
            scores,
            parser,
            categories: report.breakdowns.by_category.map((category) => category.category).slice(0, 6),
            prompts: targetPrompts
          })
        },
        expected_impact: {
          primary_metric: 'source_quality_score',
          secondary_metric: 'third_party_source_rate'
        }
      })
    );
  }

  if (parser.parsed_count > 0 && parser.source_url_count === 0) {
    const targetPrompts = promptSamples(report, ['source-seeking']);
    opportunities.push(
      opportunity({
        opportunity_key: 'create-source-seeking-answer-hub',
        opportunity_type: 'source_coverage_gap',
        priority: 'high',
        title: 'Create a source-seeking answer hub',
        description:
          'Build a page that directly answers where buyers can learn about the category and includes structured, citation-ready internal links.',
        recommended_format: 'source_hub',
        target_categories: ['source-seeking'],
        target_prompts: targetPrompts,
        evidence: {
          source_url_count: parser.source_url_count,
          parsed_count: parser.parsed_count,
          triggering_prompts: targetPrompts,
          weakness_evidence: weaknessEvidenceFor({
            report,
            opportunity_type: 'source_coverage_gap',
            scores,
            parser,
            categories: ['source-seeking'],
            prompts: targetPrompts
          })
        },
        expected_impact: {
          primary_metric: 'source_coverage_rate'
        }
      })
    );
  }

  if (!opportunities.length) {
    opportunities.push(
      opportunity({
        opportunity_key: 'maintain-and-retest',
        opportunity_type: 'retest',
        priority: 'low',
        title: 'Maintain current assets and retest after the next content update',
        description:
          'The current run is comparatively healthy. Keep prompts stable and use the next cycle to detect regressions or incremental gains.',
        recommended_format: 'retest_plan',
        evidence: {
          visibility_score: scores.visibility,
          source_quality_score: scores.sourceQuality,
          competitor_pressure_score: scores.competitorPressure
        },
        expected_impact: {
          primary_metric: 'trend_confidence'
        }
      })
    );
  }

  return opportunities.sort((a, b) => {
    const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return a.opportunity_key.localeCompare(b.opportunity_key);
  });
}

function normalizeOpportunityRow(row) {
  return {
    ...row,
    target_categories: row.target_categories || [],
    target_prompts: row.target_prompts || [],
    evidence: row.evidence || {},
    expected_impact: row.expected_impact || {}
  };
}

export async function listContentOpportunities(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM content_opportunities
     WHERE tracking_run_id = $1
     ORDER BY
       CASE priority
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeOpportunityRow);
}

export async function generateContentOpportunities(trackingRunId) {
  const report = await getTrackingRunReport(trackingRunId);
  if (!report) {
    throw new Error(`tracking run not found for opportunity generation: ${trackingRunId}`);
  }

  const opportunities = buildContentOpportunities(report);
  const planResult = await pool.query(
    `SELECT c.id AS customer_id,
            c.plan_code,
            p.content_opportunities_max
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     JOIN plans p ON p.id = c.plan_code
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  const plan = planResult.rows[0] || {};
  const maxAllowed = Number(plan.content_opportunities_max || 0);
  const allowedOpportunities = maxAllowed > 0 ? opportunities.slice(0, maxAllowed) : opportunities;
  const blockedOpportunities = maxAllowed > 0 ? opportunities.slice(maxAllowed) : [];
  if (plan.customer_id) {
    await recordQuotaUsageEvent({
      customer_id: plan.customer_id,
      brand_id: report.brand.id,
      event_type: blockedOpportunities.length ? 'quota_capped' : 'quota_checked',
      quota_type: 'content_opportunity',
      units: allowedOpportunities.length,
      status: blockedOpportunities.length ? 'capped' : 'allowed',
      metadata: {
        source: 'generate_content_opportunities',
        quota_limit: maxAllowed || null,
        requested_units: opportunities.length,
        projected_usage: allowedOpportunities.length
      }
    });
  }
  const saved = [];

  for (const item of allowedOpportunities) {
    const result = await pool.query(
      `INSERT INTO content_opportunities (
         tracking_run_id,
         brand_id,
         opportunity_key,
         opportunity_type,
         priority,
         title,
         description,
         recommended_format,
         target_categories,
         target_prompts,
         evidence,
         expected_impact,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'proposed')
       ON CONFLICT (tracking_run_id, opportunity_key)
       DO UPDATE SET
         opportunity_type = EXCLUDED.opportunity_type,
         priority = EXCLUDED.priority,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         recommended_format = EXCLUDED.recommended_format,
         target_categories = EXCLUDED.target_categories,
         target_prompts = EXCLUDED.target_prompts,
         evidence = EXCLUDED.evidence,
         expected_impact = EXCLUDED.expected_impact,
         updated_at = NOW()
       RETURNING *`,
      [
        trackingRunId,
        report.brand.id,
        item.opportunity_key,
        item.opportunity_type,
        item.priority,
        item.title,
        item.description,
        item.recommended_format,
        JSON.stringify(item.target_categories),
        JSON.stringify(item.target_prompts),
        JSON.stringify(item.evidence),
        JSON.stringify(item.expected_impact)
      ]
    );
    saved.push(normalizeOpportunityRow(result.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    generated_count: saved.length,
    blocked_count: blockedOpportunities.length,
    opportunities: saved
  };
}
