import {
  buildCategoryRows,
  getReadyToAssign,
} from "@/lib/budget/calculations";
import { applyAssignmentDelta } from "@/lib/budget/move-money";
import type { BudgetData } from "@/types/budget";

export interface AutoAssignTarget {
  categoryId: string;
  needed: number;
}

/**
 * Underfunded amounts in budget-row order (Credit Card Payments group first,
 * then group/category sortOrder). Payment categories without a goal are
 * included when Available is negative — that is the unfunded card payment.
 */
export function listUnderfundedAutoAssignTargets(
  budget: BudgetData,
  monthKey: string,
): AutoAssignTarget[] {
  const targets: AutoAssignTarget[] = [];

  for (const { categories } of buildCategoryRows(budget, monthKey)) {
    for (const row of categories) {
      if (row.goal && row.goalProgress && row.goalProgress.status === "underfunded") {
        const needed = Math.max(
          0,
          row.goalProgress.neededThisMonth - row.assigned,
        );
        if (needed > 0) {
          targets.push({ categoryId: row.category.id, needed });
        }
        continue;
      }

      if (row.isPaymentCategory && row.available < 0) {
        targets.push({
          categoryId: row.category.id,
          needed: -row.available,
        });
      }
    }
  }

  return targets;
}

export function applyAutoAssignUnderfunded<T extends BudgetData>(
  budget: T,
  monthKey: string,
): T {
  const targets = listUnderfundedAutoAssignTargets(budget, monthKey);
  let remaining = Math.max(0, getReadyToAssign(budget, monthKey));
  let next = budget;

  for (const target of targets) {
    if (remaining <= 0) break;
    const give = Math.min(target.needed, remaining);
    if (give <= 0) continue;
    next = applyAssignmentDelta(next, monthKey, target.categoryId, give);
    remaining -= give;
  }

  return next;
}
