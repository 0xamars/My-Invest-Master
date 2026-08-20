import { complete, isAiConfigured, logAiFallback } from "@/lib/ai";
import {
  buildHoldingThinkingUserMessage,
  HOLDING_THINKING_SYSTEM,
} from "@/lib/ai/prompts/holding-thinking";
import {
  sanitizeHoldingThinking,
  thinkingCacheDay,
} from "@/lib/invest/holding-thinking";
import type { HoldingExpandFacts } from "@/lib/portfolio/holding-expand";

type CacheRow = { day: string; text: string | null };

const thinkingCache = new Map<string, CacheRow>();

function thinkingPayload(facts: HoldingExpandFacts): Record<string, unknown> {
  return {
    type: facts.type,
    whyMoved: {
      changePercent: facts.whyMoved.changePercent,
      volumeVsTypical: facts.whyMoved.volumeVsTypical,
      headline: facts.whyMoved.headline?.title ?? null,
    },
    revenuePath: facts.screens?.revenuePath
      ? {
          kind: facts.screens.revenuePath.kind,
          years: facts.screens.revenuePath.years.map((year) => year.year),
        }
      : null,
    cashVsDebt: facts.screens?.cashVsDebt
      ? { netCash: facts.screens.cashVsDebt.netCash }
      : null,
    nextEarningsDate: facts.nextEarningsDate,
    vsSpy: facts.vsSpy,
  };
}

export async function generateHoldingThinking(
  symbol: string,
  facts: HoldingExpandFacts,
): Promise<string | null> {
  if (facts.type !== "stock" && facts.type !== "crypto") return null;

  const day = thinkingCacheDay();
  const key = `${symbol.toUpperCase()}:${day}`;
  const cached = thinkingCache.get(key);
  if (cached && cached.day === day) return cached.text;

  if (!isAiConfigured()) {
    logAiFallback("invest.holding_thinking", "no_key");
    thinkingCache.set(key, { day, text: null });
    return null;
  }

  try {
    const result = await complete({
      feature: "invest.holding_thinking",
      system: HOLDING_THINKING_SYSTEM,
      messages: [
        { role: "user", content: buildHoldingThinkingUserMessage(thinkingPayload(facts)) },
      ],
      timeoutMs: 20_000,
    });
    const text = sanitizeHoldingThinking(result.text);
    if (!text) logAiFallback("invest.holding_thinking", "empty");
    thinkingCache.set(key, { day, text });
    return text;
  } catch {
    logAiFallback("invest.holding_thinking", "error");
    thinkingCache.set(key, { day, text: null });
    return null;
  }
}
