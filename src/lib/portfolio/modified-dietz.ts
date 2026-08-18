import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { sortTransactions } from "@/lib/portfolio/transactions";

function parseDateOnly(value: string): number {
  return new Date(`${value}T12:00:00`).getTime();
}

function todayDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Approximate money-weighted return (Modified Dietz) from dated buy/sell
 * cash flows. Returns null when there are not enough distinct flow dates
 * to differ from cost-basis P/L — never invents a TWR or benchmark.
 */
export function computeModifiedDietzReturn(
  holdings: PortfolioHoldingWithPrices[],
  asOfDate = todayDateString(),
): number | null {
  const flows: { date: string; amount: number }[] = [];

  for (const holding of holdings) {
    if (holding.type === "cash") continue;
    if (!Array.isArray(holding.transactions) || holding.transactions.length === 0) {
      continue;
    }
    for (const tx of sortTransactions(holding.transactions)) {
      if (!tx.date || !Number.isFinite(tx.quantity) || !Number.isFinite(tx.pricePerUnit)) {
        continue;
      }
      const signed = tx.quantity * tx.pricePerUnit;
      flows.push({
        date: tx.date,
        amount: tx.type === "buy" ? signed : -signed,
      });
    }
  }

  const uniqueDates = new Set(flows.map((flow) => flow.date));
  const hasSell = holdings.some((holding) =>
    holding.transactions?.some((tx) => tx.type === "sell"),
  );
  if (flows.length === 0 || (uniqueDates.size < 2 && !hasSell)) {
    return null;
  }

  const start = [...uniqueDates].sort()[0];
  const startMs = parseDateOnly(start);
  const endMs = parseDateOnly(asOfDate);
  const periodDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));

  let netCf = 0;
  let weightedCf = 0;
  for (const flow of flows) {
    const flowMs = parseDateOnly(flow.date);
    const daysFromStart = Math.max(
      0,
      Math.min(periodDays, Math.round((flowMs - startMs) / 86_400_000)),
    );
    const weight = (periodDays - daysFromStart) / periodDays;
    netCf += flow.amount;
    weightedCf += flow.amount * weight;
  }

  const endValue = holdings.reduce(
    (sum, holding) => sum + (holding.currentValue ?? 0),
    0,
  );
  const denominator = weightedCf;
  if (denominator === 0) return null;

  return ((endValue - netCf) / denominator) * 100;
}
