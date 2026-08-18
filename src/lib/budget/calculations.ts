import {
  getMonthKey,
  shiftMonthKey,
  type BudgetAccount,
  type BudgetCategory,
  type BudgetCategoryGroup,
  type BudgetData,
  type BudgetTransaction,
  type CategoryGoal,
} from "@/types/budget";
import {
  getPaymentCategoryActivity,
  paymentAccountIdForCategory,
  sortCategoryGroupsForBudget,
} from "@/lib/budget/credit-card-payments";
import {
  computeGoalProgress,
  type CategoryGoalProgress,
} from "@/lib/budget/goals";
import {
  getReadyToAssignEffect,
  isOnBudgetOutflow,
} from "@/lib/budget/on-budget";
import {
  getAbsorbedCashOverspend,
  getCategoryOverspendState,
  getCreditOverspendOnAccount,
  getOverspendKind,
  type OverspendKind,
} from "@/lib/budget/overspend";
import { getOutflowActivityForCategory } from "@/lib/budget/transactions";

export type CategoryBudgetStatus =
  | "healthy"
  | "low"
  | "overspent"
  | "credit-overspent";

export interface CategoryBudgetRow {
  category: BudgetCategory;
  assigned: number;
  activity: number;
  available: number;
  status: CategoryBudgetStatus;
  goal: CategoryGoal | null;
  goalProgress: CategoryGoalProgress | null;
  isPaymentCategory: boolean;
  overspendKind: OverspendKind | null;
  cashOverspend: number;
  creditOverspend: number;
}

export interface MonthBudgetSummary {
  monthKey: string;
  totalIncome: number;
  totalSpent: number;
  totalAssigned: number;
  readyToAssign: number;
  availableToBudget: number;
}

function isInMonth(date: string, monthKey: string): boolean {
  return date.startsWith(monthKey);
}

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function isOnOrBeforeMonth(date: string, monthKey: string): boolean {
  return monthKeyOf(date) <= monthKey;
}

export function getTransactionsForMonth(
  transactions: BudgetTransaction[],
  monthKey: string,
): BudgetTransaction[] {
  return transactions.filter((tx) => isInMonth(tx.date, monthKey));
}

export function getTransactionsThroughMonth(
  transactions: BudgetTransaction[],
  monthKey: string,
): BudgetTransaction[] {
  return transactions.filter((tx) => isOnOrBeforeMonth(tx.date, monthKey));
}

function activityForCategory(
  tx: BudgetTransaction,
  categoryId: string,
  paymentAccountId?: string,
  accounts?: BudgetAccount[],
): number {
  if (paymentAccountId) {
    return getPaymentCategoryActivity(tx, paymentAccountId);
  }
  if (!isOnBudgetOutflow(tx, accounts)) return 0;
  return getOutflowActivityForCategory(tx, categoryId);
}

export function getCategoryActivity(
  transactions: BudgetTransaction[],
  categoryId: string,
  monthKey: string,
  paymentAccountId?: string,
  accounts?: BudgetAccount[],
): number {
  return getTransactionsForMonth(transactions, monthKey).reduce(
    (sum, tx) =>
      sum + activityForCategory(tx, categoryId, paymentAccountId, accounts),
    0,
  );
}

export function getCategoryActivityThroughMonth(
  transactions: BudgetTransaction[],
  categoryId: string,
  monthKey: string,
  paymentAccountId?: string,
  accounts?: BudgetAccount[],
): number {
  return getTransactionsThroughMonth(transactions, monthKey).reduce(
    (sum, tx) =>
      sum + activityForCategory(tx, categoryId, paymentAccountId, accounts),
    0,
  );
}

export function getMonthAssignments(
  budget: BudgetData,
  monthKey: string,
): Record<string, number> {
  return budget.monthBudgets[monthKey]?.assignments ?? {};
}

export function getCategoryAssigned(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): number {
  return getMonthAssignments(budget, monthKey)[categoryId] ?? 0;
}

export function getAssignedThroughMonth(
  budget: BudgetData,
  monthKey: string,
): number {
  let total = 0;
  for (const [key, monthBudget] of Object.entries(budget.monthBudgets)) {
    if (key <= monthKey) {
      total += Object.values(monthBudget.assignments).reduce(
        (sum, value) => sum + value,
        0,
      );
    }
  }
  return total;
}

export function getCategoryAssignedThroughMonth(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): number {
  let total = 0;
  for (const [key, monthBudget] of Object.entries(budget.monthBudgets)) {
    if (key <= monthKey) {
      total += monthBudget.assignments[categoryId] ?? 0;
    }
  }
  return total;
}

export function getIncomeThroughMonth(
  transactions: BudgetTransaction[],
  monthKey: string,
  accounts?: BudgetAccount[],
): number {
  return getTransactionsThroughMonth(transactions, monthKey).reduce(
    (sum, tx) => sum + getReadyToAssignEffect(tx, accounts),
    0,
  );
}

/**
 * Ready to Assign for `monthKey`.
 *
 *   RTA = inflows through this month − assignments through this month
 *         − uncovered cash overspend from closed months
 *
 * Credit overspend does not reduce Ready to Assign; it underfunds the card
 * payment category instead (YNAB cash vs credit rollover).
 */
export function getReadyToAssign(
  budget: BudgetData,
  monthKey: string,
): number {
  return (
    getIncomeThroughMonth(budget.transactions, monthKey, budget.accounts) -
    getAssignedThroughMonth(budget, monthKey) -
    getAbsorbedCashOverspend(budget, monthKey)
  );
}

/**
 * Category available for `monthKey`.
 *
 * Spending categories use the cash/credit overspend walk so closed-month cash
 * overspend is absorbed (Available returns to $0) instead of staying red.
 * Payment categories are assigned − card activity, then reduced by remaining
 * credit overspend on that card.
 */
export function getCategoryAvailable(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): number {
  const paymentAccountId = paymentAccountIdForCategory(
    budget.categories,
    categoryId,
  );
  if (paymentAccountId) {
    const raw =
      getCategoryAssignedThroughMonth(budget, categoryId, monthKey) -
      getCategoryActivityThroughMonth(
        budget.transactions,
        categoryId,
        monthKey,
        paymentAccountId,
        budget.accounts,
      );
    return raw - getCreditOverspendOnAccount(budget, paymentAccountId, monthKey);
  }
  return getCategoryOverspendState(budget, categoryId, monthKey).available;
}

export function getCategoryStatus(
  assigned: number,
  available: number,
  overspendKind: OverspendKind | null = null,
): CategoryBudgetStatus {
  if (overspendKind === "credit") return "credit-overspent";
  if (overspendKind === "cash" || available < 0) return "overspent";
  if (assigned > 0 && available / assigned < 0.25) return "low";
  return "healthy";
}

export function computeMonthSummary(
  budget: BudgetData,
  monthKey: string,
): MonthBudgetSummary {
  const monthTransactions = getTransactionsForMonth(budget.transactions, monthKey);
  const totalIncome = monthTransactions.reduce(
    (sum, tx) =>
      sum + Math.max(0, getReadyToAssignEffect(tx, budget.accounts)),
    0,
  );
  const totalSpent = monthTransactions
    .filter((tx) => isOnBudgetOutflow(tx, budget.accounts))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const assignments = getMonthAssignments(budget, monthKey);
  const totalAssigned = Object.values(assignments).reduce(
    (sum, value) => sum + value,
    0,
  );
  const readyToAssign = getReadyToAssign(budget, monthKey);

  return {
    monthKey,
    totalIncome,
    totalSpent,
    totalAssigned,
    readyToAssign,
    availableToBudget: readyToAssign,
  };
}

export function buildCategoryRows(
  budget: BudgetData,
  monthKey: string,
): Array<{ group: BudgetCategoryGroup; categories: CategoryBudgetRow[] }> {
  const sortedGroups = sortCategoryGroupsForBudget(budget.categoryGroups);

  return sortedGroups.map((group) => {
    const groupCategories = budget.categories
      .filter((category) => category.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => {
        const paymentAccountId = category.creditCardAccountId;
        const assigned = getCategoryAssigned(budget, category.id, monthKey);
        const activity = getCategoryActivity(
          budget.transactions,
          category.id,
          monthKey,
          paymentAccountId,
          budget.accounts,
        );
        const available = getCategoryAvailable(budget, category.id, monthKey);
        const overspendState = paymentAccountId
          ? null
          : getCategoryOverspendState(budget, category.id, monthKey);
        const creditUnderfund = paymentAccountId
          ? getCreditOverspendOnAccount(budget, paymentAccountId, monthKey)
          : 0;
        const cashOverspend = overspendState?.cashOverspend ?? 0;
        const creditOverspend = paymentAccountId
          ? creditUnderfund
          : (overspendState?.creditOverspend ?? 0);
        const overspendKind: OverspendKind | null = paymentAccountId
          ? available < 0
            ? creditUnderfund > 0
              ? "credit"
              : "cash"
            : null
          : getOverspendKind(
              overspendState ?? {
                available,
                cashOverspend,
                creditOverspend,
              },
            );
        const goal =
          budget.goals.find((entry) => entry.categoryId === category.id) ?? null;
        const priorMonth = shiftMonthKey(monthKey, -1);
        const goalProgress = goal
          ? computeGoalProgress(goal, monthKey, {
              assignedThisMonth: assigned,
              assignedBeforeMonth: getCategoryAssignedThroughMonth(
                budget,
                category.id,
                priorMonth,
              ),
              availableBeforeMonth: getCategoryAvailable(
                budget,
                category.id,
                priorMonth,
              ),
            })
          : null;

        return {
          category,
          assigned,
          activity,
          available,
          status: getCategoryStatus(assigned, available, overspendKind),
          goal,
          goalProgress,
          isPaymentCategory: Boolean(paymentAccountId),
          overspendKind,
          cashOverspend,
          creditOverspend,
        };
      });

    return { group, categories: groupCategories };
  });
}

export function getSortedTransactions(
  transactions: BudgetTransaction[],
): BudgetTransaction[] {
  return [...transactions].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.id.localeCompare(a.id);
  });
}

export function getCurrentMonthKey(): string {
  return getMonthKey(new Date());
}
