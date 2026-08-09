import {
  getAiFeatureConfig,
  isAiConfigured,
  isAiModelOverride,
} from "@/lib/ai/config";
import { logAiEvent, logAiFallback } from "@/lib/ai/log";
import { openRouterChatComplete } from "@/lib/ai/providers/openrouter";
import type { AiCompleteInput, AiCompletion } from "@/lib/ai/types";
import { AiNotConfiguredError, AiRequestError } from "@/lib/ai/types";

/**
 * Central server-only AI entrypoint.
 * Resolves model from AI_FEATURES (or AI_MODEL_OVERRIDE) then calls OpenRouter.
 */
export async function complete(
  input: AiCompleteInput,
): Promise<AiCompletion> {
  const override = isAiModelOverride();
  const config = getAiFeatureConfig(input.feature);

  if (!isAiConfigured()) {
    logAiFallback(input.feature, "no_key");
    throw new AiNotConfiguredError("AI not configured");
  }

  const started = Date.now();
  try {
    const result = await openRouterChatComplete({
      config,
      system: input.system,
      messages: input.messages,
    });
    logAiEvent({
      feature: input.feature,
      provider: "openrouter",
      model: result.model,
      status: "ok",
      ms: Date.now() - started,
      override,
    });
    return {
      text: result.text,
      feature: input.feature,
      model: result.model,
      provider: "openrouter",
    };
  } catch (error) {
    const reason =
      error instanceof AiRequestError
        ? [error.status, error.message].filter(Boolean).join(" ")
        : error instanceof Error
          ? error.message
          : "unknown";
    logAiEvent({
      feature: input.feature,
      provider: "openrouter",
      model: config.model,
      status: "error",
      ms: Date.now() - started,
      override,
      reason,
    });
    throw error;
  }
}
