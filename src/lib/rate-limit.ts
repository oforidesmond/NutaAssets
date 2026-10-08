/**
 * Simple in-memory sliding-window rate limiter for serverless.
 * Resets on cold start — acceptable on Hobby (D31).
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(input.key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(
    (t) => now - t < input.windowMs,
  );
  if (bucket.timestamps.length >= input.limit) {
    const oldest = bucket.timestamps[0]!;
    buckets.set(input.key, bucket);
    return { ok: false, retryAfterMs: input.windowMs - (now - oldest) };
  }
  bucket.timestamps.push(now);
  buckets.set(input.key, bucket);
  return { ok: true };
}

/** Import: 30 chunk requests per user per minute. */
export function limitImport(userId: string) {
  return rateLimit({
    key: `import:${userId}`,
    limit: 30,
    windowMs: 60_000,
  });
}
