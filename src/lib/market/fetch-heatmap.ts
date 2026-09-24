import type { FmpQuote } from "@/lib/market-data/fmp/quote";
import { getCachedQuotes } from "@/lib/market-data/warehouse/cached-quotes";
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

function buildMetadataMap(constituents: IndexConstituent[]) {
  const map = new Map<string, IndexConstituent>();

  for (const constituent of constituents) {
    map.set(constituent.quoteSymbol, constituent);
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

export function heatmapStockFromQuote(
  quote: FmpQuote,
  meta: IndexConstituent | undefined,
): HeatmapStock | null {
  if (
    quote.price == null ||
    quote.change == null ||
    quote.changePercent == null
  ) {
    return null;
  }

  const quoteSymbol = quote.symbol.toUpperCase();
  return {
    symbol: meta?.symbol ?? quoteSymbol,
    name: quote.name ?? meta?.name ?? quoteSymbol,
    sector: meta?.sector ?? "Other",
    industry: meta?.industry ?? "Diversified",
    changePercent: quote.changePercent,
    change: quote.change,
    price: quote.price,
    marketCap:
      typeof quote.marketCap === "number" && quote.marketCap > 0
        ? quote.marketCap
        : 0,
  };
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
  const quotes = await getCachedQuotes(
    constituents.map((item) => ({
      symbol: item.quoteSymbol,
      asset: "stock" as const,
    })),
  );

  const stocks: HeatmapStock[] = [];
  for (const constituent of constituents) {
    const quote = quotes.get(constituent.quoteSymbol.toUpperCase());
    if (!quote) continue;
    const meta =
      metadataBySymbol.get(quote.symbol.toUpperCase()) ??
      metadataBySymbol.get(constituent.symbol);
    const stock = heatmapStockFromQuote(quote, meta);
    if (stock) stocks.push(stock);
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
