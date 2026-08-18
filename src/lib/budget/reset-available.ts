import { buildCategoryRows, getReadyToAssign } from "@/lib/budget/calculations";
import { isPaymentCategory } from "@/lib/budget/credit-card-payments";
import { applyCoverOverspend, applyMoveMoney } from "@/lib/budget/move-money";
import { READY_TO_ASSIGN_ID, type BudgetData } from "@/types/budget";

export interface ResetAvailableLine {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface ResetAvailablePreview {
  leftover: number;
  covered: number;
  leftoverLines: ResetAvailableLine[];
  coverLines: ResetAvailableLine[];
}

export interface ResetAvailableOptions {
  /** After sweeping leftover to RTA, cover overspent spending categories from RTA. */
  coverOverspend?: boolean;
}

function spendingRows(budget: BudgetData, monthKey: string) {
  return buildCategoryRows(budget, monthKey)
    .flatMap((entry) => entry.categories)
    .filter((row) => !row.isPaymentCategory && !isPaymentCategory(row.category));
}

/**
 * Preview Reset Available (YNAB “Reset Available Amounts”).
 *
 * Positive leftover Available moves back to Ready to Assign. Payment
 * categories are skipped. Overspent / negative rows stay unless Cover is on.
 */
export function previewResetAvailable(
  budget: BudgetData,
  monthKey: string,
  options: ResetAvailableOptions = {},
): ResetAvailablePreview {
  const leftoverLines: ResetAvailableLine[] = [];
  for (const row of spendingRows(budget, monthKey)) {
    if (row.available > 0) {
      leftoverLines.push({
        categoryId: row.category.id,
        categoryName: row.category.name,
        amount: row.available,
      });
    }
  }

  let afterLeftover: BudgetData = budget;
  for (const line of leftoverLines) {
    afterLeftover = applyMoveMoney(
      afterLeftover,
      monthKey,
      line.categoryId,
      READY_TO_ASSIGN_ID,
      line.amount,
    );
  }

  const coverLines: ResetAvailableLine[] = [];
  if (options.coverOverspend) {
    let remainingRta = Math.max(0, getReadyToAssign(afterLeftover, monthKey));
    for (const row of spendingRows(afterLeftover, monthKey)) {
      if (remainingRta <= 0) break;
      if (row.available >= 0) continue;
      const needed = Math.min(-row.available, remainingRta);
      if (needed <= 0) continue;
      coverLines.push({
        categoryId: row.category.id,
        categoryName: row.category.name,
        amount: needed,
      });
      remainingRta -= needed;
    }
  }

  return {
    leftover: leftoverLines.reduce((sum, line) => sum + line.amount, 0),
    covered: coverLines.reduce((sum, line) => sum + line.amount, 0),
    leftoverLines,
    coverLines,
  };
}

export function applyResetAvailable<T extends BudgetData>(
  budget: T,
  monthKey: string,
  options: ResetAvailableOptions = {},
): T {
  const preview = previewResetAvailable(budget, monthKey, options);
  let next: T = budget;

  for (const line of preview.leftoverLines) {
    next = applyMoveMoney(
      next,
      monthKey,
      line.categoryId,
      READY_TO_ASSIGN_ID,
      line.amount,
    );
  }

  if (options.coverOverspend) {
    for (const line of preview.coverLines) {
      next = applyCoverOverspend(
        next,
        monthKey,
        line.categoryId,
        { type: "rta" },
        line.amount,
      );
    }
  }

  return next;
}
