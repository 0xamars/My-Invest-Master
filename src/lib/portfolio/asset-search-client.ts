import type { AssetCatalogItem } from "@/types/portfolio";

export type SearchableAssetType = "stock" | "crypto";

export async function searchAssetsFromApi(
  query: string,
  type: SearchableAssetType,
  signal?: AbortSignal,
): Promise<AssetCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ q: trimmed, type });
  const response = await fetch(`/api/assets/search?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to search assets");
  }

  const data = (await response.json()) as { results: AssetCatalogItem[] };
  return (data.results ?? []).slice(0, 8);
}
