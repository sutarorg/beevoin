/**
 * Lightweight in-memory sliding-window rate limiter.
 * Suitable for a single-instance deployment. For multi-instance/serverless,
 * swap the store for Redis/Upstash — the call sites stay identical.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

// Periodically drop stale buckets so the map doesn't grow forever.
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

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; retryAfterSeconds: number } {
  const { key, limit, windowMs } = options;
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
}
