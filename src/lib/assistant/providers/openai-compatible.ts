import {
  AiProviderError,
  normalizeBaseUrl,
  type AiChatRequest,
  type AiChatResult,
  type AiProvider,
} from "@/lib/assistant/providers/types";

async function chatCompletions(
  provider: AiProvider["id"],
  options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    request: AiChatRequest;
  },
): Promise<AiChatResult> {
  const { apiKey, baseUrl, model, request } = options;

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: request.temperature ?? 0.4,
      messages: [
        { role: "system", content: request.systemPrompt },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[${provider}] chat error:`, response.status, detail);
    throw new AiProviderError(
      provider,
      "The assistant is temporarily unavailable. Please try again in a moment.",
      response.status,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new AiProviderError(
      provider,
      "The assistant returned an empty response.",
      502,
    );
  }

  return { content, provider, model };
}

export function createOpenAiProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model =
    process.env.AI_MODEL?.trim() ||
    process.env.OPENAI_ASSISTANT_MODEL?.trim() ||
    "gpt-4o-mini";
  const baseUrl =
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";

  return {
    id: "openai",
    displayName: "OpenAI",
    apiKeyEnvVar: "OPENAI_API_KEY",
    isConfigured: () => Boolean(apiKey),
    async chat(request) {
      if (!apiKey) {
        throw new AiProviderError(
          "openai",
          "OpenAI is not configured. Set OPENAI_API_KEY.",
        );
      }
      return chatCompletions("openai", { apiKey, baseUrl, model, request });
    },
  };
}

export function createXaiProvider(): AiProvider {
  const apiKey = process.env.XAI_API_KEY?.trim() ?? "";
  const model =
    process.env.AI_MODEL?.trim() ||
    process.env.XAI_ASSISTANT_MODEL?.trim() ||
    "grok-3-mini";
  const baseUrl = process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1";

  return {
    id: "xai",
    displayName: "xAI (Grok)",
    apiKeyEnvVar: "XAI_API_KEY",
    isConfigured: () => Boolean(apiKey),
    async chat(request) {
      if (!apiKey) {
        throw new AiProviderError(
          "xai",
          "xAI is not configured. Set XAI_API_KEY.",
        );
      }
      return chatCompletions("xai", { apiKey, baseUrl, model, request });
    },
  };
}
