import type { BudgetData } from "@/types/budget";

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
    transactions: budget.transactions.map((tx) =>
      tx.categoryId === categoryId ? { ...tx, categoryId: null } : tx,
    ),
    monthBudgets,
  };
}

export function sortedCategoryGroups(budget: BudgetData) {
  return [...budget.categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder);
}
