import {
  createDefaultAccount,
  type BudgetPlan,
  type BudgetTransaction,
  type BudgetTransactionSplit,
  type BudgetTransactionType,
} from "@/types/budget";

type LegacySplit = Partial<BudgetTransactionSplit> & {
  amount?: number;
  categoryId?: string | null;
};

type LegacyTransaction = BudgetTransaction & {
  accountId?: string;
  cleared?: boolean;
  transferAccountId?: string;
  splits?: LegacySplit[];
  type?: string;
};

type LegacyPlan = BudgetPlan & {
  accounts?: BudgetPlan["accounts"];
};

function normalizeTransactionType(type: string | undefined): BudgetTransactionType {
  if (type === "transfer" || type === "inflow" || type === "outflow") {
    return type;
  }
  return "outflow";
}

function normalizeSplits(
  txId: string,
  splits: LegacySplit[] | undefined,
): BudgetTransactionSplit[] | undefined {
  if (!Array.isArray(splits) || splits.length === 0) return undefined;

  const normalized = splits
    .filter((line) => line && typeof line.amount === "number" && Number.isFinite(line.amount))
    .map((line, index) => ({
      id:
        typeof line.id === "string" && line.id.length > 0
          ? line.id
          : `${txId}-split-${index}`,
      categoryId: line.categoryId ?? null,
      amount: Math.abs(line.amount ?? 0),
      memo: typeof line.memo === "string" && line.memo.trim() ? line.memo.trim() : undefined,
    }));

  return normalized.length > 0 ? normalized : undefined;
}

/** Ensure accounts exist and all transactions are linked with cleared status. */
export function normalizeBudgetPlan(plan: BudgetPlan): BudgetPlan {
  const legacy = plan as LegacyPlan;
  const defaultAccount = createDefaultAccount();
  const accounts =
    legacy.accounts && legacy.accounts.length > 0
      ? legacy.accounts
      : [defaultAccount];
  const fallbackAccountId = accounts[0]?.id ?? defaultAccount.id;
  const accountIds = new Set(accounts.map((account) => account.id));

  const transactions = plan.transactions.map((tx) => {
    const legacyTx = tx as LegacyTransaction;
    const type = normalizeTransactionType(legacyTx.type);
    const transferAccountId =
      type === "transfer" &&
      typeof legacyTx.transferAccountId === "string" &&
      accountIds.has(legacyTx.transferAccountId) &&
      legacyTx.transferAccountId !== (legacyTx.accountId ?? fallbackAccountId)
        ? legacyTx.transferAccountId
        : undefined;
    const splits = type === "outflow" ? normalizeSplits(tx.id, legacyTx.splits) : undefined;

    return {
      ...tx,
      type,
      accountId: legacyTx.accountId ?? fallbackAccountId,
      cleared: legacyTx.cleared ?? false,
      categoryId:
        type === "inflow" || type === "transfer" ? null : (tx.categoryId ?? null),
      transferAccountId,
      splits,
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
