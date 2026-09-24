/** Feed rows in market_cache. Quotes and price bars live in other tables. */
export const MARKET_CACHE_PRUNE_DATASETS = [
  "symbol_search",
  "news_stock",
  "news_crypto",
  "symbol_news",
] as const;

export const MARKET_CACHE_PRUNE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** At most one delete pass per process per hour. */
export const MARKET_CACHE_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

export function marketCachePruneCutoff(nowMs: number): string {
  return new Date(nowMs - MARKET_CACHE_PRUNE_MAX_AGE_MS).toISOString();
}

export function shouldPruneMarketCache(
  lastPruneAtMs: number | null,
  nowMs: number,
): boolean {
  if (lastPruneAtMs == null) return true;
  return nowMs - lastPruneAtMs >= MARKET_CACHE_PRUNE_INTERVAL_MS;
}
