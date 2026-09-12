import {
  getAccountBalance,
  isCreditCardPaymentAccount,
  isLiabilityAccount,
  isOnBudgetAccount,
} from "@/lib/budget/accounts";
import { getCategoryAvailable } from "@/lib/budget/calculations";
import { paymentCategoryForAccount } from "@/lib/budget/credit-card-payments";
import type {
  BudgetAccount,
  BudgetData,
  BudgetTransaction,
} from "@/types/budget";

/** On-budget cash piles that can pay a card. Liabilities are excluded. */
export function spendingAccountsForCardPay(
  accounts: BudgetAccount[],
): BudgetAccount[] {
  return accounts.filter(
    (account) =>
      isOnBudgetAccount(account) &&
      !isCreditCardPaymentAccount(account) &&
      !isLiabilityAccount(account.type),
  );
}

export function suggestedCardPaymentAmount(input: {
  balanceOwed: number;
  paymentAvailable: number;
}): number {
  const owed = Math.max(0, input.balanceOwed);
  const available = Math.max(0, input.paymentAvailable);
  if (available > 0 && owed > 0) return Math.min(available, owed);
  if (available > 0) return available;
  return owed;
}

export type CardPaymentSnapshot = NonNullable<
  ReturnType<typeof cardPaymentSnapshot>
>;

export function cardPaymentSnapshot(
  budget: BudgetData,
  cardAccountId: string,
  monthKey: string,
): {
  card: BudgetAccount;
  paymentAvailable: number;
  balanceOwed: number;
  suggestedAmount: number;
  sources: BudgetAccount[];
} | null {
  const accounts = budget.accounts ?? [];
  const card = accounts.find((account) => account.id === cardAccountId);
  if (!card || !isCreditCardPaymentAccount(card)) return null;

  const payment = paymentCategoryForAccount(budget.categories, card.id);
  const paymentAvailable = payment
    ? getCategoryAvailable(budget, payment.id, monthKey)
    : 0;
  const balanceOwed = Math.max(0, getAccountBalance(card, budget.transactions));
  return {
    card,
    paymentAvailable,
    balanceOwed,
    suggestedAmount: suggestedCardPaymentAmount({
      balanceOwed,
      paymentAvailable,
    }),
    sources: spendingAccountsForCardPay(accounts),
  };
}

export function buildCardPaymentTransfer(input: {
  id: string;
  date: string;
  amount: number;
  fromAccountId: string;
  cardAccountId: string;
  cardName: string;
}): BudgetTransaction {
  return {
    id: input.id,
    date: input.date,
    payee: `Payment · ${input.cardName}`,
    accountId: input.fromAccountId,
    transferAccountId: input.cardAccountId,
    categoryId: null,
    amount: input.amount,
    type: "transfer",
    cleared: "cleared",
    approved: true,
  };
}

export function applyPayCard(
  budget: BudgetData,
  input: {
    cardAccountId: string;
    fromAccountId: string;
    amount: number;
    date: string;
    id?: string;
  },
): BudgetData {
  const snapshot = cardPaymentSnapshot(budget, input.cardAccountId, input.date.slice(0, 7));
  if (!snapshot) return budget;
  if (input.amount <= 0 || !Number.isFinite(input.amount)) return budget;
  if (!snapshot.sources.some((account) => account.id === input.fromAccountId)) {
    return budget;
  }

  const transfer = buildCardPaymentTransfer({
    id: input.id ?? crypto.randomUUID(),
    date: input.date,
    amount: input.amount,
    fromAccountId: input.fromAccountId,
    cardAccountId: input.cardAccountId,
    cardName: snapshot.card.name,
  });

  return {
    ...budget,
    transactions: [...budget.transactions, transfer],
  };
}
