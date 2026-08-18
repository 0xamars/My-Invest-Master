/**
 * In-memory per-instance rate limiter. Resets on cold start — enough to
 * blunt casual abuse of public market/price routes without a WAF.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  options?: { windowMs?: number; max?: number },
): { allowed: boolean; retryAfterSec: number } {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options?.max ?? DEFAULT_MAX_REQUESTS;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimitJsonResponse(
  request: Request,
  bucket: string,
  options?: { windowMs?: number; max?: number },
): Response | null {
  const ip = clientIpFromRequest(request);
  const rate = checkRateLimit(`${bucket}:${ip}`, options);
  if (rate.allowed) return null;
  return Response.json(
    { error: `Too many requests. Try again in ${rate.retryAfterSec}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    },
  );
}

/** Test helper — clear buckets between cases. */
export function resetRateLimitForTests(): void {
  buckets.clear();
}
