import type {
  BudgetAccount,
  BudgetCategory,
  BudgetTransaction,
} from "@/types/budget";
import {
  accountById,
  isCreditCardPaymentAccount,
  isLiabilityAccount,
  isOnBudgetAccount,
} from "@/lib/budget/accounts";

/**
 * On-budget account sending money to an off-budget liability
 * (mortgage, auto loan, line of credit, or other credit-like debt).
 * A transfer to an off-budget investment or asset account does not qualify.
 */
export function transferLeavesBudget(
  from: Pick<BudgetAccount, "onBudget"> | undefined,
  to: Pick<BudgetAccount, "onBudget" | "type"> | undefined,
): boolean {
  return Boolean(
    from &&
      to &&
      isOnBudgetAccount(from) &&
      !isOnBudgetAccount(to) &&
      isLiabilityAccount(to.type),
  );
}

/**
 * An envelope is required only when the transfer is new, or the amount or
 * accounts change. A memo or date edit of an older uncategorized row can save.
 */
export function envelopeRequiredForTransfer(input: {
  needsCategory: boolean;
  isNew: boolean;
  amountChanged: boolean;
  accountsChanged: boolean;
}): boolean {
  return (
    input.needsCategory &&
    (input.isNew || input.amountChanged || input.accountsChanged)
  );
}

/**
 * Category kept on a transfer that leaves the budget for a liability.
 * On-budget to on-budget transfers, transfers to off-budget assets, and
 * transfers that stay off-budget have none.
 * Payment envelopes are not a valid category for this transfer.
 */
export function keptOffBudgetTransferCategory(
  categoryId: string | null | undefined,
  from: Pick<BudgetAccount, "onBudget"> | undefined,
  to: Pick<BudgetAccount, "onBudget" | "type"> | undefined,
  categories?: BudgetCategory[],
): string | null {
  if (!transferLeavesBudget(from, to)) return null;
  if (typeof categoryId !== "string" || categoryId.length === 0) return null;
  if (categories) {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category || category.creditCardAccountId) return null;
  }
  return categoryId;
}

export function countsAsBudgetSpending(
  tx: Pick<
    BudgetTransaction,
    "type" | "accountId" | "transferAccountId" | "categoryId"
  >,
  accounts: BudgetAccount[] | undefined,
): boolean {
  if (isOnBudgetOutflow(tx, accounts)) return true;
  if (tx.type !== "transfer") return false;
  return (
    keptOffBudgetTransferCategory(
      tx.categoryId,
      accountById(accounts, tx.accountId),
      accountById(accounts, tx.transferAccountId),
    ) != null
  );
}

/**
 * Ready to Assign delta for one transaction.
 *
 * On-budget inflows increase Ready to Assign, unless they are categorized back
 * to an envelope (refund / reimbursement) or they are an uncategorized
 * credit-card inflow (released only up to what the payment envelope already holds).
 * Tracking inflows/outflows do not.
 * Transfers between two on-budget cash accounts are 0.
 * A transfer from a card to on-budget cash is a cash advance (+).
 * A categorized transfer to an off-budget liability spends an envelope, so
 * Ready to Assign stays put. An uncategorized one, and any transfer to an
 * off-budget asset, still leaves Ready to Assign (−).
 * Tracking → on-budget enters (+).
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
  if (fromOnBudget && !toOnBudget) {
    if (keptOffBudgetTransferCategory(tx.categoryId, from, to)) return 0;
    return -tx.amount;
  }
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
