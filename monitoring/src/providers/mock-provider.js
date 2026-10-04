import { assertProviderConfigured } from '../provider-configuration.js';
import { createProviderError } from '../errors.js';

function extractBrandHint(brandName, promptText) {
  if (promptText.toLowerCase().includes(brandName.toLowerCase())) {
    return `${brandName} is directly relevant to this prompt.`;
  }
  return `${brandName} may be relevant when buyers compare specialized options.`;
}

function competitorSentence(competitors) {
  if (!competitors.length) return 'No named competitors were available in the tracking setup.';
  const names = competitors.slice(0, 3).map((competitor) => competitor.name);
  return `Comparable brands often include ${names.join(', ')}.`;
}

export class MockProvider {
  constructor() {
    assertProviderConfigured('mock');
    this.providerId = 'mock';
    this.failures = new Map();
  }

  async runPrompt({ brand, competitors, modelTarget, prompt }) {
    if (prompt.prompt_text.includes('[FAIL_ALWAYS]')) {
      throw createProviderError({
        code: 'mock_forced_failure',
        message: 'mock provider forced persistent failure',
        retryable: true
      });
    }

    if (prompt.prompt_text.includes('[FAIL_ONCE]')) {
      const key = `${modelTarget.model_id}:${prompt.id || prompt.prompt_text}`;
      const count = this.failures.get(key) || 0;
      this.failures.set(key, count + 1);
      if (count === 0) {
        throw createProviderError({
          code: 'mock_forced_transient_failure',
          message: 'mock provider forced one-time failure',
          retryable: true
        });
      }
    }

    if (prompt.prompt_text.includes('[RATE_LIMIT]')) {
      throw createProviderError({
        code: 'provider_rate_limited',
        message: 'mock provider forced rate limit',
        retryable: true
      });
    }

    if (prompt.prompt_text.includes('[MALFORMED]')) {
      throw createProviderError({
        code: 'provider_malformed_response',
        message: 'mock provider forced malformed response',
        retryable: false
      });
    }

    const answer = [
      extractBrandHint(brand.name, prompt.prompt_text),
      competitorSentence(competitors),
      `For source review, start with ${brand.website_url}.`,
      `Prompt category: ${prompt.category}.`
    ].join(' ');

    return {
      provider_id: this.providerId,
      model_id: modelTarget.model_id,
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        mock: true,
        brand: brand.name,
        prompt_category: prompt.category
      },
      usage: {
        input_tokens: Math.ceil(prompt.prompt_text.length / 4),
        output_tokens: Math.ceil(answer.length / 4),
        cost_estimate_usd: 0
      }
    };
  }
}
