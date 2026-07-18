import type { AssetType } from "@/types/portfolio";

export function resolvePriceId(
  symbol: string,
  type: AssetType,
  priceId?: string,
): string | undefined {
  if (type === "stock") return undefined;
  return priceId;
}
