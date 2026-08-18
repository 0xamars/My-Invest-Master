import type { PortfolioHolding } from "@/types/portfolio";

export function getPortfolioDayChange(
  holdings: Pick<PortfolioHolding, "symbol" | "quantity">[],
  changes: Record<string, { change: number; changePercent: number }>,
  currentValue: number,
): { change: number; changePercent: number } | null {
  let dollarChange = 0;
  let matched = 0;

  for (const holding of holdings) {
    const quote = changes[holding.symbol];
    if (!quote) continue;
    dollarChange += holding.quantity * quote.change;
    matched += 1;
  }

  if (matched === 0) return null;

  const previous = currentValue - dollarChange;
  const changePercent = previous === 0 ? 0 : (dollarChange / previous) * 100;
  return { change: dollarChange, changePercent };
}
