import type { AssetCatalogItem, AssetType } from "@/types/portfolio";

export async function searchAssetsFromApi(
  query: string,
  type: AssetType,
): Promise<AssetCatalogItem[]> {
  const params = new URLSearchParams({ q: query, type });
  const response = await fetch(`/api/assets/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to search assets");
  }

  const data = (await response.json()) as { results: AssetCatalogItem[] };
  return data.results;
}
