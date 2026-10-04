const ACCOUNT_URL = 'https://serpapi.com/account.json';

function integer(value, name) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return normalized;
}

export class SerpApiAccountClient {
  constructor({ apiKey, fetchImpl = globalThis.fetch } = {}) {
    if (!String(apiKey || '').trim()) throw new TypeError('apiKey is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async snapshot() {
    const url = new URL(ACCOUNT_URL);
    url.searchParams.set('api_key', this.apiKey);
    const response = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`serpapi_account_http_${response.status}`);
    const used = body.this_month_usage ?? body.searches_used ?? 0;
    const limit = body.plan_searches ?? body.searches_per_month ?? body.total_searches_left;
    return Object.freeze({
      status: String(body.account_status || body.status || ''),
      plan_name: String(body.plan_name || body.plan || ''),
      searches_used: integer(used, 'searches_used'),
      searches_limit: integer(limit, 'searches_limit'),
      captured_at: new Date().toISOString()
    });
  }
}

export function buildSerpApiReconciliation({ before, after } = {}) {
  const beforeUsed = integer(before?.searches_used, 'before.searches_used');
  const afterUsed = integer(after?.searches_used, 'after.searches_used');
  if (afterUsed < beforeUsed) throw new Error('SerpApi usage counter moved backwards');
  const searches = afterUsed - beforeUsed;
  const freePlan = /free/i.test(String(after?.plan_name || ''));
  return Object.freeze({
    supplier: 'serpapi',
    local_billable_units: searches,
    supplier_billable_units: searches,
    billed_cost_micro_usd: freePlan ? 0 : null,
    reconciliation_status: 'reconciled',
    commercial_cost_evidence: freePlan ? 'zero_or_promotional' : 'billing_statement_required',
    plan_name: after.plan_name
  });
}
