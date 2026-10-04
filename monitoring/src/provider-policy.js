import { createProviderError } from './errors.js';
import { assertProviderConfigured } from './provider-configuration.js';

export function isPaidProviderMode(providerMode) {
  return providerMode !== 'mock';
}

export function assertPaidProviderAllowed({ provider_mode = 'unconfigured', allow_paid_provider = false }) {
  assertProviderConfigured(provider_mode);
  if (!isPaidProviderMode(provider_mode)) {
    return { allowed: true, paid: false };
  }

  if (allow_paid_provider === true) {
    return { allowed: true, paid: true };
  }

  throw createProviderError({
    code: 'paid_provider_not_allowed',
    message: `Paid provider mode requires allow_paid_provider=true: ${provider_mode}`,
    retryable: false
  });
}
