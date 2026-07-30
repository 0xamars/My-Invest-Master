import { createAnthropicProvider } from "@/lib/assistant/providers/anthropic";
import {
  createOpenAiProvider,
  createXaiProvider,
} from "@/lib/assistant/providers/openai-compatible";
import type {
  AiProvider,
  AiProviderId,
} from "@/lib/assistant/providers/types";

const PROVIDERS: Record<AiProviderId, () => AiProvider> = {
  openai: createOpenAiProvider,
  anthropic: createAnthropicProvider,
  xai: createXaiProvider,
};

export function parseAiProviderId(value: string | undefined): AiProviderId {
  const normalized = (value ?? "openai").trim().toLowerCase();
  if (normalized === "openai" || normalized === "anthropic" || normalized === "xai") {
    return normalized;
  }
  throw new Error(
    `Unsupported AI_PROVIDER "${value}". Use openai, anthropic, or xai.`,
  );
}

/** Resolve the active AI provider from environment variables. */
export function getActiveAiProvider(): AiProvider {
  const id = parseAiProviderId(process.env.AI_PROVIDER);
  return PROVIDERS[id]();
}

export function listSupportedAiProviders(): AiProviderId[] {
  return Object.keys(PROVIDERS) as AiProviderId[];
}

export type { AiProvider, AiProviderId, AiChatRequest, AiChatResult } from "@/lib/assistant/providers/types";
export { AiProviderError } from "@/lib/assistant/providers/types";
