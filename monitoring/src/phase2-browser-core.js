import { chromium as defaultChromium } from 'playwright-core';

const RESOURCE_TYPES = Object.freeze({
  conservative: new Set(['image', 'media', 'font']),
  aggressive: new Set(['image', 'media', 'font', 'stylesheet'])
});

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

function positive(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer`);
  return value;
}

async function withHardDeadline(promise, timeoutMs, code, onTimeout) {
  const timeout = positive(timeoutMs, 'timeoutMs');
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          if (typeof onTimeout === 'function') {
            Promise.resolve()
              .then(onTimeout)
              .catch(() => undefined);
          }
          reject(new Phase2BrowserTransportError(code, `deadline_ms=${timeout}`));
        }, timeout);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertTransportArmed(config) {
  if (config.phase2BrowserCoreEnabled !== true) throw new Error('Phase 2 browser core is disabled');
  if (config.liveProviderTestingEnabled !== true) throw new Error('live provider testing is disabled');
  if (config.externalSpendMode !== 'allow') throw new Error('external spend mode denies browser transport');
  if (config.pocPaidRunEnabled !== true) throw new Error('paid POC gate is disabled');
  if (!config.phase2BrightDataCdpEndpoint) throw new Error('Bright Data CDP endpoint is not configured');
  if (!Number.isSafeInteger(config.phase2LocalBudgetMicroUsd) || config.phase2LocalBudgetMicroUsd <= 0) {
    throw new Error('Phase 2 local budget must be positive');
  }
}

export class Phase2BrowserTransportError extends Error {
  constructor(code = 'phase2_browser_transport_failed', diagnostic = null) {
    super('Phase 2 browser transport failed');
    this.name = 'Phase2BrowserTransportError';
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function safeTransportDiagnostic(error) {
  const raw = String(error?.message || error?.name || 'unknown_transport_error');
  return raw
    .replace(/wss?:\/\/[^@\s]+@/gi, 'wss://[redacted]@')
    .replace(/([?&](?:api_key|key|token|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]')
    .slice(0, 300);
}

export function installResourcePolicy(context, policy = 'conservative') {
  const blocked = RESOURCE_TYPES[policy];
  if (!blocked) throw new TypeError('resource policy must be conservative or aggressive');
  return context.route('**/*', async (route) => {
    const request = route.request();
    const type = request.resourceType();
    const url = request.url();
    const isProtectedData = ['xhr', 'fetch', 'eventsource', 'websocket'].includes(type);
    const isAdOrAnalytics = /(?:doubleclick|googletagmanager|google-analytics|segment\.com|hotjar)/i.test(url);
    if ((!isProtectedData && blocked.has(type)) || isAdOrAnalytics) await route.abort('blockedbyclient');
    else await route.continue();
  });
}

export function attachByteTelemetry(page) {
  let requestBytes = 0;
  let responseBytes = 0;
  const onRequest = (request) => {
    requestBytes += Buffer.byteLength(request.url());
    const postData = request.postDataBuffer();
    if (postData) requestBytes += postData.byteLength;
  };
  const onResponse = (response) => {
    const raw = response.headers()['content-length'];
    if (raw && /^\d+$/.test(raw)) responseBytes += Number(raw);
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  return Object.freeze({
    snapshot: () => Object.freeze({ local_request_bytes: requestBytes, local_response_bytes: responseBytes }),
    detach: () => {
      page.off('request', onRequest);
      page.off('response', onResponse);
    }
  });
}

export async function runIsolatedBrowserObservation(
  connection,
  {
    resourcePolicy = 'conservative',
    requestedGeo,
    signal,
    setupTimeoutMs = 30000,
    onStage,
    observationTimeoutMs = 180000
  } = {},
  work
) {
  if (
    !connection?.browser ||
    typeof connection.browser.newContext !== 'function' ||
    typeof connection.browser.close !== 'function'
  ) {
    throw new TypeError('connection.browser.newContext and close are required');
  }
  if (typeof work !== 'function') throw new TypeError('work must be a function');
  return withHardDeadline(
    runIsolatedBrowserObservationLifecycle(
      connection,
      { resourcePolicy, requestedGeo, signal, setupTimeoutMs, onStage },
      work
    ),
    observationTimeoutMs,
    'phase2_observation_deadline_exceeded',
    () => connection.browser.close()
  );
}

async function runIsolatedBrowserObservationLifecycle(
  connection,
  { resourcePolicy, requestedGeo, signal, setupTimeoutMs, onStage },
  work
) {
  const stage = (value) => {
    if (typeof onStage === 'function') onStage(value);
  };
  const requestedLanguage = String(requestedGeo?.language || '').toLowerCase();
  const locale = requestedLanguage === 'en'
    ? 'en-US'
    : requestedLanguage || undefined;
  stage('new_context');
  const context = await withHardDeadline(
    connection.browser.newContext({
      storageState: undefined,
      ...(locale ? { locale } : {})
    }),
    setupTimeoutMs,
    'phase2_observation_context_create_timeout',
    () => connection.browser.close()
  );
  try {
    stage('install_resource_policy');
    await withHardDeadline(
      installResourcePolicy(context, resourcePolicy),
      setupTimeoutMs,
      'phase2_observation_resource_policy_timeout'
    );
    stage('new_page');
    const page = await withHardDeadline(
      context.newPage(),
      setupTimeoutMs,
      'phase2_observation_page_create_timeout',
      () => connection.browser.close()
    );
    const telemetry = attachByteTelemetry(page);
    try {
      if (signal?.aborted) throw signal.reason;
      stage('work');
      const value = await work({ page, context, signal });
      const effectiveLanguage = String(value?.browser_language || '').toLowerCase();
      return Object.freeze({
        value,
        telemetry: telemetry.snapshot(),
        effective_geo: Object.freeze({
          ...(connection.actual_geo || {}),
          ...(value?.actual_geo || {}),
          ...(effectiveLanguage ? { language: effectiveLanguage } : {})
        })
      });
    } finally {
      telemetry.detach();
    }
  } finally {
    await withHardDeadline(
      context.close(),
      10000,
      'phase2_observation_context_close_timeout'
    ).catch(() => undefined);
  }
}

export function verifyActualGeo(requestedGeo, actualGeo) {
  if (!actualGeo || typeof actualGeo !== 'object') {
    return Object.freeze({ passed: false, reason: 'actual_geo_missing' });
  }
  const fields = ['region', 'language', 'device'];
  const mismatches = fields.filter((field) => String(requestedGeo?.[field] || '').toLowerCase() !== String(actualGeo[field] || '').toLowerCase());
  return Object.freeze({ passed: mismatches.length === 0, reason: mismatches.length ? 'actual_geo_mismatch' : 'matched', mismatches: Object.freeze(mismatches) });
}

export async function verifyPreparedPageCdpGeo({ page, context, requestedGeo } = {}) {
  if (!page || typeof page.evaluate !== 'function') throw new TypeError('page is required');
  if (!context || typeof context.newCDPSession !== 'function') throw new TypeError('context is required');
  const cdp = await context.newCDPSession(page);
  const geolocation = await cdp.send('Proxy.getGeolocation');
  const client = await page.evaluate(() => ({
    language: navigator.language,
    userAgent: navigator.userAgent
  }));
  const userAgent = String(client.userAgent || '');
  const actualGeo = Object.freeze({
    region: String(geolocation?.result?.country || '').toUpperCase(),
    language: String(client.language || '').split('-')[0].toLowerCase(),
    device: /ipad|tablet/i.test(userAgent)
      ? 'tablet'
      : /mobile|android|iphone/i.test(userAgent)
        ? 'mobile'
        : 'desktop'
  });
  const verification = verifyActualGeo(requestedGeo, actualGeo);
  if (!verification.passed) {
    throw new Error(
      `prepared page geo verification failed: ${verification.reason}; ` +
      `mismatches=${verification.mismatches?.join(',') || 'missing'}; ` +
      `actual=${JSON.stringify(actualGeo)}`
    );
  }
  return actualGeo;
}

export function createPageGeoProbe({ url, timeoutMs = 30000 } = {}) {
  const endpoint = nonEmpty(url, 'url');
  const parsed = new URL(endpoint);
  if (parsed.protocol !== 'https:') throw new TypeError('geo probe URL must use HTTPS');
  if (parsed.username || parsed.password || parsed.search) throw new TypeError('geo probe URL must not contain credentials or query secrets');
  return async ({ page, signal }) => {
    const response = await page.goto(endpoint, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (signal?.aborted) throw signal.reason;
    if (!response?.ok()) throw new Error('geo probe returned a non-success status');
    const body = await response.json();
    const client = await page.evaluate(() => ({ language: navigator.language, userAgent: navigator.userAgent }));
    const userAgent = String(client.userAgent || '');
    const device = /ipad|tablet/i.test(userAgent) ? 'tablet' : /mobile|android|iphone/i.test(userAgent) ? 'mobile' : 'desktop';
    return Object.freeze({
      region: String(body.country_code || body.countryCode || body.country || '').toUpperCase(),
      language: String(client.language || '').split('-')[0].toLowerCase(),
      device
    });
  };
}

export function createSameDomainBootstrapGeoProbe({ targetUrl, geoUrl, timeoutMs = 30000 } = {}) {
  const target = new URL(nonEmpty(targetUrl, 'targetUrl'));
  const endpoint = new URL(nonEmpty(geoUrl, 'geoUrl'));
  for (const [parsed, name] of [[target, 'targetUrl'], [endpoint, 'geoUrl']]) {
    if (parsed.protocol !== 'https:') throw new TypeError(`${name} must use HTTPS`);
    if (parsed.username || parsed.password) throw new TypeError(`${name} must not contain credentials`);
  }
  if (endpoint.search) throw new TypeError('geoUrl must not contain query secrets');
  return async ({ page, signal }) => {
    const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (signal?.aborted) throw signal.reason;
    if (!response?.ok()) throw new Error('bootstrap target returned a non-success status');
    const body = await page.evaluate(async ({ url, timeout }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const result = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!result.ok) throw new Error('geo probe returned a non-success status');
        return result.json();
      } finally {
        clearTimeout(timer);
      }
    }, { url: endpoint.href, timeout: timeoutMs });
    const client = await page.evaluate(() => ({ language: navigator.language, userAgent: navigator.userAgent }));
    const userAgent = String(client.userAgent || '');
    const device = /ipad|tablet/i.test(userAgent) ? 'tablet' : /mobile|android|iphone/i.test(userAgent) ? 'mobile' : 'desktop';
    return Object.freeze({
      region: String(body.country_code || body.countryCode || body.country || '').toUpperCase(),
      language: String(client.language || '').split('-')[0].toLowerCase(),
      device
    });
  };
}

export function createSurfaceCdpGeoProbe({
  targetUrls,
  timeoutMs = 30000,
  navigateTarget = true
} = {}) {
  if (!targetUrls || typeof targetUrls !== 'object' || Array.isArray(targetUrls)) {
    throw new TypeError('targetUrls must be an object');
  }
  const normalizedTargets = Object.freeze(Object.fromEntries(
    Object.entries(targetUrls).map(([surface, value]) => {
      const target = new URL(nonEmpty(value, `targetUrls.${surface}`));
      if (target.protocol !== 'https:' || target.username || target.password) {
        throw new TypeError(`targetUrls.${surface} must be a credential-free HTTPS URL`);
      }
      return [surface, target.href];
    })
  ));
  return async ({ page, context, surface, requestedGeo, signal }) => {
    const targetUrl = normalizedTargets[surface];
    if (!targetUrl) throw new TypeError(`target URL is missing for ${surface}`);
    const cdp = await context.newCDPSession(page);
    const requestedLanguage = String(requestedGeo?.language || '').toLowerCase();
    const requestedLocale = requestedLanguage === 'en' ? 'en-US' : requestedLanguage;
    if (requestedLanguage) {
      await cdp.send('Emulation.setLocaleOverride', { locale: requestedLocale });
    }
    let response = null;
    if (navigateTarget) {
      response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });
      if (signal?.aborted) throw signal.reason;
      if (!response?.ok()) throw new Error('bootstrap target returned a non-success status');
    }
    const geolocation = await cdp.send('Proxy.getGeolocation');
    const country = geolocation?.result?.country;
    let client = await page.evaluate(() => ({
      language: navigator.language,
      userAgent: navigator.userAgent
    }));
    if (
      requestedLanguage &&
      String(client.language || '').split('-')[0].toLowerCase() !== requestedLanguage
    ) {
      await cdp.send('Emulation.setLocaleOverride', { locale: requestedLocale });
      if (navigateTarget) {
        response = await page.reload({
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs
        });
        if (!response?.ok()) throw new Error('locale retry returned a non-success status');
      }
      client = await page.evaluate(() => ({
        language: navigator.language,
        userAgent: navigator.userAgent
      }));
    }
    const userAgent = String(client.userAgent || '');
    const device = /ipad|tablet/i.test(userAgent)
      ? 'tablet'
      : /mobile|android|iphone/i.test(userAgent)
        ? 'mobile'
        : 'desktop';
    return Object.freeze({
      region: String(country || '').toUpperCase(),
      language: String(client.language || '').split('-')[0].toLowerCase(),
      device
    });
  };
}

export class BrightDataBrowserConnector {
  constructor({
    config,
    chromium = defaultChromium,
    budgetCircuit,
    geoProbe,
    allowObservationLocalePin = false,
    deferGeoVerification = false
  } = {}) {
    if (!config) throw new TypeError('config is required');
    if (!chromium || typeof chromium.connectOverCDP !== 'function') throw new TypeError('chromium.connectOverCDP is required');
    if (!budgetCircuit || typeof budgetCircuit.reserve !== 'function') throw new TypeError('budgetCircuit is required');
    if (typeof geoProbe !== 'function') throw new TypeError('geoProbe is required');
    this.config = config;
    this.chromium = chromium;
    this.budgetCircuit = budgetCircuit;
    this.geoProbe = geoProbe;
    this.allowObservationLocalePin = allowObservationLocalePin === true;
    this.deferGeoVerification = deferGeoVerification === true;
  }

  async connect({ surface, requestedGeo, estimatedCostMicroUsd, signal } = {}) {
    assertTransportArmed(this.config);
    const normalizedSurface = nonEmpty(surface, 'surface');
    const estimate = positive(estimatedCostMicroUsd, 'estimatedCostMicroUsd');
    const reservation = this.budgetCircuit.reserve(estimate);
    let browser;
    try {
      browser = await this.chromium.connectOverCDP(this.config.phase2BrightDataCdpEndpoint, {
        timeout: this.config.phase2NavigationTimeoutMs,
        headers: this.config.phase2BrightDataCdpAuthHeader
          ? { Authorization: this.config.phase2BrightDataCdpAuthHeader }
          : undefined
      });
      if (signal?.aborted) throw signal.reason;
      const contexts = browser.contexts();
      const context = contexts[0] || await browser.newContext();
      const page = context.pages()[0] || await context.newPage();
      const cdp = await context.newCDPSession(page);
      const version = await cdp.send('Browser.getVersion');
      let providerSessionId = null;
      try {
        const response = await cdp.send('Browser.getSessionId');
        providerSessionId = response?.sessionId || response?.id || null;
      } catch (error) {
        throw new Error('Bright Data CDP does not expose Browser.getSessionId', { cause: error });
      }
      const actualGeo = this.deferGeoVerification
        ? null
        : await this.geoProbe({
          page,
          context,
          surface: normalizedSurface,
          requestedGeo,
          signal
        });
      if (!this.deferGeoVerification) {
        const geoVerification = verifyActualGeo(requestedGeo, actualGeo);
        const blockingMismatches = geoVerification.mismatches.filter(
          (field) => !(this.allowObservationLocalePin && field === 'language')
        );
        if (blockingMismatches.length) {
          throw new Error(
            `browser actual geo verification failed: ${geoVerification.reason}; ` +
            `mismatches=${blockingMismatches.join(',')}; ` +
            `actual=${JSON.stringify(actualGeo)}`
          );
        }
      }
      const normalizedProviderSessionId = nonEmpty(providerSessionId, 'providerSessionId');
      reservation.commit(estimate);
      return Object.freeze({
        browser,
        provider_session_id: normalizedProviderSessionId,
        surface: normalizedSurface,
        requested_geo: Object.freeze({ ...requestedGeo }),
        actual_geo: actualGeo ? Object.freeze({ ...actualGeo }) : null,
        geo_verification_deferred: this.deferGeoVerification,
        observation_locale_pin_required:
          !this.deferGeoVerification &&
          this.allowObservationLocalePin &&
          verifyActualGeo(requestedGeo, actualGeo).mismatches.includes('language'),
        browser_version: version?.product || null,
        protocol_version: version?.protocolVersion || null,
        connected_at: new Date().toISOString()
      });
    } catch (error) {
      reservation.release();
      if (browser) await browser.close().catch(() => undefined);
      if (error instanceof Phase2BrowserTransportError) throw error;
      throw new Phase2BrowserTransportError(
        error?.code || 'phase2_browser_transport_failed',
        safeTransportDiagnostic(error)
      );
    }
  }
}
