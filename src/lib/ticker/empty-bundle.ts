import type { TickerBundle } from "@/lib/ticker/types";

export const EMPTY_TICKER_BUNDLE: TickerBundle = {
  profile: null,
  quote: null,
  incomeAnnual: [],
  balanceAnnual: [],
  cashflowAnnual: [],
  keyMetricsTtm: null,
  ratiosTtm: null,
  growth: null,
  estimates: [],
};
