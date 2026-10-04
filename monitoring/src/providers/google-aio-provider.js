import { getConfig } from '../config.js';
import { assertExternalTransportAllowed } from '../costing/external-spend-gate.js';
import { collectText, collectUrls } from './surface-utils.js';

function providerError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function parseSearchMetadata(payload) {
  return Object.freeze({
    id: payload?.search_metadata?.id || null,
    status: payload?.search_metadata?.status || null
  });
}

function extractOverview(payload) {
  return payload?.ai_overview || payload?.ai_overview_results || null;
}

export function classifyGoogleAioResponse(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('payload must be an object');
  if (payload.error) return Object.freeze({ state: 'provider_error', error: payload.error });
  const overview = extractOverview(payload);
  if (overview?.error) return Object.freeze({ state: 'aio_error', error: overview.error });
  const pageToken = payload?.ai_overview?.page_token || payload?.ai_overview?.pageToken ||
    payload?.ai_overview_page_token || payload?.page_token || null;
  if (pageToken) return Object.freeze({ state: 'page_token', page_token: String(pageToken) });
  const answer = collectText(overview);
  if (overview && answer) {
    return Object.freeze({
      state: 'present',
      overview,
      answer,
      citations: Object.freeze(collectUrls(overview))
    });
  }
  return Object.freeze({ state: 'not_triggered' });
}

export class GoogleAioProvider {
  constructor(config = getConfig(), fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.providerId = 'google_ai_overview';
    this.transportSupplier = 'serpapi';
    this.singleSurfaceRun = true;
  }

  getModelTargets() {
    return [
      {
        id: null,
        provider_id: this.providerId,
        model_id: 'google-ai-overview',
        display_name: 'Google AI Overview'
      }
    ];
  }

  async runPrompt({ prompt, transport_permit, region = 'US', language = 'en', location = '', device = 'desktop' }) {
    if (!this.config.serpapiApiKey) {
      throw new Error('SERPAPI_API_KEY is required for google_ai_overview provider mode');
    }
    assertExternalTransportAllowed({ config: this.config, supplier: 'serpapi', transport_permit });

    const initialUrl = new URL(this.config.serpapiBaseUrl);
    initialUrl.searchParams.set('engine', 'google');
    initialUrl.searchParams.set('q', prompt.prompt_text);
    initialUrl.searchParams.set('gl', String(region || 'US').toLowerCase());
    initialUrl.searchParams.set('hl', String(language || 'en').toLowerCase());
    initialUrl.searchParams.set('device', String(device || 'desktop').toLowerCase());
    initialUrl.searchParams.set('no_cache', 'true');
    if (location) initialUrl.searchParams.set('location', String(location));
    initialUrl.searchParams.set('api_key', this.config.serpapiApiKey);

    const searches = [];
    const initial = await this.#search(initialUrl, 'initial');
    searches.push(initial.metadata);
    let classification = classifyGoogleAioResponse(initial.body);

    if (classification.state === 'page_token') {
      const followupUrl = new URL(this.config.serpapiBaseUrl);
      followupUrl.searchParams.set('engine', 'google_ai_overview');
      followupUrl.searchParams.set('page_token', classification.page_token);
      followupUrl.searchParams.set('no_cache', 'true');
      followupUrl.searchParams.set('api_key', this.config.serpapiApiKey);
      const followup = await this.#search(followupUrl, 'page_token_followup');
      searches.push(followup.metadata);
      classification = classifyGoogleAioResponse(followup.body);
    }

    if (classification.state === 'provider_error') {
      throw providerError('serpapi_provider_error', { provider_error: classification.error, searches });
    }
    if (classification.state === 'aio_error') {
      throw providerError('google_aio_provider_error', { aio_error: classification.error, searches });
    }
    if (classification.state === 'page_token') {
      throw providerError('google_aio_unresolved_page_token', { searches });
    }

    const present = classification.state === 'present';
    const answer = present ? classification.answer : '';
    const citations = present ? classification.citations : [];

    return {
      provider_id: this.providerId,
      model_id: 'google-ai-overview',
      status: 'completed',
      raw_answer: answer,
      normalized_answer: {
        answer,
        outcome: present ? 'serpapi_aio_observed' : 'aio_not_triggered',
        acquisition_mode: 'serpapi_aio',
        ai_overview: present ? classification.overview : null,
        citations,
        search_metadata: Object.freeze(searches),
        initial_response_state: classifyGoogleAioResponse(initial.body).state,
        final_response_state: classification.state,
        parameters: Object.freeze({
          q: prompt.prompt_text,
          gl: String(region || 'US').toLowerCase(),
          hl: String(language || 'en').toLowerCase(),
          location: location || null,
          device: String(device || 'desktop').toLowerCase(),
          no_cache: true
        }),
        archived_payload: Object.freeze({
          ai_overview: present ? classification.overview : null,
          search_metadata: Object.freeze(searches)
        })
      },
      usage: {
        input_tokens: 0,
        output_tokens: Math.ceil(answer.length / 4),
        cost_estimate_usd: null,
        search_units: searches.length
      }
    };
  }

  async #search(url, stage) {
    const response = await this.fetchImpl(url);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw providerError('serpapi_http_error', { stage, http_status: response.status });
    }
    return Object.freeze({
      body,
      metadata: Object.freeze({ stage, ...parseSearchMetadata(body) })
    });
  }
}
