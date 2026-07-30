import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetTransaction,
  BudgetTransactionType,
} from "@/types/budget";

export const ACCOUNT_TYPE_LABELS: Record<BudgetAccountType, string> = {
  chequing: "Chequing",
  savings: "Savings",
  "credit-card": "Credit Card",
  cash: "Cash",
  "line-of-credit": "Line of Credit",
  other: "Other",
};

export function isLiabilityAccount(type: BudgetAccountType): boolean {
  return type === "credit-card" || type === "line-of-credit";
}

export function getTransactionEffect(
  accountType: BudgetAccountType,
  type: BudgetTransactionType,
  amount: number,
): number {
  if (isLiabilityAccount(accountType)) {
    return type === "outflow" ? amount : -amount;
  }
  return type === "inflow" ? amount : -amount;
}

export function getAccountTransactions(
  accountId: string,
  transactions: BudgetTransaction[],
): BudgetTransaction[] {
  return transactions.filter((tx) => tx.accountId === accountId);
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
    (sum, tx) => sum + getTransactionEffect(account.type, tx.type, tx.amount),
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
    balance += getTransactionEffect(
      account.type,
      transaction.type,
      transaction.amount,
    );
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
