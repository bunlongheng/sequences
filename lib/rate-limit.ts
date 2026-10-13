// Best-effort in-memory fixed-window rate limiter, per instance (a warm Vercel
// function or the long-lived next start). Not a global guarantee, but it blunts
// a single client hammering the passcode gate.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, { key, limit, windowMs }: { key: string; limit: number; windowMs: number }): { ok: boolean; retryAfter?: number } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  const id = `${key}:${ip}`;
  let bucket = buckets.get(id);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(id, bucket);
  }
  bucket.count += 1;
  return bucket.count > limit ? { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) } : { ok: true };
}
