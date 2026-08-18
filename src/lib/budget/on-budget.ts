import type { BudgetAccount, BudgetTransaction } from "@/types/budget";
import { accountById, isOnBudgetAccount } from "@/lib/budget/accounts";

/**
 * Ready to Assign delta for one transaction.
 *
 * On-budget inflows increase RTA. Tracking inflows/outflows do not.
 * Transfers between two on-budget (or two tracking) accounts are 0.
 * On-budget → tracking leaves the budget (−). Tracking → on-budget enters (+).
 */
export function getReadyToAssignEffect(
  tx: Pick<BudgetTransaction, "type" | "amount" | "accountId" | "transferAccountId">,
  accounts: BudgetAccount[] | undefined,
): number {
  const fromOnBudget = isOnBudgetAccount(accountById(accounts, tx.accountId));

  if (tx.type === "inflow") {
    return fromOnBudget ? tx.amount : 0;
  }

  if (tx.type === "outflow") {
    return 0;
  }

  if (tx.type !== "transfer" || !tx.transferAccountId) {
    return 0;
  }

  const toOnBudget = isOnBudgetAccount(accountById(accounts, tx.transferAccountId));
  if (fromOnBudget && !toOnBudget) return -tx.amount;
  if (!fromOnBudget && toOnBudget) return tx.amount;
  return 0;
}

export function isOnBudgetOutflow(
  tx: Pick<BudgetTransaction, "type" | "accountId">,
  accounts: BudgetAccount[] | undefined,
): boolean {
  return (
    tx.type === "outflow" &&
    isOnBudgetAccount(accountById(accounts, tx.accountId))
  );
}
