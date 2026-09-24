import type { AnalysisAssetType, AnalysisQuote } from "@/lib/analysis/types";
import { resolvePriceId } from "@/lib/portfolio/asset-catalog";
import { isFmpConfigured } from "@/lib/market-data/config";
import type { FmpQuote } from "@/lib/market-data/fmp/quote";
import {
  getCachedQuotes,
  type QuoteAsset,
} from "@/lib/market-data/warehouse/cached-quotes";

function quoteFromFmp(input: {
  symbol: string;
  type: QuoteAsset;
  quote: FmpQuote | null;
  nameHint?: string;
  priceId?: string;
  logoUrl?: string;
}): AnalysisQuote {
  const upper = input.symbol.toUpperCase();
  const quote = input.quote;
  const price = quote?.price != null && quote.price > 0 ? quote.price : null;
  return {
    symbol: upper,
    name:
      input.type === "crypto"
        ? (input.nameHint ?? quote?.name ?? upper)
        : (quote?.name ?? input.nameHint ?? upper),
    type: input.type,
    priceId: input.priceId,
    logoUrl: input.logoUrl,
    price,
    change: quote?.change ?? null,
    changePercent: quote?.changePercent ?? null,
    marketCap: quote?.marketCap ?? null,
    volume: quote?.volume ?? null,
    averageVolume: quote?.averageVolume ?? null,
    dayLow: quote?.dayLow ?? null,
    dayHigh: quote?.dayHigh ?? null,
    week52Low: quote?.week52Low ?? null,
    week52High: quote?.week52High ?? null,
    currency: quote?.currency ?? "USD",
    fetchedAt: new Date().toISOString(),
    error:
      price == null
        ? isFmpConfigured()
          ? "Quote unavailable from FMP"
          : "FMP_API_KEY is not configured"
        : undefined,
  };
}

async function fetchCachedAnalysisQuote(input: {
  symbol: string;
  type: QuoteAsset;
  nameHint?: string;
  priceId?: string;
  logoUrl?: string;
}): Promise<AnalysisQuote> {
  const upper = input.symbol.toUpperCase();
  try {
    const quotes = await getCachedQuotes([
      { symbol: upper, asset: input.type },
    ]);
    return quoteFromFmp({
      symbol: upper,
      type: input.type,
      quote: quotes.get(upper) ?? null,
      nameHint: input.nameHint,
      priceId: input.priceId,
      logoUrl: input.logoUrl,
    });
  } catch {
    return quoteFromFmp({
      symbol: upper,
      type: input.type,
      quote: null,
      nameHint: input.nameHint,
      priceId: input.priceId,
      logoUrl: input.logoUrl,
    });
  }
}

export async function fetchAnalysisQuote(input: {
  symbol: string;
  type: AnalysisAssetType;
  priceId?: string;
  name?: string;
  logoUrl?: string;
}): Promise<AnalysisQuote> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) {
    return {
      symbol: "",
      name: "",
      type: input.type,
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error: "Symbol is required",
    };
  }

  const priceId = resolvePriceId(symbol, input.type, input.priceId);

  if (input.type === "crypto") {
    return fetchCachedAnalysisQuote({
      symbol,
      type: "crypto",
      nameHint: input.name,
      priceId,
      logoUrl: input.logoUrl,
    });
  }

  return fetchCachedAnalysisQuote({
    symbol,
    type: "stock",
    nameHint: input.name,
    priceId,
    logoUrl: input.logoUrl,
  });
}
