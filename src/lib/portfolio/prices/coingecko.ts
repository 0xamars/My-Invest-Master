import type { PriceRequestAsset } from "@/types/portfolio";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchCryptoPrices(
  assets: PriceRequestAsset[],
): Promise<{
  prices: Record<string, number>;
  changes: Record<string, { change: number; changePercent: number }>;
  errors: Record<string, string>;
}> {
  const prices: Record<string, number> = {};
  const changes: Record<string, { change: number; changePercent: number }> = {};
  const errors: Record<string, string> = {};

  const cryptoAssets = assets.filter((a) => a.type === "crypto" && a.priceId);
  if (cryptoAssets.length === 0) return { prices, changes, errors };

  const ids = [...new Set(cryptoAssets.map((a) => a.priceId!))].join(",");

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
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
      return { prices, changes, errors };
    }

    const data = (await response.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;

    for (const asset of cryptoAssets) {
      const symbol = asset.symbol.toUpperCase();
      const row = data[asset.priceId!];
      const price = row?.usd;
      if (typeof price === "number" && price > 0) {
        prices[symbol] = price;
        const changePercent =
          typeof row?.usd_24h_change === "number" ? row.usd_24h_change : null;
        if (changePercent !== null) {
          changes[symbol] = {
            change: (price * changePercent) / 100,
            changePercent,
          };
        }
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

  return { prices, changes, errors };
}
