"use client";

import { useBudget } from "@/contexts/budget-context";
import {
  formatBudgetMoney,
  formatBudgetMoneySigned,
  resolveBudgetCurrency,
} from "@/lib/budget/format";

export function useBudgetFormat() {
  const { budget } = useBudget();
  const currency = resolveBudgetCurrency(budget.currency);
  return {
    currency,
    money: (value: number) => formatBudgetMoney(value, currency),
    moneySigned: (value: number) => formatBudgetMoneySigned(value, currency),
  };
}
