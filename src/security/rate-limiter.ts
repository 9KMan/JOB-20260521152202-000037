interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, RateLimitEntry> = new Map();
  private defaultConfig = { requests: 100, windowMs: 60000 }; // 100 req/min default

  check(clientId: string, toolName: string, config = this.defaultConfig): boolean {
    const key = `${clientId}:${toolName}`;
    const now = Date.now();
    
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { tokens: config.requests, lastRefill: now };
      this.buckets.set(key, entry);
    }

    // Refill tokens
    const elapsed = now - entry.lastRefill;
    const refillAmount = Math.floor((elapsed / config.windowMs) * config.requests);
    entry.tokens = Math.min(config.requests, entry.tokens + refillAmount);
    entry.lastRefill = now;

    if (entry.tokens > 0) {
      entry.tokens--;
      return true;
    }
    return false;
  }

  reset(clientId: string, toolName?: string): void {
    if (toolName) {
      this.buckets.delete(`${clientId}:${toolName}`);
    } else {
      // Reset all for client
      for (const key of this.buckets.keys()) {
        if (key.startsWith(`${clientId}:`)) {
          this.buckets.delete(key);
        }
      }
    }
  }
}