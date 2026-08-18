import {
  BRAND_GREEN,
  BRAND_GREEN_DEEP,
  BRAND_ORANGE,
  getProjectionAssetColor,
} from "@/lib/portfolio/chart-theme";
import type { MonteCarloPercentileBand } from "@/lib/retirement/monte-carlo";
import { findDepletionYear as findDepletionYearFromRows } from "@/lib/retirement/projections";
import type { RetirementPlanAsset, YearProjection } from "@/types/retirement";

export type ProjectionChartView =
  | "total-closing"
  | "opening-vs-closing"
  | "composition"
  | "appreciation-vs-expenses"
  | "income-vs-spend"
  | "net-change"
  | "post-growth-vs-close";

export const PROJECTION_CHART_VIEWS: {
  id: ProjectionChartView;
  label: string;
}[] = [
  { id: "total-closing", label: "Total (Closing)" },
  { id: "opening-vs-closing", label: "Opening vs Closing" },
  { id: "composition", label: "Composition (Stacked by Asset)" },
  { id: "appreciation-vs-expenses", label: "Appreciation vs Expenses" },
  { id: "income-vs-spend", label: "Income vs Spend" },
  { id: "net-change", label: "Net Change (Close - Open)" },
  { id: "post-growth-vs-close", label: "Post-Growth vs Close" },
];

export interface ProjectionChartRow {
  year: number;
  yearLabel: string;
  openingBalance: number;
  closingBalance: number;
  balanceAfterAppreciation: number;
  assetAppreciation: number;
  lifestyleSpending: number;
  contribution: number;
  income: number;
  portfolioWithdrawal: number;
  netChange: number;
  p10?: number;
  p50?: number;
  p90?: number;
  mcBand?: number;
  [assetKey: string]: number | string | undefined;
}

/** Smallest asset value at bottom of stack, largest on top (uses current portfolio value). */
export function sortAssetsForCompositionStack(
  assets: RetirementPlanAsset[],
): RetirementPlanAsset[] {
  return [...assets].sort((a, b) => {
    const valueA = a.unitPrice * a.quantity;
    const valueB = b.unitPrice * b.quantity;
    if (valueA !== valueB) return valueA - valueB;
    return a.symbol.localeCompare(b.symbol);
  });
}

export function buildProjectionChartData(
  projections: YearProjection[],
  assets: RetirementPlanAsset[],
  percentiles?: MonteCarloPercentileBand[],
): ProjectionChartRow[] {
  const bandByYear = new Map(
    (percentiles ?? []).map((band) => [band.year, band]),
  );

  return projections.map((projection) => {
    const band = bandByYear.get(projection.year);
    const row: ProjectionChartRow = {
      year: projection.year,
      yearLabel: String(projection.year),
      openingBalance: projection.openingBalance,
      closingBalance: projection.closingBalance,
      balanceAfterAppreciation: projection.balanceAfterAppreciation,
      assetAppreciation: projection.assetAppreciation,
      lifestyleSpending:
        projection.lifestyleSpending > 0
          ? -projection.lifestyleSpending
          : 0,
      contribution: projection.contribution,
      income: projection.income,
      portfolioWithdrawal:
        projection.portfolioWithdrawal > 0
          ? -projection.portfolioWithdrawal
          : 0,
      netChange: projection.closingBalance - projection.openingBalance,
    };

    if (band) {
      row.p10 = band.p10;
      row.p50 = band.p50;
      row.p90 = band.p90;
      row.mcBand = Math.max(0, band.p90 - band.p10);
    }

    for (const asset of assets) {
      row[`asset_${asset.id}`] =
        projection.assetBreakdown[asset.id] ?? 0;
    }

    return row;
  });
}

export function buildProjectionChartConfig(
  view: ProjectionChartView,
  assets: RetirementPlanAsset[],
): Record<string, { label: string; color: string }> {
  switch (view) {
    case "total-closing":
      return {
        closingBalance: {
          label: "Closing balance",
          color: BRAND_GREEN,
        },
      };
    case "opening-vs-closing":
      return {
        openingBalance: {
          label: "Opening balance",
          color: BRAND_ORANGE,
        },
        closingBalance: {
          label: "Closing balance",
          color: BRAND_GREEN,
        },
      };
    case "composition": {
      const config: Record<string, { label: string; color: string }> = {};
      for (const asset of assets) {
        config[`asset_${asset.id}`] = {
          label: asset.symbol,
          color: getProjectionAssetColor(asset.id, assets),
        };
      }
      return config;
    }
    case "appreciation-vs-expenses":
      return {
        assetAppreciation: {
          label: "Asset appreciation",
          color: BRAND_GREEN,
        },
        lifestyleSpending: {
          label: "Lifestyle spending",
          color: BRAND_ORANGE,
        },
      };
    case "income-vs-spend":
      return {
        income: {
          label: "Income",
          color: BRAND_GREEN,
        },
        lifestyleSpending: {
          label: "Lifestyle spending",
          color: BRAND_ORANGE,
        },
        portfolioWithdrawal: {
          label: "Portfolio withdrawal",
          color: "var(--brand-red)",
        },
      };
    case "net-change":
      return {
        netChange: {
          label: "Net change",
          color: BRAND_GREEN,
        },
      };
    case "post-growth-vs-close":
      return {
        balanceAfterAppreciation: {
          label: "After appreciation",
          color: BRAND_ORANGE,
        },
        closingBalance: {
          label: "Closing balance",
          color: BRAND_GREEN,
        },
      };
    default:
      return {};
  }
}

export const PROJECTION_RETIREMENT_LINE_COLOR = BRAND_ORANGE;
export const PROJECTION_DEPLETION_LINE_COLOR = "var(--brand-red)";
export const PROJECTION_PRIMARY_LINE = BRAND_GREEN;
export const PROJECTION_SECONDARY_LINE = BRAND_ORANGE;
export const PROJECTION_POSITIVE = BRAND_GREEN;
export const PROJECTION_NEGATIVE = BRAND_ORANGE;
export const PROJECTION_ACCENT_DEEP = BRAND_GREEN_DEEP;

/** First year the portfolio closing balance reaches zero (within projections). */
export function findDepletionYear(
  projections: YearProjection[],
): number | null {
  return findDepletionYearFromRows(projections);
}

function viewValueKeys(
  view: ProjectionChartView,
  assetKeys: string[],
): string[] {
  switch (view) {
    case "total-closing":
      return ["closingBalance"];
    case "opening-vs-closing":
      return ["openingBalance", "closingBalance"];
    case "composition":
      return assetKeys;
    case "appreciation-vs-expenses":
      return ["assetAppreciation", "lifestyleSpending"];
    case "income-vs-spend":
      return ["income", "lifestyleSpending", "portfolioWithdrawal"];
    case "net-change":
      return ["netChange"];
    case "post-growth-vs-close":
      return ["balanceAfterAppreciation", "closingBalance"];
    default:
      return ["closingBalance"];
  }
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function niceCeil(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function niceFloor(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

/** Tight Y-axis range from visible series — avoids excess headroom. */
export function computeProjectionYDomain(
  chartData: ProjectionChartRow[],
  view: ProjectionChartView,
  assetKeys: string[],
): [number, number] {
  if (chartData.length === 0) return [0, 100];

  let min = 0;
  let max = 0;

  for (const row of chartData) {
    if (view === "composition") {
      const total = assetKeys.reduce(
        (sum, key) => sum + Number(row[key] ?? 0),
        0,
      );
      max = Math.max(max, total);
    } else {
      for (const key of viewValueKeys(view, assetKeys)) {
        const value = Number(row[key] ?? 0);
        max = Math.max(max, value);
        min = Math.min(min, value);
      }
      if (view === "total-closing") {
        max = Math.max(max, Number(row.p90 ?? 0), Number(row.p10 ?? 0));
      }
    }
  }

  if (max === 0 && min === 0) return [0, 100];

  const span = Math.max(max - min, max * 0.05, 1);
  const step = niceStep(span / 4);
  const paddedMax = niceCeil(max + span * 0.06, step);
  const paddedMin = min < 0 ? niceFloor(min - span * 0.06, step) : 0;

  return [paddedMin, paddedMax];
}
