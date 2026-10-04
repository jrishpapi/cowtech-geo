import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { classifyHttpProviderError, createProviderError } from '../errors.js';
import { buildObservationPrompt } from './surface-utils.js';

export class OpenRouterProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'openrouter';
    this.transportSupplier = 'openrouter';
  }

  async runPrompt({ brand, competitors, modelTarget, prompt, transport_permit }) {
    if (!this.config.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is required for openrouter provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'openrouter', transport_permit });

    const modelId = String(modelTarget.model_id || '');
    const usesNativeSearch = modelId.startsWith('perplexity/') || modelId.endsWith(':online');
    const boundedSearchTool = modelId.startsWith('x-ai/')
      ? {
          type: 'openrouter:web_search',
          parameters: {
            engine: 'exa',
            max_results: 3,
            max_total_results: 3,
            search_context_size: 'low'
          }
        }
      : { type: 'openrouter:web_search' };
    const body = {
      model: modelTarget.model_id,
      messages: [
        {
          role: 'system',
          content:
            'You are running an AI visibility tracking prompt. Answer naturally. Do not fabricate private data.'
        },
        {
          role: 'user',
          content: buildObservationPrompt({ prompt })
        }
      ],
      ...(!usesNativeSearch ? { tools: [boundedSearchTool] } : {}),
      ...(modelId.startsWith('qwen/') && modelId.endsWith(':online')
        ? { reasoning: { enabled: false } }
        : {}),
      max_tokens: this.config.openrouterSearchMaxTokens || 1200
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await this.fetchImpl(`${this.config.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw classifyHttpProviderError(response.status, responseBody);
    }

    const answer = responseBody.choices?.[0]?.message?.content || '';
    if (!answer || typeof answer !== 'string') {
      throw createProviderError({
        code: 'provider_malformed_response',
        message: 'OpenRouter response did not include a text answer',
        retryable: false,
        details: responseBody
      });
    }
    const usage = responseBody.usage || {};
    const estimatedCost = Number(responseBody.usage?.cost || responseBody.usage?.total_cost || 0);

    return {
      provider_id: this.providerId,
      model_id: modelTarget.model_id,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        provider_response_id: responseBody.id,
        usage,
        annotations: responseBody.choices?.[0]?.message?.annotations || []
      },
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        cost_estimate_usd: Number.isFinite(estimatedCost) ? estimatedCost : 0
      }
    };
  }
}
