/**
 * Display helpers for Street Outlook (consensus estimates).
 * Data-only — not a rating score and not wired into Growth/Valuation.
 */
import type {
  EstimateOutlook,
  EstimateRowView,
} from "@/lib/market-data/warehouse/estimate-outlook";

export type { EstimateOutlook, EstimateRowView };

export const EMPTY_ESTIMATE_OUTLOOK: EstimateOutlook = {
  available: false,
  fy1: null,
  fq1: null,
  forwardPe: null,
  impliedRevenueGrowth: null,
  impliedEpsGrowth: null,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asRow(value: unknown): EstimateRowView | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<EstimateRowView>;
  if (typeof r.date !== "string" || !r.date.trim()) return null;
  const revenueAvg = isFiniteNumber(r.revenueAvg) ? r.revenueAvg : null;
  const epsAvg = isFiniteNumber(r.epsAvg) ? r.epsAvg : null;
  if (revenueAvg == null && epsAvg == null) return null;
  return {
    date: r.date.trim().slice(0, 10),
    period: r.period === "annual" || r.period === "quarter" ? r.period : null,
    revenueAvg,
    epsAvg,
    numAnalystsRevenue: isFiniteNumber(r.numAnalystsRevenue)
      ? r.numAnalystsRevenue
      : null,
    numAnalystsEps: isFiniteNumber(r.numAnalystsEps) ? r.numAnalystsEps : null,
  };
}

/** Tolerate missing / older API payloads. */
export function normalizeEstimateOutlook(raw: unknown): EstimateOutlook {
  if (!raw || typeof raw !== "object") return EMPTY_ESTIMATE_OUTLOOK;
  const o = raw as Partial<EstimateOutlook>;
  const fy1 = asRow(o.fy1);
  const fq1 = asRow(o.fq1);
  const available =
    o.available === true || fy1 != null || fq1 != null;
  const epsAvg = fy1?.epsAvg ?? fq1?.epsAvg ?? null;
  let forwardPe = isFiniteNumber(o.forwardPe) ? o.forwardPe : null;
  if (forwardPe != null && (forwardPe <= 0 || epsAvg == null || epsAvg <= 0)) {
    forwardPe = null;
  }
  return {
    available,
    fy1,
    fq1,
    forwardPe,
    impliedRevenueGrowth: isFiniteNumber(o.impliedRevenueGrowth)
      ? o.impliedRevenueGrowth
      : null,
    impliedEpsGrowth: isFiniteNumber(o.impliedEpsGrowth)
      ? o.impliedEpsGrowth
      : null,
  };
}

export function formatFiscalDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatForwardPe(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1)}×`;
}

export function formatGrowthRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatEps(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function formatRevenueUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    const decimals = abs >= 10_000_000 ? 0 : 1;
    return `${sign}$${(abs / 1_000_000).toFixed(decimals)}M`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatAnalystCoverage(row: EstimateRowView | null): string | null {
  if (!row) return null;
  const rev = row.numAnalystsRevenue;
  const eps = row.numAnalystsEps;
  if (rev == null && eps == null) return null;
  if (rev != null && eps != null && rev === eps) {
    return `${rev} analysts`;
  }
  const parts: string[] = [];
  if (rev != null) parts.push(`${rev} on revenue`);
  if (eps != null) parts.push(`${eps} on EPS`);
  return parts.join(" · ");
}

/** EPS growth is only shown when consensus FY1 EPS is positive. */
export function displayEpsGrowth(
  outlook: EstimateOutlook,
): number | null {
  const epsAvg = outlook.fy1?.epsAvg;
  if (epsAvg == null || epsAvg <= 0) return null;
  return outlook.impliedEpsGrowth;
}

/** Plain language only when growth numbers clearly support it. */
export function streetOutlookPlainLine(
  outlook: EstimateOutlook,
): string | null {
  if (!outlook.available || !outlook.fy1) return null;
  const rev = outlook.impliedRevenueGrowth;
  const eps = displayEpsGrowth(outlook);
  const up = 0.02;
  const down = -0.02;

  if (rev != null && eps != null) {
    if (rev > up && eps > up) {
      return "Consensus expects higher revenue and earnings next fiscal year than the trailing run rate.";
    }
    if (rev < down && eps < down) {
      return "Consensus expects lower revenue and earnings next fiscal year than the trailing run rate.";
    }
    if (rev > up && eps < down) {
      return "Consensus expects higher revenue next fiscal year, but lower earnings than the trailing run rate.";
    }
    if (rev < down && eps > up) {
      return "Consensus expects lower revenue next fiscal year, but higher earnings than the trailing run rate.";
    }
  }
  if (rev != null) {
    if (rev > up) {
      return "Consensus expects higher revenue next fiscal year than the trailing run rate.";
    }
    if (rev < down) {
      return "Consensus expects lower revenue next fiscal year than the trailing run rate.";
    }
  }
  if (eps != null) {
    if (eps > up) {
      return "Consensus expects higher earnings next fiscal year than the trailing run rate.";
    }
    if (eps < down) {
      return "Consensus expects lower earnings next fiscal year than the trailing run rate.";
    }
  }
  return null;
}
