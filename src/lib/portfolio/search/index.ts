import { searchCrypto } from "@/lib/portfolio/search/coingecko-search";
import { searchStocks } from "@/lib/portfolio/search/yahoo-search";
import type { AssetCatalogItem, AssetType } from "@/types/portfolio";

export async function searchAssets(
  query: string,
  type: AssetType,
): Promise<AssetCatalogItem[]> {
  if (type === "stock") {
    return searchStocks(query);
  }
  return searchCrypto(query);
}
