import YahooFinance from "yahoo-finance2";
import {
  dedupeHeatmapStocks,
  filterHeatmapConstituents,
  getTopMovers,
} from "@/lib/market/heatmap-dedupe";
import {
  INDEX_CONFIG,
  type IndexConstituent,
  type MarketIndex,
} from "@/lib/market/index-config";
import { fetchNasdaq100Constituents } from "@/lib/market/nasdaq100-constituents";
import { fetchSp500Constituents } from "@/lib/market/sp500-constituents";
import type { HeatmapStock } from "@/types/market";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const BATCH_SIZE = 50;
const BATCH_CONCURRENCY = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function fetchQuotesForSymbols(symbols: string[]) {
  const batches = chunk(symbols, BATCH_SIZE);
  const quoteList = [];

  for (let index = 0; index < batches.length; index += BATCH_CONCURRENCY) {
    const slice = batches.slice(index, index + BATCH_CONCURRENCY);
    const results = await Promise.all(
      slice.map((batch) => yahooFinance.quote(batch)),
    );

    for (const quotes of results) {
      quoteList.push(...(Array.isArray(quotes) ? quotes : [quotes]));
    }
  }

  return quoteList;
}

function buildMetadataMap(constituents: IndexConstituent[]) {
  const map = new Map<string, IndexConstituent>();

  for (const constituent of constituents) {
    map.set(constituent.yahooSymbol, constituent);
    map.set(constituent.symbol, constituent);
  }

  return map;
}

async function fetchConstituents(index: MarketIndex): Promise<IndexConstituent[]> {
  if (index === "nasdaq100") {
    return fetchNasdaq100Constituents();
  }
  return fetchSp500Constituents();
}

function selectHeatmapStocks(
  ranked: HeatmapStock[],
  index: MarketIndex,
): HeatmapStock[] {
  const topN = INDEX_CONFIG[index].heatmapTopN;
  return topN ? ranked.slice(0, topN) : ranked;
}

export async function fetchIndexHeatmap(index: MarketIndex): Promise<{
  index: MarketIndex;
  stocks: HeatmapStock[];
  gainers: HeatmapStock[];
  losers: HeatmapStock[];
  totalConstituents: number;
  displayedCount: number;
}> {
  const allConstituents = await fetchConstituents(index);
  const constituents = filterHeatmapConstituents(allConstituents);
  const metadataBySymbol = buildMetadataMap(allConstituents);
  const yahooSymbols = constituents.map((item) => item.yahooSymbol);

  const quoteList = await fetchQuotesForSymbols(yahooSymbols);
  const stocks: HeatmapStock[] = [];

  for (const quote of quoteList) {
    if (!quote.symbol) continue;

    const changePercent = quote.regularMarketChangePercent;
    const change = quote.regularMarketChange;
    const price = quote.regularMarketPrice;
    const marketCap =
      typeof quote.marketCap === "number" && quote.marketCap > 0
        ? quote.marketCap
        : 0;

    if (
      typeof changePercent !== "number" ||
      typeof change !== "number" ||
      typeof price !== "number"
    ) {
      continue;
    }

    const yahooSymbol = quote.symbol.toUpperCase();
    const meta = metadataBySymbol.get(yahooSymbol);

    stocks.push({
      symbol: meta?.symbol ?? yahooSymbol,
      name: quote.shortName ?? quote.longName ?? meta?.name ?? yahooSymbol,
      sector: meta?.sector ?? "Other",
      industry: meta?.industry ?? "Diversified",
      changePercent,
      change,
      price,
      marketCap,
    });
  }

  const deduped = dedupeHeatmapStocks(stocks);
  const ranked = deduped
    .filter((stock) => stock.marketCap > 0)
    .sort((a, b) => b.marketCap - a.marketCap);
  const heatmapStocks = selectHeatmapStocks(ranked, index);
  const { gainers, losers } = getTopMovers(deduped);

  return {
    index,
    stocks: heatmapStocks,
    gainers,
    losers,
    totalConstituents: allConstituents.length,
    displayedCount: heatmapStocks.length,
  };
}

/** @deprecated Use fetchIndexHeatmap("sp500") */
export async function fetchSp500Heatmap() {
  return fetchIndexHeatmap("sp500");
}

export const HEATMAP_TOP_N = INDEX_CONFIG.sp500.heatmapTopN ?? 120;
