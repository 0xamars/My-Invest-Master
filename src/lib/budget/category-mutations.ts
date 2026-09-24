import type { BudgetData } from "@/types/budget";

function isPinnedPaymentGroup(group: { kind?: string }): boolean {
  return group.kind === "credit-card-payments";
}

function isPinnedPaymentCategory(category: { creditCardAccountId?: string }): boolean {
  return Boolean(category.creditCardAccountId);
}

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
      const opening = monthBudget.opening
        ? {
            ...monthBudget.opening,
            envelopes: Object.fromEntries(
              Object.entries(monthBudget.opening.envelopes).filter(
                ([id]) => id !== categoryId,
              ),
            ),
          }
        : undefined;
      return [
        monthKey,
        {
          ...monthBudget,
          assignments,
          opening,
        },
      ];
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

/** Reorder user groups. The credit-card payment group stays pinned first. */
export function moveCategoryGroupInBudget<T extends BudgetData>(
  budget: T,
  groupId: string,
  direction: "up" | "down",
): T {
  const group = budget.categoryGroups.find((entry) => entry.id === groupId);
  if (!group || isPinnedPaymentGroup(group)) return budget;

  const userGroups = [...budget.categoryGroups]
    .filter((entry) => !isPinnedPaymentGroup(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const index = userGroups.findIndex((entry) => entry.id === groupId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= userGroups.length) return budget;

  const reordered = [...userGroups];
  [reordered[index], reordered[swapIndex]] = [
    reordered[swapIndex],
    reordered[index],
  ];
  const order = new Map(reordered.map((entry, sortOrder) => [entry.id, sortOrder]));

  return {
    ...budget,
    categoryGroups: budget.categoryGroups.map((entry) =>
      order.has(entry.id) ? { ...entry, sortOrder: order.get(entry.id)! } : entry,
    ),
  };
}

/** Reorder envelopes inside one group. Payment envelopes follow their accounts. */
export function moveCategoryInBudget<T extends BudgetData>(
  budget: T,
  categoryId: string,
  direction: "up" | "down",
): T {
  const category = budget.categories.find((entry) => entry.id === categoryId);
  if (!category || isPinnedPaymentCategory(category)) return budget;

  const siblings = budget.categories
    .filter(
      (entry) =>
        entry.groupId === category.groupId && !isPinnedPaymentCategory(entry),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const index = siblings.findIndex((entry) => entry.id === categoryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return budget;

  const reordered = [...siblings];
  [reordered[index], reordered[swapIndex]] = [
    reordered[swapIndex],
    reordered[index],
  ];
  const order = new Map(reordered.map((entry, sortOrder) => [entry.id, sortOrder]));

  return {
    ...budget,
    categories: budget.categories.map((entry) =>
      order.has(entry.id) ? { ...entry, sortOrder: order.get(entry.id)! } : entry,
    ),
  };
}
