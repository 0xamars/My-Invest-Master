import { fmpFetch, str } from "@/lib/market-data/fmp/client";
import { toQuoteSymbol } from "@/lib/market-data/fmp/symbols";
import { parseWarehouseTime } from "@/lib/market-data/warehouse/ttl";
import type { MarketNewsItem } from "@/types/market";

/** Headlines are cached for 15 minutes in the warehouse feed. */
const NEWS_REVALIDATE_SEC = 15 * 60;

export type FmpNewsRow = {
  symbol?: string;
  publishedDate?: string;
  publisher?: string;
  title?: string;
  image?: string;
  site?: string;
  text?: string;
  url?: string;
};

export function fmpNewsTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return new Date(0).toISOString();
  }
  const parsed = parseWarehouseTime(value);
  if (parsed == null) return new Date(0).toISOString();
  return new Date(parsed).toISOString();
}

export function fmpNewsId(row: FmpNewsRow): string {
  const url = str(row.url);
  if (url) return url;
  return [row.symbol ?? "", row.publishedDate ?? "", row.title ?? ""].join("|");
}

/** Related tickers include both the FMP pair (BTCUSD) and the base (BTC). */
export function relatedTickersFromFmpSymbol(symbol: string | null): string[] {
  if (!symbol) return [];
  const upper = toQuoteSymbol(symbol);
  const tickers = [upper];
  if (upper.endsWith("USD") && upper.length > 3) {
    tickers.push(upper.slice(0, -3));
  }
  return [...new Set(tickers)];
}

export function mapFmpNewsItem(row: FmpNewsRow): MarketNewsItem | null {
  const title = str(row.title);
  const link = str(row.url);
  if (!title || !link) return null;
  const image = str(row.image);
  const symbol = str(row.symbol);
  return {
    id: fmpNewsId(row),
    title,
    publisher: str(row.publisher) ?? str(row.site) ?? "News",
    link,
    publishedAt: fmpNewsTimestamp(row.publishedDate),
    thumbnailUrl: image ?? undefined,
    relatedTickers: relatedTickersFromFmpSymbol(symbol),
  };
}

export function mapFmpNewsPayload(data: unknown): MarketNewsItem[] {
  if (!Array.isArray(data)) return [];
  const items: MarketNewsItem[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = mapFmpNewsItem(row as FmpNewsRow);
    if (item) items.push(item);
  }
  return items;
}

async function fetchNews(
  path: string,
  query: Record<string, string | number>,
): Promise<MarketNewsItem[]> {
  const data = await fmpFetch<unknown>({
    path,
    query,
    revalidate: NEWS_REVALIDATE_SEC,
  });
  return mapFmpNewsPayload(data);
}

export async function fetchFmpLatestStockNews(
  limit = 20,
): Promise<MarketNewsItem[]> {
  return fetchNews("/news/stock-latest", { page: 0, limit });
}

export async function fetchFmpLatestCryptoNews(
  limit = 20,
): Promise<MarketNewsItem[]> {
  return fetchNews("/news/crypto-latest", { page: 0, limit });
}

export async function fetchFmpStockNews(
  symbol: string,
  limit = 5,
): Promise<MarketNewsItem[]> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return [];
  const items = await fetchNews("/news/stock", { symbols: upper, limit });
  if (items.every((item) => (item.relatedTickers ?? []).length > 0)) {
    return items;
  }
  return items.map((item) => ({
    ...item,
    relatedTickers:
      item.relatedTickers && item.relatedTickers.length > 0
        ? item.relatedTickers
        : [upper],
  }));
}
