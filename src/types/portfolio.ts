import type { DisplayCurrency } from "@/types/currency";

export type AssetType = "stock" | "crypto" | "custom" | "cash";

export interface AssetCatalogItem {
  symbol: string;
  name: string;
  type: AssetType;
  category: string;
  subCategory: string;
  /** CoinGecko API id — required for crypto price lookups */
  priceId?: string;
  /** Logo image URL */
  logoUrl?: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  category: string;
  subCategory: string;
  costPrice: number;
  quantity: number;
  addedAt: string;
  priceId?: string;
  /** Logo image URL */
  logoUrl?: string;
  /** Manually tracked current price in USD (custom assets) */
  manualCurrentPrice?: number;
  /** Native currency for cash holdings */
  cashCurrency?: DisplayCurrency;
}

export interface PortfolioHoldingWithPrices extends PortfolioHolding {
  currentPrice: number | null;
  costValue: number;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  portfolioPercent: number | null;
  isPriceLoading: boolean;
}

export interface AddAssetInput {
  asset: AssetCatalogItem;
  costPrice: number;
  quantity: number;
  manualCurrentPrice?: number;
  cashCurrency?: DisplayCurrency;
}

export interface UpdateHoldingInput {
  costPrice?: number;
  quantity?: number;
  manualCurrentPrice?: number;
  name?: string;
  cashCurrency?: DisplayCurrency;
}

export interface PriceRequestAsset {
  symbol: string;
  type: AssetType;
  priceId?: string;
}

export interface PricesResponse {
  prices: Record<string, number>;
  fetchedAt: string;
  errors?: Record<string, string>;
}

export function isLivePricedAsset(type: AssetType): boolean {
  return type === "stock" || type === "crypto";
}

export function getCashCurrency(holding: PortfolioHolding): DisplayCurrency {
  return holding.cashCurrency ?? "USD";
}
