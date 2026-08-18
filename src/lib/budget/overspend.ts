import { isCreditCardPaymentAccount } from "@/lib/budget/accounts";
import { isPaymentCategory } from "@/lib/budget/credit-card-payments";
import { isOnBudgetOutflow } from "@/lib/budget/on-budget";
import { getOutflowActivityForCategory } from "@/lib/budget/transactions";
import {
  getMonthKey,
  shiftMonthKey,
  type BudgetAccount,
  type BudgetData,
  type BudgetTransaction,
} from "@/types/budget";

export type OverspendKind = "cash" | "credit";

export interface CategoryMonthOverspend {
  available: number;
  assigned: number;
  activity: number;
  cashActivity: number;
  creditActivity: number;
  cashOverspend: number;
  creditOverspend: number;
  absorbedCash: number;
  creditOverspendByAccount: Record<string, number>;
}

export interface CategoryActivitySplit {
  cash: number;
  credit: number;
  byCreditAccount: Record<string, number>;
}

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function isOnOrBeforeMonth(date: string, monthKey: string): boolean {
  return monthKeyOf(date) <= monthKey;
}

function addAmount(
  target: Record<string, number>,
  key: string,
  amount: number,
): void {
  if (amount === 0) return;
  target[key] = (target[key] ?? 0) + amount;
}

function scaleAmounts(
  amounts: Record<string, number>,
  factor: number,
): Record<string, number> {
  if (factor === 1) return { ...amounts };
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(amounts)) {
    const scaled = value * factor;
    if (Math.abs(scaled) > 0.0001) next[key] = scaled;
  }
  return next;
}

export function collectMonthKeysThrough(
  budget: Pick<BudgetData, "transactions" | "monthBudgets">,
  monthKey: string,
): string[] {
  const months = new Set<string>();
  for (const transaction of budget.transactions) {
    months.add(monthKeyOf(transaction.date));
  }
  for (const key of Object.keys(budget.monthBudgets)) {
    months.add(key);
  }
  if (months.size === 0) return [];
  const start = [...months].sort()[0];
  if (monthKey < start) return [];

  const keys: string[] = [];
  let cursor = start;
  while (cursor <= monthKey) {
    keys.push(cursor);
    if (cursor === monthKey) break;
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}

export function splitCategoryActivity(
  tx: BudgetTransaction,
  categoryId: string,
  accounts: BudgetAccount[] | undefined,
): CategoryActivitySplit {
  const empty: CategoryActivitySplit = { cash: 0, credit: 0, byCreditAccount: {} };
  if (!isOnBudgetOutflow(tx, accounts)) return empty;

  const amount = getOutflowActivityForCategory(tx, categoryId);
  if (amount === 0) return empty;

  const account = accounts?.find((entry) => entry.id === tx.accountId);
  if (account && isCreditCardPaymentAccount(account)) {
    return {
      cash: 0,
      credit: amount,
      byCreditAccount: { [account.id]: amount },
    };
  }

  return { cash: amount, credit: 0, byCreditAccount: {} };
}

function activitySplitForMonth(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): CategoryActivitySplit {
  const split: CategoryActivitySplit = {
    cash: 0,
    credit: 0,
    byCreditAccount: {},
  };

  for (const tx of budget.transactions) {
    if (monthKeyOf(tx.date) !== monthKey) continue;
    const piece = splitCategoryActivity(tx, categoryId, budget.accounts);
    split.cash += piece.cash;
    split.credit += piece.credit;
    for (const [accountId, amount] of Object.entries(piece.byCreditAccount)) {
      addAmount(split.byCreditAccount, accountId, amount);
    }
  }

  return split;
}

function emptyOverspend(assigned: number, activity: number): CategoryMonthOverspend {
  return {
    available: assigned - activity,
    assigned,
    activity,
    cashActivity: 0,
    creditActivity: 0,
    cashOverspend: 0,
    creditOverspend: 0,
    absorbedCash: 0,
    creditOverspendByAccount: {},
  };
}

/**
 * Walk leftover + this-month assigned − activity, splitting cash vs credit
 * overspend the way YNAB does:
 *
 * - Assigned leftover funds cash spending first, then credit.
 * - Uncovered cash overspend in a *closed* month (before `monthKey`) is
 *   absorbed: Available resets by that amount and Ready to Assign in later
 *   months is reduced.
 * - Credit overspend stays in the category and underfunds the card payment
 *   category. It does not steal Ready to Assign.
 */
export function getCategoryOverspendState(
  budget: BudgetData,
  categoryId: string,
  monthKey: string,
): CategoryMonthOverspend {
  const category = budget.categories.find((entry) => entry.id === categoryId);
  if (category && isPaymentCategory(category)) {
    return emptyOverspend(0, 0);
  }

  const months = collectMonthKeysThrough(budget, monthKey);
  if (months.length === 0) {
    return emptyOverspend(0, 0);
  }

  let leftover = 0;
  let absorbedCash = 0;
  let last: CategoryMonthOverspend = emptyOverspend(0, 0);

  for (const cursor of months) {
    const assigned = budget.monthBudgets[cursor]?.assignments[categoryId] ?? 0;
    const activitySplit = activitySplitForMonth(budget, categoryId, cursor);
    const cashActivity = activitySplit.cash;
    const creditActivity = activitySplit.credit;
    const activity = cashActivity + creditActivity;

    const fundedStart = leftover;
    const carriedCredit = Math.max(0, -fundedStart);
    const coverCarried = Math.min(Math.max(0, assigned), carriedCredit);
    const leftoverAssigned = Math.max(0, assigned) - coverCarried + Math.min(0, assigned);
    const remainingCarried = carriedCredit - coverCarried;
    const spendable = Math.max(0, fundedStart) + leftoverAssigned;

    const cashOverspend = Math.max(0, cashActivity - spendable);
    const afterCash = Math.max(0, spendable - cashActivity);
    const newCreditOverspend = Math.max(0, creditActivity - afterCash);
    const creditOverspend = remainingCarried + newCreditOverspend;
    let available = spendable - cashActivity - creditActivity - remainingCarried;

    const prevHoleByAccount = last.creditOverspendByAccount;
    const prevHoleTotal = Object.values(prevHoleByAccount).reduce(
      (sum, value) => sum + value,
      0,
    );
    const remainingHoleByAccount =
      remainingCarried === 0 || prevHoleTotal <= 0
        ? {}
        : scaleAmounts(prevHoleByAccount, remainingCarried / prevHoleTotal);

    const newHoleByAccount: Record<string, number> = {
      ...remainingHoleByAccount,
    };
    const monthCreditTotal = Object.values(activitySplit.byCreditAccount).reduce(
      (sum, value) => sum + value,
      0,
    );
    if (newCreditOverspend > 0 && monthCreditTotal > 0) {
      for (const [accountId, amount] of Object.entries(
        activitySplit.byCreditAccount,
      )) {
        addAmount(
          newHoleByAccount,
          accountId,
          newCreditOverspend * (amount / monthCreditTotal),
        );
      }
    } else if (newCreditOverspend > 0) {
      addAmount(newHoleByAccount, "unknown", newCreditOverspend);
    }

    if (cursor < monthKey && cashOverspend > 0) {
      available += cashOverspend;
      absorbedCash += cashOverspend;
    }

    leftover = available;
    last = {
      available,
      assigned,
      activity,
      cashActivity,
      creditActivity,
      cashOverspend: cursor < monthKey ? 0 : cashOverspend,
      creditOverspend,
      absorbedCash,
      creditOverspendByAccount: newHoleByAccount,
    };
  }

  return last;
}

export function getAbsorbedCashOverspend(
  budget: BudgetData,
  monthKey: string,
): number {
  return budget.categories
    .filter((category) => !isPaymentCategory(category))
    .reduce(
      (sum, category) =>
        sum + getCategoryOverspendState(budget, category.id, monthKey).absorbedCash,
      0,
    );
}

export function getCreditOverspendOnAccount(
  budget: BudgetData,
  creditCardAccountId: string,
  monthKey: string,
): number {
  return budget.categories
    .filter((category) => !isPaymentCategory(category))
    .reduce((sum, category) => {
      const state = getCategoryOverspendState(budget, category.id, monthKey);
      return sum + (state.creditOverspendByAccount[creditCardAccountId] ?? 0);
    }, 0);
}

export function getOverspendKind(
  state: Pick<CategoryMonthOverspend, "cashOverspend" | "creditOverspend" | "available">,
): OverspendKind | null {
  if (state.available >= 0) return null;
  if (state.cashOverspend > 0) return "cash";
  if (state.creditOverspend > 0) return "credit";
  return state.available < 0 ? "cash" : null;
}

export function currentMonthKey(date: Date = new Date()): string {
  return getMonthKey(date);
}
