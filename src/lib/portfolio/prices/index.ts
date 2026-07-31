import { resolvePriceId } from "@/lib/portfolio/asset-catalog";
import { fetchCryptoPrices } from "@/lib/portfolio/prices/coingecko";
import { fetchStockPrices } from "@/lib/portfolio/prices/yahoo-finance";
import type { PriceRequestAsset } from "@/types/portfolio";

export async function fetchAssetPrices(assets: PriceRequestAsset[]) {
  const normalized = assets.map((asset) => ({
    symbol: asset.symbol.toUpperCase(),
    type: asset.type,
    priceId: resolvePriceId(asset.symbol, asset.type, asset.priceId),
  }));

  const liveAssets = normalized.filter(
    (asset) => asset.type === "stock" || asset.type === "crypto",
  );

  const [stockResult, cryptoResult] = await Promise.all([
    fetchStockPrices(liveAssets),
    fetchCryptoPrices(liveAssets),
  ]);

  return {
    prices: { ...stockResult.prices, ...cryptoResult.prices },
    changes: { ...stockResult.changes, ...cryptoResult.changes },
    errors: { ...stockResult.errors, ...cryptoResult.errors },
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchSingleAssetPrice(asset: PriceRequestAsset) {
  const symbol = asset.symbol.toUpperCase();
  const normalized: PriceRequestAsset = {
    symbol,
    type: asset.type,
    priceId: resolvePriceId(asset.symbol, asset.type, asset.priceId),
  };

  const result = await fetchAssetPrices([normalized]);
  return {
    price: result.prices[symbol] ?? null,
    error: result.errors[symbol],
  };
}
