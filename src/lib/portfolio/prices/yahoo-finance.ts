import YahooFinance from "yahoo-finance2";
import type { PriceRequestAsset } from "@/types/portfolio";

const yahooFinance = new YahooFinance();

type QuoteLike = {
  symbol?: string;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
};

function extractPrice(quote: QuoteLike): number | null {
  const price =
    quote.regularMarketPrice ??
    quote.postMarketPrice ??
    quote.preMarketPrice ??
    null;
  return typeof price === "number" && price > 0 ? price : null;
}

export async function fetchStockPrices(
  assets: PriceRequestAsset[],
): Promise<{
  prices: Record<string, number>;
  changes: Record<string, { change: number; changePercent: number }>;
  errors: Record<string, string>;
}> {
  const prices: Record<string, number> = {};
  const changes: Record<string, { change: number; changePercent: number }> = {};
  const errors: Record<string, string> = {};

  const stockSymbols = [
    ...new Set(
      assets.filter((a) => a.type === "stock").map((a) => a.symbol.toUpperCase()),
    ),
  ];

  if (stockSymbols.length === 0) return { prices, changes, errors };

  try {
    const quotes = await yahooFinance.quote(stockSymbols);
    const quoteList = Array.isArray(quotes) ? quotes : [quotes];

    const quoteBySymbol = new Map<string, QuoteLike>();
    for (const quote of quoteList) {
      const typed = quote as QuoteLike;
      if (typed.symbol) {
        quoteBySymbol.set(typed.symbol.toUpperCase(), typed);
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
        const change =
          typeof quote.regularMarketChange === "number"
            ? quote.regularMarketChange
            : null;
        const changePercent =
          typeof quote.regularMarketChangePercent === "number"
            ? quote.regularMarketChangePercent
            : null;
        if (change !== null && changePercent !== null) {
          changes[symbol] = { change, changePercent };
        }
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

  return { prices, changes, errors };
}
