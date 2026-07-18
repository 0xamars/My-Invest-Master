import YahooFinance from "yahoo-finance2";
import type { PriceRequestAsset } from "@/types/portfolio";

const yahooFinance = new YahooFinance();

function extractPrice(quote: unknown): number | null {
  const q = quote as {
    regularMarketPrice?: number;
    postMarketPrice?: number;
    preMarketPrice?: number;
  };
  const price =
    q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? null;
  return typeof price === "number" && price > 0 ? price : null;
}

export async function fetchStockPrices(
  assets: PriceRequestAsset[],
): Promise<{ prices: Record<string, number>; errors: Record<string, string> }> {
  const prices: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const stockSymbols = [
    ...new Set(
      assets.filter((a) => a.type === "stock").map((a) => a.symbol.toUpperCase()),
    ),
  ];

  if (stockSymbols.length === 0) return { prices, errors };

  try {
    const quotes = await yahooFinance.quote(stockSymbols);
    const quoteList = Array.isArray(quotes) ? quotes : [quotes];

    const quoteBySymbol = new Map<string, (typeof quoteList)[number]>();
    for (const quote of quoteList) {
      if (quote.symbol) {
        quoteBySymbol.set(quote.symbol.toUpperCase(), quote);
      }
    }

    for (const symbol of stockSymbols) {
      const quote = quoteBySymbol.get(symbol);
      if (!quote) {
        errors[symbol] = "Quote not found";
        continue;
      }

      const price = extractPrice(quote);
      if (price !== null) {
        prices[symbol] = price;
      } else {
        errors[symbol] = "Price unavailable from Yahoo Finance";
      }
    }
  } catch {
    const message = "Failed to fetch stock prices";
    for (const symbol of stockSymbols) {
      errors[symbol] = message;
    }
  }

  return { prices, errors };
}
