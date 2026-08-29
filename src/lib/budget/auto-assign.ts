import {
  buildCategoryRows,
  getReadyToAssign,
} from "@/lib/budget/calculations";
import { isMonthClosed } from "@/lib/budget/closed-months";
import { applyAssignmentDelta } from "@/lib/budget/move-money";
import type { BudgetData } from "@/types/budget";

export interface AutoAssignTarget {
  categoryId: string;
  needed: number;
}

export interface AutoAssignPreviewLine {
  categoryId: string;
  amount: number;
}

export interface AutoAssignPreview {
  assigned: number;
  leftover: number;
  lines: AutoAssignPreviewLine[];
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

export function previewAutoAssignUnderfunded(
  budget: BudgetData,
  monthKey: string,
): AutoAssignPreview {
  const targets = listUnderfundedAutoAssignTargets(budget, monthKey);
  let remaining = Math.max(0, getReadyToAssign(budget, monthKey));
  const lines: AutoAssignPreviewLine[] = [];

  for (const target of targets) {
    if (remaining <= 0) break;
    const give = Math.min(target.needed, remaining);
    if (give <= 0) continue;
    lines.push({ categoryId: target.categoryId, amount: give });
    remaining -= give;
  }

  return {
    assigned: lines.reduce((sum, line) => sum + line.amount, 0),
    leftover: remaining,
    lines,
  };
}

export function applyAutoAssignUnderfunded<T extends BudgetData>(
  budget: T,
  monthKey: string,
): T {
  if (isMonthClosed(budget, monthKey)) return budget;
  const preview = previewAutoAssignUnderfunded(budget, monthKey);
  let next = budget;

  for (const line of preview.lines) {
    next = applyAssignmentDelta(next, monthKey, line.categoryId, line.amount);
  }

  return next;
}
