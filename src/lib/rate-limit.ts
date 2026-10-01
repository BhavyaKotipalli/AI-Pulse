/**
 * In-memory token bucket. Adequate for a single instance and local dev; swap for a
 * Postgres/Upstash-backed limiter when running multiple serverless instances (Phase 10).
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { capacity: number; refillPerMinute: number }): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: opts.capacity, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / 60_000) * opts.refillPerMinute;
  bucket.tokens = Math.min(opts.capacity, bucket.tokens + refill);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return { ok: false, retryAfterSec: Math.ceil(((1 - bucket.tokens) / opts.refillPerMinute) * 60) };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) buckets.clear(); // crude memory bound
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
