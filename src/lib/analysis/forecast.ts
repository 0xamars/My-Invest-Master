/**
 * Street Forecast payload — analyst ratings, price targets, optional estimates.
 * Display-only; not part of the InvestSalsa score. Never invent numbers.
 */
import type { EstimateOutlook } from "@/lib/market-data/warehouse/estimate-outlook";
import type { JsonRow } from "@/lib/market-data/warehouse/types";

export type ForecastRatingKey =
  | "strongBuy"
  | "buy"
  | "hold"
  | "sell"
  | "strongSell";

export type ForecastRatings = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  /** Provider consensus label when present (e.g. Buy / Hold). */
  consensus: string | null;
  total: number;
};

export type ForecastPriceTarget = {
  low: number;
  average: number;
  high: number;
  median: number | null;
  analystsCount: number | null;
  asOf: string | null;
};

export type ForecastEstimatesSummary = {
  period: "annual" | "quarter" | null;
  date: string | null;
  epsAvg: number | null;
  revenueAvg: number | null;
  impliedEpsGrowth: number | null;
  impliedRevenueGrowth: number | null;
  numAnalystsEps: number | null;
  numAnalystsRevenue: number | null;
};

export type AnalysisForecast = {
  available: boolean;
  ratings: ForecastRatings | null;
  priceTarget: ForecastPriceTarget | null;
  estimates: ForecastEstimatesSummary | null;
};

export const EMPTY_FORECAST: AnalysisForecast = {
  available: false,
  ratings: null,
  priceTarget: null,
  estimates: null,
};

export const FORECAST_RATING_ORDER: Array<{
  key: ForecastRatingKey;
  label: string;
}> = [
  { key: "strongBuy", label: "Strong Buy" },
  { key: "buy", label: "Buy" },
  { key: "hold", label: "Hold" },
  { key: "sell", label: "Sell" },
  { key: "strongSell", label: "Strong Sell" },
];

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asCount(value: unknown): number {
  const n = asNum(value);
  if (n == null || n < 0) return 0;
  return Math.round(n);
}

function asPositivePrice(value: unknown): number | null {
  const n = asNum(value);
  if (n == null || n <= 0) return null;
  return n;
}

function rowOf(value: unknown): JsonRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as JsonRow;
  if (r.__empty === true) return null;
  return r;
}

function parseRatings(raw: unknown): ForecastRatings | null {
  const row = rowOf(raw);
  if (!row) return null;
  const strongBuy = asCount(row.strongBuy);
  const buy = asCount(row.buy);
  const hold = asCount(row.hold);
  const sell = asCount(row.sell);
  const strongSell = asCount(row.strongSell);
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total <= 0) return null;
  const consensusRaw =
    typeof row.consensus === "string" ? row.consensus.trim() : "";
  return {
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    consensus: consensusRaw || consensusFromCounts({
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
    }),
    total,
  };
}

function consensusFromCounts(
  counts: Omit<ForecastRatings, "consensus" | "total">,
): string | null {
  const ranked: Array<{ label: string; n: number }> = [
    { label: "Strong Buy", n: counts.strongBuy },
    { label: "Buy", n: counts.buy },
    { label: "Hold", n: counts.hold },
    { label: "Sell", n: counts.sell },
    { label: "Strong Sell", n: counts.strongSell },
  ];
  ranked.sort((a, b) => b.n - a.n);
  return ranked[0] && ranked[0].n > 0 ? ranked[0].label : null;
}

function parsePriceTarget(
  consensus: unknown,
  summary: unknown,
): ForecastPriceTarget | null {
  const c = rowOf(consensus);
  if (!c) return null;
  const low = asPositivePrice(c.targetLow);
  const average = asPositivePrice(c.targetConsensus);
  const high = asPositivePrice(c.targetHigh);
  if (low == null || average == null || high == null) return null;
  if (high < low) return null;
  const median = asPositivePrice(c.targetMedian);
  const s = rowOf(summary);
  const year = s ? asCount(s.lastYearCount) : 0;
  const quarter = s ? asCount(s.lastQuarterCount) : 0;
  const month = s ? asCount(s.lastMonthCount) : 0;
  const analystsCount =
    year > 0 ? year : quarter > 0 ? quarter : month > 0 ? month : null;
  return {
    low,
    average,
    high,
    median,
    analystsCount,
    asOf: null,
  };
}

function parseEstimates(
  outlook: EstimateOutlook | null | undefined,
): ForecastEstimatesSummary | null {
  if (!outlook?.available) return null;
  const row = outlook.fy1 ?? outlook.fq1;
  if (!row) return null;
  if (row.epsAvg == null && row.revenueAvg == null) return null;
  const epsOk = row.epsAvg != null && row.epsAvg > 0;
  return {
    period: row.period,
    date: row.date,
    epsAvg: row.epsAvg,
    revenueAvg: row.revenueAvg,
    impliedEpsGrowth: epsOk ? (outlook.impliedEpsGrowth ?? null) : null,
    impliedRevenueGrowth: outlook.impliedRevenueGrowth,
    numAnalystsEps: row.numAnalystsEps,
    numAnalystsRevenue: row.numAnalystsRevenue,
  };
}

/** Split warehouse street_consensus blob or legacy shapes. */
export function streetParts(raw: unknown): {
  consensus: unknown;
  summary: unknown;
  grades: unknown;
} {
  const row = rowOf(raw);
  if (!row) return { consensus: null, summary: null, grades: null };
  if (row.consensus != null || row.summary != null || row.grades != null) {
    return {
      consensus: row.consensus ?? null,
      summary: row.summary ?? null,
      grades: row.grades ?? null,
    };
  }
  if (row.targetConsensus != null || row.targetHigh != null) {
    return { consensus: row, summary: null, grades: null };
  }
  if (row.strongBuy != null || row.buy != null) {
    return { consensus: null, summary: null, grades: row };
  }
  return { consensus: null, summary: null, grades: null };
}

export function buildAnalysisForecast(input: {
  street?: unknown;
  estimateOutlook?: EstimateOutlook | null;
}): AnalysisForecast {
  const parts = streetParts(input.street);
  const ratings = parseRatings(parts.grades);
  const priceTarget = parsePriceTarget(parts.consensus, parts.summary);
  const estimates = parseEstimates(input.estimateOutlook);
  return {
    available: ratings != null || priceTarget != null || estimates != null,
    ratings,
    priceTarget,
    estimates,
  };
}

/** Tolerate missing / older API payloads. */
export function normalizeForecast(raw: unknown): AnalysisForecast {
  if (!raw || typeof raw !== "object") return EMPTY_FORECAST;
  const o = raw as Partial<AnalysisForecast>;
  const ratings = parseRatings(o.ratings);
  let priceTarget: ForecastPriceTarget | null = null;
  if (o.priceTarget && typeof o.priceTarget === "object") {
    const p = o.priceTarget as Partial<ForecastPriceTarget>;
    const low = asPositivePrice(p.low);
    const average = asPositivePrice(p.average);
    const high = asPositivePrice(p.high);
    if (low != null && average != null && high != null && high >= low) {
      priceTarget = {
        low,
        average,
        high,
        median: asPositivePrice(p.median),
        analystsCount:
          asNum(p.analystsCount) != null && asNum(p.analystsCount)! > 0
            ? Math.round(asNum(p.analystsCount)!)
            : null,
        asOf:
          typeof p.asOf === "string" && p.asOf.trim() ? p.asOf.trim() : null,
      };
    }
  }
  let estimates: ForecastEstimatesSummary | null = null;
  if (o.estimates && typeof o.estimates === "object") {
    const e = o.estimates as Partial<ForecastEstimatesSummary>;
    const epsAvg = asNum(e.epsAvg);
    const revenueAvg = asNum(e.revenueAvg);
    if (epsAvg != null || revenueAvg != null) {
      estimates = {
        period: e.period === "annual" || e.period === "quarter" ? e.period : null,
        date: typeof e.date === "string" ? e.date : null,
        epsAvg,
        revenueAvg,
        impliedEpsGrowth: asNum(e.impliedEpsGrowth),
        impliedRevenueGrowth: asNum(e.impliedRevenueGrowth),
        numAnalystsEps: asNum(e.numAnalystsEps),
        numAnalystsRevenue: asNum(e.numAnalystsRevenue),
      };
    }
  }
  return {
    available:
      o.available === true ||
      ratings != null ||
      priceTarget != null ||
      estimates != null,
    ratings,
    priceTarget,
    estimates,
  };
}

export function targetVsPricePct(
  average: number | null | undefined,
  price: number | null | undefined,
): number | null {
  if (
    average == null ||
    price == null ||
    !Number.isFinite(average) ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }
  return (average - price) / price;
}

/** One-line narrative hint — omit when no real average target. */
export function streetTargetHint(
  forecast: AnalysisForecast | null | undefined,
  price: number | null | undefined,
): {
  average: number;
  vsPricePct: number | null;
} | null {
  const avg = forecast?.priceTarget?.average;
  if (avg == null || avg <= 0) return null;
  return { average: avg, vsPricePct: targetVsPricePct(avg, price) };
}
