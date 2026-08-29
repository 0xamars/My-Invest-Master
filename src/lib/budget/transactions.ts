import { accountById, isOnBudgetAccount } from "@/lib/budget/accounts";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetTransaction,
  BudgetTransactionSplit,
} from "@/types/budget";

export function isTransferTransaction(
  tx: Pick<BudgetTransaction, "type">,
): boolean {
  return tx.type === "transfer";
}

export function isSplitTransaction(
  tx: Pick<BudgetTransaction, "splits">,
): boolean {
  return Array.isArray(tx.splits) && tx.splits.length > 0;
}

export function isIncomeTransaction(
  tx: Pick<BudgetTransaction, "type">,
): boolean {
  return tx.type === "inflow";
}

export function isExpenseTransaction(
  tx: Pick<BudgetTransaction, "type">,
): boolean {
  return tx.type === "outflow";
}

export function transactionTouchesAccount(
  tx: Pick<BudgetTransaction, "accountId" | "type" | "transferAccountId">,
  accountId: string,
): boolean {
  if (tx.accountId === accountId) return true;
  return isTransferTransaction(tx) && tx.transferAccountId === accountId;
}

export function transactionTouchesCategory(
  tx: Pick<BudgetTransaction, "categoryId" | "splits">,
  categoryId: string,
): boolean {
  if (tx.categoryId === categoryId) return true;
  return Boolean(tx.splits?.some((line) => line.categoryId === categoryId));
}

/** Outflow activity this transaction contributes to a category. Transfers are 0. */
export function getOutflowActivityForCategory(
  tx: BudgetTransaction,
  categoryId: string,
): number {
  if (!isExpenseTransaction(tx)) return 0;
  if (isSplitTransaction(tx)) {
    return (tx.splits ?? [])
      .filter((line) => line.categoryId === categoryId)
      .reduce((sum, line) => sum + line.amount, 0);
  }
  return tx.categoryId === categoryId ? tx.amount : 0;
}

export function getSplitTotal(splits: BudgetTransactionSplit[]): number {
  return splits.reduce((sum, line) => sum + line.amount, 0);
}

export function accountNameById(
  accounts: BudgetAccount[],
  accountId: string | undefined,
): string {
  if (!accountId) return "Unknown";
  return accounts.find((account) => account.id === accountId)?.name ?? "Unknown";
}

export function categoryNameById(
  categories: BudgetCategory[],
  categoryId: string | null,
): string {
  if (!categoryId) return "Unassigned";
  return (
    categories.find((category) => category.id === categoryId)?.name ?? "Unknown"
  );
}

export function buildTransferPayee(toAccountName: string): string {
  return `Transfer to ${toAccountName}`;
}

export interface TransactionDisplay {
  payee: string;
  categoryLabel: string;
  isInflowLike: boolean;
  isTransfer: boolean;
  isSplit: boolean;
  amountPrefix: "+" | "−" | "";
}

export function getTransactionDisplay(
  tx: BudgetTransaction,
  accounts: BudgetAccount[],
  categories: BudgetCategory[],
  viewingAccountId?: string,
): TransactionDisplay {
  if (isTransferTransaction(tx)) {
    const toName = accountNameById(accounts, tx.transferAccountId);
    const fromName = accountNameById(accounts, tx.accountId);
    const incoming =
      viewingAccountId != null && viewingAccountId === tx.transferAccountId;
    const fromOnBudget = isOnBudgetAccount(accountById(accounts, tx.accountId));
    const toOnBudget = isOnBudgetAccount(
      accountById(accounts, tx.transferAccountId),
    );
    const crossesBudget = fromOnBudget !== toOnBudget;
    return {
      payee: incoming ? `Transfer from ${fromName}` : `Transfer to ${toName}`,
      categoryLabel: crossesBudget ? "Leftover" : "Transfer",
      isInflowLike: incoming || (!viewingAccountId && !fromOnBudget && toOnBudget),
      isTransfer: true,
      isSplit: false,
      amountPrefix: incoming ? "+" : viewingAccountId ? "−" : "",
    };
  }

  if (isSplitTransaction(tx)) {
    const lines = tx.splits ?? [];
    const firstName = categoryNameById(categories, lines[0]?.categoryId ?? null);
    const extra = lines.length - 1;
    return {
      payee: tx.payee,
      categoryLabel: extra > 0 ? `${firstName} + ${extra} more` : firstName,
      isInflowLike: false,
      isTransfer: false,
      isSplit: true,
      amountPrefix: "−",
    };
  }

  return {
    payee: tx.payee,
    categoryLabel:
      tx.type === "inflow"
        ? "Leftover"
        : categoryNameById(categories, tx.categoryId),
    isInflowLike: tx.type === "inflow",
    isTransfer: false,
    isSplit: false,
    amountPrefix: tx.type === "inflow" ? "+" : "−",
  };
}
