import type { BudgetAccount, BudgetPlan } from "@/types/budget";

/** Remove an account and optionally move or delete its transactions. */
export function removeAccountFromBudget(
  plan: BudgetPlan,
  accountId: string,
  strategy: { type: "move"; targetAccountId: string } | { type: "delete-transactions" },
): BudgetPlan {
  let nextTransactions = plan.transactions;

  if (strategy.type === "move") {
    nextTransactions = plan.transactions.map((tx) =>
      tx.accountId === accountId
        ? { ...tx, accountId: strategy.targetAccountId }
        : tx,
    );
  } else {
    nextTransactions = plan.transactions.filter(
      (tx) => tx.accountId !== accountId,
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
