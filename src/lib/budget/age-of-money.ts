import { isOnBudgetAccount, accountById } from "@/lib/budget/accounts";
import type { BudgetAccount, BudgetTransaction } from "@/types/budget";

/** Age of Money uses the last 10 spending transactions. */
export const AGE_OF_MONEY_MIN_OUTFLOWS = 10;

export type AgeOfMoneyStatus = "empty" | "insufficient" | "ready";

export interface AgeOfMoneyResult {
  days: number | null;
  status: AgeOfMoneyStatus;
  outflowCount: number;
  matchedOutflowCount: number;
}

function byDateThenId(a: BudgetTransaction, b: BudgetTransaction): number {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return a.id.localeCompare(b.id);
}

export function daysBetweenDateKeys(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Average age (days) of the dollars spent in the last 10 outflows,
 * matching oldest inflow dollars first (FIFO). Transfers are ignored.
 */
export function computeAgeOfMoney(
  transactions: BudgetTransaction[],
  accounts?: BudgetAccount[],
): AgeOfMoneyResult {
  const onBudget = (accountId: string) =>
    isOnBudgetAccount(accountById(accounts, accountId));
  const inflows = transactions
    .filter((tx) => tx.type === "inflow" && onBudget(tx.accountId))
    .sort(byDateThenId);
  const outflows = transactions
    .filter((tx) => tx.type === "outflow" && onBudget(tx.accountId))
    .sort(byDateThenId);

  if (inflows.length === 0 && outflows.length === 0) {
    return {
      days: null,
      status: "empty",
      outflowCount: 0,
      matchedOutflowCount: 0,
    };
  }

  if (outflows.length < AGE_OF_MONEY_MIN_OUTFLOWS || inflows.length === 0) {
    return {
      days: null,
      status: "insufficient",
      outflowCount: outflows.length,
      matchedOutflowCount: 0,
    };
  }

  const pool = inflows.map((tx) => ({ date: tx.date, remaining: tx.amount }));
  const ages: { days: number; amount: number; outflowIndex: number }[] = [];
  const matchedOutflowIndexes = new Set<number>();

  for (let index = 0; index < outflows.length; index += 1) {
    let need = outflows[index].amount;
    const outDate = outflows[index].date;

    for (const inflow of pool) {
      if (need <= 0) break;
      if (inflow.remaining <= 0) continue;
      if (inflow.date > outDate) continue;

      const used = Math.min(need, inflow.remaining);
      ages.push({
        days: daysBetweenDateKeys(inflow.date, outDate),
        amount: used,
        outflowIndex: index,
      });
      inflow.remaining -= used;
      need -= used;
      matchedOutflowIndexes.add(index);
    }
  }

  const windowStart = outflows.length - AGE_OF_MONEY_MIN_OUTFLOWS;
  const recent = ages.filter((entry) => entry.outflowIndex >= windowStart);
  const matchedOutflowCount = [...matchedOutflowIndexes].filter(
    (index) => index >= windowStart,
  ).length;

  if (recent.length === 0) {
    return {
      days: null,
      status: "insufficient",
      outflowCount: outflows.length,
      matchedOutflowCount: 0,
    };
  }

  const totalAmount = recent.reduce((sum, entry) => sum + entry.amount, 0);
  const weightedDays = recent.reduce(
    (sum, entry) => sum + entry.days * entry.amount,
    0,
  );

  return {
    days: Math.round(weightedDays / totalAmount),
    status: "ready",
    outflowCount: outflows.length,
    matchedOutflowCount,
  };
}
