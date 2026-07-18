import YahooFinance from "yahoo-finance2";
import { getStockLogoUrl } from "@/lib/portfolio/logos";
import type { AssetCatalogItem } from "@/types/portfolio";

const yahooFinance = new YahooFinance();

const STOCK_QUOTE_TYPES = new Set([
  "EQUITY",
  "ETF",
  "MUTUALFUND",
  "INDEX",
]);

function mapStockResult(quote: {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  sectorDisp?: string;
  industryDisp?: string;
  typeDisp?: string;
}): AssetCatalogItem {
  return {
    symbol: quote.symbol.toUpperCase(),
    name: quote.longname ?? quote.shortname ?? quote.symbol,
    type: "stock",
    category: quote.quoteType === "ETF" ? "ETF" : "Equity",
    subCategory:
      quote.sectorDisp ??
      quote.industryDisp ??
      quote.typeDisp ??
      "Stock",
    logoUrl: getStockLogoUrl(quote.symbol),
  };
}

export async function searchStocks(query: string): Promise<AssetCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const results = await yahooFinance.search(trimmed, {
      quotesCount: 10,
      newsCount: 0,
    });

    const seen = new Set<string>();
    const items: AssetCatalogItem[] = [];

    for (const quote of results.quotes) {
      if (!quote || typeof quote !== "object" || !("symbol" in quote)) continue;
      if (!("isYahooFinance" in quote) || quote.isYahooFinance !== true) continue;

      const q = quote as {
        symbol: string;
        shortname?: string;
        longname?: string;
        quoteType?: string;
        sectorDisp?: string;
        industryDisp?: string;
        typeDisp?: string;
      };

      if (q.quoteType && !STOCK_QUOTE_TYPES.has(q.quoteType)) continue;

      const symbol = q.symbol.toUpperCase();
      if (seen.has(symbol)) continue;
      seen.add(symbol);

      items.push(mapStockResult(q));
      if (items.length >= 8) break;
    }

    return items;
  } catch (error) {
    console.error("Yahoo stock search error:", error);
    return [];
  }
}

export async function lookupStockSymbol(
  symbol: string,
): Promise<AssetCatalogItem | null> {
  const results = await searchStocks(symbol);
  const normalized = symbol.trim().toUpperCase();
  return results.find((item) => item.symbol === normalized) ?? results[0] ?? null;
}
