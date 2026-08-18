import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * Assistant / paid-key routes: 20 requests per minute per key.
 */
export function checkAssistantRateLimit(key: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  return checkRateLimit(`assistant:${key}`, { windowMs: 60_000, max: 20 });
}
