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
import { getOutflowActivityForCategory } from "@/lib/budget/transactions";

export type CategoryBudgetStatus = "healthy" | "low" | "overspent";

export interface CategoryBudgetRow {
  category: BudgetCategory;
  assigned: number;
  activity: number;
  available: number;
  status: CategoryBudgetStatus;
  goal: CategoryGoal | null;
  goalProgress: CategoryGoalProgress | null;
  isPaymentCategory: boolean;
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
 * Cumulative form (no migration):
 *   RTA = inflows through this month − assignments through this month
 *
 * Equivalent leftover form:
 *   RTA = prior month RTA + this month income − this month assigned
 */
export function getReadyToAssign(
  budget: BudgetData,
  monthKey: string,
): number {
  return (
    getIncomeThroughMonth(budget.transactions, monthKey, budget.accounts) -
    getAssignedThroughMonth(budget, monthKey)
  );
}

/**
 * Category available for `monthKey`.
 *
 *   available = assigned through this month − activity through this month
 *
 * Equivalent leftover form:
 *   available = prior available + this month assigned − this month activity
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
  return (
    getCategoryAssignedThroughMonth(budget, categoryId, monthKey) -
    getCategoryActivityThroughMonth(
      budget.transactions,
      categoryId,
      monthKey,
      paymentAccountId,
      budget.accounts,
    )
  );
}

export function getCategoryStatus(
  assigned: number,
  available: number,
): CategoryBudgetStatus {
  if (available < 0) return "overspent";
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
          status: getCategoryStatus(assigned, available),
          goal,
          goalProgress,
          isPaymentCategory: Boolean(paymentAccountId),
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
