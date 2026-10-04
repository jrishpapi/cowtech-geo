import { GuestUiAdapter } from '../phase3-guest-ui-adapter.js';

export class ChatgptGuestUiAdapter extends GuestUiAdapter {
  constructor(options = {}) {
    super({
      surface: 'chatgpt_ui',
      adapterVersion: 'chatgpt-guest-ui-v2',
      url: 'https://chatgpt.com/',
      selectors: {
        prompt: ['#prompt-textarea', '[contenteditable="true"][data-virtualkeyboard="true"]', 'textarea[placeholder]'],
        submit: ['button[data-testid="send-button"]', 'button[aria-label*="Send"]'],
        answer: ['[data-message-author-role="assistant"]:last-of-type', 'article[data-testid^="conversation-turn"]:last-of-type'],
        citation: ['[data-message-author-role="assistant"]:last-of-type a[href]', 'article[data-testid^="conversation-turn"]:last-of-type a[href]'],
        newConversation: ['a[href="/"]', 'button[aria-label*="New chat"]'],
        loginWall: ['a[href*="auth/login"]', 'button[data-testid="login-button"]'],
        challenge: ['iframe[src*="challenge"]', '[id*="cf-challenge"]', '[data-testid*="challenge"]'],
        rateLimit: ['[data-testid="rate-limit-modal"]', '[role="alert"]:has-text("limit")'],
        busy: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop"]']
      },
      ...options
    });
  }
}
