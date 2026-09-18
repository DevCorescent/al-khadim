/**
 * Fixed-window, per-IP rate limiter (in-memory, per server process) standing
 * in for express-rate-limit. Create one at module scope and call it at the top
 * of a controller: `const limiter = rateLimit({ windowMs, max }); ... limiter(req);`
 */
import type { NextRequest } from 'next/server';
import { HttpError, clientIp } from './http';

interface Options {
  windowMs: number;
  max: number;
  message?: string;
}

export function rateLimit({ windowMs, max, message = 'Too many requests, please try again later.' }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: NextRequest) => {
    // Escape hatch for the automated API tests; never set this in production.
    if (process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production') return;
    const now = Date.now();
    const key = clientIp(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
      if (hits.size > 10_000) {
        hits.forEach((v, k) => {
          if (v.resetAt <= now) hits.delete(k);
        });
      }
    }
    if (++entry.count > max) throw new HttpError(429, message);
  };
}
