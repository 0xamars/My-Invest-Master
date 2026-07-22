import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";
import {
  CHART_NEGATIVE_COLOR,
  CHART_POSITIVE_COLOR,
  CHART_TYPE_COLORS,
  getChartSeriesColor,
} from "@/lib/portfolio/chart-theme";
import { normalizeSector } from "@/lib/portfolio/sectors";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import type { AssetType } from "@/types/portfolio";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: "Stocks",
  crypto: "Crypto",
  cash: "Cash",
  custom: "Custom",
};

export const ASSET_TYPE_COLORS = CHART_TYPE_COLORS;

export interface SectorBreakdownItem {
  id: string;
  label: string;
  value: number;
  count: number;
  percent: number;
  fill: string;
}

export interface AssetTypeBreakdownItem {
  id: AssetType;
  label: string;
  value: number;
  count: number;
  percent: number;
  fill: string;
}

export interface TopHoldingChartItem {
  id: string;
  label: string;
  value: number;
  percent: number;
}

export interface ProfitLossChartItem {
  id: string;
  label: string;
  profitLoss: number;
  profitLossPercent: number;
  fill: string;
}

export interface CostVsValueChartItem {
  id: string;
  label: string;
  cost: number;
  current: number;
}

export interface AnalyticsSummary {
  holdingsCount: number;
  returnPercent: number;
  winnersCount: number;
  losersCount: number;
  assetTypeCount: number;
  bestPerformer: PortfolioHoldingWithPrices | null;
  worstPerformer: PortfolioHoldingWithPrices | null;
}

function getPricedHoldings(holdings: PortfolioHoldingWithPrices[]) {
  return holdings.filter(
    (holding) => holding.currentValue !== null && holding.currentValue > 0,
  );
}

export function buildAssetTypeBreakdown(
  holdings: PortfolioHoldingWithPrices[],
): AssetTypeBreakdownItem[] {
  const byType = new Map<AssetType, { value: number; count: number }>();

  for (const holding of getPricedHoldings(holdings)) {
    const existing = byType.get(holding.type) ?? { value: 0, count: 0 };
    byType.set(holding.type, {
      value: existing.value + (holding.currentValue ?? 0),
      count: existing.count + 1,
    });
  }

  const total = [...byType.values()].reduce((sum, item) => sum + item.value, 0);

  return [...byType.entries()]
    .map(([type, data]) => ({
      id: type,
      label: ASSET_TYPE_LABELS[type],
      value: data.value,
      count: data.count,
      percent: total > 0 ? (data.value / total) * 100 : 0,
      fill: ASSET_TYPE_COLORS[type],
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildSectorBreakdown(
  holdings: PortfolioHoldingWithPrices[],
): SectorBreakdownItem[] {
  const bySector = new Map<string, { value: number; count: number }>();

  for (const holding of getPricedHoldings(holdings)) {
    const sector = normalizeSector(holding.sector);
    const existing = bySector.get(sector) ?? { value: 0, count: 0 };
    bySector.set(sector, {
      value: existing.value + (holding.currentValue ?? 0),
      count: existing.count + 1,
    });
  }

  const total = [...bySector.values()].reduce((sum, item) => sum + item.value, 0);

  return [...bySector.entries()]
    .map(([sector, data], index) => ({
      id: sector,
      label: sector,
      value: data.value,
      count: data.count,
      percent: total > 0 ? (data.value / total) * 100 : 0,
      fill: getChartSeriesColor(index),
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildTopHoldingsChartData(
  holdings: PortfolioHoldingWithPrices[],
  limit = 8,
): TopHoldingChartItem[] {
  return getPricedHoldings(holdings)
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
    .slice(0, limit)
    .map((holding) => ({
      id: holding.id,
      label: getHoldingChartLabel(holding),
      value: holding.currentValue ?? 0,
      percent: holding.portfolioPercent ?? 0,
    }));
}

export function buildProfitLossChartData(
  holdings: PortfolioHoldingWithPrices[],
  limit = 10,
): ProfitLossChartItem[] {
  return holdings
    .filter(
      (holding) =>
        holding.profitLoss !== null &&
        holding.type !== "cash" &&
        holding.currentValue !== null,
    )
    .sort(
      (a, b) => Math.abs(b.profitLoss ?? 0) - Math.abs(a.profitLoss ?? 0),
    )
    .slice(0, limit)
    .map((holding) => ({
      id: holding.id,
      label: getHoldingChartLabel(holding),
      profitLoss: holding.profitLoss ?? 0,
      profitLossPercent: holding.profitLossPercent ?? 0,
      fill: (holding.profitLoss ?? 0) >= 0 ? CHART_POSITIVE_COLOR : CHART_NEGATIVE_COLOR,
    }));
}

export function buildCostVsValueChartData(
  holdings: PortfolioHoldingWithPrices[],
  limit = 6,
): CostVsValueChartItem[] {
  return getPricedHoldings(holdings)
    .filter((holding) => holding.type !== "cash")
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
    .slice(0, limit)
    .map((holding) => ({
      id: holding.id,
      label: getHoldingChartLabel(holding),
      cost: holding.costValue,
      current: holding.currentValue ?? 0,
    }));
}

export function getAnalyticsSummary(
  holdings: PortfolioHoldingWithPrices[],
  totals: {
    costValue: number;
    profitLoss: number;
  },
): AnalyticsSummary {
  const priced = getPricedHoldings(holdings);
  const withProfitLoss = priced.filter(
    (holding) => holding.profitLoss !== null && holding.type !== "cash",
  );

  const bestPerformer =
    withProfitLoss.length > 0
      ? withProfitLoss.reduce((best, holding) =>
          (holding.profitLossPercent ?? 0) > (best.profitLossPercent ?? 0)
            ? holding
            : best,
        )
      : null;

  const worstPerformer =
    withProfitLoss.length > 0
      ? withProfitLoss.reduce((worst, holding) =>
          (holding.profitLossPercent ?? 0) < (worst.profitLossPercent ?? 0)
            ? holding
            : worst,
        )
      : null;

  return {
    holdingsCount: priced.length,
    returnPercent:
      totals.costValue > 0 ? (totals.profitLoss / totals.costValue) * 100 : 0,
    winnersCount: withProfitLoss.filter((h) => (h.profitLoss ?? 0) > 0).length,
    losersCount: withProfitLoss.filter((h) => (h.profitLoss ?? 0) < 0).length,
    assetTypeCount: new Set(priced.map((h) => h.type)).size,
    bestPerformer,
    worstPerformer,
  };
}

export function hasAnalyticsData(holdings: PortfolioHoldingWithPrices[]): boolean {
  return getPricedHoldings(holdings).length > 0;
}
