import type { AssetType } from "@/types/portfolio";

export type PriceProjectionScenario = "expected";

export interface RetirementPlanAsset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  priceId?: string;
  logoUrl?: string;
  unitPrice: number;
  quantity: number;
  /** Expected annual growth rate in percent (e.g. 7 = 7%). */
  expectedCagr: number;
}

export interface RetirementPlan {
  id: string;
  name: string;
  retirementYear: number;
  /** Annual lifestyle spending in USD. */
  annualLifestyleSpending: number;
  /** Inflation rate in percent (e.g. 3 = 3%). */
  inflationRate: number;
  priceProjectionScenario: PriceProjectionScenario;
  assets: RetirementPlanAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface YearProjection {
  year: number;
  openingBalance: number;
  assetAppreciation: number;
  balanceAfterAppreciation: number;
  lifestyleSpending: number;
  closingBalance: number;
  assetBreakdown: Record<string, number>;
}

export interface RetirementPlanSummary {
  id: string;
  name: string;
  retirementYear: number;
  totalPortfolioValue: number;
  updatedAt: string;
}

export function getPlanTotalValue(plan: Pick<RetirementPlan, "assets">): number {
  return plan.assets.reduce(
    (sum, asset) => sum + asset.unitPrice * asset.quantity,
    0,
  );
}

export function createEmptyPlan(name = "New Retirement Plan"): RetirementPlan {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  return {
    id: crypto.randomUUID(),
    name,
    retirementYear: currentYear + 20,
    annualLifestyleSpending: 60_000,
    inflationRate: 3,
    priceProjectionScenario: "expected",
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const DEFAULT_CAGR_BY_TYPE: Record<AssetType, number> = {
  stock: 7,
  crypto: 10,
  custom: 5,
  cash: 2,
};
