import { Injectable } from "@nestjs/common";

type Attempt = { count: number; lastAt: number };

const WINDOW_MS = 15 * 60 * 1000;
const DELAY_AFTER = 5;
const MAX_DELAY_MS = 15_000;

@Injectable()
export class LoginThrottle {
  private readonly attempts = new Map<string, Attempt>();

  key(email: string, ip: string) {
    return `${ip}|${email.toLowerCase()}`;
  }

  async wait(key: string) {
    this.prune();
    const row = this.attempts.get(key);
    if (!row || row.count < DELAY_AFTER) return;
    const extra = row.count - DELAY_AFTER;
    const delay = Math.min(1000 * 2 ** extra, MAX_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  fail(key: string) {
    const row = this.attempts.get(key);
    if (!row) {
      this.attempts.set(key, { count: 1, lastAt: Date.now() });
      return;
    }
    row.count += 1;
    row.lastAt = Date.now();
  }

  reset(key: string) {
    this.attempts.delete(key);
  }

  private prune() {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, row] of this.attempts) {
      if (row.lastAt < cutoff) this.attempts.delete(key);
    }
  }
}
