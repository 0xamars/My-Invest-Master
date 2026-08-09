export { complete } from "@/lib/ai/client";
export {
  AI_FEATURES,
  getAiFeatureConfig,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  isAiConfigured,
  isAiModelOverride,
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
