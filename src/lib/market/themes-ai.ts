import { getActiveAiProvider } from "@/lib/assistant/providers";
import {
  buildFallbackCustomTheme,
  buildFallbackPopularPayload,
} from "@/lib/market/themes-fallback";
import { CUSTOM_THEME_CATALOG } from "@/types/market-themes";
import type {
  CustomThemePayload,
  MarketSentiment,
  MarketStockQuality,
  MarketTheme,
  MarketThemeStock,
  MarketThemesPayload,
} from "@/types/market-themes";
import { MARKET_INSIGHTS_DISCLAIMER } from "@/types/market-themes";

const STOCK_SELECTION_RULES = [
  "Strong financials: healthy margins, manageable debt, solid ROE/ROIC where applicable.",
  "Fairly valued or undervalued vs growth: use common metrics (P/E, PEG, EV/Sales, FCF yield) qualitatively — do not invent precise live prices.",
  "Good growth potential: credible revenue/earnings growth outlook tied to the theme.",
  "Prefer liquid, well-known listed equities (US tickers preferred).",
  "Exactly 5 stocks per theme.",
].join(" ");

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function asSentiment(value: unknown): MarketSentiment {
  if (value === "positive" || value === "neutral" || value === "rising") {
    return value;
  }
  return "neutral";
}

function asQuality(value: unknown): MarketStockQuality {
  if (value === "strong" || value === "balanced" || value === "watch") {
    return value;
  }
  return "balanced";
}

function normalizeStock(raw: unknown): MarketThemeStock | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const ticker = String(row.ticker ?? "").trim().toUpperCase();
  const name = String(row.name ?? "").trim();
  if (!ticker || !name) return null;
  return {
    ticker,
    name,
    reason: String(row.reason ?? "").trim() || "Fits the theme thesis.",
    metrics: String(row.metrics ?? "").trim() || "Quality screen applied",
    quality: asQuality(row.quality),
    valuationNote:
      typeof row.valuationNote === "string" && row.valuationNote.trim()
        ? row.valuationNote.trim()
        : undefined,
  };
}

function normalizeTheme(raw: unknown, fallbackId?: string): MarketTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  const stocks = (Array.isArray(row.stocks) ? row.stocks : [])
    .map(normalizeStock)
    .filter((stock): stock is MarketThemeStock => Boolean(stock))
    .slice(0, 5);

  if (stocks.length === 0) return null;

  const id =
    String(row.id ?? fallbackId ?? name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "theme";

  return {
    id,
    name,
    description:
      String(row.description ?? "").trim() ||
      `${name} investment theme with quality-screened equities.`,
    sentiment: asSentiment(row.sentiment),
    popularityReason:
      String(row.popularityReason ?? "").trim() ||
      "Elevated investor and media attention around this theme.",
    stocks,
  };
}

async function completeJsonPrompt(system: string, user: string): Promise<{
  data: unknown;
  provider: string;
}> {
  const provider = getActiveAiProvider();
  if (!provider.isConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const result = await provider.chat({
    systemPrompt: system,
    messages: [{ role: "user", content: user }],
    temperature: 0.35,
  });

  return { data: extractJson(result.content), provider: result.provider };
}

export async function generatePopularThemes(): Promise<MarketThemesPayload> {
  try {
    const { data, provider } = await completeJsonPrompt(
      [
        "You are InvestSalsa Market Insights — an educational market research assistant.",
        "Return ONLY valid JSON. No markdown commentary outside JSON.",
        "Do NOT give personalized financial advice or tell users to buy/sell.",
        "Combine: (1) current market trend reasoning, (2) social/news investor interest heuristics.",
        "Stock selection criteria (apply all):",
        STOCK_SELECTION_RULES,
      ].join("\n"),
      [
        "Generate the 5 most popular investment themes right now.",
        'JSON shape: { "themes": [ { "id": "kebab-case", "name": "", "description": "", "sentiment": "positive"|"neutral"|"rising", "popularityReason": "", "stocks": [ { "ticker": "", "name": "", "reason": "", "metrics": "", "quality": "strong"|"balanced"|"watch", "valuationNote": "" } ] } ] }',
        "Exactly 5 themes, exactly 5 stocks each.",
        "Keep descriptions to 1-2 sentences. metrics should be short (e.g. 'Rev +20% · FCF rich · PEG ~1.2').",
      ].join("\n"),
    );

    const themesRaw =
      data && typeof data === "object" && Array.isArray((data as { themes?: unknown }).themes)
        ? (data as { themes: unknown[] }).themes
        : [];

    const themes = themesRaw
      .map((theme) => normalizeTheme(theme))
      .filter((theme): theme is MarketTheme => Boolean(theme))
      .slice(0, 5);

    if (themes.length < 3) {
      return { ...buildFallbackPopularPayload(), provider };
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "ai",
      provider,
      themes,
      disclaimer: MARKET_INSIGHTS_DISCLAIMER,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return buildFallbackPopularPayload();
    }
    console.error("generatePopularThemes failed:", error);
    return buildFallbackPopularPayload();
  }
}

export async function generateCustomTheme(themeId: string): Promise<CustomThemePayload> {
  const catalogEntry = CUSTOM_THEME_CATALOG.find((entry) => entry.id === themeId);
  const themeName = catalogEntry?.name ?? themeId;

  try {
    const { data, provider } = await completeJsonPrompt(
      [
        "You are InvestSalsa Market Insights — an educational market research assistant.",
        "Return ONLY valid JSON. No markdown commentary outside JSON.",
        "Do NOT give personalized financial advice or tell users to buy/sell.",
        "Stock selection criteria (apply all):",
        STOCK_SELECTION_RULES,
      ].join("\n"),
      [
        `Generate Top 5 stocks for the investment theme: "${themeName}" (id: ${themeId}).`,
        catalogEntry ? `Theme focus: ${catalogEntry.blurb}` : "",
        'JSON shape: { "theme": { "id": "", "name": "", "description": "", "sentiment": "positive"|"neutral"|"rising", "popularityReason": "", "stocks": [ { "ticker": "", "name": "", "reason": "", "metrics": "", "quality": "strong"|"balanced"|"watch", "valuationNote": "" } ] } }',
        "Exactly 5 stocks. Prefer high-quality public companies.",
      ].join("\n"),
    );

    const themeNode =
      data && typeof data === "object" && "theme" in (data as object)
        ? (data as { theme: unknown }).theme
        : data;

    const theme = normalizeTheme(themeNode, themeId);
    if (!theme) {
      return {
        generatedAt: new Date().toISOString(),
        source: "fallback",
        theme: buildFallbackCustomTheme(themeId, themeName),
        disclaimer: MARKET_INSIGHTS_DISCLAIMER,
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "ai",
      provider,
      theme: { ...theme, id: themeId, name: theme.name || themeName },
      disclaimer: MARKET_INSIGHTS_DISCLAIMER,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return {
        generatedAt: new Date().toISOString(),
        source: "fallback",
        theme: buildFallbackCustomTheme(themeId, themeName),
        disclaimer: MARKET_INSIGHTS_DISCLAIMER,
      };
    }
    console.error("generateCustomTheme failed:", error);
    return {
      generatedAt: new Date().toISOString(),
      source: "fallback",
      theme: buildFallbackCustomTheme(themeId, themeName),
      disclaimer: MARKET_INSIGHTS_DISCLAIMER,
    };
  }
}
