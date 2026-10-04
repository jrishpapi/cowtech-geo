import { GuestUiAdapter } from '../phase3-guest-ui-adapter.js';

export class PerplexityGuestUiAdapter extends GuestUiAdapter {
  constructor(options = {}) {
    super({
      surface: 'perplexity_ui',
      adapterVersion: 'perplexity-guest-ui-v2',
      url: 'https://www.perplexity.ai/',
      selectors: {
        prompt: ['textarea[placeholder]', '[contenteditable="true"][role="textbox"]'],
        submit: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
        answer: ['main [data-testid="answer"]:last-of-type', 'main .prose:last-of-type', 'main [class*="answer"]:last-of-type'],
        citation: ['main [data-testid="answer"]:last-of-type a[href]', 'main .prose:last-of-type a[href]'],
        newConversation: ['a[href="/"]', 'button[aria-label*="New Thread"]', 'button[aria-label*="New"]'],
        loginWall: ['a[href*="/login"]', '[data-testid="signup-wall"]'],
        challenge: ['iframe[src*="challenge"]', '[id*="cf-challenge"]', '[data-testid*="challenge"]'],
        rateLimit: ['[role="alert"]:has-text("limit")', '[data-testid*="rate-limit"]'],
        busy: ['button[aria-label*="Stop"]', '[data-testid="answer-loading"]']
      },
      ...options
    });
  }
}
