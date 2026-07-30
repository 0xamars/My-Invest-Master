import { createDefaultAccount, type BudgetPlan, type BudgetTransaction } from "@/types/budget";

type LegacyTransaction = BudgetTransaction & {
  accountId?: string;
  cleared?: boolean;
};

type LegacyPlan = BudgetPlan & {
  accounts?: BudgetPlan["accounts"];
};

/** Ensure accounts exist and all transactions are linked with cleared status. */
export function normalizeBudgetPlan(plan: BudgetPlan): BudgetPlan {
  const legacy = plan as LegacyPlan;
  const defaultAccount = createDefaultAccount();
  const accounts =
    legacy.accounts && legacy.accounts.length > 0
      ? legacy.accounts
      : [defaultAccount];
  const fallbackAccountId = accounts[0]?.id ?? defaultAccount.id;

  const transactions = plan.transactions.map((tx) => {
    const legacyTx = tx as LegacyTransaction;
    return {
      ...tx,
      accountId: legacyTx.accountId ?? fallbackAccountId,
      cleared: legacyTx.cleared ?? false,
    };
  });

  return {
    ...plan,
    accounts,
    transactions,
  };
}

export function normalizeBudgetPlans(plans: BudgetPlan[]): BudgetPlan[] {
  return plans.map(normalizeBudgetPlan);
}
