import type { BudgetData } from "@/types/budget";

/** True when the plan opted into explicit month close (`closedThrough` is present). */
export function usesExplicitMonthClose(
  budget: Pick<BudgetData, "closedThrough">,
): boolean {
  return Object.hasOwn(budget, "closedThrough");
}

/**
 * Last closed month.
 * `undefined` = legacy implicit close.
 * `null` = explicit close, nothing closed yet.
 */
export function getClosedThrough(
  budget: Pick<BudgetData, "closedThrough">,
): string | null | undefined {
  if (!usesExplicitMonthClose(budget)) return undefined;
  return typeof budget.closedThrough === "string" ? budget.closedThrough : null;
}

export function isMonthClosed(budget: BudgetData, monthKey: string): boolean {
  if (budget.monthBudgets[monthKey]?.closedAt) return true;
  const through = getClosedThrough(budget);
  return typeof through === "string" && monthKey <= through;
}

/**
 * Cash overspend is absorbed only for months that are actually closed.
 * Legacy plans (no `closedThrough`) keep the old rule: any month before the
 * viewed month is treated as closed.
 */
export function shouldAbsorbCashOverspend(
  budget: BudgetData,
  cursor: string,
  viewedMonth: string,
): boolean {
  if (cursor >= viewedMonth) return false;
  const through = getClosedThrough(budget);
  if (through === undefined) return true;
  return through !== null && cursor <= through;
}
