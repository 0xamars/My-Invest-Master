import { getOpenRouterApiKey, getOpenRouterBaseUrl } from "@/lib/ai/config";
import type { AiFeatureConfig, AiMessage } from "@/lib/ai/types";
import { AiNotConfiguredError, AiRequestError } from "@/lib/ai/types";

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

function refererHeader(): string | undefined {
  const fromEnv =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return fromEnv || undefined;
}

/** OpenAI-compatible chat completions via OpenRouter. Server-only. */
export async function openRouterChatComplete(input: {
  config: AiFeatureConfig;
  system?: string;
  messages: AiMessage[];
}): Promise<{ text: string; model: string }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new AiNotConfiguredError("AI not configured");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (input.system?.trim()) {
    messages.push({ role: "system", content: input.system.trim() });
  }
  for (const m of input.messages) {
    if (!m.content.trim()) continue;
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.length === 0) {
    throw new AiRequestError("AI request has no messages.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Title": "InvestSalsa",
  };
  const referer = refererHeader();
  if (referer) headers["HTTP-Referer"] = referer;

  const response = await fetch(
    `${getOpenRouterBaseUrl()}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: input.config.model,
        temperature: input.config.temperature,
        max_tokens: input.config.maxTokens,
        messages,
      }),
    },
  );

  const raw = await response.text();
  let payload: OpenRouterChatResponse | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as OpenRouterChatResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.error?.message || raw.slice(0, 240) || response.statusText;
    throw new AiRequestError(
      `OpenRouter request failed (${response.status}): ${detail}`,
      response.status,
    );
  }

  const text = payload?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new AiRequestError("AI returned an empty response.", 502);
  }

  return { text, model: input.config.model };
}
