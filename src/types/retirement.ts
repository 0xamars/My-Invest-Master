import type { AssetType } from "@/types/portfolio";

export type PriceProjectionScenario = "expected";

export type RetirementPlanCurrency = "CAD" | "USD";

export type RetirementIncomeKind = "cpp" | "oas" | "pension" | "other";

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

export interface RetirementSpouse {
  name: string;
  currentAge: number;
  retirementAge: number;
}

export interface RetirementIncomeStream {
  id: string;
  name: string;
  kind: RetirementIncomeKind;
  /** Annual amount in today's dollars (USD storage). */
  annualAmount: number;
  startAge: number;
  /** When true, amount grows with plan inflation from today. */
  colaWithInflation: boolean;
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
  currentAge: number;
  retirementAge: number;
  planEndAge: number;
  spouse: RetirementSpouse | null;
  /** Display currency for this plan (USD storage + existing FX path). */
  currency: RetirementPlanCurrency;
  /** Safe withdrawal rate in percent (e.g. 4 = 4%). */
  withdrawalRate: number;
  /** Annual savings added during the accumulation phase. */
  annualContribution: number;
  incomeStreams: RetirementIncomeStream[];
}

export interface YearProjection {
  year: number;
  age: number;
  openingBalance: number;
  assetAppreciation: number;
  balanceAfterAppreciation: number;
  contribution: number;
  lifestyleSpending: number;
  income: number;
  portfolioWithdrawal: number;
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

export const DEFAULT_CURRENT_AGE = 40;
export const DEFAULT_RETIREMENT_AGE = 65;
export const DEFAULT_PLAN_END_AGE = 90;
export const DEFAULT_WITHDRAWAL_RATE = 4;
export const DEFAULT_PLAN_CURRENCY: RetirementPlanCurrency = "CAD";

export const DEFAULT_CAGR_BY_TYPE: Record<AssetType, number> = {
  stock: 7,
  crypto: 10,
  custom: 5,
  cash: 2,
};

/**
 * Default annual volatility (percent) used by the light Monte Carlo.
 * These are simple asset-class assumptions, not a historical backtest.
 * stocks ~15%, crypto ~50%, cash ~1%, custom ~10%.
 */
export const DEFAULT_VOLATILITY_BY_TYPE: Record<AssetType, number> = {
  stock: 15,
  crypto: 50,
  cash: 1,
  custom: 10,
};

export const RETIREMENT_INCOME_KIND_LABELS: Record<RetirementIncomeKind, string> =
  {
    cpp: "CPP",
    oas: "OAS",
    pension: "Pension",
    other: "Other income",
  };

export function getPlanTotalValue(plan: Pick<RetirementPlan, "assets">): number {
  return plan.assets.reduce(
    (sum, asset) => sum + asset.unitPrice * asset.quantity,
    0,
  );
}

export function retirementYearFromAges(
  currentAge: number,
  retirementAge: number,
  currentYear: number,
): number {
  return currentYear + (retirementAge - currentAge);
}

export function retirementAgeFromYear(
  currentAge: number,
  retirementYear: number,
  currentYear: number,
): number {
  return currentAge + (retirementYear - currentYear);
}

export function ageInCalendarYear(
  currentAge: number,
  year: number,
  currentYear: number,
): number {
  return currentAge + (year - currentYear);
}

export function createIncomeStream(
  kind: RetirementIncomeKind,
  overrides?: Partial<Omit<RetirementIncomeStream, "kind">>,
): RetirementIncomeStream {
  return {
    id: crypto.randomUUID(),
    name: RETIREMENT_INCOME_KIND_LABELS[kind],
    kind,
    annualAmount: 0,
    startAge: 65,
    colaWithInflation: true,
    ...overrides,
  };
}

export function createEmptySpouse(): RetirementSpouse {
  return {
    name: "",
    currentAge: DEFAULT_CURRENT_AGE,
    retirementAge: DEFAULT_RETIREMENT_AGE,
  };
}

export function createEmptyPlan(name = "New Retirement Plan"): RetirementPlan {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  return {
    id: crypto.randomUUID(),
    name,
    currentAge: DEFAULT_CURRENT_AGE,
    retirementAge: DEFAULT_RETIREMENT_AGE,
    retirementYear: retirementYearFromAges(
      DEFAULT_CURRENT_AGE,
      DEFAULT_RETIREMENT_AGE,
      currentYear,
    ),
    planEndAge: DEFAULT_PLAN_END_AGE,
    spouse: null,
    currency: DEFAULT_PLAN_CURRENCY,
    withdrawalRate: DEFAULT_WITHDRAWAL_RATE,
    annualContribution: 0,
    incomeStreams: [],
    annualLifestyleSpending: 60_000,
    inflationRate: 3,
    priceProjectionScenario: "expected",
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}
