import type { AssetCatalogItem } from "@/types/portfolio";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
}

export async function searchCrypto(query: string): Promise<AssetCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/search?query=${encodeURIComponent(trimmed)}`,
      {
        next: { revalidate: 300 },
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { coins?: CoinGeckoSearchCoin[] };
    const coins = data.coins ?? [];

    const seen = new Set<string>();
    const items: AssetCatalogItem[] = [];

    for (const coin of coins) {
      const symbol = coin.symbol.toUpperCase();
      if (seen.has(symbol)) continue;
      seen.add(symbol);

      items.push({
        symbol,
        name: coin.name,
        type: "crypto",
        category: "Crypto",
        subCategory: "Cryptocurrency",
        priceId: coin.id,
        logoUrl: coin.thumb,
      });

      if (items.length >= 8) break;
    }

    return items;
  } catch (error) {
    console.error("CoinGecko search error:", error);
    return [];
  }
}

export async function lookupCryptoSymbol(
  symbol: string,
): Promise<AssetCatalogItem | null> {
  const results = await searchCrypto(symbol);
  const normalized = symbol.trim().toUpperCase();
  return results.find((item) => item.symbol === normalized) ?? results[0] ?? null;
}
