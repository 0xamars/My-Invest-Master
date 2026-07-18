/** Theme-aware chart series colors — use with `fill: getChartSeriesColor(n)`. */
export const CHART_SERIES_COUNT = 12;

export function getChartSeriesColor(index: number): string {
  return `var(--chart-series-${(index % CHART_SERIES_COUNT) + 1})`;
}

export const CHART_POSITIVE_COLOR = "var(--chart-positive)";
export const CHART_NEGATIVE_COLOR = "var(--chart-negative)";
export const CHART_COST_COLOR = "var(--chart-cost)";
export const CHART_CURRENT_COLOR = "var(--chart-current)";

export const CHART_TYPE_COLORS = {
  stock: "var(--chart-type-stock)",
  crypto: "var(--chart-type-crypto)",
  cash: "var(--chart-type-cash)",
  custom: "var(--chart-type-custom)",
} as const;

export const CHART_LABEL_COLOR = "var(--chart-label)";
export const CHART_LABEL_MUTED_COLOR = "var(--chart-label-muted)";
export const CHART_LABEL_LINE_COLOR = "var(--chart-label-line)";
export const CHART_AXIS_COLOR = "var(--chart-axis)";
export const CHART_GRID_COLOR = "var(--chart-grid)";
export const CHART_SLICE_STROKE = "var(--chart-slice-stroke)";

/** @deprecated Use getChartSeriesColor — kept for imports migrating gradually */
export const ALLOCATION_COLORS = Array.from({ length: CHART_SERIES_COUNT }, (_, i) =>
  getChartSeriesColor(i),
);
