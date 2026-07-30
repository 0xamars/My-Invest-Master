/** Theme-aware chart series colors — use with `fill: getChartSeriesColor(n)`. */
export const CHART_SERIES_COUNT = 12;

export function getChartSeriesColor(index: number): string {
  return `var(--chart-series-${(index % CHART_SERIES_COUNT) + 1})`;
}

/** Golden-angle stepping for additional hues beyond the base series palette. */
const GOLDEN_ANGLE = 137.508;

/**
 * Distinct series colors for projection charts — theme-aware for the first 12 assets,
 * then evenly spaced OKLCH hues for additional assets.
 */
export function getProjectionSeriesColor(index: number): string {
  if (index < CHART_SERIES_COUNT) {
    return getChartSeriesColor(index);
  }

  const extension = index - CHART_SERIES_COUNT;
  const band = Math.floor(extension / CHART_SERIES_COUNT);
  const hue = (GOLDEN_ANGLE * (index + 1)) % 360;
  const lightness = band % 2 === 0 ? 0.66 : 0.58;
  const chroma = 0.1 + (extension % 4) * 0.012;

  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

/** Stable color index per asset (symbol order, then id). */
export function getProjectionAssetColorIndex(
  assetId: string,
  assets: Array<{ id: string; symbol: string }>,
): number {
  const sorted = [...assets].sort(
    (a, b) => a.symbol.localeCompare(b.symbol) || a.id.localeCompare(b.id),
  );
  const index = sorted.findIndex((asset) => asset.id === assetId);
  return index >= 0 ? index : 0;
}

export function getProjectionAssetColor(
  assetId: string,
  assets: Array<{ id: string; symbol: string }>,
): string {
  return getProjectionSeriesColor(getProjectionAssetColorIndex(assetId, assets));
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

/** InvestSalsa brand palette for retirement projection charts */
export const BRAND_GREEN = "var(--brand-green)";
export const BRAND_GREEN_DEEP = "var(--brand-green-deep)";
export const BRAND_ORANGE = "var(--brand-orange)";

/** @deprecated Use getChartSeriesColor — kept for imports migrating gradually */
export const ALLOCATION_COLORS = Array.from({ length: CHART_SERIES_COUNT }, (_, i) =>
  getChartSeriesColor(i),
);
