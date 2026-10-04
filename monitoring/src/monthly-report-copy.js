function scoreLabel(score, kind) {
  if (kind === 'competitor_pressure') {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  if (score >= 85) return 'strong';
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'needs work';
  return 'weak';
}

function formatScore(score) {
  return Number.isFinite(Number(score)) ? Number(score) : 0;
}

function plainList(items, fallback) {
  const filtered = (items || []).filter(Boolean);
  return filtered.length ? filtered : [fallback];
}

function riskSentence(risk) {
  if (risk.type === 'visibility') {
    return `Visibility is below the current healthy threshold, so the brand is not appearing consistently enough across tracked AI questions.`;
  }

  if (risk.type === 'source_quality') {
    return `Source quality is below the current healthy threshold, which means AI answers may not have enough strong evidence pointing back to the brand or neutral sources.`;
  }

  if (risk.type === 'competitor_pressure') {
    const names = (risk.evidence?.competitors || [])
      .slice(0, 3)
      .map((competitor) => competitor.name)
      .filter(Boolean);
    return names.length
      ? `Competitor pressure is material, especially around ${names.join(', ')}, so comparison and alternative pages should be prioritized.`
      : `Competitor pressure is material, so comparison and alternative pages should be prioritized.`;
  }

  if (risk.type === 'third_party_source_gap') {
    return `No third-party sources were detected, so the next content cycle should create or earn neutral proof sources.`;
  }

  return risk.title || 'A tracked risk needs attention before the next retest.';
}

function executionSentence(item) {
  if (item.type === 'content_brief' && item.status === 'draft') {
    return `Create the ${item.content_type} asset "${item.title}" and target ${item.linked_prompt_count} validated opportunity prompts.`;
  }

  if (item.type === 'content_brief' && item.status === 'needs_validated_prompt') {
    return `Hold "${item.title}" until at least one validated opportunity prompt is linked.`;
  }

  if (item.type === 'prompt_promotion') {
    return `Track the promoted prompt in prompt set v${item.target_version_number}: ${item.title.replace('Track promoted prompt: ', '')}`;
  }

  return item.title || 'Review this execution item before the next cycle.';
}

function expectedImpactSentence(brief) {
  if (brief.target_metric === 'competitor_pressure_score') {
    return `Expected impact: reduce competitor pressure by giving AI systems a clearer owned comparison source for ${brief.linked_prompt_count} validated prompts.`;
  }

  if (brief.target_metric === 'source_quality_score') {
    return `Expected impact: improve source quality by giving AI systems stronger proof sources to cite.`;
  }

  if (brief.target_metric === 'visibility_score') {
    return `Expected impact: improve visibility by covering buyer questions where the brand is currently weak or absent.`;
  }

  return `Expected impact: improve the next retest by aligning content with validated opportunity prompts.`;
}

function buildScoreNarratives(monthlyReport) {
  const visibility = monthlyReport.score_snapshot.visibility;
  const sourceQuality = monthlyReport.score_snapshot.source_quality;
  const competitorPressure = monthlyReport.score_snapshot.competitor_pressure;

  return [
    {
      metric: 'visibility',
      title: 'Visibility',
      score: formatScore(visibility.score),
      status_label: scoreLabel(visibility.score, 'visibility'),
      customer_copy: `Visibility is ${scoreLabel(visibility.score, 'visibility')} at ${formatScore(visibility.score)}. This measures whether the brand appears in tracked AI answers and whether those answers have source support.`
    },
    {
      metric: 'source_quality',
      title: 'Source quality',
      score: formatScore(sourceQuality.score),
      status_label: scoreLabel(sourceQuality.score, 'source_quality'),
      customer_copy: `Source quality is ${scoreLabel(sourceQuality.score, 'source_quality')} at ${formatScore(sourceQuality.score)}. This measures whether AI answers cite official or neutral sources instead of relying on competitor-owned evidence.`
    },
    {
      metric: 'competitor_pressure',
      title: 'Competitor pressure',
      score: formatScore(competitorPressure.score),
      status_label: scoreLabel(competitorPressure.score, 'competitor_pressure'),
      customer_copy: `Competitor pressure is ${scoreLabel(competitorPressure.score, 'competitor_pressure')} at ${formatScore(competitorPressure.score)}. This score is lower-is-better and tracks how strongly competitors appear in the same AI answer space.`
    }
  ];
}

export function buildCustomerReportCopy(monthlyReport) {
  const brandName = monthlyReport.brand.name;
  const readyBriefs = monthlyReport.content_plan.article_ready_briefs || [];
  const blockedBriefs = monthlyReport.content_plan.blocked_briefs || [];
  const promotedCount = monthlyReport.prompt_strategy.promoted_prompt_count || 0;
  const validatedCount = monthlyReport.prompt_strategy.validated_count || 0;
  const riskCount = monthlyReport.risks.length;

  const firstReadyBrief = readyBriefs[0];
  const primaryAction = firstReadyBrief
    ? `Prioritize "${firstReadyBrief.title}" because it is already tied to ${firstReadyBrief.linked_prompt_count} validated opportunity prompts.`
    : 'Keep validating opportunity prompts before generating article drafts.';

  const retestMetrics = plainList(
    monthlyReport.retest_plan.target_metrics,
    'trend_confidence'
  );

  return {
    schema_version: 'phase3-customer-report-copy-v1',
    title: `${brandName} AI Visibility Monthly Report - ${monthlyReport.report_month}`,
    one_line_summary: monthlyReport.executive_summary.headline,
    customer_summary: [
      `${brandName} was reviewed against the current tracked AI prompt set for ${monthlyReport.report_month}.`,
      monthlyReport.executive_summary.headline,
      `The system found ${riskCount} active risk${riskCount === 1 ? '' : 's'}, ${validatedCount} validated opportunity prompt${validatedCount === 1 ? '' : 's'}, and ${promotedCount} promoted prompt${promotedCount === 1 ? '' : 's'} for future tracking.`
    ],
    score_narratives: buildScoreNarratives(monthlyReport),
    risk_explanations: monthlyReport.risks.map((risk) => ({
      type: risk.type,
      severity: risk.severity,
      title: risk.title,
      customer_copy: riskSentence(risk)
    })),
    recommended_execution_order: monthlyReport.execution_plan.map((item, index) => ({
      order: index + 1,
      type: item.type,
      status: item.status,
      customer_copy: executionSentence(item)
    })),
    content_recommendations: {
      primary_action: primaryAction,
      article_ready_count: readyBriefs.length,
      blocked_count: blockedBriefs.length,
      expected_impacts: readyBriefs.map(expectedImpactSentence),
      blocked_notes: blockedBriefs.map((brief) => `${brief.title} is not ready for drafting because ${brief.reason}`)
    },
    prompt_strategy_copy: {
      summary: promotedCount
        ? `${promotedCount} validated opportunity prompt${promotedCount === 1 ? ' has' : 's have'} been promoted into stable tracking, so future runs can measure them without changing historical results.`
        : 'No opportunity prompts were promoted in this cycle, so the current stable prompt set remains unchanged.',
      next_watchlist: monthlyReport.retest_plan.prompts_to_watch || []
    },
    retest_copy: {
      summary: `The next retest should watch ${retestMetrics.join(', ')} and compare results against the appropriate prompt set version.`,
      target_metrics: retestMetrics,
      guardrail: 'Do not claim AI visibility has improved until a later retest confirms movement.'
    },
    caveats: monthlyReport.executive_summary.caveats
  };
}
