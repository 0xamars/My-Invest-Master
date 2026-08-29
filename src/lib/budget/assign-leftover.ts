import { getReadyToAssign } from "@/lib/budget/calculations";
import { isMonthClosed } from "@/lib/budget/closed-months";
import { isPaymentCategory } from "@/lib/budget/credit-card-payments";
import { applyAssignmentDelta } from "@/lib/budget/move-money";
import type { BudgetData } from "@/types/budget";

export interface LeftoverAllocation {
  categoryId: string;
  amount: number;
}

/**
 * Put leftover (unassigned money) into envelopes for `monthKey`.
 * Amounts are added to this-month Assigned. Extra beyond leftover is ignored.
 */
export function applyAssignLeftover<T extends BudgetData>(
  budget: T,
  monthKey: string,
  allocations: LeftoverAllocation[],
): T {
  if (isMonthClosed(budget, monthKey)) return budget;

  const paymentIds = new Set(
    budget.categories
      .filter((category) => isPaymentCategory(category))
      .map((category) => category.id),
  );

  let remaining = Math.max(0, getReadyToAssign(budget, monthKey));
  let next = budget;

  for (const line of allocations) {
    if (remaining <= 0) break;
    if (!line.categoryId || paymentIds.has(line.categoryId)) continue;
    const amount = Math.min(remaining, Math.max(0, line.amount));
    if (amount <= 0) continue;
    next = applyAssignmentDelta(next, monthKey, line.categoryId, amount);
    remaining -= amount;
  }

  return next;
}
