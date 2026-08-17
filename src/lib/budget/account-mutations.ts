import type { BudgetAccount, BudgetPlan } from "@/types/budget";

/** Remove an account and optionally move or delete its transactions. */
export function removeAccountFromBudget(
  plan: BudgetPlan,
  accountId: string,
  strategy: { type: "move"; targetAccountId: string } | { type: "delete-transactions" },
): BudgetPlan {
  let nextTransactions = plan.transactions;

  if (strategy.type === "move") {
    nextTransactions = plan.transactions
      .map((tx) => {
        const nextAccountId =
          tx.accountId === accountId ? strategy.targetAccountId : tx.accountId;
        const nextTransferAccountId =
          tx.transferAccountId === accountId
            ? strategy.targetAccountId
            : tx.transferAccountId;
        return {
          ...tx,
          accountId: nextAccountId,
          transferAccountId: nextTransferAccountId,
        };
      })
      .filter((tx) => {
        if (tx.type !== "transfer") return true;
        return Boolean(tx.transferAccountId) && tx.accountId !== tx.transferAccountId;
      });
  } else {
    nextTransactions = plan.transactions.filter(
      (tx) => tx.accountId !== accountId && tx.transferAccountId !== accountId,
    );
  }

  return {
    ...plan,
    accounts: plan.accounts.filter((account) => account.id !== accountId),
    transactions: nextTransactions,
  };
}

export function sortedAccountsFromPlan(plan: BudgetPlan): BudgetAccount[] {
  return [...plan.accounts].sort((a, b) => a.sortOrder - b.sortOrder);
}
