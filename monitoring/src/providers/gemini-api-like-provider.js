import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectText, collectUrls } from './surface-utils.js';

export class GeminiApiLikeProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'gemini_api_like';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: this.config.geminiSearchModel || 'gemini-2.5-flash',
        display_name: 'Gemini API-like Search'
      }
    ];
  }

  async runPrompt({ brand, competitors, prompt, transport_permit }) {
    if (!this.config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required for gemini_api_like provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'google_gemini', transport_permit });

    const model = this.config.geminiSearchModel || 'gemini-2.5-flash';
    const url = new URL(`${this.config.geminiBaseUrl}/models/${model}:generateContent`);
    url.searchParams.set('key', this.config.geminiApiKey);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: buildObservationPrompt({ prompt }) }]
        }
      ],
      tools: [{ google_search: {} }]
    };

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const candidate = responseBody.candidates?.[0] || {};
    const answer = collectText(candidate.content?.parts) || collectText(candidate);
    if (!answer) throw new Error('Gemini API response did not include an answer');

    return {
      provider_id: this.providerId,
      model_id: model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        grounding_metadata: candidate.groundingMetadata || null,
        citations: collectUrls(candidate.groundingMetadata)
      },
      usage: {
        input_tokens: responseBody.usageMetadata?.promptTokenCount || 0,
        output_tokens: responseBody.usageMetadata?.candidatesTokenCount || 0,
        cost_estimate_usd: 0
      }
    };
  }
}
