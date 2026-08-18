import type { BudgetData } from "@/types/budget";

function clearCategoryOnSplits<T extends { categoryId: string | null }>(
  splits: T[] | undefined,
  categoryId: string,
): T[] | undefined {
  return splits?.map((line) =>
    line.categoryId === categoryId ? { ...line, categoryId: null } : line,
  );
}

/** Remove a category and clean up assignments, goals, and transaction links. */
export function removeCategoryFromBudget(
  budget: BudgetData,
  categoryId: string,
): BudgetData {
  const monthBudgets = Object.fromEntries(
    Object.entries(budget.monthBudgets).map(([monthKey, monthBudget]) => {
      const { [categoryId]: _removed, ...assignments } = monthBudget.assignments;
      return [monthKey, { assignments }];
    }),
  );

  return {
    ...budget,
    categories: budget.categories.filter((category) => category.id !== categoryId),
    goals: budget.goals.filter((goal) => goal.categoryId !== categoryId),
    transactions: budget.transactions.map((tx) => ({
      ...tx,
      categoryId: tx.categoryId === categoryId ? null : tx.categoryId,
      splits: clearCategoryOnSplits(tx.splits, categoryId),
    })),
    scheduledTransactions: budget.scheduledTransactions?.map((schedule) => ({
      ...schedule,
      categoryId: schedule.categoryId === categoryId ? null : schedule.categoryId,
      splits: clearCategoryOnSplits(schedule.splits, categoryId),
    })),
    monthBudgets,
  };
}

export function sortedCategoryGroups(budget: BudgetData) {
  return [...budget.categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder);
}
