import { complete, isAiConfigured, logAiFallback } from "@/lib/ai";
import { AiNotConfiguredError, AiRequestError } from "@/lib/ai/types";
import { requireAssistantAuth } from "@/lib/assistant/auth";
import {
  AiProviderError,
  getActiveAiProvider,
  parseAiProviderId,
} from "@/lib/assistant/providers";
import { checkAssistantRateLimit } from "@/lib/assistant/rate-limit";
import {
  ASSISTANT_DISCLAIMER,
  buildAssistantFallbackReply,
  buildAssistantSystemPrompt,
} from "@/lib/assistant/system-prompt";
import {
  normalizeAssistantContext,
  sanitizeAssistantMessages,
} from "@/lib/assistant/validate";

export const runtime = "nodejs";

interface AssistantRequestBody {
  messages?: unknown;
  context?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireAssistantAuth();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error ?? "Authentication required." },
      { status: 401 },
    );
  }

  const rateKey = auth.userId ?? request.headers.get("x-forwarded-for") ?? "anon";
  const rate = checkAssistantRateLimit(rateKey);
  if (!rate.allowed) {
    return Response.json(
      {
        error: `Too many requests. Try again in ${rate.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  let body: AssistantRequestBody;
  try {
    body = (await request.json()) as AssistantRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const context = normalizeAssistantContext(body.context);
  if (!context) {
    return Response.json(
      { error: "A valid page context is required." },
      { status: 400 },
    );
  }

  // Trust server session for signed-in flag, not the client payload.
  context.signedIn = Boolean(auth.userId) || !auth.authRequired;

  const messages = sanitizeAssistantMessages(body.messages);
  if (messages.length === 0) {
    return Response.json(
      { error: "At least one message is required." },
      { status: 400 },
    );
  }

  // Reject oversized payloads early
  if (JSON.stringify(body).length > 120_000) {
    return Response.json({ error: "Request payload is too large." }, { status: 413 });
  }

  const systemPrompt = buildAssistantSystemPrompt(context);

  if (isAiConfigured()) {
    try {
      const result = await complete({
        feature: "chat.assistant",
        system: systemPrompt,
        messages,
      });
      return Response.json({
        reply: result.text,
        configured: true,
        provider: result.provider,
        model: result.model,
        pageId: context.page.id,
        dataScopes: context.dataScopes,
        disclaimer: ASSISTANT_DISCLAIMER,
      });
    } catch (error) {
      if (error instanceof AiNotConfiguredError) {
        logAiFallback("chat.assistant", "no_key");
        return Response.json({
          reply: buildAssistantFallbackReply(context, {
            id: "openrouter",
            displayName: "OpenRouter",
            apiKeyEnvVar: "OPENROUTER_API_KEY",
          }),
          configured: false,
          provider: "openrouter",
          pageId: context.page.id,
          disclaimer: ASSISTANT_DISCLAIMER,
        });
      }
      console.error("Assistant OpenRouter error:", error);
      const message =
        error instanceof AiRequestError
          ? error.message
          : "Could not reach the AI service. Check your network or API configuration.";
      return Response.json(
        { error: message, provider: "openrouter" },
        { status: 502 },
      );
    }
  }

  let provider;
  try {
    provider = getActiveAiProvider();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid AI_PROVIDER configuration.",
      },
      { status: 500 },
    );
  }

  if (!provider.isConfigured()) {
    logAiFallback("chat.assistant", "no_key");
    return Response.json({
      reply: buildAssistantFallbackReply(context, {
        id: "openrouter",
        displayName: "OpenRouter",
        apiKeyEnvVar: "OPENROUTER_API_KEY",
      }),
      configured: false,
      provider: "openrouter",
      pageId: context.page.id,
      disclaimer: ASSISTANT_DISCLAIMER,
    });
  }

  try {
    const result = await provider.chat({
      systemPrompt,
      messages,
      temperature: 0.35,
    });

    return Response.json({
      reply: result.content,
      configured: true,
      provider: result.provider,
      model: result.model,
      pageId: context.page.id,
      dataScopes: context.dataScopes,
      disclaimer: ASSISTANT_DISCLAIMER,
    });
  } catch (error) {
    if (error instanceof AiProviderError) {
      console.error("Assistant provider error:", error.provider, error.message);
      return Response.json(
        { error: error.message, provider: error.provider },
        { status: 502 },
      );
    }

    console.error("Assistant request failed:", error);
    return Response.json(
      {
        error:
          "Could not reach the AI service. Check your network or API configuration.",
        provider: parseAiProviderId(process.env.AI_PROVIDER),
      },
      { status: 502 },
    );
  }
}
