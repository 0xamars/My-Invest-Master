/**
 * Stock-relative drawdown vs a ticker’s own daily history.
 * Used to score Price Zone without cross-stock absolute-depth bias.
 * Compute from warehouse price_daily closes only — no FMP technical endpoints.
 */
import { clamp, round1 } from "@/lib/analysis/rating/math";
import type {
  RelativeDepthId,
  RelativeDepthResult,
} from "@/lib/analysis/rating/types";

/** Prefer ≥1 trading year before relative scoring. */
export const RELATIVE_DRAWDOWN_MIN_BARS = 252;

/** Look back at most ~5 calendar years from the latest daily bar. */
export const RELATIVE_DRAWDOWN_WINDOW_YEARS = 5;
const RELATIVE_DRAWDOWN_WINDOW_MS =
  RELATIVE_DRAWDOWN_WINDOW_YEARS * 365.25 * 24 * 60 * 60 * 1000;

/** Hybrid mix when relative is available (relative-heavy). */
export const RELATIVE_ZONE_WEIGHT = 0.8;
export const ABSOLUTE_ZONE_WEIGHT = 0.2;

export const RELATIVE_DEPTH_LABELS: Record<RelativeDepthId, string> = {
  deep: "DEEP FOR THIS STOCK",
  deeper: "DEEPER THAN USUAL",
  typical: "TYPICAL",
  shallow: "SHALLOW FOR THIS STOCK",
};

export const RELATIVE_DEPTH_TOOLTIP =
  "Compares today’s pullback to how deep this stock has fallen over about the last 5 years — not vs other stocks.";

/**
 * Last 5 years of daily closes (or full series if shorter), chronological.
 * Non-finite / non-positive closes are dropped.
 */
export function windowClosesForRelativeDrawdown(
  bars: Array<{ time: number; close: number }> | null | undefined,
): number[] {
  const sorted = (bars ?? [])
    .filter(
      (b) =>
        Number.isFinite(b.time) &&
        Number.isFinite(b.close) &&
        b.close > 0,
    )
    .sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];
  const latest = sorted[sorted.length - 1]!.time;
  const cutoff = latest - RELATIVE_DRAWDOWN_WINDOW_MS;
  return sorted.filter((b) => b.time >= cutoff).map((b) => b.close);
}

/**
 * Running-peak daily drawdowns over the 5Y (or shorter) window.
 * dd_t = (peak_t − close_t) / peak_t where peak_t = max(close so far in window).
 * Returns null when window is thinner than minBars (≥252).
 */
export function computeDailyDrawdowns(
  closes: number[],
  minBars = RELATIVE_DRAWDOWN_MIN_BARS,
): { drawdowns: number[]; current: number; peak: number } | null {
  const series = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (series.length < minBars) return null;

  const drawdowns: number[] = [];
  let peak = series[0]!;
  for (const close of series) {
    if (close > peak) peak = close;
    const dd = peak > 0 ? (peak - close) / peak : 0;
    drawdowns.push(clamp(dd, 0, 1));
  }
  const current = drawdowns[drawdowns.length - 1]!;
  return { drawdowns, current, peak };
}

/**
 * Fraction of historical daily drawdowns ≤ current (0–1).
 * Higher = deeper vs this stock’s own past.
 */
export function drawdownPercentile(
  drawdowns: number[],
  current: number,
): number {
  if (drawdowns.length === 0) return 0;
  let le = 0;
  for (const d of drawdowns) {
    if (d <= current) le += 1;
  }
  return le / drawdowns.length;
}

export function relativeScoreFromPercentile(percentile: number): number {
  if (percentile >= 0.9) return 90;
  if (percentile >= 0.75) return 75;
  if (percentile >= 0.5) return 55;
  if (percentile >= 0.25) return 35;
  return 20;
}

export function relativeDepthFromPercentile(
  percentile: number,
): RelativeDepthId {
  if (percentile >= 0.9) return "deep";
  if (percentile >= 0.75) return "deeper";
  if (percentile >= 0.4) return "typical";
  return "shallow";
}

export function computeRelativeDepth(
  bars: Array<{ time: number; close: number }> | null | undefined,
): RelativeDepthResult {
  const empty: RelativeDepthResult = {
    available: false,
    drawdown: null,
    percentile: null,
    status: null,
    statusLabel: null,
    score: null,
    barsUsed: 0,
    peak: null,
  };

  const series = windowClosesForRelativeDrawdown(bars);
  const computed = computeDailyDrawdowns(series);
  if (!computed) {
    return { ...empty, barsUsed: series.length };
  }

  const percentile = drawdownPercentile(computed.drawdowns, computed.current);
  const status = relativeDepthFromPercentile(percentile);
  const score = relativeScoreFromPercentile(percentile);

  return {
    available: true,
    drawdown: round1(computed.current * 1000) / 1000,
    percentile: round1(percentile * 1000) / 1000,
    status,
    statusLabel: RELATIVE_DEPTH_LABELS[status],
    score,
    barsUsed: series.length,
    peak: round1(computed.peak * 100) / 100,
  };
}

/** Final Price Zone component score: relative-heavy hybrid, or absolute only. */
export function blendZoneScore(
  absoluteScore: number | null,
  relative: RelativeDepthResult,
): number | null {
  if (absoluteScore == null) {
    return relative.available ? relative.score : null;
  }
  if (!relative.available || relative.score == null) {
    return absoluteScore;
  }
  return round1(
    RELATIVE_ZONE_WEIGHT * relative.score +
      ABSOLUTE_ZONE_WEIGHT * absoluteScore,
  );
}

export function formatDrawdownPct(drawdown: number | null): string | null {
  if (drawdown == null || !Number.isFinite(drawdown)) return null;
  const pct = Math.round(drawdown * 100);
  if (pct <= 0) return "At peak";
  return `−${pct}% from peak`;
}

export function relativeDepthHint(
  status: RelativeDepthId | null | undefined,
): string | null {
  switch (status) {
    case "deep":
      return "Among the deepest pullbacks this stock has seen";
    case "deeper":
      return "Deeper than usual for this stock’s own history";
    case "typical":
      return "About a normal pullback depth for this stock";
    case "shallow":
      return "Mild vs how far this stock has fallen before";
    default:
      return null;
  }
}
