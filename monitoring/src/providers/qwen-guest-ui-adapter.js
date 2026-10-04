import { GuestUiAdapter } from '../phase3-guest-ui-adapter.js';

async function clickVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (!await locator.isVisible().catch(() => false)) return false;
  await locator.click({ timeout: 5000 });
  await page.waitForTimeout(250);
  return true;
}

export class QwenGuestUiAdapter extends GuestUiAdapter {
  constructor(options = {}) {
    super({
      surface: 'qwen_ui',
      adapterVersion: 'qwen-guest-ui-v8',
      url: 'https://chat.qwen.ai/',
      navigationWaitUntil: 'commit',
      navigationTimeoutMs: 60000,
      answerTimeoutMs: 75000,
      selectors: {
        prompt: ['textarea[placeholder]', '[contenteditable="true"][role="textbox"]', 'textarea'],
        submit: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
        answer: [
          'main [data-message-author-role="assistant"]:last-of-type',
          'main [data-role="assistant"]:last-of-type',
          'main [data-testid*="message"]:last-of-type',
          'main [class*="assistant"]:last-of-type [class*="markdown"]',
          'main .qwen-markdown:last-of-type',
          'main .markdown-body:last-of-type',
          'main .prose:last-of-type',
          'main [class*="markdown"]:last-of-type'
        ],
        citation: [
          'main [data-message-author-role="assistant"]:last-of-type a[href]',
          'main [data-role="assistant"]:last-of-type a[href]',
          'main [data-testid*="message"]:last-of-type a[href]',
          'main .qwen-markdown:last-of-type a[href]',
          'main .markdown-body:last-of-type a[href]',
          'main [class*="markdown"]:last-of-type a[href]'
        ],
        newConversation: ['a[href="/"]', 'button[aria-label*="New chat" i]', 'button:has-text("New chat")'],
        loginWall: ['a[href*="/login"]', 'button:has-text("Log in")', '[data-testid*="login"]'],
        challenge: ['iframe[src*="challenge"]', 'iframe[src*="captcha"]', '[data-testid*="challenge"]'],
        rateLimit: ['[role="alert"]:has-text("limit")', '[role="alert"]:has-text("稍后")'],
        busy: ['button[aria-label*="Stop" i]', '[data-testid*="generating"]']
      },
      ...options
    });
  }

  async prepareLoadedSurface({ page }) {
    await clickVisible(page, 'button:has-text("Stay logged out")').catch(() => false);
    await clickVisible(page, 'button.guidance-pc-close-btn').catch(() => false);
    await clickVisible(page, '.new-chat').catch(() => false);
    await clickVisible(page, 'button:has-text("Stay logged out")').catch(() => false);
    await clickVisible(page, 'button.guidance-pc-close-btn').catch(() => false);
  }

  async afterPromptSubmitted({ page }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await clickVisible(page, 'button:has-text("Stay logged out")').catch(() => false)) {
        await clickVisible(page, 'button.send-button').catch(() => false);
        return;
      }
      await page.waitForTimeout(250);
    }
  }
}
