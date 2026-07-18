import type { PriceRequestAsset, PricesResponse } from "@/types/portfolio";

export async function fetchPricesFromApi(
  assets: PriceRequestAsset[],
): Promise<PricesResponse> {
  if (assets.length === 0) {
    return { prices: {}, fetchedAt: new Date().toISOString() };
  }

  const response = await fetch("/api/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }

  return response.json() as Promise<PricesResponse>;
}
