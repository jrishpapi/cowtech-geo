import { GuestUiAdapter } from '../phase3-guest-ui-adapter.js';

export class GrokGuestUiAdapter extends GuestUiAdapter {
  constructor(options = {}) {
    super({
      surface: 'grok_ui',
      adapterVersion: 'grok-guest-ui-v5',
      url: 'https://grok.com/',
      navigationWaitUntil: 'commit',
      navigationTimeoutMs: 60000,
      selectors: {
        prompt: [
          'textarea:not([aria-hidden="true"]):not([disabled])',
          '[contenteditable="true"][role="textbox"]:not([aria-hidden="true"])'
        ],
        submit: ['button[aria-label*="Submit" i]', 'button[aria-label*="Send" i]', 'button[type="submit"]'],
        answer: [
          'main [data-message-author-role="assistant"]:last-of-type',
          'main [data-role="assistant"]:last-of-type',
          'main article:last-of-type',
          'main [data-testid*="response"]:last-of-type',
          'main .prose:last-of-type',
          'main [class*="markdown"]:last-of-type'
        ],
        citation: [
          'main [data-message-author-role="assistant"]:last-of-type a[href]',
          'main [data-role="assistant"]:last-of-type a[href]',
          'main article:last-of-type a[href]',
          'main [data-testid*="response"]:last-of-type a[href]',
          'main [class*="markdown"]:last-of-type a[href]'
        ],
        newConversation: ['a[href="/"]', 'button[aria-label*="New chat" i]'],
        loginWall: ['a[href*="/sign-in"]', 'a[href*="/login"]', 'button:has-text("Sign in")'],
        challenge: ['iframe[src*="challenge"]', '[id*="cf-challenge"]', '[data-testid*="challenge"]'],
        rateLimit: ['[role="alert"]:has-text("limit")', '[data-testid*="rate-limit"]'],
        busy: ['button[aria-label*="Stop" i]', '[data-testid*="loading"]']
      },
      ...options
    });
  }
}
