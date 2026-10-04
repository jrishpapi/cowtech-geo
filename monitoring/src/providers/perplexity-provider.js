import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt } from './surface-utils.js';

export class PerplexityProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'perplexity';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: this.config.perplexityModel || 'sonar',
        display_name: 'Perplexity Sonar'
      }
    ];
  }

  async runPrompt({ brand, competitors, prompt, transport_permit }) {
    if (!this.config.perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY is required for perplexity provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'perplexity', transport_permit });

    const body = {
      model: this.config.perplexityModel || 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Answer naturally with web-grounded evidence and citations when available.'
        },
        {
          role: 'user',
          content: buildObservationPrompt({ prompt })
        }
      ]
    };

    const response = await this.fetchImpl(`${this.config.perplexityBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Perplexity API request failed: ${response.status}`);
    }

    const answer = responseBody.choices?.[0]?.message?.content || '';
    if (!answer) throw new Error('Perplexity API response did not include an answer');

    return {
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        citations: responseBody.citations || [],
        search_results: responseBody.search_results || [],
        provider_response_id: responseBody.id || null
      },
      usage: {
        input_tokens: responseBody.usage?.prompt_tokens || 0,
        output_tokens: responseBody.usage?.completion_tokens || 0,
        cost_estimate_usd: Number(responseBody.usage?.cost || 0)
      }
    };
  }
}
