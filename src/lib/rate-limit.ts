/**
 * Rate limiting.
 *
 * HONEST LIMITATION: the default store is IN-MEMORY and therefore PER
 * INSTANCE. On Vercel (and any multi-instance/serverless platform) each
 * running instance keeps its own map, so the effective global limit is
 * `limit × number of warm instances`. It is a cheap first layer against
 * accidental hammering and naive scripts — it is NOT a distributed limiter
 * and must not be described as one.
 *
 * The call sites never change: to make limits global, implement
 * `RateLimitStore` against Redis/Upstash and call `setRateLimitStore()` once
 * at startup.
 */

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export interface RateLimitStore {
  hit(options: RateLimitOptions): Promise<RateLimitResult> | RateLimitResult;
}

/* ---------------- default: in-memory sliding window ---------------- */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export const memoryRateLimitStore: RateLimitStore = {
  hit({ key, limit, windowMs }) {
    sweep(windowMs);
    const now = Date.now();
    const bucket = buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= limit) {
      const oldest = bucket.timestamps[0];
      buckets.set(key, bucket);
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
      };
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);
    return { ok: true, retryAfterSeconds: 0 };
  },
};

let store: RateLimitStore = memoryRateLimitStore;

/** Swap in a shared store (e.g. Redis) without touching any call site. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

/**
 * Synchronous limiter used by route handlers. With the default in-memory
 * store this is exact; an async store should be awaited via `rateLimitAsync`.
 */
export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const result = store.hit(options);
  if (result instanceof Promise) {
    // An async store was installed; fail open rather than block the request
    // synchronously. Use rateLimitAsync() in that deployment.
    return { ok: true, retryAfterSeconds: 0 };
  }
  return result;
}

export async function rateLimitAsync(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  return store.hit(options);
}
