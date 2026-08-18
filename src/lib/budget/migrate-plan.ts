import { isBudgetAccountType } from "@/lib/budget/accounts";
import { normalizeClearedState } from "@/lib/budget/cleared";
import { ensureCreditCardPaymentCategories } from "@/lib/budget/credit-card-payments";
import { resolveBudgetCurrency } from "@/lib/budget/format";
import { isCategoryGoalType } from "@/lib/budget/goals";
import {
  createDefaultAccount,
  type BudgetAccount,
  type BudgetClearedState,
  type BudgetCurrency,
  type BudgetPlan,
  type BudgetScheduledTransaction,
  type BudgetTransaction,
  type BudgetTransactionSplit,
  type BudgetTransactionType,
  type CategoryGoal,
  type RecurringFrequency,
} from "@/types/budget";

type LegacySplit = Partial<BudgetTransactionSplit> & {
  amount?: number;
  categoryId?: string | null;
};

type LegacyTransaction = BudgetTransaction & {
  accountId?: string;
  cleared?: boolean | BudgetClearedState;
  transferAccountId?: string;
  splits?: LegacySplit[];
  type?: string;
  scheduledTransactionId?: string;
  approved?: boolean;
  importId?: string;
  matchedTransactionId?: string;
};

type LegacyScheduled = Partial<BudgetScheduledTransaction> & {
  type?: string;
  splits?: LegacySplit[];
};

type LegacyAccount = Partial<BudgetAccount> & {
  id?: string;
  name?: string;
  type?: string;
  sortOrder?: number;
  onBudget?: boolean;
};

type LegacyGoal = Partial<CategoryGoal> & {
  type?: string;
  targetAmount?: number;
};

type LegacyPlan = BudgetPlan & {
  accounts?: BudgetPlan["accounts"];
  scheduledTransactions?: BudgetScheduledTransaction[];
  goals?: CategoryGoal[];
  currency?: BudgetCurrency | string;
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

function normalizeAccount(account: LegacyAccount, index: number): BudgetAccount {
  const rawType = account.type ?? "";
  const type = isBudgetAccountType(rawType) ? rawType : "other";
  const onBudget = account.onBudget !== false;

  return {
    id:
      typeof account.id === "string" && account.id.length > 0
        ? account.id
        : `account-${index}`,
    name:
      typeof account.name === "string" && account.name.trim()
        ? account.name.trim()
        : "Account",
    type,
    onBudget,
    sortOrder:
      typeof account.sortOrder === "number" && Number.isFinite(account.sortOrder)
        ? account.sortOrder
        : index,
    lastReconciledAt:
      typeof account.lastReconciledAt === "string"
        ? account.lastReconciledAt
        : undefined,
  };
}

function normalizeGoals(goals: LegacyGoal[] | undefined): CategoryGoal[] {
  if (!Array.isArray(goals) || goals.length === 0) return [];

  return goals
    .filter(
      (goal) =>
        goal &&
        typeof goal.id === "string" &&
        goal.id.length > 0 &&
        typeof goal.categoryId === "string" &&
        goal.categoryId.length > 0,
    )
    .map((goal) => ({
      id: goal.id!,
      categoryId: goal.categoryId!,
      type: isCategoryGoalType(goal.type) ? goal.type : "target-balance",
      targetAmount: Math.max(
        0,
        typeof goal.targetAmount === "number" && Number.isFinite(goal.targetAmount)
          ? goal.targetAmount
          : 0,
      ),
      targetDate:
        typeof goal.targetDate === "string" && goal.targetDate.length > 0
          ? goal.targetDate
          : undefined,
      label:
        typeof goal.label === "string" && goal.label.trim()
          ? goal.label.trim()
          : undefined,
    }));
}

/** Ensure accounts exist and all transactions are linked with cleared status. */
export function normalizeBudgetPlan(plan: BudgetPlan): BudgetPlan {
  const legacy = plan as LegacyPlan;
  const defaultAccount = createDefaultAccount();
  const accounts =
    legacy.accounts && legacy.accounts.length > 0
      ? legacy.accounts.map((account, index) =>
          normalizeAccount(account as LegacyAccount, index),
        )
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

    const importId =
      typeof legacyTx.importId === "string" && legacyTx.importId.length > 0
        ? legacyTx.importId
        : undefined;
    const matchedTransactionId =
      typeof legacyTx.matchedTransactionId === "string" &&
      legacyTx.matchedTransactionId.length > 0
        ? legacyTx.matchedTransactionId
        : undefined;

    return {
      ...tx,
      type,
      accountId: legacyTx.accountId ?? fallbackAccountId,
      cleared: normalizeClearedState(legacyTx.cleared),
      categoryId:
        type === "inflow" || type === "transfer" ? null : (tx.categoryId ?? null),
      transferAccountId,
      splits,
      scheduledTransactionId,
      approved: legacyTx.approved === false ? false : true,
      importId,
      matchedTransactionId,
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
    goals: normalizeGoals(legacy.goals),
    currency: resolveBudgetCurrency(legacy.currency),
  });
}

export function normalizeBudgetPlans(plans: BudgetPlan[]): BudgetPlan[] {
  return plans.map(normalizeBudgetPlan);
}
