import { createHash } from 'node:crypto';

const TERMINAL_BLOCKERS = Object.freeze({
  login_wall: 'surface_login_wall',
  challenge: 'surface_challenge',
  rate_limit: 'surface_rate_limited'
});

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} must be a non-empty string`);
  return normalized;
}

function originalPrompt(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('promptText must be a non-empty string');
  return value;
}

function selectorList(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  return Object.freeze(value.map((item, index) => nonEmpty(item, `${name}[${index}]`)));
}

function httpsUrl(value, name) {
  const parsed = new URL(nonEmpty(value, name));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new TypeError(`${name} must be a credential-free HTTPS URL`);
  }
  return parsed.href;
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!await locator.isVisible().catch(() => false)) continue;
    if (
      typeof locator.getAttribute === 'function' &&
      await locator.getAttribute('aria-hidden').catch(() => null) === 'true'
    ) {
      continue;
    }
    if (
      typeof locator.isDisabled === 'function' &&
      await locator.isDisabled().catch(() => false)
    ) {
      continue;
    }
    return { selector, locator };
  }
  return null;
}

async function visibleText(page, selectors) {
  const match = await firstVisible(page, selectors);
  if (!match) return '';
  return String(await match.locator.innerText()).trim();
}

function normalizeCitation(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

export class GuestUiSurfaceError extends Error {
  constructor(code, message = code, diagnostic = null) {
    super(message);
    this.name = 'GuestUiSurfaceError';
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

async function promptDiagnostic(page) {
  try {
    const value = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      actions: [...document.querySelectorAll('button,a[href]')]
        .filter((node) => node.getClientRects().length)
        .slice(0, 24)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          text: String(node.innerText || node.getAttribute('aria-label') || '').trim().slice(0, 120),
          href: node.tagName.toLowerCase() === 'a'
            ? String(node.getAttribute('href') || '').slice(0, 180)
            : null,
          data_testid: node.getAttribute('data-testid')
        })),
      candidates: [...document.querySelectorAll('textarea,input,[contenteditable="true"],[role="textbox"]')]
        .slice(0, 12)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          placeholder: node.getAttribute('placeholder'),
          aria_label: node.getAttribute('aria-label'),
          role: node.getAttribute('role'),
          contenteditable: node.getAttribute('contenteditable'),
          disabled: Boolean(node.disabled),
          read_only: Boolean(node.readOnly),
          aria_hidden: node.getAttribute('aria-hidden'),
          visible: Boolean(node.getClientRects().length),
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
          parent_class: String(node.parentElement?.className || '').slice(0, 160)
        }))
    }));
    return JSON.stringify(value);
  } catch {
    return 'page_diagnostic_unavailable';
  }
}

async function answerDiagnostic(page) {
  try {
    const value = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      actions: [...document.querySelectorAll('nav a[href],aside a[href],button,[role="button"]')]
        .filter((node) => node.getClientRects().length)
        .slice(0, 40)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          text: String(node.innerText || node.getAttribute('aria-label') || '').trim().slice(0, 140),
          href: node.tagName.toLowerCase() === 'a'
            ? String(node.getAttribute('href') || '').slice(0, 200)
            : null,
          class_name: String(node.className || '').slice(0, 160)
        })),
      candidates: [...document.querySelectorAll(
        'main article,main [data-testid],main [class*="markdown"],main [class*="message"],main [class*="response"]'
      )]
        .slice(-20)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          data_testid: node.getAttribute('data-testid'),
          class_name: String(node.className || '').slice(0, 160),
          text: String(node.innerText || '').trim().slice(0, 160)
        }))
    }));
    return JSON.stringify(value);
  } catch {
    return 'answer_diagnostic_unavailable';
  }
}

export class GuestUiAdapter {
  constructor({
    surface,
    adapterVersion,
    url,
    selectors,
    completionStableMs = 750,
    navigationTimeoutMs = 120000,
    navigationWaitUntil = 'domcontentloaded',
    answerTimeoutMs = 120000
  }) {
    this.surface = nonEmpty(surface, 'surface');
    this.adapterVersion = nonEmpty(adapterVersion, 'adapterVersion');
    this.url = httpsUrl(url, 'url');
    this.selectors = Object.freeze({
      prompt: selectorList(selectors?.prompt, 'selectors.prompt'),
      submit: selectorList(selectors?.submit, 'selectors.submit'),
      answer: selectorList(selectors?.answer, 'selectors.answer'),
      citation: selectorList(selectors?.citation, 'selectors.citation'),
      newConversation: selectorList(selectors?.newConversation, 'selectors.newConversation'),
      loginWall: selectorList(selectors?.loginWall, 'selectors.loginWall'),
      challenge: selectorList(selectors?.challenge, 'selectors.challenge'),
      rateLimit: selectorList(selectors?.rateLimit, 'selectors.rateLimit'),
      busy: selectorList(selectors?.busy, 'selectors.busy')
    });
    this.completionStableMs = completionStableMs;
    this.navigationTimeoutMs = navigationTimeoutMs;
    if (!['commit', 'domcontentloaded', 'load'].includes(navigationWaitUntil)) {
      throw new TypeError('navigationWaitUntil must be commit, domcontentloaded, or load');
    }
    this.navigationWaitUntil = navigationWaitUntil;
    this.answerTimeoutMs = answerTimeoutMs;
  }

  async prepareSession({ page, context, requestedLanguage, requestedGeo, verifyLoadedPage }) {
    if (!page || typeof page.locator !== 'function') throw new TypeError('page is required');
    if (context && typeof context.clearCookies === 'function') await context.clearCookies();
    await page.goto(this.url, {
      waitUntil: this.navigationWaitUntil,
      timeout: this.navigationTimeoutMs
    });
    await this.#waitForPromptOrBlocker(
      page,
      Math.min(this.navigationTimeoutMs, 60000)
    );
    await this.prepareLoadedSurface({ page });
    await this.#waitForPromptOrBlocker(
      page,
      Math.min(this.navigationTimeoutMs, 15000)
    );
    await this.#throwIfBlocked(page);
    const actualGeo = typeof verifyLoadedPage === 'function'
      ? await verifyLoadedPage({ page, context, requestedGeo })
      : null;
    const prompt = await firstVisible(page, this.selectors.prompt);
    if (!prompt) {
      throw new GuestUiSurfaceError(
        'prompt_input_missing',
        'prompt_input_missing',
        await promptDiagnostic(page)
      );
    }
    const expectedLanguage = String(requestedLanguage || '').toLowerCase();
    let browserLanguage = null;
    if (expectedLanguage) {
      browserLanguage = String(await page.evaluate(() => navigator.language) || '')
        .split('-')[0]
        .toLowerCase();
      if (browserLanguage !== expectedLanguage) {
        throw new GuestUiSurfaceError(
          'surface_locale_mismatch',
          'surface_locale_mismatch',
          `requested=${expectedLanguage};actual=${browserLanguage || 'missing'}`
        );
      }
    }
    return Object.freeze({
      surface: this.surface,
      adapter_version: this.adapterVersion,
      browser_language: browserLanguage,
      actual_geo: actualGeo
    });
  }

  async prepareLoadedSurface() {}

  async afterPromptSubmitted() {}

  async openSurface({ page }) {
    await this.#throwIfBlocked(page);
    const prompt = await firstVisible(page, this.selectors.prompt);
    if (!prompt) {
      throw new GuestUiSurfaceError(
        'prompt_input_missing',
        'prompt_input_missing',
        await promptDiagnostic(page)
      );
    }
    return prompt.selector;
  }

  async submitOriginalPrompt({ page, promptText }) {
    const exactPrompt = originalPrompt(promptText);
    await this.#throwIfBlocked(page);
    const prompt = await firstVisible(page, this.selectors.prompt);
    if (!prompt) {
      throw new GuestUiSurfaceError(
        'prompt_input_missing',
        'prompt_input_missing',
        await promptDiagnostic(page)
      );
    }
    await prompt.locator.fill(exactPrompt);
    const observed = await prompt.locator.inputValue()
      .catch(() => prompt.locator.innerText());
    if (observed !== exactPrompt) throw new GuestUiSurfaceError('original_prompt_integrity_failed');
    const submit = await firstVisible(page, this.selectors.submit);
    if (submit) await submit.locator.click();
    else await prompt.locator.press('Enter');
    return Object.freeze({
      prompt_sha256: createHash('sha256').update(exactPrompt).digest('hex'),
      submitted_length: exactPrompt.length
    });
  }

  async waitForCompletion({ page }) {
    const deadline = Date.now() + this.answerTimeoutMs;
    let previous = '';
    let stableSince = 0;
    while (Date.now() < deadline) {
      await this.#throwIfBlocked(page);
      const busy = await firstVisible(page, this.selectors.busy);
      const answer = await visibleText(page, this.selectors.answer);
      if (answer && !busy) {
        if (answer === previous) {
          if (!stableSince) stableSince = Date.now();
          if (Date.now() - stableSince >= this.completionStableMs) return answer;
        } else {
          previous = answer;
          stableSince = Date.now();
        }
      }
      await page.waitForTimeout(Math.min(250, Math.max(1, deadline - Date.now())));
    }
    throw new GuestUiSurfaceError(
      'answer_timeout',
      'answer_timeout',
      await answerDiagnostic(page)
    );
  }

  async extractAnswer({ page }) {
    const answer = await visibleText(page, this.selectors.answer);
    if (!answer) throw new GuestUiSurfaceError('answer_missing');
    return answer;
  }

  async extractCitations({ page }) {
    const citations = new Set();
    for (const selector of this.selectors.citation) {
      const hrefs = await page.locator(selector).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('href')).filter(Boolean)
      ).catch(() => []);
      for (const href of hrefs) {
        const normalized = normalizeCitation(href);
        if (normalized) citations.add(normalized);
      }
    }
    return Object.freeze([...citations]);
  }

  async detectLoginWall({ page }) {
    return Boolean(await firstVisible(page, this.selectors.loginWall));
  }

  async detectChallenge({ page }) {
    return Boolean(await firstVisible(page, this.selectors.challenge));
  }

  async detectRateLimit({ page }) {
    return Boolean(await firstVisible(page, this.selectors.rateLimit));
  }

  validateObservation({ answer, citations = [] }) {
    const normalizedAnswer = nonEmpty(answer, 'answer');
    if (!Array.isArray(citations)) throw new TypeError('citations must be an array');
    return Object.freeze({
      valid: true,
      answer_length: normalizedAnswer.length,
      citation_count: citations.length
    });
  }

  buildEvidence({ promptText, answer, citations, submittedAt, completedAt }) {
    const exactPrompt = originalPrompt(promptText);
    const normalizedAnswer = nonEmpty(answer, 'answer');
    const normalizedCitations = [...new Set((citations || []).map(normalizeCitation).filter(Boolean))];
    return Object.freeze({
      schema_version: 'phase3-guest-ui-evidence-v1',
      surface: this.surface,
      acquisition_mode: 'web_ui',
      adapter_version: this.adapterVersion,
      prompt_sha256: createHash('sha256').update(exactPrompt).digest('hex'),
      answer_sha256: createHash('sha256').update(normalizedAnswer).digest('hex'),
      answer_text: normalizedAnswer,
      citations: Object.freeze(normalizedCitations),
      submitted_at: submittedAt || null,
      completed_at: completedAt || null,
      selector_fingerprint: createHash('sha256')
        .update(JSON.stringify(this.selectors))
        .digest('hex')
    });
  }

  async resetConversation({ page }) {
    const reset = await firstVisible(page, this.selectors.newConversation);
    if (reset) {
      await reset.locator.click();
      const prompt = await firstVisible(page, this.selectors.prompt);
      if (!prompt) throw new GuestUiSurfaceError('conversation_reset_failed');
      return 'ui_reset';
    }
    await page.goto(this.url, {
      waitUntil: this.navigationWaitUntil,
      timeout: this.navigationTimeoutMs
    });
    await this.#throwIfBlocked(page);
    return 'navigation_reset';
  }

  async observe({ page, context, promptText, requestedGeo, onStage, verifyLoadedPage }) {
    const stage = (value) => {
      if (typeof onStage === 'function') onStage(value);
    };
    stage('prepare_session');
    const prepared = await this.prepareSession({
      page,
      context,
      requestedLanguage: requestedGeo?.language,
      requestedGeo,
      verifyLoadedPage
    });
    stage('open_surface');
    await this.openSurface({ page });
    const submittedAt = new Date().toISOString();
    stage('submit_prompt');
    await this.submitOriginalPrompt({ page, promptText });
    await this.afterPromptSubmitted({ page });
    stage('wait_for_completion');
    await this.waitForCompletion({ page });
    stage('extract_answer');
    const answer = await this.extractAnswer({ page });
    stage('extract_citations');
    const citations = await this.extractCitations({ page });
    const validation = this.validateObservation({ answer, citations });
    const completedAt = new Date().toISOString();
    const evidence = this.buildEvidence({ promptText, answer, citations, submittedAt, completedAt });
    let conversationResetStatus = 'completed';
    let conversationResetErrorCode = null;
    try {
      stage('reset_conversation');
      await this.resetConversation({ page });
    } catch (error) {
      conversationResetStatus = 'failed';
      conversationResetErrorCode = String(error?.code || error?.name || 'conversation_reset_failed');
    }
    stage('completed');
    return Object.freeze({
      provider_id: this.surface,
      status: 'completed',
      outcome: 'web_ui_observed',
      acquisition_mode: 'web_ui',
      answer,
      citations,
      validation,
      evidence,
      browser_language: prepared.browser_language,
      actual_geo: prepared.actual_geo,
      conversation_reset_status: conversationResetStatus,
      conversation_reset_error_code: conversationResetErrorCode
    });
  }

  async #throwIfBlocked(page) {
    for (const [method, code] of Object.entries(TERMINAL_BLOCKERS)) {
      const selectors = this.selectors[method === 'login_wall' ? 'loginWall' : method === 'rate_limit' ? 'rateLimit' : method];
      const blocked = await firstVisible(page, selectors);
      if (!blocked) continue;
      if (method === 'login_wall' && await firstVisible(page, this.selectors.prompt)) {
        continue;
      }
      throw new GuestUiSurfaceError(
        code,
        code,
        JSON.stringify({
          blocker_selector: blocked.selector,
          page: await promptDiagnostic(page)
        })
      );
    }
  }

  async #waitForPromptOrBlocker(page, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await firstVisible(page, this.selectors.prompt)) return true;
      await this.#throwIfBlocked(page);
      await page.waitForTimeout(Math.min(250, Math.max(1, deadline - Date.now())));
    }
    return false;
  }
}
