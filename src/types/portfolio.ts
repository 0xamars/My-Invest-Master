import type { DisplayCurrency } from "@/types/currency";
import type { RulesChangelogEntry } from "@/lib/invest/rules-changelog";
import {
  EMPTY_LEVERAGE,
  type PortfolioLeverage,
} from "@/lib/portfolio/leverage";

export type AssetType = "stock" | "crypto" | "custom" | "cash";

/** Target mix by asset type, stored as percents on the portfolio JSONB. */
export type TargetAllocation = Record<AssetType, number>;

export type TransactionType = "buy" | "sell";

export interface PortfolioTransaction {
  id: string;
  type: TransactionType;
  quantity: number;
  pricePerUnit: number;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  createdAt: string;
  /** Closed-fill journal: why this exit happened. */
  why?: string;
  /** Closed-fill journal: what we skipped instead. */
  skipped?: string;
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
  /** Daily (or 24h) change vs previous close / prior period when available. */
  changes?: Record<string, { change: number; changePercent: number }>;
  fetchedAt: string;
  errors?: Record<string, string>;
}

export function isLivePricedAsset(type: AssetType): boolean {
  return type === "stock" || type === "crypto";
}

export function getCashCurrency(holding: PortfolioHolding): DisplayCurrency {
  return holding.cashCurrency ?? "USD";
}

/** Multi-portfolio record (cloud `user_portfolio_plans.data`). */
export interface UserPortfolio {
  id: string;
  name: string;
  isPrimary: boolean;
  holdings: PortfolioHolding[];
  /** Optional target mix by asset type (percent). Unset → default 80/10/10/0. */
  targetAllocation?: TargetAllocation;
  /** Manual margin figures. Nulls on old plans — never invented. */
  leverage?: PortfolioLeverage;
  /** Live rules log (target mix, leftover, util). Seeded history stays in code. */
  rulesChangelog?: RulesChangelogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPortfolioSummary {
  id: string;
  name: string;
  isPrimary: boolean;
  holdingCount: number;
  updatedAt: string;
}

export function createEmptyPortfolio(
  name = "My Portfolio",
  options?: { isPrimary?: boolean },
): UserPortfolio {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    isPrimary: options?.isPrimary ?? false,
    holdings: [],
    leverage: { ...EMPTY_LEVERAGE },
    createdAt: now,
    updatedAt: now,
  };
}

export function toPortfolioSummary(
  portfolio: UserPortfolio,
): UserPortfolioSummary {
  return {
    id: portfolio.id,
    name: portfolio.name,
    isPrimary: portfolio.isPrimary,
    holdingCount: portfolio.holdings.length,
    updatedAt: portfolio.updatedAt,
  };
}
