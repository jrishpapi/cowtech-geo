import { GuestUiAdapter } from '../phase3-guest-ui-adapter.js';

export class GeminiGuestUiAdapter extends GuestUiAdapter {
  constructor(options = {}) {
    super({
      surface: 'gemini_ui',
      adapterVersion: 'gemini-guest-ui-v2',
      url: 'https://gemini.google.com/app',
      selectors: {
        prompt: ['rich-textarea div[contenteditable="true"]', 'textarea[aria-label*="prompt" i]', '[contenteditable="true"][role="textbox"]'],
        submit: ['button[aria-label*="Send" i]', 'button[data-test-id="send-button"]'],
        answer: ['model-response:last-of-type .markdown', 'main [data-test-id="response"]:last-of-type', 'main .response-container:last-of-type'],
        citation: ['model-response:last-of-type a[href]', 'main [data-test-id="response"]:last-of-type a[href]'],
        newConversation: ['a[href="/app"]', 'button[aria-label*="New chat" i]'],
        loginWall: [
          'body:not(:has(rich-textarea div[contenteditable="true"])) a[href*="accounts.google.com"]',
          'body:not(:has([contenteditable="true"][role="textbox"])) button[aria-label*="Sign in" i]'
        ],
        challenge: ['iframe[src*="challenge"]', 'iframe[src*="recaptcha"]', '[data-testid*="challenge"]'],
        rateLimit: ['[role="alert"]:has-text("limit")', '[role="alert"]:has-text("try again later")'],
        busy: ['button[aria-label*="Stop response" i]', 'mat-progress-spinner']
      },
      ...options
    });
  }
}
