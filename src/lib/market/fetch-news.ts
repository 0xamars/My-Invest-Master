import {
  fetchFmpLatestCryptoNews,
  fetchFmpLatestStockNews,
  fetchFmpStockNews,
} from "@/lib/market-data/fmp/news";
import { toQuoteSymbol } from "@/lib/market-data/fmp/symbols";
import { loadCachedFeed } from "@/lib/market-data/warehouse/feed-cache";
import type { MarketNewsItem } from "@/types/market";

function dedupeNews(items: MarketNewsItem[]): MarketNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function newsForBookSymbols(
  items: MarketNewsItem[],
  symbols: string[],
  limit = 4,
): MarketNewsItem[] {
  const wanted = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  if (wanted.size === 0) return [];
  return items
    .filter((item) =>
      (item.relatedTickers ?? []).some((ticker) =>
        wanted.has(ticker.toUpperCase()),
      ),
    )
    .slice(0, limit);
}

export async function fetchNewsForSymbols(
  symbols: string[],
): Promise<MarketNewsItem[]> {
  const unique = [
    ...new Set(symbols.map((symbol) => toQuoteSymbol(symbol)).filter(Boolean)),
  ].slice(0, 8);
  if (unique.length === 0) return [];

  const batches = await Promise.all(
    unique.map((symbol) =>
      loadCachedFeed({
        cacheKey: symbol,
        dataset: "symbol_news",
        emptyValue: [] as MarketNewsItem[],
        isEmpty: (items) => items.length === 0,
        fetchFmp: () => fetchFmpStockNews(symbol, 3),
      }),
    ),
  );

  return newsForBookSymbols(dedupeNews(batches.flat()), unique, 6);
}

export async function fetchHeadlineForSymbol(
  symbol: string,
): Promise<MarketNewsItem | null> {
  const items = await fetchNewsForSymbols([symbol]);
  return items[0] ?? null;
}

export async function fetchMarketNews(): Promise<{
  stockNews: MarketNewsItem[];
  cryptoNews: MarketNewsItem[];
}> {
  const [stockNews, cryptoNews] = await Promise.all([
    loadCachedFeed({
      cacheKey: "latest",
      dataset: "news_stock",
      emptyValue: [] as MarketNewsItem[],
      isEmpty: (items) => items.length === 0,
      fetchFmp: async () => (await fetchFmpLatestStockNews(20)).slice(0, 8),
    }),
    loadCachedFeed({
      cacheKey: "latest",
      dataset: "news_crypto",
      emptyValue: [] as MarketNewsItem[],
      isEmpty: (items) => items.length === 0,
      fetchFmp: async () => (await fetchFmpLatestCryptoNews(20)).slice(0, 8),
    }),
  ]);

  return {
    stockNews: dedupeNews(stockNews).slice(0, 8),
    cryptoNews: dedupeNews(cryptoNews).slice(0, 8),
  };
}
