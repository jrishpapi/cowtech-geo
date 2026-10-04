import { createProviderError } from './errors.js';

export function assertProviderConfigured(providerMode) {
  const mode = String(providerMode || '').trim();
  const code = !mode || mode === 'unconfigured'
    ? 'provider_not_configured'
    : ['mock', 'fixture'].includes(mode) && process.env.NODE_ENV !== 'test'
      ? 'mock_provider_test_only'
      : null;
  if (code) {
    const error = createProviderError({
      code,
      message: code === 'provider_not_configured'
        ? 'Configure your own AI provider before running this operation.'
        : 'Synthetic providers are restricted to automated tests.',
      retryable: false
    });
    error.statusCode = 503;
    throw error;
  }
  return mode;
}
