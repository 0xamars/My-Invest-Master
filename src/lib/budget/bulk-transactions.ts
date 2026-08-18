import { isReconciledState } from "@/lib/budget/cleared";
import { isSplitTransaction, isTransferTransaction } from "@/lib/budget/transactions";
import type { BudgetClearedState, BudgetData, BudgetTransaction } from "@/types/budget";

function selectedIds(ids: Iterable<string>): Set<string> {
  return new Set([...ids].filter(Boolean));
}

function mapSelected<T extends BudgetData>(
  budget: T,
  ids: Iterable<string>,
  update: (tx: BudgetTransaction) => BudgetTransaction,
): T {
  const selected = selectedIds(ids);
  if (selected.size === 0) return budget;

  let changed = false;
  const transactions = budget.transactions.map((tx) => {
    if (!selected.has(tx.id)) return tx;
    const next = update(tx);
    if (next !== tx) changed = true;
    return next;
  });

  if (!changed) return budget;
  return { ...budget, transactions };
}

/** Set category on selected non-split outflows. Inflows, transfers, and splits are skipped. */
export function applyBulkCategorize<T extends BudgetData>(
  budget: T,
  ids: Iterable<string>,
  categoryId: string | null,
): T {
  return mapSelected(budget, ids, (tx) => {
    if (tx.type !== "outflow") return tx;
    if (isTransferTransaction(tx) || isSplitTransaction(tx)) return tx;
    if (tx.categoryId === categoryId) return tx;
    return { ...tx, categoryId };
  });
}

export function applyBulkApprove<T extends BudgetData>(
  budget: T,
  ids: Iterable<string>,
  approved = true,
): T {
  return mapSelected(budget, ids, (tx) => {
    if (tx.approved === approved) return tx;
    return { ...tx, approved };
  });
}

export function applyBulkDelete<T extends BudgetData>(
  budget: T,
  ids: Iterable<string>,
): T {
  const selected = selectedIds(ids);
  if (selected.size === 0) return budget;
  const transactions = budget.transactions.filter((tx) => !selected.has(tx.id));
  if (transactions.length === budget.transactions.length) return budget;
  return { ...budget, transactions };
}

/**
 * Toggle cleared on selected rows that are not reconciled.
 * If any toggleable row is uncleared, all become cleared; otherwise they become uncleared.
 */
export function applyBulkToggleCleared<T extends BudgetData>(
  budget: T,
  ids: Iterable<string>,
): T {
  const selected = selectedIds(ids);
  const toggleable = budget.transactions.filter(
    (tx) => selected.has(tx.id) && !isReconciledState(tx.cleared),
  );
  if (toggleable.length === 0) return budget;

  const nextCleared: BudgetClearedState = toggleable.some(
    (tx) => tx.cleared === "uncleared",
  )
    ? "cleared"
    : "uncleared";

  return mapSelected(budget, ids, (tx) => {
    if (isReconciledState(tx.cleared) || tx.cleared === nextCleared) return tx;
    return { ...tx, cleared: nextCleared };
  });
}

export function canBulkCategorize(
  tx: Pick<BudgetTransaction, "type" | "splits">,
): boolean {
  return tx.type === "outflow" && !isSplitTransaction(tx);
}
