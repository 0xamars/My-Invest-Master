import type { AssetType } from "@/types/portfolio";

export type PriceProjectionScenario = "expected";

export type RetirementPlanCurrency = "CAD" | "USD";

export type RetirementIncomeKind = "cpp" | "oas" | "pension" | "other";

/** Registered and taxable buckets. Cash is an unregistered cash account. */
export type RetirementAccountKind = "rrsp" | "tfsa" | "non_registered" | "cash";

/** RRSP is stored as rrsp. The projection reports rrif after conversion. */
export type ProjectedAccountKind = RetirementAccountKind | "rrif";

export type RetirementPersonId = "person1" | "person2";

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
  /** RRSP, TFSA, non-registered, or cash. Existing rows migrate in normalize. */
  accountKind: RetirementAccountKind;
  /** Person 1 is the primary plan holder. Person 2 is the spouse. */
  owner: RetirementPersonId;
  /**
   * Annual amount added to this account until its owner reaches their target
   * age. Stored in USD, like the rest of the plan. Default 0.
   */
  annualContribution: number;
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
  /** Defaults to person 1 so older plans keep a single earner. */
  owner: RetirementPersonId;
  /**
   * Percent of a pension or other stream that continues after the owner dies.
   * CPP and OAS ignore this and stop. Default 0 so death does not invent income.
   */
  survivorPercent: number;
}

/**
 * What-if for the survivor view. Not stored on the plan: a death age is an
 * input to the view, not a fact the planner invents.
 */
export interface SurvivorScenario {
  deceased: RetirementPersonId;
  /** Age the deceased attains in the year of death. */
  deathAge: number;
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
  /**
   * Percent of pension-stream income assigned to the other person while both
   * are alive. 0–50. CPP and OAS are not split. Does not change the household
   * total. The Withdrawal order section also uses it for RRIF income when the
   * owner is 65 or older. Default 0.
   */
  pensionSplitPercent: number;
  incomeStreams: RetirementIncomeStream[];
  /**
   * Settings for the Withdrawal order comparison. Missing on old plans;
   * normalize fills the defaults. Null money fields mean "use the published
   * tax-year figure" and are converted from Canadian dollars at comparison time.
   */
  withdrawalAssumptions: RetirementWithdrawalAssumptions;
}

/** Which withdrawal order the year-by-year table is showing. Not a recommendation. */
export type WithdrawalOrderId =
  | "rrsp-first"
  | "tfsa-last"
  | "non-registered-first"
  | "meltdown";

export interface RetirementWithdrawalAssumptions {
  selectedOrder: WithdrawalOrderId;
  /**
   * Share of a non-registered withdrawal treated as unrealized capital gain.
   * 0–1. Cash is not a gain. Default 0.5, a generic assumption.
   */
  unrealizedGainShare: number;
  /**
   * Taxable fraction of a capital gain. The 2026 inclusion rate used here is 0.5.
   */
  capitalGainsInclusionRate: number;
  /**
   * Per retired person, in stored plan dollars. Null uses the top of the lowest
   * federal bracket for the tax year, converted from Canadian dollars.
   */
  meltdownTargetIncome: number | null;
  /**
   * TFSA deposits allowed per living person per year, in stored plan dollars.
   * Null uses the TFSA dollar limit, converted from Canadian dollars. This is
   * not that person's real contribution room.
   */
  annualTfsaRoom: number | null;
}

export interface PersonYearIncome {
  cpp: number;
  oas: number;
  pension: number;
  other: number;
  /** Pension after the split election. The household pension total is unchanged. */
  pensionAfterSplit: number;
}

export interface YearProjection {
  year: number;
  age: number;
  /** Null when the plan has no spouse. */
  spouseAge: number | null;
  deceased: RetirementPersonId[];
  openingBalance: number;
  assetAppreciation: number;
  balanceAfterAppreciation: number;
  contribution: number;
  lifestyleSpending: number;
  /** Household income. Pension split does not change this total. */
  income: number;
  incomeByPerson: Record<RetirementPersonId, PersonYearIncome>;
  /** Tax hook result. The default engine returns 0. */
  taxPayable: number;
  portfolioWithdrawal: number;
  /** Prescribed RRIF minimum actually taken from RRIF accounts. */
  rrifMinimum: number;
  /** Minimum above the spending gap that was moved to a non-RRIF account. */
  rrifSurplusReinvested: number;
  /** Minimum above the spending gap that left the plan. */
  rrifSurplusLeftPlan: number;
  closingBalance: number;
  assetBreakdown: Record<string, number>;
  /** Account kind after RRSP→RRIF conversion for this year. */
  accountKindById: Record<string, ProjectedAccountKind>;
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

export const ACCOUNT_KIND_LABELS: Record<RetirementAccountKind, string> = {
  rrsp: "RRSP",
  tfsa: "TFSA",
  non_registered: "Non-registered",
  cash: "Cash",
};

export const ACCOUNT_KINDS: RetirementAccountKind[] = [
  "rrsp",
  "tfsa",
  "non_registered",
  "cash",
];

/** Federal RRSP-to-RRIF deadline: the end of the year the owner turns 71. */
export const RRSP_CONVERSION_AGE = 71;

export function defaultAccountKind(type: AssetType): RetirementAccountKind {
  return type === "cash" ? "cash" : "non_registered";
}

export function isAccountKind(value: unknown): value is RetirementAccountKind {
  return (
    value === "rrsp" ||
    value === "tfsa" ||
    value === "non_registered" ||
    value === "cash"
  );
}

export function emptyPersonIncome(): PersonYearIncome {
  return { cpp: 0, oas: 0, pension: 0, other: 0, pensionAfterSplit: 0 };
}

export function personLabel(
  plan: Pick<RetirementPlan, "spouse">,
  person: RetirementPersonId,
): string {
  if (person === "person1") return "You";
  const name = plan.spouse?.name.trim();
  return name ? name : "Spouse";
}

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
    owner: "person1",
    survivorPercent: 0,
    ...overrides,
  };
}

export const DEFAULT_WITHDRAWAL_ASSUMPTIONS: RetirementWithdrawalAssumptions = {
  selectedOrder: "rrsp-first",
  unrealizedGainShare: 0.5,
  capitalGainsInclusionRate: 0.5,
  meltdownTargetIncome: null,
  annualTfsaRoom: null,
};

export function createEmptySpouse(): RetirementSpouse {
  return {
    name: "",
    currentAge: DEFAULT_CURRENT_AGE,
    retirementAge: DEFAULT_RETIREMENT_AGE,
  };
}

export function createEmptyPlan(name = "New Retire plan"): RetirementPlan {
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
    pensionSplitPercent: 0,
    incomeStreams: [],
    withdrawalAssumptions: { ...DEFAULT_WITHDRAWAL_ASSUMPTIONS },
    annualLifestyleSpending: 60_000,
    inflationRate: 3,
    priceProjectionScenario: "expected",
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}
