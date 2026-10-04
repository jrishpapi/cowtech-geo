import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectText, collectUrls } from './surface-utils.js';

function estimatedCostMicroUsd({ inputTokens, outputTokens, inputRate, outputRate }) {
  return Math.ceil(
    (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
  );
}

export class GrokOfficialApiProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'grok_official_api';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [{
      id: null,
      provider_id: this.providerId,
      model_id: this.config.xaiSearchModel || 'grok-4.5',
      display_name: 'Grok Official API Search'
    }];
  }

  async runPrompt({ prompt, transport_permit }) {
    if (!this.config.xaiApiKey) {
      throw new Error('XAI_API_KEY is required for Grok official API');
    }
    assertExternalTransportAllowed({
      config: this.config,
      supplier: 'xai',
      transport_permit
    });
    const body = {
      model: this.config.xaiSearchModel || 'grok-4.5',
      input: buildObservationPrompt({ prompt }),
      tools: [{ type: 'web_search' }],
      store: false
    };
    const response = await this.fetchImpl(
      `${String(this.config.xaiBaseUrl).replace(/\/+$/, '')}/responses`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.xaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`xAI Responses API request failed: ${response.status}`);
    }
    const answer = responseBody.output_text || collectText(responseBody.output);
    if (!answer) throw new Error('xAI Responses API did not include an answer');
    const inputTokens = Number(responseBody.usage?.input_tokens || 0);
    const outputTokens = Number(responseBody.usage?.output_tokens || 0);
    return Object.freeze({
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: Object.freeze({
        answer,
        provider_response_id: responseBody.id || null,
        citations: Object.freeze(collectUrls(responseBody.output))
      }),
      usage: Object.freeze({
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_estimate_micro_usd: estimatedCostMicroUsd({
          inputTokens,
          outputTokens,
          inputRate: Number(this.config.xaiInputCostMicroUsdPerMillion || 0),
          outputRate: Number(this.config.xaiOutputCostMicroUsdPerMillion || 0)
        })
      })
    });
  }
}
