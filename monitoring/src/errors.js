export function createProviderError({ code, message, retryable = false, status, details }) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  if (status) error.status = status;
  if (details) error.details = details;
  return error;
}

export function classifyProviderError(error) {
  if (!error) {
    return {
      code: 'provider_unknown_error',
      message: 'Unknown provider error',
      retryable: false
    };
  }

  if (error.name === 'AbortError' || error.code === 'provider_timeout') {
    return {
      code: 'provider_timeout',
      message: error.message || 'Provider request timed out',
      retryable: true
    };
  }

  if (error.code) {
    return {
      code: error.code,
      message: error.message,
      retryable: Boolean(error.retryable)
    };
  }

  return {
    code: 'provider_error',
    message: error.message || String(error),
    retryable: false
  };
}

export function classifyHttpProviderError(status, responseBody = {}) {
  if (status === 401 || status === 403) {
    return createProviderError({
      code: 'provider_auth_error',
      message: `Provider authentication failed: ${status}`,
      retryable: false,
      status,
      details: responseBody
    });
  }

  if (status === 402) {
    return createProviderError({
      code: 'provider_payment_required',
      message: 'Provider payment required or insufficient credits',
      retryable: false,
      status,
      details: responseBody
    });
  }

  if (status === 429) {
    return createProviderError({
      code: 'provider_rate_limited',
      message: 'Provider rate limited the request',
      retryable: true,
      status,
      details: responseBody
    });
  }

  if (status >= 500) {
    return createProviderError({
      code: 'provider_server_error',
      message: `Provider server error: ${status}`,
      retryable: true,
      status,
      details: responseBody
    });
  }

  return createProviderError({
    code: 'provider_http_error',
    message: `Provider request failed: ${status}`,
    retryable: false,
    status,
    details: responseBody
  });
}
