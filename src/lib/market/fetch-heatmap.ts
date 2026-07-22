import YahooFinance from "yahoo-finance2";
import { SP500_HEATMAP_SYMBOLS } from "@/lib/market/sp500-symbols";
import type { HeatmapStock } from "@/types/market";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export async function fetchSp500Heatmap(): Promise<HeatmapStock[]> {
  const quotes = await yahooFinance.quote([...SP500_HEATMAP_SYMBOLS]);
  const quoteList = Array.isArray(quotes) ? quotes : [quotes];

  const stocks: HeatmapStock[] = [];

  for (const quote of quoteList) {
    if (!quote.symbol) continue;

    const changePercent = quote.regularMarketChangePercent;
    const price = quote.regularMarketPrice;
    const marketCap = quote.marketCap;

    if (
      typeof changePercent !== "number" ||
      typeof price !== "number" ||
      typeof marketCap !== "number"
    ) {
      continue;
    }

    stocks.push({
      symbol: quote.symbol.toUpperCase(),
      name:
        quote.shortName ??
        quote.longName ??
        quote.symbol.toUpperCase(),
      changePercent,
      price,
      marketCap,
    });
  }

  return stocks.sort((a, b) => b.marketCap - a.marketCap);
}
