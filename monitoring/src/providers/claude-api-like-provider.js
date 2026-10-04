import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectText, collectUrls } from './surface-utils.js';

export class ClaudeApiLikeProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'claude_api_like';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: this.config.anthropicSearchModel || 'claude-sonnet-4-5',
        display_name: 'Claude API-like Search'
      }
    ];
  }

  async runPrompt({ brand, competitors, prompt, transport_permit }) {
    if (!this.config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for claude_api_like provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'anthropic', transport_permit });

    const body = {
      model: this.config.anthropicSearchModel || 'claude-sonnet-4-5',
      max_tokens: 1200,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search'
        }
      ],
      messages: [
        {
          role: 'user',
          content: buildObservationPrompt({ prompt })
        }
      ]
    };

    const response = await this.fetchImpl(`${this.config.anthropicBaseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Anthropic Messages API request failed: ${response.status}`);
    }

    const answer = collectText(
      (responseBody.content || []).filter((block) => block?.type === 'text' || typeof block?.text === 'string')
    );
    if (!answer) throw new Error('Anthropic Messages API did not include an answer');

    return {
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        provider_response_id: responseBody.id || null,
        citations: collectUrls(responseBody.content)
      },
      usage: {
        input_tokens: responseBody.usage?.input_tokens || 0,
        output_tokens: responseBody.usage?.output_tokens || 0,
        cost_estimate_usd: 0
      }
    };
  }
}
