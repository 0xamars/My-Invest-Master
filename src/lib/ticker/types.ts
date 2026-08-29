export type TickerCacheStatus = "fresh" | "stale" | "miss";

export type TickerField = {
  label: string;
  value: number | null;
  kind: "money" | "ratio" | "percent" | "shares" | "multiple" | "count";
};

export type TickerStatementYear = {
  fiscalYear: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  cash: number | null;
  totalDebt: number | null;
  equity: number | null;
  totalAssets: number | null;
  sharesOut: number | null;
  sharesDiluted: number | null;
};

export type TickerSnapshot = {
  symbol: string;
  source: "fmp";
  found: boolean;
  fetchedAt: string;
  cache: {
    status: TickerCacheStatus;
    /** True when this response was assembled from cache without calling FMP. */
    fromCache: boolean;
    /** True when this request path called Financial Modeling Prep. */
    fmpHit: boolean;
    freshUntil: string;
    staleUntil: string;
  };
  profile: {
    name: string | null;
    exchange: string | null;
    currency: string | null;
    sector: string | null;
    industry: string | null;
    country: string | null;
    description: string | null;
    ceo: string | null;
    website: string | null;
    ipoDate: string | null;
    employees: number | null;
    isEtf: boolean | null;
    isFund: boolean | null;
  };
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
    marketCap: number | null;
    volume: number | null;
    averageVolume: number | null;
    dayLow: number | null;
    dayHigh: number | null;
    week52Low: number | null;
    week52High: number | null;
    beta: number | null;
  };
  keyMetrics: TickerField[];
  income: TickerField[];
  cashflow: TickerField[];
  balance: TickerField[];
  growth: TickerField[];
  margins: TickerField[];
  shares: TickerField[];
  estimates: TickerField[];
  years: TickerStatementYear[];
};

export type TickerBundle = {
  profile: Record<string, unknown> | null;
  quote: Record<string, unknown> | null;
  incomeAnnual: Record<string, unknown>[];
  balanceAnnual: Record<string, unknown>[];
  cashflowAnnual: Record<string, unknown>[];
  keyMetricsTtm: Record<string, unknown> | null;
  ratiosTtm: Record<string, unknown> | null;
  growth: Record<string, unknown> | null;
  estimates: Record<string, unknown>[];
};

export type TickerCacheEntry = {
  snapshot: TickerSnapshot;
  fetchedAtMs: number;
  freshUntilMs: number;
  staleUntilMs: number;
};
