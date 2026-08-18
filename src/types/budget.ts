export type BudgetAccountType =
  | "chequing"
  | "savings"
  | "credit-card"
  | "cash"
  | "line-of-credit"
  | "other";

export interface BudgetAccount {
  id: string;
  name: string;
  type: BudgetAccountType;
  sortOrder: number;
  lastReconciledAt?: string;
}

export type BudgetCategoryGroupKind = "user" | "credit-card-payments";

export interface BudgetCategoryGroup {
  id: string;
  name: string;
  sortOrder: number;
  /** System group that holds one payment category per credit-card / LOC account. */
  kind?: BudgetCategoryGroupKind;
}

export interface BudgetCategory {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  /** When set, this is the automatic payment category for that liability account. */
  creditCardAccountId?: string;
}

export type BudgetTransactionType = "inflow" | "outflow" | "transfer";

export type RecurringFrequency =
  | "weekly"
  | "every-2-weeks"
  | "monthly"
  | "yearly";

export interface BudgetScheduledTransaction {
  id: string;
  nextDate: string;
  frequency: RecurringFrequency;
  payee: string;
  accountId: string;
  /** Null for inflows (Ready to Assign) and transfers. Unused when splits are present. */
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  memo?: string;
  transferAccountId?: string;
  splits?: BudgetTransactionSplit[];
  endDate?: string;
  remainingCount?: number;
  /** False once remaining count or end date is exhausted. Defaults to true. */
  active?: boolean;
}

export interface BudgetTransactionSplit {
  id: string;
  categoryId: string | null;
  amount: number;
  memo?: string;
}

export interface BudgetTransaction {
  id: string;
  date: string;
  payee: string;
  accountId: string;
  /** Null for inflows (Ready to Assign) and transfers. Unused when splits are present. */
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  cleared: boolean;
  memo?: string;
  /** Destination account when type is "transfer". */
  transferAccountId?: string;
  /** Category lines for split outflows. Activity uses these instead of categoryId. */
  splits?: BudgetTransactionSplit[];
  /** Set when this row was posted from a recurring schedule. */
  scheduledTransactionId?: string;
}

export interface MonthBudget {
  assignments: Record<string, number>;
}

export interface CategoryGoal {
  id: string;
  categoryId: string;
  targetAmount: number;
  targetDate?: string;
  label?: string;
}

export interface BudgetPlan {
  id: string;
  name: string;
  accounts: BudgetAccount[];
  categoryGroups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  scheduledTransactions: BudgetScheduledTransaction[];
  monthBudgets: Record<string, MonthBudget>;
  goals: CategoryGoal[];
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use BudgetPlan — kept for calculation helpers */
export interface BudgetData {
  accounts?: BudgetAccount[];
  categoryGroups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  scheduledTransactions?: BudgetScheduledTransaction[];
  monthBudgets: Record<string, MonthBudget>;
  goals: CategoryGoal[];
  updatedAt: string;
}

export interface BudgetPlanSummary {
  id: string;
  name: string;
  availableToBudget: number;
  totalAssigned: number;
  totalSpent: number;
  updatedAt: string;
}

export function createDefaultAccount(name = "Chequing"): BudgetAccount {
  return {
    id: crypto.randomUUID(),
    name,
    type: "chequing",
    sortOrder: 0,
  };
}

export function createEmptyBudgetPlan(name = "New Budget Plan"): BudgetPlan {
  const now = new Date().toISOString();
  const categoryGroups: BudgetCategoryGroup[] = [];
  const categories: BudgetCategory[] = [];
  const defaultAccount = createDefaultAccount();

  DEFAULT_STRUCTURE.forEach((entry, groupIndex) => {
    const groupId = crypto.randomUUID();
    categoryGroups.push({
      id: groupId,
      name: entry.group,
      sortOrder: groupIndex,
    });

    entry.categories.forEach((categoryName, categoryIndex) => {
      categories.push({
        id: crypto.randomUUID(),
        groupId,
        name: categoryName,
        sortOrder: categoryIndex,
      });
    });
  });

  return {
    id: crypto.randomUUID(),
    name,
    accounts: [defaultAccount],
    categoryGroups,
    categories,
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** @deprecated Use createEmptyBudgetPlan */
export function createEmptyBudget(): BudgetData {
  const plan = createEmptyBudgetPlan();
  return {
    categoryGroups: plan.categoryGroups,
    categories: plan.categories,
    transactions: plan.transactions,
    monthBudgets: plan.monthBudgets,
    goals: plan.goals,
    updatedAt: plan.updatedAt,
  };
}

const DEFAULT_STRUCTURE: Array<{ group: string; categories: string[] }> = [
  {
    group: "Immediate Obligations",
    categories: ["Rent / Mortgage", "Utilities", "Insurance"],
  },
  {
    group: "Living Expenses",
    categories: ["Groceries", "Transport", "Healthcare"],
  },
  {
    group: "Quality of Life",
    categories: ["Dining Out", "Fun", "Subscriptions"],
  },
  {
    group: "Future Goals",
    categories: ["Emergency Fund", "Vacation", "Investments"],
  },
];


export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + delta);
  return getMonthKey(date);
}

export function formatMonthLabel(monthKey: string): string {
  return parseMonthKey(monthKey).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
