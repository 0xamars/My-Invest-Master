import { isCreditCardPaymentAccount } from "@/lib/budget/accounts";
import { shouldAbsorbCashOverspend } from "@/lib/budget/closed-months";
import {
  getPaymentCategoryActivity,
  paymentCategoryForAccount,
  sumTransfersToCard,
  sumUncategorizedCardInflows,
} from "@/lib/budget/credit-card-payments";
import {
  collectMonthKeysThrough,
  getCreditOverspendOnAccount,
} from "@/lib/budget/overspend";
import { shiftMonthKey, type BudgetData } from "@/types/budget";

function assignedThrough(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): number {
  let total = 0;
  for (const [key, monthBudget] of Object.entries(budget.monthBudgets)) {
    if (key <= monthKey) total += monthBudget.assignments[categoryId] ?? 0;
  }
  return total;
}

function activityThrough(
  budget: BudgetData,
  cardId: string,
  monthKey: string,
): number {
  return budget.transactions.reduce((sum, tx) => {
    if (tx.date.slice(0, 7) > monthKey) return sum;
    return sum + getPaymentCategoryActivity(tx, cardId, budget.accounts);
  }, 0);
}

/**
 * Payment-envelope position before closed-month overpay is absorbed.
 * Uncategorized card inflows release leftover only up to dollars already
 * reserved here. They do not create cash the payment envelope never held.
 */
export function paymentEnvelopeBeforeAbsorption(
  budget: BudgetData,
  cardId: string,
  monthKey: string,
): { raw: number; release: number } {
  const category = paymentCategoryForAccount(budget.categories, cardId);
  if (!category) return { raw: 0, release: 0 };

  const beforeRelease =
    assignedThrough(budget, category.id, monthKey) -
    activityThrough(budget, cardId, monthKey) -
    getCreditOverspendOnAccount(budget, cardId, monthKey);
  const inflows = sumUncategorizedCardInflows(
    budget.transactions,
    cardId,
    monthKey,
  );
  const release = Math.min(inflows, Math.max(0, beforeRelease));
  return { raw: beforeRelease - release, release };
}

/** Cash that left via a card payment beyond what the envelope held. */
export function paymentCashOverspend(
  budget: BudgetData,
  cardId: string,
  monthKey: string,
): number {
  const { raw } = paymentEnvelopeBeforeAbsorption(budget, cardId, monthKey);
  if (raw >= -0.0001) return 0;
  const payments = sumTransfersToCard(budget.transactions, cardId, monthKey);
  const beforePayments = raw + payments;
  return Math.max(0, payments - Math.max(0, beforePayments));
}

export function absorbedPaymentOverpayForCard(
  budget: BudgetData,
  cardId: string,
  viewedMonth: string,
): number {
  let absorbed = 0;
  for (const cursor of collectMonthKeysThrough(budget, viewedMonth)) {
    if (!shouldAbsorbCashOverspend(budget, cursor, viewedMonth)) continue;
    const hole = paymentCashOverspend(budget, cardId, cursor);
    if (hole > absorbed) absorbed = hole;
  }
  return absorbed;
}

export function getPaymentEnvelopeAvailable(
  budget: BudgetData,
  cardId: string,
  monthKey: string,
): number {
  const { raw } = paymentEnvelopeBeforeAbsorption(budget, cardId, monthKey);
  const absorbed = absorbedPaymentOverpayForCard(budget, cardId, monthKey);
  let available = raw + absorbed;
  const cashHole = paymentCashOverspend(budget, cardId, monthKey);
  const visibleHole = Math.max(0, cashHole - absorbed);
  if (available < -visibleHole) available = -visibleHole;
  return available;
}

export function getCardInflowRelease(budget: BudgetData, monthKey: string): number {
  let total = 0;
  for (const account of budget.accounts ?? []) {
    if (!isCreditCardPaymentAccount(account)) continue;
    total += paymentEnvelopeBeforeAbsorption(budget, account.id, monthKey).release;
  }
  return total;
}

export function cardInflowReleaseInMonth(
  budget: BudgetData,
  cardId: string,
  monthKey: string,
): number {
  const prior = shiftMonthKey(monthKey, -1);
  const now = paymentEnvelopeBeforeAbsorption(budget, cardId, monthKey).release;
  const before = paymentEnvelopeBeforeAbsorption(budget, cardId, prior).release;
  return now - before;
}

export function getCardInflowReleaseInMonth(
  budget: BudgetData,
  monthKey: string,
): number {
  return getCardInflowRelease(budget, monthKey) - getCardInflowRelease(budget, shiftMonthKey(monthKey, -1));
}

export function getAbsorbedPaymentOverpay(
  budget: BudgetData,
  monthKey: string,
): number {
  let total = 0;
  for (const account of budget.accounts ?? []) {
    if (!isCreditCardPaymentAccount(account)) continue;
    total += absorbedPaymentOverpayForCard(budget, account.id, monthKey);
  }
  return total;
}
