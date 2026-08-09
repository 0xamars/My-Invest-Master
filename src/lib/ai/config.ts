import type { AiFeatureConfig, AiFeatureId } from "@/lib/ai/types";

/**
 * Sole source of OpenRouter model IDs. Do not hardcode models elsewhere.
 * Override every feature at once with AI_MODEL_OVERRIDE while testing.
 */
export const AI_FEATURES: Record<AiFeatureId, AiFeatureConfig> = {
  "analysis.company_blurb": {
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.3,
    maxTokens: 200,
  },
  "analysis.narrative_bundle": {
    model: "x-ai/grok-4.5",
    temperature: 0.35,
    maxTokens: 2800,
  },
  "analysis.future_outlook": {
    model: "x-ai/grok-4.5",
    temperature: 0.35,
    maxTokens: 900,
  },
  "chat.assistant": {
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.35,
    maxTokens: 1200,
  },
};

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}

export function getOpenRouterBaseUrl(): string {
  const raw =
    process.env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_DEFAULT_BASE_URL;
  return raw.replace(/\/$/, "");
}

export function isAiConfigured(): boolean {
  return getOpenRouterApiKey() != null;
}

export function isAiModelOverride(): boolean {
  return Boolean(process.env.AI_MODEL_OVERRIDE?.trim());
}

export function getAiFeatureConfig(feature: AiFeatureId): AiFeatureConfig {
  const base = AI_FEATURES[feature];
  if (isAiModelOverride()) {
    return { ...base, model: process.env.AI_MODEL_OVERRIDE!.trim() };
  }
  return base;
}
