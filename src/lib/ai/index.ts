export { complete } from "@/lib/ai/client";
export {
  AI_FEATURES,
  getAiFeatureConfig,
  getNarrativeTimeoutMs,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  isAiConfigured,
  isAiModelOverride,
  resolveAiFeature,
} from "@/lib/ai/config";
export { logAiEvent, logAiFallback } from "@/lib/ai/log";
export {
  AiNotConfiguredError,
  AiRequestError,
  type AiCompleteInput,
  type AiCompletion,
  type AiFeatureConfig,
  type AiFeatureId,
  type AiMessage,
} from "@/lib/ai/types";
