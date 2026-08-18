import { getCategoryAvailable, getReadyToAssign } from "@/lib/budget/calculations";
import { READY_TO_ASSIGN_ID, type BudgetData } from "@/types/budget";

export { READY_TO_ASSIGN_ID };

export function isReadyToAssignDestination(destinationId: string): boolean {
  return destinationId === READY_TO_ASSIGN_ID;
}

function withAssignmentDelta<T extends BudgetData>(
  budget: T,
  monthKey: string,
  categoryId: string,
  delta: number,
): T {
  if (delta === 0) return budget;
  const monthBudget = budget.monthBudgets[monthKey] ?? { assignments: {} };
  const current = monthBudget.assignments[categoryId] ?? 0;
  return {
    ...budget,
    monthBudgets: {
      ...budget.monthBudgets,
      [monthKey]: {
        assignments: {
          ...monthBudget.assignments,
          [categoryId]: current + delta,
        },
      },
    },
  };
}

/**
 * Move leftover Available (not only this-month Assigned) to another category
 * or back to Ready to Assign. This-month assignment may go negative so prior
 * leftover can leave the category.
 */
export function applyMoveMoney<T extends BudgetData>(
  budget: T,
  monthKey: string,
  fromCategoryId: string,
  toCategoryId: string,
  amount: number,
): T {
  const transfer = Math.max(0, amount);
  if (transfer === 0) return budget;
  if (fromCategoryId === toCategoryId) return budget;

  const available = Math.max(0, getCategoryAvailable(budget, fromCategoryId, monthKey));
  const moved = Math.min(transfer, available);
  if (moved === 0) return budget;

  let next = withAssignmentDelta(budget, monthKey, fromCategoryId, -moved);
  if (!isReadyToAssignDestination(toCategoryId)) {
    next = withAssignmentDelta(next, monthKey, toCategoryId, moved);
  }
  return next;
}

export function applyCoverOverspend<T extends BudgetData>(
  budget: T,
  monthKey: string,
  categoryId: string,
  source:
    | { type: "rta" }
    | { type: "category"; categoryId: string },
  amount: number,
): T {
  const available = getCategoryAvailable(budget, categoryId, monthKey);
  const overspend = Math.max(0, -available);
  const requested = Math.min(Math.max(0, amount), overspend);
  if (requested === 0) return budget;

  if (source.type === "rta") {
    const rta = Math.max(0, getReadyToAssign(budget, monthKey));
    const used = Math.min(requested, rta);
    return withAssignmentDelta(budget, monthKey, categoryId, used);
  }

  if (source.categoryId === categoryId) return budget;
  return applyMoveMoney(budget, monthKey, source.categoryId, categoryId, requested);
}

export function applyAssignmentDelta<T extends BudgetData>(
  budget: T,
  monthKey: string,
  categoryId: string,
  delta: number,
): T {
  return withAssignmentDelta(budget, monthKey, categoryId, delta);
}
