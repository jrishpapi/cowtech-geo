import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { buildObservationPrompt, collectUrls } from './surface-utils.js';

function estimatedCostMicroUsd({
  inputTokens,
  outputTokens,
  inputRate,
  outputRate,
  searchInvocations,
  searchRate
}) {
  return Math.ceil(
    (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
  ) + (searchInvocations * searchRate);
}

export class QwenOfficialApiProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'qwen_official_api';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [{
      id: null,
      provider_id: this.providerId,
      model_id: this.config.qwenSearchModel || 'qwen-plus',
      display_name: 'Qwen Official API Search'
    }];
  }

  async runPrompt({ prompt, transport_permit }) {
    if (!this.config.dashscopeApiKey) {
      throw new Error('DASHSCOPE_API_KEY is required for Qwen official API');
    }
    assertExternalTransportAllowed({
      config: this.config,
      supplier: 'dashscope',
      transport_permit
    });
    const body = {
      model: this.config.qwenSearchModel || 'qwen-plus',
      input: {
        messages: [{
          role: 'user',
          content: buildObservationPrompt({ prompt })
        }]
      },
      parameters: {
        result_format: 'message',
        enable_search: true,
        search_options: {
          forced_search: true,
          enable_source: true,
          enable_citation: true,
          citation_format: '[<number>]',
          search_strategy: 'turbo'
        }
      }
    };
    const response = await this.fetchImpl(
      `${String(this.config.dashscopeBaseUrl).replace(/\/+$/, '')}/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.dashscopeApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok || responseBody.code) {
      throw new Error(`DashScope Qwen API request failed: ${response.status}`);
    }
    const answer = responseBody.output?.choices?.[0]?.message?.content || '';
    if (!answer) throw new Error('DashScope Qwen API did not include an answer');
    const inputTokens = Number(responseBody.usage?.input_tokens || 0);
    const outputTokens = Number(responseBody.usage?.output_tokens || 0);
    const searchInfo = responseBody.output?.search_info || responseBody.search_info || {};
    const reportedSearchInvocations = Number(
      responseBody.usage?.plugins?.search?.count || 0
    );
    const searchInvocations = Math.max(
      1,
      Number.isSafeInteger(reportedSearchInvocations) && reportedSearchInvocations > 0
        ? reportedSearchInvocations
        : 0
    );
    return Object.freeze({
      provider_id: this.providerId,
      model_id: body.model,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: Object.freeze({
        answer,
        provider_response_id: responseBody.request_id || null,
        citations: Object.freeze(collectUrls(searchInfo.search_results || []))
      }),
      usage: Object.freeze({
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_estimate_micro_usd: estimatedCostMicroUsd({
          inputTokens,
          outputTokens,
          inputRate: Number(this.config.qwenInputCostMicroUsdPerMillion || 0),
          outputRate: Number(this.config.qwenOutputCostMicroUsdPerMillion || 0),
          searchInvocations,
          searchRate: Number(this.config.qwenSearchCostMicroUsdPerCall || 0)
        })
      }),
      search_info: searchInfo
    });
  }
}
