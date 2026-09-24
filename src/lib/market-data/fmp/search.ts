import { fmpFetch, str } from "@/lib/market-data/fmp/client";
import { getStockLogoUrl } from "@/lib/portfolio/logos";
import type { AssetCatalogItem } from "@/types/portfolio";

const SEARCH_REVALIDATE_SEC = 60 * 60;
const STOCK_TYPES = new Set(["stock", "etf", "fund", "trust", "index"]);

export function normalizeSearchCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export function mapFmpSearchHit(
  row: Record<string, unknown>,
): AssetCatalogItem | null {
  const symbol = str(row.symbol)?.toUpperCase();
  if (!symbol) return null;
  const type = str(row.type)?.toLowerCase() ?? "stock";
  if (!STOCK_TYPES.has(type)) return null;
  const name = str(row.name) ?? symbol;
  const exchange = str(row.exchangeFullName) ?? str(row.exchange);
  return {
    symbol,
    name,
    type: "stock",
    category: type === "etf" ? "ETF" : "Equity",
    subCategory: exchange ?? (type === "etf" ? "ETF" : "Stock"),
    logoUrl: getStockLogoUrl(symbol),
  };
}

export function mergeSearchHits(
  rows: AssetCatalogItem[],
  limit = 8,
): AssetCatalogItem[] {
  const seen = new Set<string>();
  const items: AssetCatalogItem[] = [];
  for (const row of rows) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    items.push(row);
    if (items.length >= limit) break;
  }
  return items;
}

async function fetchSearch(
  path: "/search-symbol" | "/search-name",
  query: string,
): Promise<AssetCatalogItem[]> {
  const data = await fmpFetch<unknown>({
    path,
    query: { query, limit: 10 },
    revalidate: SEARCH_REVALIDATE_SEC,
  });
  if (!Array.isArray(data)) return [];
  const items: AssetCatalogItem[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = mapFmpSearchHit(row as Record<string, unknown>);
    if (item) items.push(item);
  }
  return items;
}

/** Symbol lookup plus name lookup, merged. Callers cache the merged list. */
export async function fetchFmpStockSearch(
  query: string,
): Promise<AssetCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const [bySymbol, byName] = await Promise.all([
    fetchSearch("/search-symbol", trimmed).catch(() => []),
    fetchSearch("/search-name", trimmed).catch(() => []),
  ]);
  return mergeSearchHits([...bySymbol, ...byName]);
}
