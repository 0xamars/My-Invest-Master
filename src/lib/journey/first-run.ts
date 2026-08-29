import { isDisplayCurrency, type DisplayCurrency } from "@/types/currency";
import { createEmptyBudgetPlan, type BudgetCurrency, type BudgetPlan } from "@/types/budget";
import { createEmptyPortfolio, type UserPortfolio } from "@/types/portfolio";

export const STARTER_ENVELOPE_NAMES = [
  "Housing",
  "Food",
  "Transport",
  "Debt",
  "Fun",
  "Buffer",
] as const;

export const STARTER_SPENDING_ACCOUNT_NAME = "Spending";

export const FIRST_BOOK_FREEDOM_LINE = "this is the book Freedom will use.";

export const SHOW_THE_DETAILS_LABEL = "Show the details";

export const ADD_HOLDING_FIELD_HELP = {
  type: "Buy adds shares to the book. Sell takes them off. Quantity and average cost stay honest.",
  asset: "Search a public name or ticker. This is the line on the book — not a recommendation.",
  sector: "A label for grouping. It does not change quantity or cost.",
  quantity: "How many shares or units you hold. Do not invent a count.",
  price: "What you paid per unit. This is average cost on the book, not today's price.",
  date: "The day you bought or sold. Use the real date if you have it.",
} as const;

export function shouldOfferBudgetFirstRunKit(
  plans: readonly Pick<BudgetPlan, "id">[],
): boolean {
  return plans.length === 0;
}

export function shouldOfferFirstBookWizard(
  books: readonly Pick<UserPortfolio, "id">[],
): boolean {
  return books.length === 0;
}

export function budgetCurrencyFromProfile(
  currency: string | null | undefined,
): BudgetCurrency {
  return currency === "CAD" ? "CAD" : "USD";
}

/**
 * Starter plan for an empty Budget: six envelopes + one spending account.
 * No leftover, no assignments, no close — leftover and month-close stay honest.
 */
export function createFirstRunBudgetKit(
  name = "Budget",
  options?: { currency?: BudgetCurrency },
): BudgetPlan {
  const now = new Date().toISOString();
  const plan = createEmptyBudgetPlan(name);
  const groupId = plan.categoryGroups[0]?.id ?? crypto.randomUUID();

  return {
    ...plan,
    name,
    accounts: [
      {
        id: plan.accounts[0]?.id ?? crypto.randomUUID(),
        name: STARTER_SPENDING_ACCOUNT_NAME,
        type: "chequing",
        onBudget: true,
        sortOrder: 0,
      },
    ],
    categoryGroups: [
      {
        id: groupId,
        name: "Envelopes",
        sortOrder: 0,
      },
    ],
    categories: STARTER_ENVELOPE_NAMES.map((envelopeName, index) => ({
      id: crypto.randomUUID(),
      groupId,
      name: envelopeName,
      sortOrder: index,
    })),
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    closedThrough: null,
    currency: options?.currency ?? plan.currency ?? "USD",
    createdAt: now,
    updatedAt: now,
  };
}

export function firstRunKitEnvelopeNames(plan: Pick<BudgetPlan, "categories">): string[] {
  return plan.categories.map((category) => category.name);
}

/**
 * Offer the kit only when there is no plan. Existing plans are returned as-is.
 */
export function applyBudgetFirstRunKit(
  plans: readonly BudgetPlan[],
  name = "Budget",
  options?: { currency?: BudgetCurrency },
): BudgetPlan[] {
  if (plans.length > 0) return [...plans];
  return [createFirstRunBudgetKit(name, options)];
}

/**
 * First book: name only, empty holdings. Existing books are never replaced.
 */
export function applyFirstBookIfMissing(
  books: readonly UserPortfolio[],
  name: string,
): UserPortfolio[] {
  if (books.length > 0) return [...books];
  return [createEmptyPortfolio(name.trim() || "Book", { isPrimary: true })];
}

export function firstBookWizardCopy(): { freedomLine: string } {
  return { freedomLine: FIRST_BOOK_FREEDOM_LINE };
}

export function displayCurrencyOrDefault(
  currency: string | null | undefined,
  fallback: DisplayCurrency = "CAD",
): DisplayCurrency {
  if (currency && isDisplayCurrency(currency)) return currency;
  return fallback;
}
