import type { AiFeatureConfig, AiFeatureId } from "@/lib/ai/types";

/**
 * Sole source of OpenRouter model IDs. Do not hardcode models elsewhere.
 *
 * Resolution (intentional, not a failure fallback):
 * 1) AI_MODEL_OVERRIDE — every feature, if set
 * 2) NARRATIVE_MODEL or AI_MODEL_NARRATIVE — narrative features only, if set
 * 3) AI_FEATURES[feature].model
 *
 * Timeouts and empty responses never substitute a different model.
 */
export const AI_FEATURES: Record<AiFeatureId, AiFeatureConfig> = {
  "analysis.company_blurb": {
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.3,
    maxTokens: 200,
  },
  "analysis.narrative_bundle": {
    model: "x-ai/grok-4.6",
    temperature: 0.35,
    maxTokens: 3200,
  },
  "analysis.future_outlook": {
    model: "x-ai/grok-4.6",
    temperature: 0.35,
    maxTokens: 900,
  },
  "chat.assistant": {
    model: "google/gemini-2.5-flash-lite",
    temperature: 0.35,
    maxTokens: 1200,
  },
};

const NARRATIVE_FEATURES: AiFeatureId[] = [
  "analysis.narrative_bundle",
  "analysis.future_outlook",
];

export type AiModelSource = "AI_FEATURES" | "ENV_OVERRIDE";

export type ResolvedAiFeature = {
  config: AiFeatureConfig;
  source: AiModelSource;
};

function envTrim(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/** Hard cap for analysis.narrative_bundle. Default 90s so flagship models can finish. */
export function getNarrativeTimeoutMs(): number {
  const raw = Number(process.env.NARRATIVE_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(180_000, Math.max(30_000, Math.round(raw)));
  }
  return 90_000;
}

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

export function resolveAiFeature(feature: AiFeatureId): ResolvedAiFeature {
  const base = AI_FEATURES[feature];
  const global = envTrim("AI_MODEL_OVERRIDE");
  if (global) {
    return { config: { ...base, model: global }, source: "ENV_OVERRIDE" };
  }
  if (NARRATIVE_FEATURES.includes(feature)) {
    const narrative = envTrim("NARRATIVE_MODEL") || envTrim("AI_MODEL_NARRATIVE");
    if (narrative) {
      return { config: { ...base, model: narrative }, source: "ENV_OVERRIDE" };
    }
  }
  return { config: { ...base }, source: "AI_FEATURES" };
}

export function getAiFeatureConfig(feature: AiFeatureId): AiFeatureConfig {
  return resolveAiFeature(feature).config;
}

/** True when a documented env override is selecting the model for this feature. */
export function isAiModelOverride(feature?: AiFeatureId): boolean {
  if (feature) return resolveAiFeature(feature).source === "ENV_OVERRIDE";
  return Boolean(envTrim("AI_MODEL_OVERRIDE"));
}
