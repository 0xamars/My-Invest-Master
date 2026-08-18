import type { BudgetAccount, BudgetData, BudgetTransaction } from "@/types/budget";
import {
  getAccountBalanceThroughMonth,
  isLiabilityAccount,
} from "@/lib/budget/accounts";
import {
  computeMonthSummary,
  getCategoryActivity,
  getSortedTransactions,
} from "@/lib/budget/calculations";
import { isOnBudgetOutflow } from "@/lib/budget/on-budget";
import { getOutflowActivityForCategory } from "@/lib/budget/transactions";
import { getMonthKey, parseMonthKey, shiftMonthKey } from "@/types/budget";

export type ReportRangePreset =
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "custom";

export const REPORT_RANGE_PRESETS: ReportRangePreset[] = [
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "custom",
];

export const REPORT_RANGE_LABELS: Record<ReportRangePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "last-6-months": "Last 6 months",
  custom: "Custom",
};

export interface ReportDateRange {
  preset: ReportRangePreset;
  fromDate: string;
  toDate: string;
  monthKeys: string[];
}

export interface PayeeSpendingRow {
  payee: string;
  amount: number;
}

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

export interface NetWorthMonthRow {
  monthKey: string;
  label: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface NetWorthSnapshot {
  assets: number;
  liabilities: number;
  netWorth: number;
  assetAccounts: Array<{ account: BudgetAccount; balance: number }>;
  liabilityAccounts: Array<{ account: BudgetAccount; balance: number }>;
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

export function getNetWorthSnapshot(
  accounts: BudgetAccount[],
  transactions: BudgetTransaction[],
  monthKey?: string,
): NetWorthSnapshot {
  const assetAccounts: Array<{ account: BudgetAccount; balance: number }> = [];
  const liabilityAccounts: Array<{ account: BudgetAccount; balance: number }> =
    [];

  for (const account of accounts) {
    const balance =
      monthKey != null
        ? getAccountBalanceThroughMonth(account, transactions, monthKey)
        : getAccountBalanceThroughMonth(account, transactions, "9999-12");
    if (isLiabilityAccount(account.type)) {
      liabilityAccounts.push({ account, balance });
    } else {
      assetAccounts.push({ account, balance });
    }
  }

  const assets = assetAccounts.reduce((sum, row) => sum + row.balance, 0);
  const liabilities = liabilityAccounts.reduce((sum, row) => sum + row.balance, 0);

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    assetAccounts,
    liabilityAccounts,
  };
}

export function getNetWorthSeries(
  budget: Pick<BudgetData, "accounts" | "transactions">,
  monthCount = 6,
): NetWorthMonthRow[] {
  const accounts = budget.accounts ?? [];
  return getRecentMonthKeys(monthCount).map((monthKey) => {
    const snapshot = getNetWorthSnapshot(accounts, budget.transactions, monthKey);
    return {
      monthKey,
      label: monthLabel(monthKey),
      assets: snapshot.assets,
      liabilities: snapshot.liabilities,
      netWorth: snapshot.netWorth,
    };
  });
}

function lastDateOfMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}

function firstDateOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

function monthKeysInclusive(fromMonth: string, toMonth: string): string[] {
  if (fromMonth > toMonth) return monthKeysInclusive(toMonth, fromMonth);
  const keys: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    keys.push(cursor);
    if (cursor === toMonth) break;
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function resolveReportDateRange(
  preset: ReportRangePreset,
  options?: { now?: Date; fromDate?: string; toDate?: string },
): ReportDateRange {
  const now = options?.now ?? new Date();
  const currentMonth = getMonthKey(now);
  const lastMonth = shiftMonthKey(currentMonth, -1);

  if (preset === "custom") {
    const fromDate = isValidDateKey(options?.fromDate ?? "")
      ? options!.fromDate!
      : firstDateOfMonth(currentMonth);
    const toDate = isValidDateKey(options?.toDate ?? "")
      ? options!.toDate!
      : lastDateOfMonth(currentMonth);
    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;
    return {
      preset,
      fromDate: start,
      toDate: end,
      monthKeys: monthKeysInclusive(start.slice(0, 7), end.slice(0, 7)),
    };
  }

  const monthCount =
    preset === "this-month" ? 1 : preset === "last-month" ? 1 : preset === "last-3-months" ? 3 : 6;
  const endMonth = preset === "last-month" ? lastMonth : currentMonth;
  const monthKeys = getRecentMonthKeys(monthCount, endMonth);
  return {
    preset,
    fromDate: firstDateOfMonth(monthKeys[0]!),
    toDate: lastDateOfMonth(monthKeys[monthKeys.length - 1]!),
    monthKeys,
  };
}

function isInDateRange(date: string, fromDate: string, toDate: string): boolean {
  return date >= fromDate && date <= toDate;
}

export function getSpendingByCategory(
  budget: BudgetData,
  monthKey: string,
): CategorySpendingRow[] {
  return budget.categories
    .filter((category) => !category.creditCardAccountId)
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      amount: getCategoryActivity(
        budget.transactions,
        category.id,
        monthKey,
        undefined,
        budget.accounts,
      ),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getSpendingByCategoryInRange(
  budget: BudgetData,
  fromDate: string,
  toDate: string,
): CategorySpendingRow[] {
  return budget.categories
    .filter((category) => !category.creditCardAccountId)
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      amount: budget.transactions.reduce((sum, tx) => {
        if (!isInDateRange(tx.date, fromDate, toDate)) return sum;
        if (!isOnBudgetOutflow(tx, budget.accounts)) return sum;
        return sum + getOutflowActivityForCategory(tx, category.id);
      }, 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getSpendingByPayee(
  budget: BudgetData,
  fromDate: string,
  toDate: string,
): PayeeSpendingRow[] {
  const totals = new Map<string, PayeeSpendingRow>();

  for (const tx of budget.transactions) {
    if (!isInDateRange(tx.date, fromDate, toDate)) continue;
    if (!isOnBudgetOutflow(tx, budget.accounts)) continue;
    const name = tx.payee.trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    const current = totals.get(key);
    if (current) {
      current.amount += tx.amount;
    } else {
      totals.set(key, { payee: name, amount: tx.amount });
    }
  }

  return [...totals.values()]
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.payee.localeCompare(b.payee));
}

export function getIncomeVsExpensesSeries(
  budget: BudgetData,
  monthCount = 6,
): MonthCashFlowRow[] {
  return getIncomeVsExpensesForMonths(budget, getRecentMonthKeys(monthCount));
}

export function getIncomeVsExpensesForMonths(
  budget: BudgetData,
  monthKeys: string[],
): MonthCashFlowRow[] {
  return monthKeys.map((monthKey) => {
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

export function isTransactionApproved(
  tx: Pick<BudgetTransaction, "approved">,
): boolean {
  return tx.approved !== false;
}

export function filterTransactions(
  budget: BudgetData,
  options: {
    monthKey?: string | "all";
    categoryId?: string | "all";
    accountId?: string | "all";
    type?: "all" | "inflow" | "outflow" | "transfer";
    inbox?: "all" | "unapproved";
    search?: string;
    payee?: string;
    fromDate?: string;
    toDate?: string;
  },
) {
  let rows = getSortedTransactions(budget.transactions);

  if (options.fromDate || options.toDate) {
    const fromDate = options.fromDate || "0000-01-01";
    const toDate = options.toDate || "9999-12-31";
    rows = rows.filter((tx) => isInDateRange(tx.date, fromDate, toDate));
  } else if (options.monthKey && options.monthKey !== "all") {
    rows = rows.filter((tx) => tx.date.startsWith(options.monthKey!));
  }

  if (options.accountId && options.accountId !== "all") {
    rows = rows.filter(
      (tx) =>
        tx.accountId === options.accountId ||
        (tx.type === "transfer" && tx.transferAccountId === options.accountId),
    );
  }

  if (options.categoryId && options.categoryId !== "all") {
    const paymentAccountId = budget.categories.find(
      (category) => category.id === options.categoryId,
    )?.creditCardAccountId;
    rows = rows.filter((tx) => {
      if (paymentAccountId) {
        return (
          tx.accountId === paymentAccountId ||
          tx.transferAccountId === paymentAccountId
        );
      }
      return (
        tx.categoryId === options.categoryId ||
        Boolean(tx.splits?.some((line) => line.categoryId === options.categoryId))
      );
    });
  }

  if (options.type && options.type !== "all") {
    rows = rows.filter((tx) => tx.type === options.type);
  }

  if (options.inbox === "unapproved") {
    rows = rows.filter((tx) => !isTransactionApproved(tx));
  }

  const query = options.search?.trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (tx) =>
        tx.payee.toLowerCase().includes(query) ||
        (tx.memo?.toLowerCase().includes(query) ?? false),
    );
  }

  const payee = options.payee?.trim().toLowerCase();
  if (payee) {
    rows = rows.filter((tx) => tx.payee.trim().toLowerCase() === payee);
  }

  return rows;
}

export function getBudgetMonthOptions(budget: BudgetData): string[] {
  const keys = new Set<string>();
  for (const tx of budget.transactions) {
    keys.add(tx.date.slice(0, 7));
  }
  for (const schedule of budget.scheduledTransactions ?? []) {
    if (schedule.active === false) continue;
    keys.add(schedule.nextDate.slice(0, 7));
  }
  keys.add(getMonthKey(new Date()));
  return [...keys].sort((a, b) => b.localeCompare(a));
}
