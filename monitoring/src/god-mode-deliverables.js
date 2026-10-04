import { pool } from './db.js';
import { getCustomerVisibilityReportPayload } from './customer-visibility.js';
import { getCustomerMonitoringPayload } from './recurring-monitoring.js';

const SCORE_KEYS = ['visibility', 'source_quality', 'competitor_pressure'];

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  return text || fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, numberValue(value)));
}

function percent(numerator, denominator) {
  if (numberValue(denominator) <= 0) return 0;
  return Math.round((numberValue(numerator) / numberValue(denominator)) * 1000) / 10;
}

function scoreBand(score, inverse = false) {
  const value = numberValue(score);
  if (inverse) {
    if (value >= 70) return 'high_risk';
    if (value >= 40) return 'watch';
    return 'controlled';
  }
  if (value >= 70) return 'strong';
  if (value >= 40) return 'improving';
  return 'weak';
}

function scoreDirection(key) {
  return key === 'competitor_pressure' ? 'lower_is_better' : 'higher_is_better';
}

function scoreDelta(current, previous) {
  if (previous === null || previous === undefined) return null;
  return Math.round((numberValue(current) - numberValue(previous)) * 10) / 10;
}

function evidenceStrings(opportunity = {}) {
  const evidence = opportunity.evidence || {};
  const rows = arrayValue(evidence.weakness_evidence).map((item) => cleanText(item)).filter(Boolean);
  if (rows.length) return rows.slice(0, 4);

  const summary = [];
  if (evidence.visibility_score !== undefined) summary.push(`Visibility score: ${numberValue(evidence.visibility_score)}.`);
  if (evidence.source_quality_score !== undefined) {
    summary.push(`Source quality score: ${numberValue(evidence.source_quality_score)}.`);
  }
  if (evidence.competitor_pressure_score !== undefined) {
    summary.push(`Competitor pressure score: ${numberValue(evidence.competitor_pressure_score)}.`);
  }
  if (evidence.brand_mention_count !== undefined && evidence.parsed_count !== undefined) {
    summary.push(
      `${numberValue(evidence.brand_mention_count)} of ${numberValue(evidence.parsed_count)} parsed answers mention the brand.`
    );
  }
  return summary.length ? summary.slice(0, 4) : ['Derived from measured prompt results in this tracking run.'];
}

function previousScore(context, key) {
  return context.previousScores?.[`${key}_score`] ?? null;
}

function scorecardsFor(context, visibility = {}) {
  const visibilityCards = new Map(arrayValue(visibility.scorecards).map((card) => [card.key, card]));
  return Object.fromEntries(
    SCORE_KEYS.map((key) => {
      const fallbackScore = context.scores?.[`${key}_score`];
      const current = clamp(visibilityCards.get(key)?.score ?? fallbackScore);
      const previous = previousScore(context, key);
      return [
        key,
        {
          score: current,
          band: scoreBand(current, key === 'competitor_pressure'),
          direction: scoreDirection(key),
          previous_score: previous === null ? null : clamp(previous),
          delta_from_previous_run: scoreDelta(current, previous)
        }
      ];
    })
  );
}

function measurementFor(context, visibility = {}) {
  const stats = context.promptStats || {};
  const coverage = visibility.coverage || {};
  const measurement = visibility.measurement || {};
  return {
    tracking_run_id: context.run.tracking_run_id,
    run_type: context.run.run_type,
    run_created_at: context.run.run_created_at,
    mode: measurement.mode || 'not_reported',
    score_meaning: measurement.score_meaning || 'observed_prompt_results',
    provider_calls_live: measurement.paid_provider_call_executed === true,
    answer_count: numberValue(stats.answer_count),
    completed_answer_count: numberValue(stats.completed_count),
    parsed_answer_count: numberValue(coverage.parsed_answers),
    model_count: arrayValue(visibility.breakdowns?.models).length,
    category_count: arrayValue(visibility.breakdowns?.categories).length,
    average_parser_confidence: numberValue(coverage.avg_parser_confidence),
    methodology: [
      'Scores are calculated from the configured prompt and AI surface sample for this tracking run.',
      'Evidence excerpts are customer-safe, shortened observations; raw provider payloads are never included.',
      'Recommended actions are prioritized from measured gaps and require a same-prompt retest before impact is claimed.'
    ]
  };
}

function safeHighlights(visibility = {}, predicate = () => true, limit = 6) {
  return arrayValue(visibility.highlighted_answers)
    .filter(predicate)
    .slice(0, limit)
    .map((item) => ({
      provider: item.provider_id || null,
      model: item.model_id || null,
      category: item.category || null,
      prompt: cleanText(item.prompt_text),
      answer_excerpt: cleanText(item.answer_excerpt).slice(0, 320),
      brand_mentioned: item.brand_mentioned === true,
      competitor_mentions: numberValue(item.competitor_mentions),
      source_url_count: numberValue(item.source_url_count),
      official_source_count: numberValue(item.official_source_count),
      competitor_source_count: numberValue(item.competitor_source_count),
      parser_confidence: numberValue(item.parser_confidence)
    }));
}

function basePayload({ context, visibility = {}, deliverableType, generatedAt = new Date().toISOString() }) {
  const monitoring = context.monitoring || {};
  const measurement = measurementFor(context, visibility);
  const reportStatus =
    measurement.score_meaning === 'ai_visibility_measurement' &&
    measurement.provider_calls_live === true &&
    measurement.parsed_answer_count > 0
      ? 'ready'
      : measurement.score_meaning === 'pipeline_validation'
        ? 'validation_only'
        : measurement.parsed_answer_count > 0
          ? 'evidence_limited'
          : 'insufficient_evidence';
  return {
    schema_version: 'god-mode-deliverable-v2',
    deliverable_type: deliverableType,
    product_tier: 'god',
    status: reportStatus,
    customer_delivery_ready: reportStatus === 'ready',
    generated_at: generatedAt,
    brand: {
      id: context.run.brand_id,
      name: context.run.brand_name,
      website_url: context.run.website_url,
      vertical: context.run.vertical,
      locale: context.run.locale
    },
    measurement,
    scorecards: scorecardsFor(context, visibility),
    trend: {
      cadence_status: monitoring.cadence?.status || 'not_configured',
      next_retest_window_start: monitoring.cadence?.next_retest_window_start || null,
      brand_share_of_voice: numberValue(monitoring.current?.share_of_voice?.brand_share_of_voice),
      vs_previous: {
        visibility_score: monitoring.deltas?.vs_previous?.visibility_score ?? null,
        source_quality_score: monitoring.deltas?.vs_previous?.source_quality_score ?? null,
        competitor_pressure_score: monitoring.deltas?.vs_previous?.competitor_pressure_score ?? null,
        brand_share_of_voice: monitoring.deltas?.vs_previous?.brand_share_of_voice ?? null
      },
      vs_baseline: {
        visibility_score: monitoring.deltas?.vs_baseline?.visibility_score ?? null,
        source_quality_score: monitoring.deltas?.vs_baseline?.source_quality_score ?? null,
        competitor_pressure_score: monitoring.deltas?.vs_baseline?.competitor_pressure_score ?? null,
        brand_share_of_voice: monitoring.deltas?.vs_baseline?.brand_share_of_voice ?? null
      },
      active_alerts: arrayValue(monitoring.alerts)
        .filter((alert) => alert.status !== 'resolved')
        .slice(0, 6)
        .map((alert) => ({
          type: alert.alert_type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metric: alert.metric_key,
          previous_value: alert.previous_value,
          current_value: alert.current_value,
          delta: alert.delta_value
        }))
    },
    guardrails: [
      'This report describes observed answers from the configured sample; it is not a guarantee of future ranking or revenue.',
      'Treat recommended impact as a prioritization hypothesis until the same prompt and surface set is retested.',
      'Answer excerpts are shortened for customer review and must not be presented as full provider transcripts.'
    ],
    available_export_formats: ['markdown', 'pdf'],
    customer_safe: {
      raw_provider_payload_exposed: false,
      raw_answer_exposed: false,
      cost_exposed: false,
      internal_debug_exposed: false,
      customer_safe_answer_excerpts_included: true
    }
  };
}

function competitorProfiles(context, visibility = {}) {
  const monitoringCompetitors = arrayValue(context.monitoring?.current?.share_of_voice?.competitors);
  const measured = new Map();
  for (const item of [...arrayValue(visibility.competitor_pressure?.competitors), ...monitoringCompetitors]) {
    const key = cleanText(item.name).toLowerCase();
    const previous = measured.get(key) || {};
    measured.set(key, {
      ...previous,
      ...item,
      mentioned_result_count:
        item.mentioned_result_count ?? item.mentioned_answers ?? previous.mentioned_result_count ?? previous.mentioned_answers ?? 0
    });
  }
  const denominator = Math.max(1, numberValue(visibility.coverage?.parsed_answers));

  return context.competitors
    .map((competitor) => {
      const metric = measured.get(cleanText(competitor.name).toLowerCase()) || {};
      const mentionCount = numberValue(metric.mention_count);
      const mentionedAnswerCount = numberValue(metric.mentioned_result_count);
      const observed = mentionCount > 0 || mentionedAnswerCount > 0;
      return {
        name: competitor.name,
        website_url: competitor.website_url || null,
        mention_count: mentionCount,
        mentioned_answer_count: mentionedAnswerCount,
        answer_coverage_percent: percent(mentionedAnswerCount, denominator),
        share_of_voice_percent: numberValue(metric.share_of_voice),
        observed,
        pressure_level: mentionCount >= 5 || mentionedAnswerCount / denominator >= 0.5 ? 'high' : observed ? 'watch' : 'not_observed',
        evidence_note:
          observed
            ? `${competitor.name} appeared ${mentionCount} time${mentionCount === 1 ? '' : 's'} across ${mentionedAnswerCount} measured answer${mentionedAnswerCount === 1 ? '' : 's'}.`
            : `${competitor.name} is configured for tracking but was not detected in the parsed answer sample.`
      };
    })
    .sort((a, b) => b.mention_count - a.mention_count || b.mentioned_answer_count - a.mentioned_answer_count || a.name.localeCompare(b.name))
    .map((item, index) => ({ rank: index + 1, ...item }));
}

function priorityGaps(context, visibility = {}, limit = 5) {
  const nextActionByTitle = new Map(
    arrayValue(visibility.next_actions).map((action) => [cleanText(action.title).toLowerCase(), action])
  );
  return context.opportunities.slice(0, limit).map((item, index) => {
    const linkedAction = nextActionByTitle.get(cleanText(item.title).toLowerCase()) || {};
    const impact = item.expected_impact || {};
    return {
      order: index + 1,
      priority: item.priority,
      type: item.opportunity_type,
      title: item.title,
      description: item.description,
      recommended_format: item.recommended_format,
      evidence: evidenceStrings(item),
      target_prompts: arrayValue(item.target_prompts).slice(0, 3).map((prompt) => ({
        category: prompt.category || null,
        prompt: cleanText(prompt.prompt_text),
        model: prompt.model_id || null
      })),
      expected_impact: {
        primary_metric: impact.primary_metric || 'visibility_score',
        secondary_metric: impact.secondary_metric || null,
        desired_direction: impact.desired_direction || 'improve_primary_metric'
      },
      recommended_steps: arrayValue(linkedAction.recommended_steps).slice(0, 5),
      success_measure:
        linkedAction.success_measure || 'Retest the same prompt and surface set after publication and compare against this baseline.'
    };
  });
}

function competitorActionPlan({ profiles, gaps, visibility = {} }) {
  const topCompetitor = profiles.find((item) => item.mention_count > 0) || profiles[0];
  const topGap = gaps[0];
  const targetSource = arrayValue(visibility.source_intelligence?.citation_gap_decision_layer?.target_sources_to_win)[0];
  const topCompetitorName = topCompetitor?.name || 'the most visible competitor';
  const firstGapTitle = topGap?.title || 'the highest-priority measured content gap';
  const targetDomain = targetSource?.domain || 'one relevant neutral third-party source';

  return [
    {
      phase: 'days_1_30',
      priority: 'critical',
      owner: 'GEO content lead',
      action: `Publish a decision-grade comparison or alternatives page against ${topCompetitorName}.`,
      deliverable: `One comparison page plus supporting FAQ mapped to ${firstGapTitle}.`,
      evidence_basis: [topCompetitor?.evidence_note, ...(topGap?.evidence || [])].filter(Boolean).slice(0, 3),
      success_metric: 'Brand becomes co-mentioned on the same comparison prompts without increasing competitor-owned citation leakage.'
    },
    {
      phase: 'days_31_60',
      priority: 'high',
      owner: 'Brand and partnerships lead',
      action: `Win or strengthen a credible citation path through ${targetDomain}.`,
      deliverable: 'One official evidence hub update and one live neutral-source placement or profile.',
      evidence_basis: [
        `Current official source count: ${numberValue(visibility.source_mix?.official_source_count)}.`,
        `Current third-party source count: ${numberValue(visibility.source_mix?.third_party_source_count)}.`
      ],
      success_metric: 'Next retest shows at least one additional official or neutral citation for the target prompts.'
    },
    {
      phase: 'days_61_90',
      priority: 'high',
      owner: 'AIVGL measurement owner',
      action: 'Run a controlled same-prompt, same-surface retest and compare the evidence baseline.',
      deliverable: 'Before/after scorecard, prompt-level evidence log, and decision on the next content cycle.',
      evidence_basis: ['Impact must be measured against the same prompt and surface set before improvement is claimed.'],
      success_metric: 'Visibility and source quality move upward, or competitor pressure moves downward, with prompt-level evidence attached.'
    }
  ];
}

function strategyRoadmap({ context, visibility = {}, priorities }) {
  const topAction = arrayValue(visibility.next_actions)[0];
  const topOpportunity = context.opportunities[0];
  const primaryAction = cleanText(topAction?.title || topOpportunity?.title, 'Fix the highest-priority measured visibility gap.');
  const primarySteps = arrayValue(topAction?.recommended_steps).slice(0, 4);

  return [
    {
      phase: 'days_1_30',
      objective: 'Close the highest-confidence answer and evidence gap.',
      actions: primarySteps.length ? primarySteps : [primaryAction],
      deliverable: topAction?.deliverable || topOpportunity?.recommended_format || 'One prompt-mapped evidence asset.',
      owner: 'GEO content lead',
      success_metric: topAction?.success_measure || 'Asset is published, discoverable, and mapped to the measured prompt set.'
    },
    {
      phase: 'days_31_60',
      objective: 'Build source authority around the new answer asset.',
      actions: [
        'Add internal links from the highest-authority owned pages.',
        'Secure at least one relevant neutral-source mention or ecosystem profile.',
        'Keep product facts, category language, and proof consistent across sources.'
      ],
      deliverable: 'Owned evidence hub update plus one neutral source placement.',
      owner: 'Brand and partnerships lead',
      success_metric: 'Official or neutral source coverage increases on the target prompt set.'
    },
    {
      phase: 'days_61_90',
      objective: 'Validate impact and decide whether to scale, revise, or stop.',
      actions: [
        'Retest the same prompts and surfaces.',
        'Compare answer-level mentions, source mix, and competitor pressure.',
        'Keep only actions supported by observed movement; revise the rest.'
      ],
      deliverable: 'Before/after evidence review and next-cycle decision memo.',
      owner: 'AIVGL measurement owner',
      success_metric: priorities.map((priority) => priority.success_metric).join(' ')
    }
  ];
}

function strategicPriorities(context, visibility = {}) {
  const cards = scorecardsFor(context, visibility);
  const actionByType = new Map(arrayValue(visibility.next_actions).map((action) => [action.type, action]));
  return [
    {
      priority: 'visibility',
      objective: 'Increase answer-level brand recall across the configured AI surfaces.',
      signal: cards.visibility.band,
      baseline: cards.visibility.score,
      evidence: [
        `${numberValue(visibility.coverage?.brand_mentions)} brand mentions across ${numberValue(visibility.coverage?.parsed_answers)} parsed answers.`,
        ...(arrayValue(actionByType.get('visibility_gap')?.evidence).slice(0, 2))
      ],
      actions: arrayValue(actionByType.get('visibility_gap')?.recommended_steps).slice(0, 4),
      deliverable: actionByType.get('visibility_gap')?.deliverable || 'Prompt-mapped category or problem page.',
      success_metric:
        actionByType.get('visibility_gap')?.success_measure || 'Increase brand mentions on the same prompt and model pairs.'
    },
    {
      priority: 'source_quality',
      objective: 'Shift citations toward official and credible neutral sources.',
      signal: cards.source_quality.band,
      baseline: cards.source_quality.score,
      evidence: [
        `${numberValue(visibility.source_mix?.official_source_count)} official and ${numberValue(visibility.source_mix?.third_party_source_count)} neutral source mentions.`,
        `${numberValue(visibility.source_mix?.competitor_source_count)} competitor-owned source mentions.`
      ],
      actions: arrayValue(actionByType.get('source_quality_gap')?.recommended_steps).slice(0, 4),
      deliverable: actionByType.get('source_quality_gap')?.deliverable || 'Citation-ready official evidence hub.',
      success_metric:
        actionByType.get('source_quality_gap')?.success_measure || 'Increase official and neutral source mentions on retest.'
    },
    {
      priority: 'competitor_pressure',
      objective: 'Reduce competitor-only answers and competitor-owned citation leakage.',
      signal: cards.competitor_pressure.band,
      baseline: cards.competitor_pressure.score,
      evidence: [
        `${numberValue(visibility.coverage?.competitor_mentions)} competitor mentions in the parsed sample.`,
        `${numberValue(visibility.source_mix?.competitor_source_count)} competitor-owned source mentions.`
      ],
      actions: arrayValue(actionByType.get('competitor_pressure')?.recommended_steps).slice(0, 4),
      deliverable: actionByType.get('competitor_pressure')?.deliverable || 'Comparison and alternatives content for the top competitor.',
      success_metric:
        actionByType.get('competitor_pressure')?.success_measure || 'Reduce competitor pressure or increase brand co-mentions on retest.'
    }
  ];
}

function riskRegister(context, visibility = {}) {
  const cards = scorecardsFor(context, visibility);
  return [
    cards.visibility.score < 70
      ? {
          severity: cards.visibility.score < 40 ? 'critical' : 'high',
          risk: 'The brand is absent or weakly represented in part of the measured answer set.',
          evidence: `Visibility score ${cards.visibility.score}; ${numberValue(visibility.coverage?.brand_mentions)} measured brand mentions.`,
          mitigation: 'Publish the top prompt-mapped answer asset before expanding content volume.'
        }
      : null,
    cards.source_quality.score < 70
      ? {
          severity: cards.source_quality.score < 40 ? 'critical' : 'high',
          risk: 'AI answers lack enough official or neutral evidence supporting the brand.',
          evidence: `Source quality score ${cards.source_quality.score}; ${numberValue(visibility.source_mix?.official_source_count)} official source mentions.`,
          mitigation: 'Strengthen the official evidence hub and win one neutral source placement.'
        }
      : null,
    cards.competitor_pressure.score >= 40
      ? {
          severity: cards.competitor_pressure.score >= 70 ? 'critical' : 'high',
          risk: 'Competitors occupy material answer or citation share in the measured set.',
          evidence: `Competitor pressure score ${cards.competitor_pressure.score}; ${numberValue(visibility.coverage?.competitor_mentions)} competitor mentions.`,
          mitigation: 'Publish direct comparison content and retest the same prompts.'
        }
      : null,
    {
      severity: 'measurement',
      risk: 'Observed scores can change when prompts, surfaces, locale, or provider behavior changes.',
      evidence: `${numberValue(visibility.coverage?.parsed_answers)} parsed answers across ${arrayValue(visibility.breakdowns?.models).length} measured model rows.`,
      mitigation: 'Keep the baseline prompt and surface set stable for impact retests.'
    }
  ].filter(Boolean);
}

async function loadContext(trackingRunId) {
  const run = await pool.query(
    `SELECT tr.id AS tracking_run_id,
            tr.run_type,
            tr.created_at AS run_created_at,
            b.id AS brand_id,
            b.name AS brand_name,
            b.website_url,
            b.vertical,
            b.locale,
            c.plan_code
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1`,
    [trackingRunId]
  );
  if (!run.rowCount) {
    const error = new Error(`tracking run not found: ${trackingRunId}`);
    error.code = 'tracking_run_not_found';
    throw error;
  }

  const row = run.rows[0];
  const [scores, competitors, opportunities, promptStats, previousScores, visibility, monitoring] = await Promise.all([
    pool.query('SELECT * FROM run_scores WHERE tracking_run_id = $1', [trackingRunId]),
    pool.query(
      `SELECT name, website_url
       FROM competitors
       WHERE brand_id = $1
       ORDER BY created_at ASC
       LIMIT 10`,
      [row.brand_id]
    ),
    pool.query(
      `SELECT opportunity_type,
              priority,
              title,
              description,
              recommended_format,
              target_prompts,
              evidence,
              expected_impact
       FROM content_opportunities
       WHERE tracking_run_id = $1
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at ASC
       LIMIT 8`,
      [trackingRunId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS answer_count,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
              COUNT(*) FILTER (
                WHERE COALESCE((parser_output->'summary'->>'brand_mentioned')::boolean, false)
              )::int AS brand_mentions,
              COALESCE(SUM((parser_output->'summary'->>'competitor_mentions')::int), 0)::int AS competitor_mentions,
              COALESCE(SUM((parser_output->'summary'->>'competitor_source_count')::int), 0)::int AS competitor_sources
       FROM prompt_results
       WHERE tracking_run_id = $1`,
      [trackingRunId]
    ),
    pool.query(
      `SELECT rs.visibility_score,
              rs.source_quality_score,
              rs.competitor_pressure_score
       FROM tracking_runs previous_run
       JOIN run_scores rs ON rs.tracking_run_id = previous_run.id
       WHERE previous_run.brand_id = $1
         AND previous_run.id <> $2
         AND previous_run.created_at < $3
       ORDER BY previous_run.created_at DESC
       LIMIT 1`,
      [row.brand_id, trackingRunId, row.run_created_at]
    ),
    getCustomerVisibilityReportPayload({ run_id: trackingRunId }),
    getCustomerMonitoringPayload({ run_id: trackingRunId })
  ]);

  return {
    run: row,
    scores: scores.rows[0] || null,
    previousScores: previousScores.rows[0] || null,
    competitors: competitors.rows,
    opportunities: opportunities.rows,
    promptStats: promptStats.rows[0] || {},
    visibility: visibility || {},
    monitoring: monitoring || {}
  };
}

export function buildCompetitorDeepReport({ context, generated_at } = {}) {
  const visibility = context?.visibility || {};
  const profiles = competitorProfiles(context, visibility);
  const gaps = priorityGaps(context, visibility);
  const parsedAnswers = numberValue(visibility.coverage?.parsed_answers);
  const competitorMentions = numberValue(visibility.coverage?.competitor_mentions ?? context.promptStats?.competitor_mentions);
  const sourceDecision = visibility.source_intelligence?.citation_gap_decision_layer || {};
  const actionPlan = competitorActionPlan({ profiles, gaps, visibility });
  const topCompetitor = profiles.find((profile) => profile.observed === true);

  return {
    ...basePayload({ context, visibility, deliverableType: 'competitor_deep_report', generatedAt: generated_at }),
    title: `${context.run.brand_name} competitor deep report`,
    executive_summary: topCompetitor
      ? `${context.run.brand_name} is measured against ${profiles.length} configured competitors. ${topCompetitor.name} currently ranks first by observed competitor mentions, while the highest-priority response is ${gaps[0]?.title || 'to strengthen comparison and evidence coverage'}.`
      : profiles.length
        ? `${context.run.brand_name} is measured against ${profiles.length} configured competitors, but none were observed in the parsed answer sample. Keep the competitor set stable and retest before claiming a competitive lead.`
        : `${context.run.brand_name} has no configured competitors in this run; prioritize competitor setup before the next measurement cycle.`,
    competitive_summary: {
      tracked_competitors: profiles.length,
      parsed_answers: parsedAnswers,
      brand_mentions: numberValue(visibility.coverage?.brand_mentions ?? context.promptStats?.brand_mentions),
      competitor_mentions: competitorMentions,
      competitor_sources: numberValue(visibility.source_mix?.competitor_source_count ?? context.promptStats?.competitor_sources),
      competitor_mention_rate_percent: percent(competitorMentions, parsedAnswers),
      brand_share_of_voice_percent: numberValue(context.monitoring?.current?.share_of_voice?.brand_share_of_voice),
      pressure_score: clamp(context.scores?.competitor_pressure_score),
      pressure_band: scoreBand(context.scores?.competitor_pressure_score, true)
    },
    competitors: profiles,
    evidence_highlights: safeHighlights(
      visibility,
      (item) => numberValue(item.competitor_mentions) > 0 || item.brand_mentioned !== true,
      6
    ),
    source_landscape: {
      top_domains: arrayValue(visibility.source_mix?.top_domains).slice(0, 8),
      competitor_leakage: arrayValue(visibility.source_intelligence?.competitor_leakage).slice(0, 8),
      competitor_shaping_pages: arrayValue(sourceDecision.competitor_shaping_pages).slice(0, 8),
      target_sources_to_win: arrayValue(sourceDecision.target_sources_to_win).slice(0, 8)
    },
    priority_gaps: gaps,
    action_plan: actionPlan,
    recommended_actions: actionPlan.map((item) => item.action),
    measurement_plan: {
      baseline_metrics: {
        visibility_score: clamp(context.scores?.visibility_score),
        source_quality_score: clamp(context.scores?.source_quality_score),
        competitor_pressure_score: clamp(context.scores?.competitor_pressure_score),
        brand_mentions: numberValue(visibility.coverage?.brand_mentions),
        competitor_mentions: competitorMentions
      },
      retest_window: 'After the first two action phases are published and discoverable, normally within 60-90 days.',
      retest_controls: ['same prompts', 'same AI surfaces', 'same locale', 'same score definitions'],
      decision_rule: 'Scale only the actions supported by answer-level or source-level movement in the controlled retest.'
    }
  };
}

export function buildStrategyMemo({ context, generated_at } = {}) {
  const visibility = context?.visibility || {};
  const cards = scorecardsFor(context, visibility);
  const priorities = strategicPriorities(context, visibility);
  const roadmap = strategyRoadmap({ context, visibility, priorities });
  const weakest = [...priorities].sort((a, b) => {
    const aRisk = a.priority === 'competitor_pressure' ? a.baseline : 100 - a.baseline;
    const bRisk = b.priority === 'competitor_pressure' ? b.baseline : 100 - b.baseline;
    return bRisk - aRisk;
  })[0];
  const focus =
    cards.visibility.score < 50
      ? 'Build answer eligibility and evidence coverage before scaling content volume.'
      : cards.competitor_pressure.score >= 50
        ? 'Defend answer share against competitor mentions and competitor-owned sources.'
        : 'Scale the content loop while preserving source quality and controlled measurement.';

  return {
    ...basePayload({ context, visibility, deliverableType: 'strategy_memo', generatedAt: generated_at }),
    title: `${context.run.brand_name} GEO strategy memo`,
    executive_summary: focus,
    decision_brief: {
      current_position: `${context.run.brand_name} has visibility ${cards.visibility.score}, source quality ${cards.source_quality.score}, and competitor pressure ${cards.competitor_pressure.score}.`,
      primary_constraint: weakest?.objective || 'Insufficient measured evidence to select a primary constraint.',
      strategic_thesis: focus,
      first_decision: roadmap[0].actions[0]
    },
    strategic_priorities: priorities,
    evidence_register: [
      ...safeHighlights(visibility, () => true, 5).map((item, index) => ({
        evidence_id: `answer-${index + 1}`,
        type: 'measured_answer_excerpt',
        statement: item.prompt,
        observation: item.answer_excerpt,
        model: item.model,
        brand_mentioned: item.brand_mentioned,
        competitor_mentions: item.competitor_mentions,
        source_url_count: item.source_url_count
      })),
      ...arrayValue(visibility.source_mix?.top_domains).slice(0, 5).map((item, index) => ({
        evidence_id: `source-${index + 1}`,
        type: 'measured_source_domain',
        statement: item.domain || item.source_name || 'Measured source',
        observation: `${numberValue(item.result_count || item.citation_count)} measured result or citation occurrences.`,
        source_type: item.source_type || 'unknown'
      }))
    ],
    risk_register: riskRegister(context, visibility),
    roadmap_90_days: roadmap,
    next_30_days: roadmap[0].actions.map((action) => ({
      action,
      owner: roadmap[0].owner,
      deliverable: roadmap[0].deliverable,
      success_metric: roadmap[0].success_metric
    })),
    operating_cadence: {
      weekly: ['Review content production against the first action phase.', 'Log live source placements and blockers.'],
      monthly: ['Review scorecards and answer evidence.', 'Confirm whether the prompt set stayed stable.'],
      quarterly: ['Run the controlled retest.', 'Keep, revise, or stop each initiative based on measured movement.']
    },
    measurement_plan: {
      baseline: Object.fromEntries(SCORE_KEYS.map((key) => [key, cards[key].score])),
      target_directions: {
        visibility: 'increase',
        source_quality: 'increase',
        competitor_pressure: 'decrease'
      },
      required_proof: ['same-prompt retest', 'answer-level excerpts', 'source-mix comparison', 'competitor mention comparison'],
      claim_boundary: 'No strategy outcome is considered proven until a later controlled retest confirms movement.'
    }
  };
}

export async function generateCompetitorDeepReport(trackingRunId, { generated_at } = {}) {
  const context = await loadContext(trackingRunId);
  return buildCompetitorDeepReport({ context, generated_at });
}

export async function generateStrategyMemo(trackingRunId, { generated_at } = {}) {
  const context = await loadContext(trackingRunId);
  return buildStrategyMemo({ context, generated_at });
}
