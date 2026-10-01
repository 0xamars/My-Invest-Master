import { getReadyToAssign } from "@/lib/budget/calculations";
import {
  createEmptyBudgetPlan,
  getMonthKey,
  type BudgetPlan,
} from "@/types/budget";
import {
  createEmptyPortfolio,
  type PortfolioHolding,
  type UserPortfolio,
} from "@/types/portfolio";
import {
  createEmptyPlan,
  type RetirementPlan,
  type RetirementPlanAsset,
} from "@/types/retirement";

export const SAMPLE_BUDGET_NAME = "Sample budget";
export const SAMPLE_PORTFOLIO_NAME = "Sample portfolio";
export const SAMPLE_RETIRE_NAME = "Sample Retire plan";
export const SAMPLE_CHEQUING_NAME = "Sample chequing";
export const SAMPLE_SAVINGS_NAME = "Sample savings";
export const SAMPLE_PAY_NAME = "Sample pay";
export const SAMPLE_MARKET_NAME = "Sample market";
export const SAMPLE_SHARES_NAME = "Sample shares";
export const SAMPLE_SHARES_SYMBOL = "SAMPLE";
export const SAMPLE_FUND_NAME = "Sample fund";

/** Placeholder unit. Not a forecast and not a real balance. */
export const SAMPLE_UNIT = 1;

/**
 * Product rows the reset button deletes for one test account.
 * Preferences (plan tier), bank links, admin rows, and flags stay.
 */
export const TEST_ACCOUNT_RESET_TABLES = [
  "user_budget_plans",
  "user_budgets",
  "user_retirement_plans",
  "user_portfolio_plans",
  "user_portfolios",
  "user_watchlist_plans",
  "user_options",
  "user_money_profiles",
] as const;

export type TestAccountResetTable = (typeof TEST_ACCOUNT_RESET_TABLES)[number];

const RESET_NEVER = [
  "user_preferences",
  "user_plaid_items",
  "user_plaid_accounts",
  "app_admins",
  "app_admin_emails",
  "feature_flag_overrides",
  "admin_audit_log",
] as const;

export function resetSkipsSecretsAndAccountSettings(
  tables: readonly string[] = TEST_ACCOUNT_RESET_TABLES,
): boolean {
  return tables.every(
    (table) => !(RESET_NEVER as readonly string[]).includes(table),
  );
}

export type SampleDataset = {
  budget: BudgetPlan;
  portfolio: UserPortfolio;
  retire: RetirementPlan;
  monthKey: string;
};

function iso(date: Date): string {
  return date.toISOString();
}

function sampleHolding(now: Date): PortfolioHolding {
  const stamp = iso(now);
  return {
    id: crypto.randomUUID(),
    symbol: SAMPLE_SHARES_SYMBOL,
    name: SAMPLE_SHARES_NAME,
    type: "custom",
    sector: "Sample",
    category: "Sample",
    subCategory: "Sample",
    costPrice: SAMPLE_UNIT,
    quantity: SAMPLE_UNIT,
    addedAt: stamp,
    manualCurrentPrice: SAMPLE_UNIT,
    transactions: [
      {
        id: crypto.randomUUID(),
        type: "buy",
        quantity: SAMPLE_UNIT,
        pricePerUnit: SAMPLE_UNIT,
        date: stamp.slice(0, 10),
        createdAt: stamp,
      },
    ],
  };
}

function sampleRetireAsset(): RetirementPlanAsset {
  return {
    id: crypto.randomUUID(),
    symbol: SAMPLE_SHARES_SYMBOL,
    name: SAMPLE_FUND_NAME,
    type: "custom",
    unitPrice: SAMPLE_UNIT,
    quantity: SAMPLE_UNIT,
    expectedCagr: 0,
    accountKind: "tfsa",
    owner: "person1",
    annualContribution: 0,
  };
}

/**
 * Clearly labelled sample rows for one test account.
 * The Retire plan does not invent an age, spending, income, or a retire date.
 * Budget leftover for the sample month is zero.
 */
export function buildSampleDataset(options?: {
  now?: Date;
  portfolioIsPrimary?: boolean;
}): SampleDataset {
  const now = options?.now ?? new Date();
  const stamp = iso(now);
  const monthKey = getMonthKey(now);
  const day = `${monthKey}-15`;

  const budget = createEmptyBudgetPlan(SAMPLE_BUDGET_NAME);
  const chequingId = crypto.randomUUID();
  const savingsId = crypto.randomUUID();
  const groceries = budget.categories.find(
    (category) => category.name === "Groceries",
  );
  if (!groceries) {
    throw new Error("Sample budget is missing a groceries category");
  }

  budget.accounts = [
    {
      id: chequingId,
      name: SAMPLE_CHEQUING_NAME,
      type: "chequing",
      onBudget: true,
      sortOrder: 0,
    },
    {
      id: savingsId,
      name: SAMPLE_SAVINGS_NAME,
      type: "savings",
      onBudget: true,
      sortOrder: 1,
    },
  ];
  budget.transactions = [
    {
      id: crypto.randomUUID(),
      date: day,
      payee: SAMPLE_PAY_NAME,
      accountId: chequingId,
      categoryId: null,
      amount: SAMPLE_UNIT,
      type: "inflow",
      cleared: "cleared",
      memo: "Sample",
    },
    {
      id: crypto.randomUUID(),
      date: day,
      payee: SAMPLE_MARKET_NAME,
      accountId: chequingId,
      categoryId: groceries.id,
      amount: SAMPLE_UNIT,
      type: "outflow",
      cleared: "cleared",
      memo: "Sample",
      categoryManual: true,
    },
  ];
  budget.monthBudgets = {
    [monthKey]: { assignments: { [groceries.id]: SAMPLE_UNIT } },
  };
  budget.createdAt = stamp;
  budget.updatedAt = stamp;

  const portfolio = createEmptyPortfolio(SAMPLE_PORTFOLIO_NAME, {
    isPrimary: options?.portfolioIsPrimary ?? false,
  });
  portfolio.holdings = [sampleHolding(now)];
  portfolio.createdAt = stamp;
  portfolio.updatedAt = stamp;

  const retire = createEmptyPlan(SAMPLE_RETIRE_NAME);
  retire.assets = [sampleRetireAsset()];
  retire.currentAge = null;
  retire.retirementYear = null;
  retire.annualLifestyleSpending = null;
  retire.annualContribution = 0;
  retire.incomeStreams = [];
  retire.spouse = null;
  retire.createdAt = stamp;
  retire.updatedAt = stamp;

  return { budget, portfolio, retire, monthKey };
}

export function sampleBudgetLeftoverIsZero(dataset: SampleDataset): boolean {
  return getReadyToAssign(dataset.budget, dataset.monthKey) === 0;
}
