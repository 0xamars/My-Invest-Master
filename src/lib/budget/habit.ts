import {
  buildCategoryRows,
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { isTransactionApproved } from "@/lib/budget/reports";
import type { BudgetPlan } from "@/types/budget";

export interface BudgetHabitOverspend {
  categoryId: string;
  name: string;
  amount: number;
  kind: "cash" | "credit";
}

export interface BudgetHabitSnapshot {
  inboxCount: number;
  overspent: BudgetHabitOverspend[];
  readyToAssign: number;
  lastImportedDate: string | null;
  needsAttention: boolean;
}

/** Latest transaction date among rows that carry an importId. */
export function lastImportedTransactionDate(
  plan: Pick<BudgetPlan, "transactions">,
): string | null {
  let latest: string | null = null;
  for (const tx of plan.transactions) {
    if (!tx.importId) continue;
    if (!latest || tx.date > latest) latest = tx.date;
  }
  return latest;
}

export function budgetHabitSnapshot(
  plan: BudgetPlan,
  monthKey: string = getCurrentMonthKey(),
): BudgetHabitSnapshot {
  const summary = computeMonthSummary(plan, monthKey);
  const rows = buildCategoryRows(plan, monthKey);
  const inboxCount = plan.transactions.filter(
    (tx) => !isTransactionApproved(tx),
  ).length;
  const overspent: BudgetHabitOverspend[] = [];

  for (const group of rows) {
    for (const row of group.categories) {
      if (row.status !== "overspent" && row.status !== "credit-overspent") {
        continue;
      }
      const amount =
        row.overspendKind === "credit"
          ? row.creditOverspend
          : Math.max(row.cashOverspend, Math.max(0, -row.available));
      if (!(amount > 0)) continue;
      overspent.push({
        categoryId: row.category.id,
        name: row.category.name,
        amount,
        kind: row.overspendKind === "credit" ? "credit" : "cash",
      });
    }
  }

  return {
    inboxCount,
    overspent,
    readyToAssign: summary.readyToAssign,
    lastImportedDate: lastImportedTransactionDate(plan),
    needsAttention: inboxCount > 0 || overspent.length > 0,
  };
}
