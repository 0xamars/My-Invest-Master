import { fetchFmpStockSearch, normalizeSearchCacheKey } from "@/lib/market-data/fmp/search";
import { loadCachedFeed } from "@/lib/market-data/warehouse/feed-cache";
import type { AssetCatalogItem } from "@/types/portfolio";

export async function searchStocks(query: string): Promise<AssetCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = normalizeSearchCacheKey(trimmed);
  if (!cacheKey) return [];

  try {
    return await loadCachedFeed({
      cacheKey,
      dataset: "symbol_search",
      emptyValue: [] as AssetCatalogItem[],
      isEmpty: (items) => items.length === 0,
      fetchFmp: () => fetchFmpStockSearch(trimmed),
    });
  } catch (error) {
    console.error("FMP stock search error:", error);
    return [];
  }
}

export async function lookupStockSymbol(
  symbol: string,
): Promise<AssetCatalogItem | null> {
  const results = await searchStocks(symbol);
  const normalized = symbol.trim().toUpperCase();
  return results.find((item) => item.symbol === normalized) ?? results[0] ?? null;
}
