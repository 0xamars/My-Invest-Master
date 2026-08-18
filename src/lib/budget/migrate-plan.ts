import { ensureCreditCardPaymentCategories } from "@/lib/budget/credit-card-payments";
import {
  createDefaultAccount,
  type BudgetPlan,
  type BudgetScheduledTransaction,
  type BudgetTransaction,
  type BudgetTransactionSplit,
  type BudgetTransactionType,
  type RecurringFrequency,
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
  scheduledTransactionId?: string;
};

type LegacyScheduled = Partial<BudgetScheduledTransaction> & {
  type?: string;
  splits?: LegacySplit[];
};

type LegacyPlan = BudgetPlan & {
  accounts?: BudgetPlan["accounts"];
  scheduledTransactions?: BudgetScheduledTransaction[];
};

const FREQUENCIES = new Set<RecurringFrequency>([
  "weekly",
  "every-2-weeks",
  "monthly",
  "yearly",
]);

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

function normalizeFrequency(value: unknown): RecurringFrequency {
  if (typeof value === "string" && FREQUENCIES.has(value as RecurringFrequency)) {
    return value as RecurringFrequency;
  }
  return "monthly";
}

function normalizeScheduledTransactions(
  schedules: LegacyScheduled[] | undefined,
  accountIds: Set<string>,
  fallbackAccountId: string,
): BudgetScheduledTransaction[] {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  return schedules
    .filter((row) => row && typeof row.id === "string" && row.id.length > 0)
    .map((row) => {
      const type = normalizeTransactionType(row.type);
      const accountId =
        typeof row.accountId === "string" && accountIds.has(row.accountId)
          ? row.accountId
          : fallbackAccountId;
      const transferAccountId =
        type === "transfer" &&
        typeof row.transferAccountId === "string" &&
        accountIds.has(row.transferAccountId) &&
        row.transferAccountId !== accountId
          ? row.transferAccountId
          : undefined;
      const splits = type === "outflow" ? normalizeSplits(row.id!, row.splits) : undefined;
      const remainingCount =
        typeof row.remainingCount === "number" && Number.isFinite(row.remainingCount)
          ? Math.max(0, Math.floor(row.remainingCount))
          : undefined;
      const endDate =
        typeof row.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.endDate)
          ? row.endDate
          : undefined;
      const nextDate =
        typeof row.nextDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.nextDate)
          ? row.nextDate
          : new Date().toISOString().slice(0, 10);

      return {
        id: row.id!,
        nextDate,
        frequency: normalizeFrequency(row.frequency),
        payee: typeof row.payee === "string" ? row.payee : "",
        accountId,
        categoryId:
          type === "inflow" || type === "transfer" || splits
            ? null
            : (row.categoryId ?? null),
        amount: Math.abs(typeof row.amount === "number" ? row.amount : 0),
        type,
        memo: typeof row.memo === "string" && row.memo.trim() ? row.memo.trim() : undefined,
        transferAccountId,
        splits,
        endDate,
        remainingCount,
        active: row.active === false ? false : true,
      };
    });
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
    const scheduledTransactionId =
      typeof legacyTx.scheduledTransactionId === "string" &&
      legacyTx.scheduledTransactionId.length > 0
        ? legacyTx.scheduledTransactionId
        : undefined;

    return {
      ...tx,
      type,
      accountId: legacyTx.accountId ?? fallbackAccountId,
      cleared: legacyTx.cleared ?? false,
      categoryId:
        type === "inflow" || type === "transfer" ? null : (tx.categoryId ?? null),
      transferAccountId,
      splits,
      scheduledTransactionId,
    };
  });

  const scheduledTransactions = normalizeScheduledTransactions(
    legacy.scheduledTransactions,
    accountIds,
    fallbackAccountId,
  );

  return ensureCreditCardPaymentCategories({
    ...plan,
    accounts,
    transactions,
    scheduledTransactions,
  });
}

export function normalizeBudgetPlans(plans: BudgetPlan[]): BudgetPlan[] {
  return plans.map(normalizeBudgetPlan);
}
