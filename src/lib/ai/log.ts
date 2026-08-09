import type { AiFeatureId } from "@/lib/ai/types";

export type AiLogStatus = "ok" | "error" | "fallback" | "cache_hit";
export type AiFallbackReason = "no_key" | "error" | "empty";

function sanitizeReason(raw: string): string {
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-or-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/sk-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/apikey=[^&\s]+/gi, "apikey=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/** One-line server log for AI usage. Never logs keys or prompts. */
export function logAiEvent(input: {
  feature: AiFeatureId | string;
  status: AiLogStatus;
  provider?: string;
  model?: string;
  ms?: number;
  override?: boolean;
  reason?: string;
}): void {
  const parts = [`[ai] feature=${input.feature}`];
  if (input.provider) parts.push(`provider=${input.provider}`);
  if (input.model) parts.push(`model=${input.model}`);
  parts.push(`status=${input.status}`);
  if (input.ms != null && Number.isFinite(input.ms)) {
    parts.push(`ms=${Math.max(0, Math.round(input.ms))}`);
  }
  if (input.override) parts.push("override=true");
  if (input.reason) parts.push(`reason=${sanitizeReason(input.reason)}`);
  console.info(parts.join(" "));
}

export function logAiFallback(
  feature: AiFeatureId | string,
  reason: AiFallbackReason,
): void {
  logAiEvent({ feature, status: "fallback", reason });
}
