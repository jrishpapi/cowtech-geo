function keyFor({ surface, environment, region, language, device }) {
  return [surface, environment, region, language, device].map((value) => String(value || '').trim()).join('|');
}

async function closeBrowserWithin(browser, timeoutMs = 10000) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => browser.close()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('browser close deadline exceeded')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class Phase2BrowserSessionPool {
  constructor({
    connector,
    maxSessionMs = 3600000,
    maxIdleMs = 300000,
    closeTimeoutMs = 10000,
    now = () => Date.now()
  } = {}) {
    if (!connector || typeof connector.connect !== 'function') throw new TypeError('connector.connect is required');
    this.connector = connector;
    this.maxSessionMs = maxSessionMs;
    this.maxIdleMs = maxIdleMs;
    this.closeTimeoutMs = closeTimeoutMs;
    this.now = now;
    this.entries = new Map();
  }

  async lease({ surface, environment = 'phase2_guest', requestedGeo, estimatedCostMicroUsd, signal } = {}) {
    const key = keyFor({ surface, environment, ...requestedGeo });
    await this.sweep();
    let entry = this.entries.get(key);
    if (!entry) {
      const connection = await this.connector.connect({ surface, requestedGeo, estimatedCostMicroUsd, signal });
      entry = { connection, createdAt: this.now(), lastUsedAt: this.now(), leased: false, useCount: 0 };
      this.entries.set(key, entry);
    }
    if (entry.leased) throw new Error('browser session is already leased');
    entry.leased = true;
    entry.lastUsedAt = this.now();
    entry.useCount += 1;
    let released = false;
    return Object.freeze({
      connection: entry.connection,
      warm: entry.useCount > 1,
      use_count: entry.useCount,
      release: () => {
        if (released) throw new Error('browser session lease is already released');
        released = true;
        entry.leased = false;
        entry.lastUsedAt = this.now();
      },
      destroy: async () => {
        if (released) throw new Error('browser session lease is already released');
        released = true;
        entry.leased = false;
        this.entries.delete(key);
        await closeBrowserWithin(entry.connection.browser, this.closeTimeoutMs).catch(() => undefined);
      }
    });
  }

  async sweep() {
    const now = this.now();
    const closing = [];
    for (const [key, entry] of this.entries) {
      if (entry.leased) continue;
      if (now - entry.createdAt >= this.maxSessionMs || now - entry.lastUsedAt >= this.maxIdleMs) {
        this.entries.delete(key);
        closing.push(closeBrowserWithin(entry.connection.browser, this.closeTimeoutMs));
      }
    }
    await Promise.allSettled(closing);
  }

  async closeAll() {
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.allSettled(
      entries.map((entry) => closeBrowserWithin(entry.connection.browser, this.closeTimeoutMs))
    );
  }
}
