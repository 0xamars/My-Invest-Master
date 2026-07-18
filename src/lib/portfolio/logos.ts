import type { AssetType, PortfolioHolding } from "@/types/portfolio";

const FMP_LOGO = (symbol: string) =>
  `https://financialmodelingprep.com/image-stock/${symbol.toUpperCase()}.png`;

const PARQET_LOGO = (symbol: string) =>
  `https://assets.parqet.com/logos/symbol/${symbol.toUpperCase()}?format=png`;

export function getStockLogoUrls(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  return [FMP_LOGO(upper), PARQET_LOGO(upper)];
}

export function getStockLogoUrl(symbol: string): string {
  return getStockLogoUrls(symbol)[0];
}

export function resolveHoldingLogoUrl(holding: Pick<
  PortfolioHolding,
  "symbol" | "type" | "priceId" | "logoUrl"
>): string | undefined {
  if (holding.logoUrl) return holding.logoUrl;
  if (holding.type === "stock") return getStockLogoUrl(holding.symbol);
  return undefined;
}

export function getAssetFallbackLabel(
  symbol: string,
  type: AssetType,
): string {
  if (type === "cash") return "$";
  return symbol.slice(0, 2).toUpperCase();
}

export function getCryptoLogoApiUrl(priceId: string): string {
  return `/api/logos/crypto?priceId=${encodeURIComponent(priceId)}`;
}
