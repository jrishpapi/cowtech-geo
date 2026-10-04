import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectUrls } from './surface-utils.js';

export class GrokApiLikeProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'grok_api_like';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: this.config.xaiSearchModel || 'grok-4.3',
        display_name: 'Grok API-like Search'
      }
    ];
  }

  async runPrompt({ brand, competitors, prompt, transport_permit }) {
    if (!this.config.xaiApiKey) {
      throw new Error('XAI_API_KEY is required for grok_api_like provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'xai', transport_permit });

    const body = {
      model: this.config.xaiSearchModel || 'grok-4.3',
      messages: [
        {
          role: 'system',
          content: 'Answer naturally using live search when it helps. Include source URLs when available.'
        },
        {
          role: 'user',
          content: buildObservationPrompt({ prompt })
        }
      ],
      search_parameters: {
        mode: 'auto',
        max_search_results: 5
      }
    };

    const response = await this.fetchImpl(`${this.config.xaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.xaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`xAI Chat Completions API request failed: ${response.status}`);
    }

    const answer = responseBody.choices?.[0]?.message?.content || '';
    if (!answer) throw new Error('xAI Chat Completions API did not include an answer');

    return {
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        provider_response_id: responseBody.id || null,
        citations: collectUrls(responseBody)
      },
      usage: {
        input_tokens: responseBody.usage?.prompt_tokens || 0,
        output_tokens: responseBody.usage?.completion_tokens || 0,
        cost_estimate_usd: Number(responseBody.usage?.cost || 0)
      }
    };
  }
}
