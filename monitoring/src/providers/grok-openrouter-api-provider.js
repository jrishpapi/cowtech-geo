import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt } from './surface-utils.js';

function positiveMicroUsd(value) {
  const usd = Number(value);
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('OpenRouter Grok response did not include a positive usage cost');
  }
  return Math.max(1, Math.ceil(usd * 1_000_000));
}

export class GrokOpenRouterApiProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'grok_openrouter_api';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [{
      id: null,
      provider_id: this.providerId,
      model_id: this.config.openrouterGrokModel || 'x-ai/grok-4.20',
      display_name: 'Grok via OpenRouter API Search'
    }];
  }

  async runPrompt({ prompt, transport_permit }) {
    if (!this.config.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is required for Grok via OpenRouter');
    }
    assertExternalTransportAllowed({
      config: this.config,
      supplier: 'openrouter',
      transport_permit
    });
    const body = {
      model: this.config.openrouterGrokModel || 'x-ai/grok-4.20',
      messages: [{
        role: 'user',
        content: buildObservationPrompt({ prompt })
      }],
      tools: [{ type: 'openrouter:web_search' }],
      max_tokens: this.config.openrouterSearchMaxTokens || 1200
    };
    const response = await this.fetchImpl(
      `${String(this.config.openrouterBaseUrl).replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.openrouterApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`OpenRouter Grok API request failed: ${response.status}`);
    }
    const answer = responseBody.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new Error('OpenRouter Grok API did not include an answer');
    }
    const usage = responseBody.usage || {};
    return Object.freeze({
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: Object.freeze({
        answer,
        provider_response_id: responseBody.id || null,
        annotations: Object.freeze(responseBody.choices?.[0]?.message?.annotations || [])
      }),
      usage: Object.freeze({
        input_tokens: Number(usage.prompt_tokens || 0),
        output_tokens: Number(usage.completion_tokens || 0),
        cost_estimate_micro_usd: positiveMicroUsd(usage.cost ?? usage.total_cost)
      })
    });
  }
}
