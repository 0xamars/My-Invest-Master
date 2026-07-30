export function formatBudgetMoney(value: number): string {
  const abs = Math.abs(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
}

export function formatBudgetMoneySigned(value: number): string {
  if (value === 0) return formatBudgetMoney(0);
  const prefix = value > 0 ? "+" : "−";
  return `${prefix}${formatBudgetMoney(value)}`;
}

export function formatBudgetDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
