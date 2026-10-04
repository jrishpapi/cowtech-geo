import { generateContentBriefs } from './briefs.js';
import { generateContentOpportunities } from './opportunities.js';
import { discoverOpportunityPrompts } from './opportunity-prompts.js';

export const RUN_EXECUTION_PLAN_SCHEMA = 'r13-run-execution-plan-v1';

export async function generateRunExecutionPlan(trackingRunId, options = {}) {
  const opportunityResult = await generateContentOpportunities(trackingRunId);
  const opportunityPromptResult = await discoverOpportunityPrompts(trackingRunId);
  const highPriorityResult = await generateContentBriefs(trackingRunId, {
    priority: options.brief_priority || 'high'
  });

  return {
    schema_version: RUN_EXECUTION_PLAN_SCHEMA,
    status: 'completed',
    tracking_run_id: trackingRunId,
    generated_at: new Date().toISOString(),
    steps: {
      opportunities: {
        status: 'completed',
        generated_count: opportunityResult.generated_count,
        blocked_count: opportunityResult.blocked_count || 0
      },
      opportunity_prompt_bindings: {
        status: 'completed',
        generated_count: opportunityPromptResult.generated_count,
        validated_count: opportunityPromptResult.validated_count
      },
      high_priority_briefs: {
        status: 'completed',
        generated_count: highPriorityResult.generated_count,
        brief_priority: options.brief_priority || 'high'
      }
    },
    next_step:
      highPriorityResult.generated_count > 0
        ? 'Open the customer dashboard to review report -> opportunity -> brief execution plan.'
        : 'Review generated opportunities and validate prompt bindings before drafting content.',
    opportunities: opportunityResult.opportunities,
    opportunity_prompts: opportunityPromptResult.prompts,
    briefs: highPriorityResult.briefs
  };
}
