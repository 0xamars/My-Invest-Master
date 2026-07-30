import type { AssistantChatMessage } from "@/lib/assistant/types";

export type AiProviderId = "openai" | "anthropic" | "xai";

export interface AiChatRequest {
  systemPrompt: string;
  messages: AssistantChatMessage[];
  temperature?: number;
}

export interface AiChatResult {
  content: string;
  provider: AiProviderId;
  model: string;
}

export interface AiProvider {
  id: AiProviderId;
  displayName: string;
  /** Env var name expected for this provider's API key. */
  apiKeyEnvVar: string;
  isConfigured(): boolean;
  chat(request: AiChatRequest): Promise<AiChatResult>;
}

export class AiProviderError extends Error {
  readonly status?: number;
  readonly provider: AiProviderId;

  constructor(provider: AiProviderId, message: string, status?: number) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.status = status;
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}
