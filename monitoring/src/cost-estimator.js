export const modelPriceSnapshot = {
  'openai/gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'google/gemini-2.5-flash-lite': { input: 0.0000001, output: 0.0000004 },
  'meta-llama/llama-3.3-70b-instruct': { input: 0.0000001, output: 0.00000032 },
  'deepseek/deepseek-chat': { input: 0.0000002002, output: 0.0000008001 },
  'qwen/qwen3.6-plus': { input: 0.000000325, output: 0.00000195 },
  'qwen/qwen3.6-plus:online': { input: 0.000000325, output: 0.00000195 },
  'x-ai/grok-4.20': { input: 0.00000125, output: 0.0000025 },
  'google/gemini-2.5-flash': { input: 0.0000003, output: 0.0000025 },
  'mistralai/mistral-nemo': { input: 0.00000002, output: 0.00000003 }
};

export const webSearchCostUsd = 0.005;

export function estimateTokensFromText(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export function estimateProviderCallCost({
  model_id,
  input_tokens,
  output_tokens,
  include_web_search = true
}) {
  const price = modelPriceSnapshot[model_id];
  if (!price) {
    return {
      input_tokens,
      output_tokens,
      estimated_cost_usd: include_web_search ? webSearchCostUsd : 0,
      price_found: false
    };
  }

  const tokenCost = input_tokens * price.input + output_tokens * price.output;
  const searchCost = include_web_search ? webSearchCostUsd : 0;

  return {
    input_tokens,
    output_tokens,
    estimated_cost_usd: Number((tokenCost + searchCost).toFixed(8)),
    price_found: true
  };
}

export function estimatePromptTrackingCall({ model_id, prompt_text, expected_output_tokens = 1000 }) {
  const inputTokens = estimateTokensFromText(prompt_text) + 1200;
  return estimateProviderCallCost({
    model_id,
    input_tokens: inputTokens,
    output_tokens: expected_output_tokens,
    include_web_search: true
  });
}
