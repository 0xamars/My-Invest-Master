import type { PriceRequestAsset } from "@/types/portfolio";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchCryptoPrices(
  assets: PriceRequestAsset[],
): Promise<{ prices: Record<string, number>; errors: Record<string, string> }> {
  const prices: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const cryptoAssets = assets.filter((a) => a.type === "crypto" && a.priceId);
  if (cryptoAssets.length === 0) return { prices, errors };

  const ids = [...new Set(cryptoAssets.map((a) => a.priceId!))].join(",");

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd`,
      {
        next: { revalidate: 30 },
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      const message = `CoinGecko API error (${response.status})`;
      for (const asset of cryptoAssets) {
        errors[asset.symbol.toUpperCase()] = message;
      }
      return { prices, errors };
    }

    const data = (await response.json()) as Record<string, { usd?: number }>;

    for (const asset of cryptoAssets) {
      const symbol = asset.symbol.toUpperCase();
      const price = data[asset.priceId!]?.usd;
      if (typeof price === "number" && price > 0) {
        prices[symbol] = price;
      } else {
        errors[symbol] = "Price unavailable from CoinGecko";
      }
    }
  } catch {
    const message = "Failed to fetch crypto prices";
    for (const asset of cryptoAssets) {
      errors[asset.symbol.toUpperCase()] = message;
    }
  }

  return { prices, errors };
}
