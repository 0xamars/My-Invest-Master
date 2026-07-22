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
