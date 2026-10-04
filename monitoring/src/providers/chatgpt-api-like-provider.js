import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectText, collectUrls } from './surface-utils.js';

export class ChatgptApiLikeProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'chatgpt_api_like';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: this.config.openaiSearchModel || 'gpt-4o-mini',
        display_name: 'ChatGPT API-like Search'
      }
    ];
  }

  async runPrompt({ brand, competitors, prompt, transport_permit }) {
    if (!this.config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required for chatgpt_api_like provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'openai', transport_permit });

    const body = {
      model: this.config.openaiSearchModel || 'gpt-4o-mini',
      tools: [{ type: 'web_search' }],
      input: buildObservationPrompt({ prompt })
    };

    const response = await this.fetchImpl(`${this.config.openaiBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`OpenAI Responses API request failed: ${response.status}`);
    }

    const answer = responseBody.output_text || collectText(responseBody.output);
    if (!answer) throw new Error('OpenAI Responses API did not include an answer');

    return {
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        provider_response_id: responseBody.id || null,
        citations: collectUrls(responseBody.output)
      },
      usage: {
        input_tokens: responseBody.usage?.input_tokens || 0,
        output_tokens: responseBody.usage?.output_tokens || 0,
        cost_estimate_usd: Number(responseBody.usage?.cost || 0)
      }
    };
  }
}
