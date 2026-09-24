import { isLiabilityAccount } from "@/lib/budget/accounts";
import type { BudgetAccount, BudgetTransaction } from "@/types/budget";

export const STARTING_BALANCE_PAYEE = "Starting Balance";

/**
 * Opening balance recorded as a real transaction so reconciliation stays honest.
 *
 * Cash and other assets: an inflow (on-budget inflows land in leftover).
 * Liabilities, including credit cards: an uncategorized outflow. That raises
 * the balance owed and does not fund the payment envelope — existing debt
 * stays debt until money is assigned to the payment envelope.
 */
export function buildStartingBalanceTransaction(input: {
  id: string;
  account: Pick<BudgetAccount, "id" | "type">;
  amount: number;
  date: string;
}): BudgetTransaction | null {
  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;

  return {
    id: input.id,
    date: input.date,
    payee: STARTING_BALANCE_PAYEE,
    accountId: input.account.id,
    categoryId: null,
    amount,
    type: isLiabilityAccount(input.account.type) ? "outflow" : "inflow",
    cleared: "uncleared",
    approved: true,
    memo: "Balance when the account was added",
  };
}
