import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";
import { getChartSeriesColor } from "@/lib/portfolio/chart-theme";

export { getChartSeriesColor, ALLOCATION_COLORS } from "@/lib/portfolio/chart-theme";

export function getHoldingChartLabel(holding: PortfolioHoldingWithPrices): string {
  if (holding.type === "cash") {
    return `Cash (${getCashCurrency(holding)})`;
  }
  return holding.symbol;
}

export function buildAllocationChartData(holdings: PortfolioHoldingWithPrices[]) {
  return holdings
    .filter(
      (holding) =>
        holding.portfolioPercent !== null && holding.portfolioPercent > 0,
    )
    .sort((a, b) => b.portfolioPercent! - a.portfolioPercent!)
    .map((holding, index) => ({
      id: holding.id,
      label: getHoldingChartLabel(holding),
      name: holding.name,
      portfolioPercent: holding.portfolioPercent!,
      currentValue: holding.currentValue ?? 0,
      fill: getChartSeriesColor(index),
    }));
}

export function formatAllocationPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
