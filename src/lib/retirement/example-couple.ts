import { convertFromUsd } from "@/lib/portfolio/prices/fx";
import {
  compareWithdrawalOrders,
  sharedTaxComparison,
} from "@/lib/retirement/withdrawal-orders";
import { DEFAULT_FX_RATES, type FxRates } from "@/types/currency";
import {
  DEFAULT_WITHDRAWAL_ASSUMPTIONS,
  type WithdrawalOrderId,
} from "@/types/retirement";

/**
 * Homepage illustration only. Names, ages, balances, and spending are
 * invented. Do not replace these with a real household.
 */
export const EXAMPLE_COUPLE_YEAR = 2026;
export const EXAMPLE_CAD_PER_USD = DEFAULT_FX_RATES.CAD;

/** Plain names for the homepage proof. The in-app comparison keeps its own labels. */
export const EXAMPLE_HOME_ORDER_LABEL: Record<WithdrawalOrderId, string> = {
  "rrsp-first": "RRSP first",
  "tfsa-last": "TFSA last",
  "non-registered-first": "Non-registered first",
  meltdown: "Spread RRSP early",
};

export const EXAMPLE_COUPLE = {
  names: { person1: "Sam", person2: "Riley" },
  ages: { person1: 65, person2: 65 },
  endAge: 90,
  spendingCad: 110_000,
  inflationPercent: 2,
  growthPercent: 4,
  gainShare: 0.5,
  inclusionRate: 0.5,
  pensionSplitPercent: 0,
  accounts: {
    person1: { rrsp: 800_000, tfsa: 200_000, nonRegistered: 150_000 },
    person2: { rrsp: 600_000, tfsa: 150_000, nonRegistered: 100_000 },
  },
  income: {
    person1: { cpp: 12_000, oas: 8_000 },
    person2: { cpp: 10_000, oas: 8_000 },
  },
} as const;

export const EXAMPLE_RATES: FxRates = DEFAULT_FX_RATES;

function storedUsd(cad: number): number {
  return cad / EXAMPLE_CAD_PER_USD;
}

function account(
  id: string,
  owner: "person1" | "person2",
  accountKind: "rrsp" | "tfsa" | "non_registered",
  cad: number,
) {
  return {
    id,
    symbol: id,
    name: id,
    type: "custom" as const,
    unitPrice: storedUsd(cad),
    quantity: 1,
    expectedCagr: EXAMPLE_COUPLE.growthPercent,
    accountKind,
    owner,
    annualContribution: 0,
  };
}

function income(
  id: string,
  owner: "person1" | "person2",
  kind: "cpp" | "oas",
  cad: number,
) {
  return {
    id,
    name: kind === "cpp" ? "CPP" : "OAS",
    kind,
    annualAmount: storedUsd(cad),
    startAge: 65,
    colaWithInflation: true,
    owner,
    survivorPercent: 0,
  };
}

export const EXAMPLE_COUPLE_PLAN = {
  id: "example-sam-riley",
  name: "Sam & Riley",
  currentAge: EXAMPLE_COUPLE.ages.person1,
  retirementAge: EXAMPLE_COUPLE.ages.person1,
  planEndAge: EXAMPLE_COUPLE.endAge,
  inflationRate: EXAMPLE_COUPLE.inflationPercent,
  annualLifestyleSpending: storedUsd(EXAMPLE_COUPLE.spendingCad),
  pensionSplitPercent: EXAMPLE_COUPLE.pensionSplitPercent,
  currency: "CAD" as const,
  withdrawalRate: 4,
  annualContribution: 0,
  spouse: {
    name: EXAMPLE_COUPLE.names.person2,
    currentAge: EXAMPLE_COUPLE.ages.person2,
    retirementAge: EXAMPLE_COUPLE.ages.person2,
  },
  withdrawalAssumptions: { ...DEFAULT_WITHDRAWAL_ASSUMPTIONS },
  assets: [
    account("sam-rrsp", "person1", "rrsp", EXAMPLE_COUPLE.accounts.person1.rrsp),
    account("sam-tfsa", "person1", "tfsa", EXAMPLE_COUPLE.accounts.person1.tfsa),
    account(
      "sam-nonreg",
      "person1",
      "non_registered",
      EXAMPLE_COUPLE.accounts.person1.nonRegistered,
    ),
    account("riley-rrsp", "person2", "rrsp", EXAMPLE_COUPLE.accounts.person2.rrsp),
    account("riley-tfsa", "person2", "tfsa", EXAMPLE_COUPLE.accounts.person2.tfsa),
    account(
      "riley-nonreg",
      "person2",
      "non_registered",
      EXAMPLE_COUPLE.accounts.person2.nonRegistered,
    ),
  ],
  incomeStreams: [
    income("sam-cpp", "person1", "cpp", EXAMPLE_COUPLE.income.person1.cpp),
    income("sam-oas", "person1", "oas", EXAMPLE_COUPLE.income.person1.oas),
    income("riley-cpp", "person2", "cpp", EXAMPLE_COUPLE.income.person2.cpp),
    income("riley-oas", "person2", "oas", EXAMPLE_COUPLE.income.person2.oas),
  ],
};

export function exampleCoupleComparison() {
  return compareWithdrawalOrders(EXAMPLE_COUPLE_PLAN, {
    currentYear: EXAMPLE_COUPLE_YEAR,
    cadPerUsd: EXAMPLE_CAD_PER_USD,
  });
}

export const EXAMPLE_COUPLE_COMPARISON = exampleCoupleComparison();

export interface ExampleLifetimeTaxRow {
  id: WithdrawalOrderId;
  label: string;
  /** Whole Canadian dollars of tax over the plan. */
  cad: number;
  funded: boolean;
}

export interface ExampleLifetimeTaxDisplay {
  rows: ExampleLifetimeTaxRow[];
  /** Highest lifetime tax minus lowest, in whole Canadian dollars. */
  deltaCad: number;
  /** True when every order covers spending through the plan horizon. */
  allFunded: boolean;
}

function wholeCad(usd: number): number {
  return Math.round(convertFromUsd(usd, "CAD", EXAMPLE_RATES));
}

/**
 * Lifetime tax for the homepage proof. Amounts are the engine result on
 * EXAMPLE_COUPLE_PLAN, rounded the same way the bars are labeled.
 */
export function exampleLifetimeTaxDisplay(): ExampleLifetimeTaxDisplay | null {
  const comparison = EXAMPLE_COUPLE_COMPARISON;
  if (comparison.status !== "ready" || comparison.orders.length === 0) return null;
  const shared = sharedTaxComparison(comparison.orders);
  const rows = comparison.orders.map((order) => {
    const usd = shared.taxes[order.id]?.totalTax ?? order.totals.totalTax;
    return {
      id: order.id,
      label: EXAMPLE_HOME_ORDER_LABEL[order.id],
      cad: wholeCad(usd),
      funded: order.totals.depletionYear == null,
    };
  });
  const amounts = rows.map((row) => row.cad);
  return {
    rows,
    deltaCad: Math.max(...amounts) - Math.min(...amounts),
    allFunded: shared.throughYear == null && rows.every((row) => row.funded),
  };
}

export function formatExampleCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}
