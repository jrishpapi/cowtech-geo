export const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Starter AI visibility monitoring plan for one brand.',
    monthly_prompt_limit: 12,
    model_limit: 3,
    competitor_limit: 3,
    weekly_runs_per_month: 90,
    included_full_retests: 1,
    content_opportunities_min: 2,
    content_opportunities_max: 4,
    article_drafts_min: 2,
    article_drafts_max: 2,
    openrouter_reserve_usd: 5,
    monthly_provider_call_limit: 4000,
    live_provider_enabled: true,
    live_provider_status: 'enabled',
    daily_provider_call_limit: 150,
    monthly_provider_cost_limit_usd: 75,
    retry_buffer_percent: 25
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Main commercial AI visibility loop plan.',
    monthly_prompt_limit: 24,
    model_limit: 5,
    competitor_limit: 5,
    weekly_runs_per_month: 150,
    included_full_retests: 2,
    content_opportunities_min: 4,
    content_opportunities_max: 8,
    article_drafts_min: 4,
    article_drafts_max: 4,
    openrouter_reserve_usd: 30,
    monthly_provider_call_limit: 10000,
    live_provider_enabled: true,
    live_provider_status: 'enabled',
    daily_provider_call_limit: 400,
    monthly_provider_cost_limit_usd: 250,
    retry_buffer_percent: 25
  },
  {
    id: 'god',
    name: 'God',
    description: 'High-touch AI visibility and content growth plan.',
    monthly_prompt_limit: 50,
    model_limit: 8,
    competitor_limit: 10,
    weekly_runs_per_month: 240,
    included_full_retests: 4,
    content_opportunities_min: 10,
    content_opportunities_max: 20,
    article_drafts_min: 8,
    article_drafts_max: 8,
    openrouter_reserve_usd: 200,
    monthly_provider_call_limit: 25000,
    live_provider_enabled: true,
    live_provider_status: 'enabled',
    daily_provider_call_limit: 1000,
    monthly_provider_cost_limit_usd: 800,
    retry_buffer_percent: 25
  }
];

export const modelTargets = [
  {
    provider_id: 'openrouter',
    model_id: 'openai/gpt-4o-mini',
    display_name: 'OpenAI GPT-4o mini'
  },
  {
    provider_id: 'openrouter',
    model_id: 'perplexity/sonar',
    display_name: 'Perplexity Sonar'
  },
  {
    provider_id: 'openrouter',
    model_id: 'google/gemini-2.5-flash-lite',
    display_name: 'Google Gemini 2.5 Flash Lite'
  },
  {
    provider_id: 'openrouter',
    model_id: 'meta-llama/llama-3.3-70b-instruct',
    display_name: 'Meta Llama 3.3 70B Instruct'
  },
  {
    provider_id: 'openrouter',
    model_id: 'deepseek/deepseek-chat',
    display_name: 'DeepSeek Chat'
  },
  {
    provider_id: 'openrouter',
    model_id: 'qwen/qwen3.6-plus:online',
    display_name: 'Qwen 3.6 Plus Online'
  },
  {
    provider_id: 'openrouter',
    model_id: 'x-ai/grok-4.20',
    display_name: 'Grok 4.20'
  },
  {
    provider_id: 'openrouter',
    model_id: 'google/gemini-2.5-flash',
    display_name: 'Google Gemini 2.5 Flash'
  },
  {
    provider_id: 'openrouter',
    model_id: 'mistralai/mistral-nemo',
    display_name: 'Mistral Nemo'
  }
];

export const promptTaxonomy = [
  {
    id: 'brand-awareness',
    label: 'Brand awareness',
    description: 'Tests whether the model recognizes the brand as an entity.',
    applies_to: ['b2b_saas', 'dtc', 'healthcare', 'insurance']
  },
  {
    id: 'category-recommendation',
    label: 'Category recommendation',
    description: 'Tests whether the model recommends the brand inside a category.',
    applies_to: ['b2b_saas', 'dtc', 'healthcare', 'insurance']
  },
  {
    id: 'problem-solution',
    label: 'Problem solution',
    description: 'Tests whether the brand appears for problem-led buying intent.',
    applies_to: ['b2b_saas', 'dtc', 'healthcare', 'insurance']
  },
  {
    id: 'competitor-comparison',
    label: 'Competitor comparison',
    description: 'Tests direct comparison against one named competitor.',
    applies_to: ['b2b_saas', 'dtc']
  },
  {
    id: 'buying-guide',
    label: 'Buying guide',
    description: 'Tests buying-guide and shortlisting intent.',
    applies_to: ['b2b_saas', 'dtc', 'healthcare', 'insurance']
  },
  {
    id: 'source-seeking',
    label: 'Source seeking',
    description: 'Tests which websites or sources the model surfaces for learning intent.',
    applies_to: ['b2b_saas', 'dtc', 'healthcare', 'insurance']
  },
  {
    id: 'alternative-search',
    label: 'Alternative search',
    description: 'Tests alternative-to prompts around known competitors or incumbents.',
    applies_to: ['b2b_saas', 'dtc']
  },
  {
    id: 'regulated-education',
    label: 'Regulated education',
    description: 'Guarded prompt category for healthcare, insurance, finance, or legal content.',
    applies_to: ['healthcare', 'insurance']
  }
];
