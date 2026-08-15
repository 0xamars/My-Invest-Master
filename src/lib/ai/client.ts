import { isAiConfigured, resolveAiFeature } from "@/lib/ai/config";
import { logAiEvent, logAiFallback } from "@/lib/ai/log";
import { openRouterChatComplete } from "@/lib/ai/providers/openrouter";
import type { AiCompleteInput, AiCompletion } from "@/lib/ai/types";
import { AiNotConfiguredError, AiRequestError } from "@/lib/ai/types";

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof AiRequestError &&
    (error.status === 504 || /timed out/i.test(error.message))
  );
}

/**
 * Central server-only AI entrypoint.
 * Uses exactly resolveAiFeature(feature).config.model — never a different model on failure.
 */
export async function complete(
  input: AiCompleteInput,
): Promise<AiCompletion> {
  const resolved = resolveAiFeature(input.feature);
  const config = resolved.config;

  if (!isAiConfigured()) {
    logAiFallback(input.feature, "no_key");
    throw new AiNotConfiguredError("AI not configured");
  }

  const timeoutMs =
    input.timeoutMs != null && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
      ? Math.round(input.timeoutMs)
      : 0;
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise =
    timeoutMs > 0
      ? new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            ac.abort();
            reject(new AiRequestError("AI request timed out", 504));
          }, timeoutMs);
        })
      : null;

  const work = openRouterChatComplete({
    config,
    system: input.system,
    messages: input.messages,
    signal: timeoutMs > 0 ? ac.signal : undefined,
  });
  if (timeoutPromise) {
    void work.catch(() => {
      /* abort after race settles — avoid unhandled rejection */
    });
  }

  const started = Date.now();
  try {
    const result = timeoutPromise
      ? await Promise.race([work, timeoutPromise])
      : await work;
    logAiEvent({
      feature: input.feature,
      provider: "openrouter",
      model: config.model,
      source: resolved.source,
      status: "ok",
      ms: Date.now() - started,
    });
    return {
      text: result.text,
      feature: input.feature,
      model: config.model,
      provider: "openrouter",
    };
  } catch (error) {
    const timedOut = isTimeoutError(error) || ac.signal.aborted;
    const reason = timedOut
      ? "timeout"
      : error instanceof AiRequestError
        ? [error.status, error.message].filter(Boolean).join(" ")
        : error instanceof Error
          ? error.message
          : "unknown";
    logAiEvent({
      feature: input.feature,
      provider: "openrouter",
      model: config.model,
      source: resolved.source,
      status: "error",
      ms: Date.now() - started,
      reason,
    });
    if (timedOut) {
      throw new AiRequestError("AI request timed out", 504);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
