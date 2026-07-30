import {
  AiProviderError,
  normalizeBaseUrl,
  type AiChatRequest,
  type AiChatResult,
  type AiProvider,
} from "@/lib/assistant/providers/types";

export function createAnthropicProvider(): AiProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const model =
    process.env.AI_MODEL?.trim() ||
    process.env.ANTHROPIC_ASSISTANT_MODEL?.trim() ||
    "claude-sonnet-4-5";
  const baseUrl =
    process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";

  return {
    id: "anthropic",
    displayName: "Anthropic (Claude)",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    isConfigured: () => Boolean(apiKey),
    async chat(request: AiChatRequest): Promise<AiChatResult> {
      if (!apiKey) {
        throw new AiProviderError(
          "anthropic",
          "Anthropic is not configured. Set ANTHROPIC_API_KEY.",
        );
      }

      const response = await fetch(
        `${normalizeBaseUrl(baseUrl)}/v1/messages`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            temperature: request.temperature ?? 0.4,
            system: request.systemPrompt,
            messages: request.messages.map((message) => ({
              role: message.role === "assistant" ? "assistant" : "user",
              content: message.content,
            })),
          }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        console.error("[anthropic] chat error:", response.status, detail);
        throw new AiProviderError(
          "anthropic",
          "The assistant is temporarily unavailable. Please try again in a moment.",
          response.status,
        );
      }

      const payload = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const content = payload.content
        ?.filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!content) {
        throw new AiProviderError(
          "anthropic",
          "The assistant returned an empty response.",
          502,
        );
      }

      return {
        content,
        provider: "anthropic",
        model,
      };
    },
  };
}
