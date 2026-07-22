import type { DisplayCurrency } from "@/types/currency";

export type AssetType = "stock" | "crypto" | "custom" | "cash";

export type TransactionType = "buy" | "sell";

export interface PortfolioTransaction {
  id: string;
  type: TransactionType;
  quantity: number;
  pricePerUnit: number;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  createdAt: string;
}

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
  /** Sector for allocation charts (e.g. AI Tech, Software). */
  sector: string;
  /** @deprecated Legacy — use sector. Kept for search API mapping. */
  category: string;
  /** @deprecated Legacy — use sector. Kept for search API mapping. */
  subCategory: string;
  costPrice: number;
  quantity: number;
  addedAt: string;
  /** Ledger of buy/sell events — source of truth for quantity & avg cost. */
  transactions: PortfolioTransaction[];
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

export interface AddTransactionInput {
  asset: AssetCatalogItem;
  type: TransactionType;
  quantity: number;
  pricePerUnit: number;
  date: string;
  /** Required when creating a new holding. */
  sector?: string;
  manualCurrentPrice?: number;
  cashCurrency?: DisplayCurrency;
}

/** @deprecated Use AddTransactionInput */
export interface AddAssetInput {
  asset: AssetCatalogItem;
  sector: string;
  costPrice: number;
  quantity: number;
  manualCurrentPrice?: number;
  cashCurrency?: DisplayCurrency;
}

export interface UpdateHoldingInput {
  manualCurrentPrice?: number;
  name?: string;
  sector?: string;
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
