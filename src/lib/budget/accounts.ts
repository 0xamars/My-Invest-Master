import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetTransaction,
} from "@/types/budget";
import { transactionTouchesAccount } from "@/lib/budget/transactions";

export const ACCOUNT_TYPE_LABELS: Record<BudgetAccountType, string> = {
  chequing: "Chequing",
  savings: "Savings",
  "credit-card": "Credit Card",
  cash: "Cash",
  "line-of-credit": "Line of Credit",
  brokerage: "Brokerage",
  mortgage: "Mortgage",
  other: "Other",
};

const ACCOUNT_TYPES = new Set<BudgetAccountType>(
  Object.keys(ACCOUNT_TYPE_LABELS) as BudgetAccountType[],
);

export function isBudgetAccountType(value: string): value is BudgetAccountType {
  return ACCOUNT_TYPES.has(value as BudgetAccountType);
}

export function defaultOnBudgetForType(type: BudgetAccountType): boolean {
  return type !== "brokerage" && type !== "mortgage";
}

export function isOnBudgetAccount(
  account: Pick<BudgetAccount, "onBudget"> | undefined,
): boolean {
  return account?.onBudget !== false;
}

export function accountById(
  accounts: BudgetAccount[] | undefined,
  accountId: string | undefined,
): BudgetAccount | undefined {
  if (!accountId || !accounts || accounts.length === 0) return undefined;
  return accounts.find((account) => account.id === accountId);
}

export function isLiabilityAccount(type: BudgetAccountType): boolean {
  return (
    type === "credit-card" || type === "line-of-credit" || type === "mortgage"
  );
}

/** On-budget credit cards and lines of credit get a payment category. */
export function isCreditCardPaymentAccount(
  account: Pick<BudgetAccount, "type" | "onBudget">,
): boolean {
  return (
    isOnBudgetAccount(account) &&
    (account.type === "credit-card" || account.type === "line-of-credit")
  );
}

export function getTransactionEffect(
  accountType: BudgetAccountType,
  type: "inflow" | "outflow",
  amount: number,
): number {
  if (isLiabilityAccount(accountType)) {
    return type === "outflow" ? amount : -amount;
  }
  return type === "inflow" ? amount : -amount;
}

/** Balance change of `tx` on `account`, including the far side of a transfer. */
export function getTransactionBalanceEffect(
  account: BudgetAccount,
  tx: BudgetTransaction,
): number {
  if (tx.type === "transfer") {
    const isFrom = tx.accountId === account.id;
    const isTo = tx.transferAccountId === account.id;
    if (!isFrom && !isTo) return 0;
    return getTransactionEffect(
      account.type,
      isFrom ? "outflow" : "inflow",
      tx.amount,
    );
  }
  return getTransactionEffect(account.type, tx.type, tx.amount);
}

export function getAccountTransactions(
  accountId: string,
  transactions: BudgetTransaction[],
): BudgetTransaction[] {
  return transactions.filter((tx) => transactionTouchesAccount(tx, accountId));
}

export function getAccountBalance(
  account: BudgetAccount,
  transactions: BudgetTransaction[],
  options?: { clearedOnly?: boolean },
): number {
  let rows = getAccountTransactions(account.id, transactions);
  if (options?.clearedOnly) {
    rows = rows.filter((tx) => tx.cleared);
  }

  return rows.reduce(
    (sum, tx) => sum + getTransactionBalanceEffect(account, tx),
    0,
  );
}

export interface RunningBalanceRow {
  transaction: BudgetTransaction;
  runningBalance: number;
}

export function getRunningBalances(
  account: BudgetAccount,
  transactions: BudgetTransaction[],
): RunningBalanceRow[] {
  const sorted = [...getAccountTransactions(account.id, transactions)].sort(
    (a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    },
  );

  let balance = 0;
  return sorted.map((transaction) => {
    balance += getTransactionBalanceEffect(account, transaction);
    return { transaction, runningBalance: balance };
  });
}

export function getUnclearedTransactions(
  accountId: string,
  transactions: BudgetTransaction[],
): BudgetTransaction[] {
  return getAccountTransactions(accountId, transactions)
    .filter((tx) => !tx.cleared)
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
}

export function getReconciliationDifference(
  account: BudgetAccount,
  transactions: BudgetTransaction[],
  statementBalance: number,
): number {
  const clearedBalance = getAccountBalance(account, transactions, {
    clearedOnly: true,
  });
  return statementBalance - clearedBalance;
}

export function sortedAccounts(accounts: BudgetAccount[]): BudgetAccount[] {
  return [...accounts].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function formatAccountBalanceLabel(type: BudgetAccountType): string {
  return isLiabilityAccount(type) ? "Balance owed" : "Current balance";
}

export function getAccountBalanceThroughMonth(
  account: BudgetAccount,
  transactions: BudgetTransaction[],
  monthKey: string,
): number {
  return getAccountBalance(
    account,
    transactions.filter((tx) => tx.date.slice(0, 7) <= monthKey),
  );
}
