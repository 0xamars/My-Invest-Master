import type { BudgetAccount, BudgetTransaction } from "@/types/budget";
import {
  accountById,
  isCreditCardPaymentAccount,
  isOnBudgetAccount,
} from "@/lib/budget/accounts";

/**
 * Ready to Assign delta for one transaction.
 *
 * On-budget inflows increase RTA, unless they are categorized back to an
 * envelope (refund / reimbursement) or they are an uncategorized credit-card
 * inflow (released only up to what the payment envelope already holds).
 * Tracking inflows/outflows do not.
 * Transfers between two on-budget cash accounts are 0.
 * A transfer from a card to on-budget cash is a cash advance (+).
 * On-budget → tracking leaves the budget (−). Tracking → on-budget enters (+).
 */
export function getReadyToAssignEffect(
  tx: Pick<
    BudgetTransaction,
    "type" | "amount" | "accountId" | "transferAccountId" | "categoryId"
  >,
  accounts: BudgetAccount[] | undefined,
): number {
  const from = accountById(accounts, tx.accountId);
  const fromOnBudget = isOnBudgetAccount(from);

  if (tx.type === "inflow") {
    if (!fromOnBudget) return 0;
    if (tx.categoryId) return 0;
    if (from && isCreditCardPaymentAccount(from)) return 0;
    return tx.amount;
  }

  if (tx.type === "outflow") {
    return 0;
  }

  if (tx.type !== "transfer" || !tx.transferAccountId) {
    return 0;
  }

  const to = accountById(accounts, tx.transferAccountId);
  if (
    from &&
    isCreditCardPaymentAccount(from) &&
    to &&
    isOnBudgetAccount(to) &&
    !isCreditCardPaymentAccount(to)
  ) {
    return tx.amount;
  }

  const toOnBudget = isOnBudgetAccount(to);
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
