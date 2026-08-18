import type { BudgetCurrency } from "@/types/budget";

export function resolveBudgetCurrency(
  currency: BudgetCurrency | string | undefined,
): BudgetCurrency {
  return currency === "CAD" ? "CAD" : "USD";
}

export function formatBudgetMoney(
  value: number,
  currency: BudgetCurrency | string = "USD",
): string {
  const abs = Math.abs(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: resolveBudgetCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
}

export function formatBudgetMoneySigned(
  value: number,
  currency: BudgetCurrency | string = "USD",
): string {
  if (value === 0) return formatBudgetMoney(0, currency);
  const prefix = value > 0 ? "+" : "−";
  return `${prefix}${formatBudgetMoney(value, currency)}`;
}

export function formatBudgetDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
