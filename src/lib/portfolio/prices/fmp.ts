import { isFmpConfigured } from "@/lib/market-data/config";
import type { FmpQuote } from "@/lib/market-data/fmp/quote";
import { getCachedQuotes } from "@/lib/market-data/warehouse/cached-quotes";
import type { PriceRequestAsset } from "@/types/portfolio";

export type LivePriceResult = {
  prices: Record<string, number>;
  changes: Record<string, { change: number; changePercent: number }>;
  errors: Record<string, string>;
};

function changeFromQuote(
  quote: FmpQuote,
): { change: number; changePercent: number } | null {
  const price = quote.price;
  if (price == null || price <= 0) return null;
  let change = quote.change;
  let changePercent = quote.changePercent;
  if (changePercent == null && change != null && price !== change) {
    const previous = price - change;
    if (previous !== 0) changePercent = (change / previous) * 100;
  }
  if (change == null && changePercent != null) {
    change = (price * changePercent) / 100;
  }
  if (change == null || changePercent == null) return null;
  return { change, changePercent };
}

export async function fetchLivePrices(
  assets: PriceRequestAsset[],
): Promise<LivePriceResult> {
  const prices: Record<string, number> = {};
  const changes: Record<string, { change: number; changePercent: number }> = {};
  const errors: Record<string, string> = {};

  const requests = assets
    .filter((asset) => asset.type === "stock" || asset.type === "crypto")
    .map((asset) => ({
      symbol: asset.symbol.toUpperCase(),
      asset: asset.type as "stock" | "crypto",
    }));

  const symbols = [...new Set(requests.map((asset) => asset.symbol))];
  if (symbols.length === 0) return { prices, changes, errors };

  if (!isFmpConfigured()) {
    for (const symbol of symbols) {
      errors[symbol] = "FMP_API_KEY is not configured";
    }
    return { prices, changes, errors };
  }

  try {
    const quotes = await getCachedQuotes(requests);
    for (const symbol of symbols) {
      const quote = quotes.get(symbol) ?? null;
      const price = quote?.price;
      if (!quote || price == null || price <= 0) {
        errors[symbol] = quote ? "Price unavailable" : "Quote not found";
        continue;
      }
      prices[symbol] = price;
      const change = changeFromQuote(quote);
      if (change) changes[symbol] = change;
    }
  } catch {
    for (const symbol of symbols) {
      errors[symbol] = "Failed to fetch prices";
    }
  }

  return { prices, changes, errors };
}
