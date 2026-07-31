export type RatingConfidence = "High" | "Medium" | "Low";

export type RatingLabel =
  | "Strong"
  | "Favorable"
  | "Neutral"
  | "Cautious"
  | "Weak";

export type OutlookLevel = "Strong" | "Neutral" | "Weak";

export type FibZoneId =
  | "grey"
  | "dark_green"
  | "green"
  | "yellow"
  | "orange"
  | "red";

export type ConfluenceSignal = "Buy" | "Sell" | "None";
export type ConfluenceStatus = "Green" | "Red" | "Neutral";

export type PeerBasis = "sub_industry" | "industry" | "sector" | "none";

export type CapitalProfile =
  | "industry_peer"
  | "brokerage_capital_markets"
  | "bank_insurance"
  | "reit_utilities"
  | "early_growth";

/** @deprecated Alias of CapitalProfile */
export type BusinessModel = CapitalProfile;

export type MetricScore = {
  id: string;
  label: string;
  value: number | null;
  display: string | null;
  score: number | null;
  skipped: boolean;
  /** Optional peer-relative explanation shown in Fundamental detail. */
  note?: string | null;
};

export type PillarScore = {
  id: "financial_strength" | "profitability" | "growth" | "valuation";
  label: string;
  score: number | null;
  metrics: MetricScore[];
  metricsUsed: number;
  metricsAvailable: number;
};

export type FundamentalPeerContext = {
  basis: PeerBasis;
  /** Human label e.g. "Capital Markets · 10 peers" */
  label: string;
  peerCount: number;
  industryKey: string | null;
  industry: string | null;
  sectorKey: string | null;
  sector: string | null;
};

export type FundamentalResult = {
  available: boolean;
  score: number | null;
  version: "v1.1";
  pillars: PillarScore[];
  outlook: {
    company: OutlookLevel;
    industry: OutlookLevel;
    adjustment: number;
    reason: string;
  };
  classification: {
    /** Capital-structure overlay; most names are industry_peer. */
    businessModel: BusinessModel;
    /** Industry/sector-anchored assessment frame (never "Standard operating"). */
    businessModelLabel: string;
    industry: string | null;
    industryKey: string | null;
    sector: string | null;
    sectorKey: string | null;
  };
  peerContext: FundamentalPeerContext;
  metricsUsed: number;
  metricsExpected: number;
  missingMetrics: string[];
  dataAsOf: string | null;
  notes: string[];
};

export type FibZoneResult = {
  level: number | null;
  ath: number | null;
  price: number | null;
  zone: FibZoneId | null;
  zoneLabel: string | null;
  score: number | null;
};

export type TimeframeConfluence = {
  timeframe: "1D" | "4H";
  available: boolean;
  priceZ: number | null;
  macdZ: number | null;
  status: ConfluenceStatus | null;
  signal: ConfluenceSignal | null;
  score: number | null;
  barsUsed: number;
};

export type TechnicalResult = {
  available: boolean;
  score: number | null;
  fib: FibZoneResult;
  daily: TimeframeConfluence;
  h4: TimeframeConfluence;
  notes: string[];
};

export type RadarAxis = {
  key: string;
  label: string;
  value: number | null;
};

export type InvestSalsaRating = {
  score: number | null;
  label: RatingLabel | null;
  confidence: RatingConfidence;
  weights: { fundamental: number; technical: number };
  fundamental: FundamentalResult;
  technical: TechnicalResult;
  radar: RadarAxis[];
  notes: string[];
};

export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type FundamentalInputs = {
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  ebitda: number | null;
  totalRevenue: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  /** True ROIC when computable; null if not. */
  returnOnInvestedCapital: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fcfGrowth: number | null;
  /** Forward revenue estimate growth (0y/0q) when available. */
  revenueEstimateGrowth: number | null;
  earningsEstimateGrowth: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  enterpriseToEbitda: number | null;
  priceToSales: number | null;
  priceToFcf: number | null;
  pegRatio: number | null;
  marketCap: number | null;
  recommendationKey: string | null;
  sector: string | null;
  sectorKey: string | null;
  industry: string | null;
  industryKey: string | null;
  dataAsOf: string | null;
};

/** Compact peer row used for relative scoring. */
export type PeerMetricRow = {
  symbol: string;
  industryKey: string | null;
  sectorKey: string | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  grossMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  trailingPE: number | null;
  enterpriseToEbitda: number | null;
  priceToSales: number | null;
  priceToFcf: number | null;
  pegRatio: number | null;
};
