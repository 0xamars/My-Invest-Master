import { ensureCreditCardPaymentCategories } from "@/lib/budget/credit-card-payments";
import type { BudgetAccount, BudgetPlan } from "@/types/budget";

/** Remove an account and optionally move or delete its transactions. */
export function removeAccountFromBudget(
  plan: BudgetPlan,
  accountId: string,
  strategy: { type: "move"; targetAccountId: string } | { type: "delete-transactions" },
): BudgetPlan {
  let nextTransactions = plan.transactions;
  let nextSchedules = plan.scheduledTransactions ?? [];

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
    nextSchedules = nextSchedules
      .map((schedule) => {
        const nextAccountId =
          schedule.accountId === accountId
            ? strategy.targetAccountId
            : schedule.accountId;
        const nextTransferAccountId =
          schedule.transferAccountId === accountId
            ? strategy.targetAccountId
            : schedule.transferAccountId;
        return {
          ...schedule,
          accountId: nextAccountId,
          transferAccountId: nextTransferAccountId,
        };
      })
      .filter((schedule) => {
        if (schedule.type !== "transfer") return true;
        return (
          Boolean(schedule.transferAccountId) &&
          schedule.accountId !== schedule.transferAccountId
        );
      });
  } else {
    nextTransactions = plan.transactions.filter(
      (tx) => tx.accountId !== accountId && tx.transferAccountId !== accountId,
    );
    nextSchedules = nextSchedules.filter(
      (schedule) =>
        schedule.accountId !== accountId &&
        schedule.transferAccountId !== accountId,
    );
  }

  return ensureCreditCardPaymentCategories({
    ...plan,
    accounts: plan.accounts.filter((account) => account.id !== accountId),
    transactions: nextTransactions,
    scheduledTransactions: nextSchedules,
  });
}

export function sortedAccountsFromPlan(plan: BudgetPlan): BudgetAccount[] {
  return [...plan.accounts].sort((a, b) => a.sortOrder - b.sortOrder);
}
