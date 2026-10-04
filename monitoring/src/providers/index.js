import { MockProvider } from './mock-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { PerplexityProvider } from './perplexity-provider.js';
import { GoogleAioProvider } from './google-aio-provider.js';
import { ChatgptApiLikeProvider } from './chatgpt-api-like-provider.js';
import { GeminiApiLikeProvider } from './gemini-api-like-provider.js';
import { ClaudeApiLikeProvider } from './claude-api-like-provider.js';
import { GrokApiLikeProvider } from './grok-api-like-provider.js';
import { assertProviderConfigured } from '../provider-configuration.js';

export function createProvider(mode = 'unconfigured') {
  mode = assertProviderConfigured(mode);
  if (mode === 'mock') return new MockProvider();
  if (mode === 'openrouter') return new OpenRouterProvider();
  if (mode === 'perplexity') return new PerplexityProvider();
  if (mode === 'google_ai_overview') return new GoogleAioProvider();
  if (mode === 'chatgpt_api_like') return new ChatgptApiLikeProvider();
  if (mode === 'gemini_api_like') return new GeminiApiLikeProvider();
  if (mode === 'claude_api_like') return new ClaudeApiLikeProvider();
  if (mode === 'grok_api_like') return new GrokApiLikeProvider();
  throw new Error(`Unknown provider mode: ${mode}`);
}
