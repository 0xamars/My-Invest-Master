import type { TickerBundle } from "@/lib/ticker/types";

export const EMPTY_TICKER_BUNDLE: TickerBundle = {
  profile: null,
  quote: null,
  incomeAnnual: [],
  incomeQuarter: [],
  balanceAnnual: [],
  cashflowAnnual: [],
  keyMetricsTtm: null,
  keyMetricsAnnual: [],
  ratiosTtm: null,
  incomeGrowth: [],
  growth: null,
  financialScores: null,
  estimates: [],
};
