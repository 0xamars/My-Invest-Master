import YahooFinance from "yahoo-finance2";
import type { MarketNewsItem } from "@/types/market";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

interface YahooNewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: string | Date;
  thumbnail?: {
    resolutions?: Array<{ url: string; width: number; height: number }>;
  };
  relatedTickers?: string[];
}

function mapNewsItem(item: YahooNewsItem): MarketNewsItem {
  const thumbnailUrl = item.thumbnail?.resolutions?.find(
    (resolution) => resolution.width >= 200,
  )?.url;

  const publishedAt =
    item.providerPublishTime instanceof Date
      ? item.providerPublishTime.toISOString()
      : item.providerPublishTime;

  return {
    id: item.uuid,
    title: item.title,
    publisher: item.publisher,
    link: item.link,
    publishedAt,
    thumbnailUrl,
    relatedTickers: item.relatedTickers,
  };
}

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
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))]
    .filter(Boolean)
    .slice(0, 8);
  if (unique.length === 0) return [];

  const batches = await Promise.all(
    unique.map(async (symbol) => {
      try {
        const result = await yahooFinance.search(symbol, { newsCount: 3 });
        return (result.news ?? []).map((item) =>
          mapNewsItem(item as YahooNewsItem),
        );
      } catch {
        return [];
      }
    }),
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
  const [stockResult, cryptoResult] = await Promise.all([
    yahooFinance.search("stock market", { newsCount: 10 }),
    yahooFinance.search("bitcoin cryptocurrency", { newsCount: 10 }),
  ]);

  const stockNews = dedupeNews(
    (stockResult.news ?? []).map((item) =>
      mapNewsItem(item as YahooNewsItem),
    ),
  ).slice(0, 8);

  const cryptoNews = dedupeNews(
    (cryptoResult.news ?? []).map((item) =>
      mapNewsItem(item as YahooNewsItem),
    ),
  ).slice(0, 8);

  return { stockNews, cryptoNews };
}
