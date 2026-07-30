import type { BudgetData } from "@/types/budget";
import {
  computeMonthSummary,
  getCategoryActivity,
  getSortedTransactions,
} from "@/lib/budget/calculations";
import { getMonthKey, parseMonthKey, shiftMonthKey } from "@/types/budget";

export interface CategorySpendingRow {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface MonthCashFlowRow {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
}

export interface AvailableTrendRow {
  monthKey: string;
  label: string;
  available: number;
}

function monthLabel(monthKey: string): string {
  return parseMonthKey(monthKey).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export function getRecentMonthKeys(count: number, endMonthKey?: string): string[] {
  const end = endMonthKey ?? getMonthKey(new Date());
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    keys.push(shiftMonthKey(end, -index));
  }
  return keys;
}

export function getSpendingByCategory(
  budget: BudgetData,
  monthKey: string,
): CategorySpendingRow[] {
  return budget.categories
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      amount: getCategoryActivity(budget.transactions, category.id, monthKey),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getIncomeVsExpensesSeries(
  budget: BudgetData,
  monthCount = 6,
): MonthCashFlowRow[] {
  return getRecentMonthKeys(monthCount).map((monthKey) => {
    const summary = computeMonthSummary(budget, monthKey);
    return {
      monthKey,
      label: monthLabel(monthKey),
      income: summary.totalIncome,
      expenses: summary.totalSpent,
    };
  });
}

export function getAvailableToBudgetSeries(
  budget: BudgetData,
  monthCount = 6,
): AvailableTrendRow[] {
  return getRecentMonthKeys(monthCount).map((monthKey) => {
    const summary = computeMonthSummary(budget, monthKey);
    return {
      monthKey,
      label: monthLabel(monthKey),
      available: summary.availableToBudget,
    };
  });
}

export function filterTransactions(
  budget: BudgetData,
  options: {
    monthKey?: string | "all";
    categoryId?: string | "all";
    accountId?: string | "all";
    type?: "all" | "inflow" | "outflow";
    search?: string;
  },
) {
  let rows = getSortedTransactions(budget.transactions);

  if (options.monthKey && options.monthKey !== "all") {
    rows = rows.filter((tx) => tx.date.startsWith(options.monthKey!));
  }

  if (options.accountId && options.accountId !== "all") {
    rows = rows.filter((tx) => tx.accountId === options.accountId);
  }

  if (options.categoryId && options.categoryId !== "all") {
    rows = rows.filter((tx) => tx.categoryId === options.categoryId);
  }

  if (options.type && options.type !== "all") {
    rows = rows.filter((tx) => tx.type === options.type);
  }

  const query = options.search?.trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (tx) =>
        tx.payee.toLowerCase().includes(query) ||
        (tx.memo?.toLowerCase().includes(query) ?? false),
    );
  }

  return rows;
}

export function getBudgetMonthOptions(budget: BudgetData): string[] {
  const keys = new Set<string>();
  for (const tx of budget.transactions) {
    keys.add(tx.date.slice(0, 7));
  }
  keys.add(getMonthKey(new Date()));
  return [...keys].sort((a, b) => b.localeCompare(a));
}
