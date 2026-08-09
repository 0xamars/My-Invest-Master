/**
 * Analyst-estimate helpers for the Analysis package.
 * Scoring (Growth blend / Valuation) does not consume these this pass.
 */
import type { JsonRow } from "@/lib/market-data/warehouse/types";

export type EstimatePeriodKind = "annual" | "quarter";

export type EstimateRowView = {
  date: string;
  period: EstimatePeriodKind | null;
  revenueAvg: number | null;
  epsAvg: number | null;
  numAnalystsRevenue: number | null;
  numAnalystsEps: number | null;
};

export type EstimateOutlook = {
  /** True when FY1 and/or FQ1 has revenueAvg and/or epsAvg. */
  available: boolean;
  fy1: EstimateRowView | null;
  fq1: EstimateRowView | null;
  /** price / fy1.epsAvg (or fq1) when epsAvg > 0; else null. */
  forwardPe: number | null;
  impliedRevenueGrowth: number | null;
  impliedEpsGrowth: number | null;
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rowDate(row: JsonRow): string | null {
  const raw = row.date ?? row.fiscalDateEnding ?? row.calendarYear;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}$/.test(s)) return `${s}-12-31`;
  return s.slice(0, 10);
}

function rowPeriod(row: JsonRow): EstimatePeriodKind | null {
  const p = row.__period ?? row.period;
  if (p === "annual" || p === "FY") return "annual";
  if (
    p === "quarter" ||
    p === "Q1" ||
    p === "Q2" ||
    p === "Q3" ||
    p === "Q4"
  ) {
    return "quarter";
  }
  return null;
}

export function toEstimateView(row: JsonRow): EstimateRowView | null {
  if (!row || row.__empty === true) return null;
  const date = rowDate(row);
  if (!date) return null;
  const revenueAvg =
    asNum(row.revenueAvg) ?? asNum(row.estimatedRevenueAvg);
  const epsAvg =
    asNum(row.epsAvg) ??
    asNum(row.estimatedEpsAvg) ??
    asNum(row.estimatedEps);
  if (revenueAvg == null && epsAvg == null) return null;
  return {
    date,
    period: rowPeriod(row),
    revenueAvg,
    epsAvg,
    numAnalystsRevenue: asNum(row.numAnalystsRevenue),
    numAnalystsEps: asNum(row.numAnalystsEps),
  };
}

/** Nearest fiscal period on/after today with revenueAvg and/or epsAvg. */
export function nearestFutureEstimate(
  rows: JsonRow[],
  period?: EstimatePeriodKind,
  asOf = new Date(),
): EstimateRowView | null {
  const today = asOf.toISOString().slice(0, 10);
  const candidates: EstimateRowView[] = [];
  for (const row of rows ?? []) {
    const view = toEstimateView(row);
    if (!view) continue;
    if (period) {
      if (view.period != null && view.period !== period) continue;
      if (view.period == null) continue;
    }
    if (view.date < today) continue;
    candidates.push(view);
  }
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? null;
}

export function computeForwardPe(
  price: number | null | undefined,
  epsAvg: number | null | undefined,
): number | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  if (epsAvg == null || !Number.isFinite(epsAvg) || epsAvg <= 0) return null;
  return price / epsAvg;
}

export function impliedGrowth(
  forward: number | null | undefined,
  trailing: number | null | undefined,
): number | null {
  if (
    forward == null ||
    trailing == null ||
    !Number.isFinite(forward) ||
    !Number.isFinite(trailing) ||
    trailing === 0
  ) {
    return null;
  }
  return (forward - trailing) / Math.abs(trailing);
}

export function buildEstimateOutlook(
  rows: JsonRow[],
  opts?: {
    price?: number | null;
    trailingRevenue?: number | null;
    trailingEps?: number | null;
    asOf?: Date;
  },
): EstimateOutlook {
  const fy1 = nearestFutureEstimate(rows, "annual", opts?.asOf);
  const fq1 = nearestFutureEstimate(rows, "quarter", opts?.asOf);
  const epsAvg = fy1?.epsAvg ?? fq1?.epsAvg ?? null;
  return {
    available: fy1 != null || fq1 != null,
    fy1,
    fq1,
    forwardPe: computeForwardPe(opts?.price ?? null, epsAvg),
    impliedRevenueGrowth: impliedGrowth(
      fy1?.revenueAvg ?? null,
      opts?.trailingRevenue ?? null,
    ),
    impliedEpsGrowth: impliedGrowth(
      fy1?.epsAvg ?? null,
      opts?.trailingEps ?? null,
    ),
  };
}
