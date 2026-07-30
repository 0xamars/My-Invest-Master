import {
  getMonthKey,
  type BudgetCategory,
  type BudgetCategoryGroup,
  type BudgetData,
  type BudgetTransaction,
  type CategoryGoal,
} from "@/types/budget";

export type CategoryBudgetStatus = "healthy" | "low" | "overspent";

export interface CategoryBudgetRow {
  category: BudgetCategory;
  assigned: number;
  activity: number;
  available: number;
  status: CategoryBudgetStatus;
  goal: CategoryGoal | null;
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

export function getTransactionsForMonth(
  transactions: BudgetTransaction[],
  monthKey: string,
): BudgetTransaction[] {
  return transactions.filter((tx) => isInMonth(tx.date, monthKey));
}

export function getCategoryActivity(
  transactions: BudgetTransaction[],
  categoryId: string,
  monthKey: string,
): number {
  return getTransactionsForMonth(transactions, monthKey)
    .filter((tx) => tx.type === "outflow" && tx.categoryId === categoryId)
    .reduce((sum, tx) => sum + tx.amount, 0);
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

export function getCategoryAvailable(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): number {
  const assigned = getCategoryAssigned(budget, categoryId, monthKey);
  const activity = getCategoryActivity(budget.transactions, categoryId, monthKey);
  return assigned - activity;
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
  const totalIncome = monthTransactions
    .filter((tx) => tx.type === "inflow")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalSpent = monthTransactions
    .filter((tx) => tx.type === "outflow")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const assignments = getMonthAssignments(budget, monthKey);
  const totalAssigned = Object.values(assignments).reduce(
    (sum, value) => sum + value,
    0,
  );
  const readyToAssign = totalIncome - totalAssigned;

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
  const sortedGroups = [...budget.categoryGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return sortedGroups.map((group) => {
    const groupCategories = budget.categories
      .filter((category) => category.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => {
        const assigned = getCategoryAssigned(budget, category.id, monthKey);
        const activity = getCategoryActivity(
          budget.transactions,
          category.id,
          monthKey,
        );
        const available = assigned - activity;
        const goal =
          budget.goals.find((entry) => entry.categoryId === category.id) ?? null;

        return {
          category,
          assigned,
          activity,
          available,
          status: getCategoryStatus(assigned, available),
          goal,
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
