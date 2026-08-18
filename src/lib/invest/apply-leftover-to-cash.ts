import { SECTOR_CASH } from "@/lib/portfolio/sectors";
import {
  createTransaction,
  syncHoldingFromTransactions,
} from "@/lib/portfolio/transactions";
import type { BudgetCurrency } from "@/types/budget";
import {
  getCashCurrency,
  type PortfolioHolding,
} from "@/types/portfolio";

export interface ApplyLeftoverToCashInput {
  amount: number;
  currency: BudgetCurrency;
  date: string;
}

export interface ApplyLeftoverToCashResult {
  holdings: PortfolioHolding[];
  applied: number;
  created: boolean;
}

/**
 * Add leftover dollars as a cash buy on the book. Does not touch Budget
 * category math. Quantity = leftover at $1. Matching cash (same currency)
 * is increased; otherwise a Cash (CCY) holding is created. Amounts ≤ 0
 * are a no-op — never invent a balance.
 */
export function applyLeftoverToBookCash(
  holdings: PortfolioHolding[],
  input: ApplyLeftoverToCashInput,
): ApplyLeftoverToCashResult {
  const amount = input.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { holdings, applied: 0, created: false };
  }

  const existing = holdings.find(
    (holding) =>
      holding.type === "cash" && getCashCurrency(holding) === input.currency,
  );
  const buy = createTransaction("buy", amount, 1, input.date);

  if (existing) {
    return {
      holdings: holdings.map((holding) =>
        holding.id === existing.id
          ? syncHoldingFromTransactions({
              ...holding,
              transactions: [...holding.transactions, buy],
            })
          : holding,
      ),
      applied: amount,
      created: false,
    };
  }

  const created: PortfolioHolding = syncHoldingFromTransactions({
    id: crypto.randomUUID(),
    symbol: "CASH",
    name: `Cash (${input.currency})`,
    type: "cash",
    sector: SECTOR_CASH,
    category: "Cash",
    subCategory: "Liquidity",
    costPrice: 1,
    quantity: 0,
    addedAt: new Date(`${input.date}T12:00:00`).toISOString(),
    transactions: [buy],
    cashCurrency: input.currency,
  });

  return {
    holdings: [...holdings, created],
    applied: amount,
    created: true,
  };
}
