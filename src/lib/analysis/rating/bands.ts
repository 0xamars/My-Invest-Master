/**
 * InvestSalsa Rating v1 — locked threshold bands.
 * Scores are 0–100. Higher is better (for valuation: cheaper = higher).
 */

export type Band = {
  /** Inclusive upper bound of the metric for this band (ascending metric order). */
  max: number;
  score: number;
};

/** Score ascending metrics where higher raw value is better. */
export function scoreAscending(value: number, bands: Band[]): number {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1]?.score ?? 50;
}

/** Score descending metrics where lower raw value is better (e.g. leverage, multiples). */
export function scoreDescending(value: number, bands: Band[]): number {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1]?.score ?? 50;
}

/** Leverage: Yahoo debtToEquity is percent-like (e.g. 78.4 = 78.4%). */
export const DEBT_TO_EQUITY_BANDS: Band[] = [
  { max: 30, score: 95 },
  { max: 50, score: 85 },
  { max: 80, score: 70 },
  { max: 120, score: 50 },
  { max: 200, score: 30 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

export const CURRENT_RATIO_BANDS: Band[] = [
  { max: 0.8, score: 15 },
  { max: 1.0, score: 35 },
  { max: 1.2, score: 55 },
  { max: 1.5, score: 70 },
  { max: 2.0, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

export const QUICK_RATIO_BANDS: Band[] = [
  { max: 0.6, score: 15 },
  { max: 0.9, score: 35 },
  { max: 1.0, score: 55 },
  { max: 1.3, score: 70 },
  { max: 1.8, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** FCF / operating cash flow — quality of cash conversion. */
export const FCF_QUALITY_BANDS: Band[] = [
  { max: 0, score: 10 },
  { max: 0.35, score: 30 },
  { max: 0.55, score: 50 },
  { max: 0.75, score: 70 },
  { max: 0.9, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Margin bands (decimal, e.g. 0.25 = 25%). */
export const GROSS_MARGIN_BANDS: Band[] = [
  { max: 0.1, score: 10 },
  { max: 0.2, score: 25 },
  { max: 0.3, score: 45 },
  { max: 0.4, score: 65 },
  { max: 0.5, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

export const OPERATING_MARGIN_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.05, score: 25 },
  { max: 0.1, score: 45 },
  { max: 0.15, score: 65 },
  { max: 0.25, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

export const PROFIT_MARGIN_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.03, score: 25 },
  { max: 0.08, score: 45 },
  { max: 0.12, score: 65 },
  { max: 0.2, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** EBITDA margin (decimal). */
export const EBITDA_MARGIN_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.08, score: 25 },
  { max: 0.15, score: 45 },
  { max: 0.22, score: 65 },
  { max: 0.35, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Free-cash-flow / revenue (decimal). */
export const FCF_MARGIN_BANDS: Band[] = [
  { max: -0.05, score: 5 },
  { max: 0, score: 20 },
  { max: 0.04, score: 40 },
  { max: 0.08, score: 55 },
  { max: 0.12, score: 70 },
  { max: 0.2, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Operating-cash-flow / revenue (decimal). */
export const OCF_MARGIN_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.05, score: 25 },
  { max: 0.1, score: 45 },
  { max: 0.15, score: 65 },
  { max: 0.25, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** ROE / ROIC as decimals (1.0 = 100%). */
export const ROE_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.05, score: 25 },
  { max: 0.1, score: 45 },
  { max: 0.15, score: 65 },
  { max: 0.25, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

export const ROIC_BANDS: Band[] = [
  { max: 0, score: 5 },
  { max: 0.04, score: 25 },
  { max: 0.08, score: 45 },
  { max: 0.12, score: 65 },
  { max: 0.18, score: 80 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Growth rates as decimals. */
export const GROWTH_BANDS: Band[] = [
  { max: -0.05, score: 10 },
  { max: 0, score: 25 },
  { max: 0.03, score: 40 },
  { max: 0.08, score: 55 },
  { max: 0.15, score: 70 },
  { max: 0.25, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Valuation multiples — lower is better. */
export const PE_BANDS: Band[] = [
  { max: 10, score: 95 },
  { max: 15, score: 85 },
  { max: 20, score: 70 },
  { max: 30, score: 50 },
  { max: 45, score: 30 },
  { max: Number.POSITIVE_INFINITY, score: 15 },
];

export const EV_EBITDA_BANDS: Band[] = [
  { max: 8, score: 95 },
  { max: 12, score: 80 },
  { max: 18, score: 60 },
  { max: 25, score: 40 },
  { max: 40, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

export const P_FCF_BANDS: Band[] = [
  { max: 10, score: 95 },
  { max: 15, score: 80 },
  { max: 25, score: 60 },
  { max: 35, score: 40 },
  { max: 50, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** EV / Free Cash Flow — lower is better. */
export const EV_FCF_BANDS: Band[] = [
  { max: 12, score: 95 },
  { max: 18, score: 80 },
  { max: 28, score: 60 },
  { max: 40, score: 40 },
  { max: 60, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** Price / Operating Cash Flow — lower is better. */
export const P_OCF_BANDS: Band[] = [
  { max: 8, score: 95 },
  { max: 12, score: 80 },
  { max: 18, score: 60 },
  { max: 28, score: 40 },
  { max: 40, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** EV / Sales — lower is better. */
export const EV_SALES_BANDS: Band[] = [
  { max: 1, score: 95 },
  { max: 2, score: 80 },
  { max: 4, score: 60 },
  { max: 8, score: 40 },
  { max: 15, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** EV / EBIT — lower is better. */
export const EV_EBIT_BANDS: Band[] = [
  { max: 10, score: 95 },
  { max: 15, score: 80 },
  { max: 22, score: 60 },
  { max: 30, score: 40 },
  { max: 45, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

export const P_S_BANDS: Band[] = [
  { max: 1, score: 95 },
  { max: 2, score: 80 },
  { max: 4, score: 60 },
  { max: 8, score: 40 },
  { max: 15, score: 20 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

export const PEG_BANDS: Band[] = [
  { max: 0.8, score: 90 },
  { max: 1.2, score: 75 },
  { max: 2.0, score: 55 },
  { max: 3.0, score: 35 },
  { max: Number.POSITIVE_INFINITY, score: 15 },
];

/** Total debt / revenue — lower is better (critical when EBITDA ≤ 0). */
export const DEBT_TO_REVENUE_BANDS: Band[] = [
  { max: 0.25, score: 95 },
  { max: 0.5, score: 80 },
  { max: 1.0, score: 60 },
  { max: 1.5, score: 40 },
  { max: 2.5, score: 22 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** Total debt / total assets — preferred leverage proxy for treasury holdings. */
export const DEBT_TO_ASSETS_BANDS: Band[] = [
  { max: 0.15, score: 95 },
  { max: 0.25, score: 80 },
  { max: 0.4, score: 60 },
  { max: 0.55, score: 40 },
  { max: 0.7, score: 22 },
  { max: Number.POSITIVE_INFINITY, score: 10 },
];

/** FCF yield (FCF / market cap) — higher is better; only score when FCF > 0. */
export const FCF_YIELD_BANDS: Band[] = [
  { max: 0.01, score: 15 },
  { max: 0.02, score: 30 },
  { max: 0.04, score: 50 },
  { max: 0.06, score: 70 },
  { max: 0.08, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

/** Earnings yield (EPS/price or 1/PE) — higher is better. */
export const EARNINGS_YIELD_BANDS: Band[] = [
  { max: 0.02, score: 15 },
  { max: 0.03, score: 30 },
  { max: 0.05, score: 50 },
  { max: 0.07, score: 70 },
  { max: 0.1, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

export const FIB_ZONE_SCORES = {
  dark_green: 90,
  green: 80,
  grey: 70,
  yellow: 55,
  orange: 35,
  red: 20,
} as const;

/** User-facing price-zone labels (internal ids unchanged). */
export const FIB_ZONE_LABELS = {
  grey: "BLOOD IN THE STREETS!",
  dark_green: "BUY THE FEAR",
  green: "DIP SEASON",
  yellow: "CHOP ZONE",
  orange: "GETTING SPICY",
  red: "FOMO ZONE",
} as const;

export const CONFLUENCE_SCORES = {
  /** Deferred — explicit Buy trade signal scoring not user-facing. */
  buy: 90,
  none_green: 65,
  none_red: 35,
  /** Deferred — explicit Sell trade signal scoring not user-facing. */
  sell: 15,
} as const;

export const OUTLOOK_POINTS = {
  Strong: 5,
  Neutral: 0,
  Weak: -5,
} as const;

export const FUNDAMENTAL_WEIGHT = 0.6;
export const TECHNICAL_WEIGHT = 0.4;

export const TECH_FIB_WEIGHT = 0.4;
export const TECH_4H_WEIGHT = 0.2;
export const TECH_1D_WEIGHT = 0.3;
export const TECH_1W_WEIGHT = 0.1;

export const MACD_FAST = 8;
export const MACD_SLOW = 21;
export const MACD_SIGNAL = 9;
export const MACD_LOOKBACK = 100;
export const MACD_THRESHOLD = 2.0;
