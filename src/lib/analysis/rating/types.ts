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

/** Shared Technical heat band (Price zone + Momentum). */
export type TechHeatId =
  | "dark_green"
  | "green"
  | "teal"
  | "yellow"
  | "orange"
  | "red";

export type PeerBasis = "sub_industry" | "industry" | "sector" | "none";

export type CapitalProfile =
  | "industry_peer"
  | "brokerage_capital_markets"
  | "bank_insurance"
  | "reit_utilities"
  | "early_growth"
  | "treasury_holding";

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

export type GrowthBusinessProfile =
  | "reinvesting_growth_compounder"
  | "cash_compounder"
  | "cyclical_mixed"
  | "low_quality_fragile";

export type FundamentalResult = {
  available: boolean;
  score: number | null;
  version: "v1.2";
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
    /** Growth/disruption opportunity profile (drives soft-weighting policy). */
    growthProfile: GrowthBusinessProfile;
    growthProfileLabel: string;
    /** Critical red flags that force strict scoring. */
    criticalFlags: string[];
    /** Whether reinvestment soft-weighting was applied to FCF/cash penalties. */
    reinvestmentSoftWeighting: boolean;
    /** Shared Fundamental Period used by all pillars. */
    fundamentalPeriod: "ttm" | "annual" | "quarter" | null;
    /** Why that period was selected. */
    periodSelectionReason: string | null;
    /** native | constructed | hybrid | unavailable */
    ttmSource: "native" | "constructed" | "hybrid" | "unavailable" | null;
    /** Key fields constructed into TTM from quarters (when applicable). */
    constructedTtmFields: string[];
  };
  peerContext: FundamentalPeerContext;
  metricsUsed: number;
  metricsExpected: number;
  missingMetrics: string[];
  dataAsOf: string | null;
  notes: string[];
  /**
   * Present when the symbol is an ETF/fund/trust vehicle.
   * Corporate FS/Profitability/Growth/Valuation are not scored.
   */
  nonOperatingVehicle: {
    kind: "etf" | "fund" | "trust" | "closed_end_fund";
    label: string;
    reason: string;
    message: string;
    meta: {
      name: string | null;
      category: string | null;
      provider: string | null;
    };
  } | null;
};

export type FibZoneResult = {
  level: number | null;
  ath: number | null;
  price: number | null;
  zone: FibZoneId | null;
  zoneLabel: string | null;
  /**
   * Score used in Technical aggregate.
   * Relative-heavy hybrid when history allows; else absolute zone score.
   */
  score: number | null;
  /** Absolute ATH→$0 zone score (label/color story). */
  absoluteScore: number | null;
  /** Stock-relative drawdown depth vs own daily history. */
  relative: RelativeDepthResult;
};

/** Relative drawdown depth vs this ticker’s own past (not vs peers). */
export type RelativeDepthId = "deep" | "deeper" | "typical" | "shallow";

export type RelativeDepthResult = {
  available: boolean;
  /** Current drawdown from running peak (0–1). */
  drawdown: number | null;
  /** Fraction of historical daily drawdowns ≤ current (0–1). Internal. */
  percentile: number | null;
  status: RelativeDepthId | null;
  statusLabel: string | null;
  score: number | null;
  barsUsed: number;
  /** Running peak used for current drawdown (within the 5Y window). */
  peak: number | null;
};

export type TimeframeConfluence = {
  timeframe: "1D" | "4H" | "1W";
  /** User-facing horizon label (NEAR / MEDIUM / LONG TERM). */
  label: "NEAR TERM" | "MEDIUM TERM" | "LONG TERM";
  available: boolean;
  priceZ: number | null;
  macdZ: number | null;
  /**
   * Legacy coarse status kept for compatibility.
   * Prefer `heat` / `heatLabel` for UI and scoring.
   */
  status: ConfluenceStatus | null;
  /** Shared layer band from priceZ (same palette as Price zone). */
  heat: TechHeatId | null;
  /** Path-agnostic layer label (FAR BELOW … FAR ABOVE) — no Z jargon. */
  heatLabel: string | null;
  signal: ConfluenceSignal | null;
  score: number | null;
  barsUsed: number;
};

export type TechnicalResult = {
  available: boolean;
  score: number | null;
  fib: FibZoneResult;
  /** MEDIUM TERM — daily bars */
  daily: TimeframeConfluence;
  /** NEAR TERM — 4H aggregated from hourly */
  h4: TimeframeConfluence;
  /** LONG TERM — weekly aggregated from daily */
  weekly: TimeframeConfluence;
  notes: string[];
};

export type RadarAxis = {
  key: string;
  label: string;
  value: number | null;
};

export type FairValueLabel =
  | "Undervalued"
  | "Fairly valued"
  | "Overvalued"
  | "Expensive today, strong growth potential"
  | "Cheap, but business quality is weak";

export type OptionalityLabel = "Low" | "Medium" | "High";

export type FairValueScenario = {
  id: "base" | "upside" | "disruptive";
  label: string;
  value: number | null;
  active: boolean;
  rationale: string | null;
};

export type GrowthOptionalityResult = {
  score: number | null;
  label: OptionalityLabel | null;
  reasons: string[];
  /** Machine-readable reason codes for UI */
  reasonCodes: string[];
};

export type FairValueResult = {
  available: boolean;
  version: "v1" | "v1.1" | "v1.2";
  label: FairValueLabel | null;
  takeaway: string | null;
  confidence: RatingConfidence;
  price: number | null;
  scenarios: {
    base: number | null;
    upside: number | null;
    disruptive: number | null;
  };
  range: {
    low: number | null;
    mid: number | null;
    high: number | null;
  };
  bands: {
    plus30: number | null;
    plus10: number | null;
    fairLow: number | null;
    fairHigh: number | null;
    minus10: number | null;
    minus30: number | null;
  };
  upsidePctVsBase: number | null;
  downsidePctVsBase: number | null;
  upsidePctVsMid: number | null;
  optionality: GrowthOptionalityResult;
  inputsUsed: string[];
  missingInputs: string[];
  notes: string[];
  disruptiveEnabled: boolean;
  disruptiveDisabledReason: string | null;
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
  /**
   * Dormant Fair Value module — always unavailable in product surface.
   * Kept for type compatibility; Analysis UI must not render it.
   */
  fairValue: FairValueResult;
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
  /** Same-period operating income / EBIT growth when available from growth package. */
  operatingIncomeGrowth: number | null;
  /**
   * True geometric ~3Y CAGR from annual series (≥4 points, both ends > 0).
   * Null when not reliably computable — never filled with avg-YoY / capped fallbacks.
   */
  revenueGrowth3y: number | null;
  earningsGrowth3y: number | null;
  operatingGrowth3y: number | null;
  /** Forward revenue estimate growth — often unavailable; never invent. */
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
  /** Financial Strength v1.2 inputs */
  equityToAssets: number | null;
  interestCoverage: number | null;
  netDebtToEbitda: number | null;
  debtToEbitda: number | null;
  cashToDebt: number | null;
  cashToShortTermDebt: number | null;
  fcfToDebt: number | null;
  /** OCF / total debt when debt > 0. */
  ocfToDebt: number | null;
  /** Total debt / revenue — leverage when EBITDA is weak or negative. */
  debtToRevenue: number | null;
  /** 0–100 stability proxy from multi-year FCF */
  fcfStability: number | null;
  altmanZScore: number | null;
  piotroskiScore: number | null;
  beneishMScore: number | null;
  wacc: number | null;
  ebit: number | null;
  totalAssets: number | null;
  workingCapital: number | null;
  /** Profitability v1.2 inputs */
  ebitdaMargin: number | null;
  fcfMargin: number | null;
  ocfMargin: number | null;
  /**
   * Whether OCF/FCF margins are reliable for this business type.
   * Financial intermediaries often have distorted operating cash flow.
   */
  cashFlowReliable?: boolean | null;
  /** Explainability when cash metrics are down-weighted/skipped. */
  cashFlowNote?: string | null;
  /**
   * True when same-period statement margins failed coherence checks or
   * critical income/cash fields are missing — score with reduced confidence.
   */
  statementMarginsDegraded?: boolean | null;
  /** Deterministic quality / mapping notes for details UI. */
  statementQualityNotes?: string[];
  /** Average ROIC over up to 3 annual periods when computable */
  returnOnInvestedCapital3y: number | null;
  /** Absolute change in operating margin over ~2–3 years (latest − older) */
  operatingMarginTrend: number | null;
  grossMarginTrend: number | null;
  netMarginTrend: number | null;
  /** Absolute change in ROIC over ~2–3 years (latest − older) */
  roicTrend: number | null;
  /** Valuation v1.2 inputs */
  enterpriseValue: number | null;
  evToFcf: number | null;
  evToSales: number | null;
  priceToOcf: number | null;
  evToEbit: number | null;
  /** FCF / market cap when FCF > 0 and market cap > 0. */
  fcfYield: number | null;
  /** Earnings yield (1/PE or EPS/price) when positive earnings. */
  earningsYield: number | null;
  /** Median trailing P/E over ~5y when available (for vs-own-history) */
  trailingPeMedian5y: number | null;
  /** Reinvestment proxies for Growth Optionality */
  capitalExpenditure: number | null;
  researchAndDevelopment: number | null;
  grossProfit: number | null;
  /** Prior-year gross profit for expansion signal */
  grossProfitPrior: number | null;
  dataSource?: "fmp" | "yahoo" | null;
  /**
   * Shared Fundamental Period for ALL pillars in one Analysis run.
   * TTM if complete enough → annual → quarter last resort. Never mixed.
   */
  statementPeriod?: "ttm" | "quarter" | "annual" | null;
  /** Alias of statementPeriod — preferred name in UI/docs. */
  fundamentalPeriod?: "ttm" | "quarter" | "annual" | null;
  /** Why this Fundamental Period was chosen. */
  periodSelectionReason?: string | null;
  /** Same-period policy explainability for details. */
  periodSourceNote?: string | null;
  /** Non-scoring trend/warning notes from other periods. */
  periodTrendNotes?: string[];
  /** Completeness ratio (0–1) of the selected period core checklist. */
  periodCompleteness?: number | null;
  /** How TTM statements were obtained when period is TTM. */
  ttmSource?: "native" | "constructed" | "hybrid" | "unavailable" | null;
  /** Fields built into constructed/hybrid TTM from quarterly statements. */
  constructedTtmFields?: string[];
  /** Explainability note for how growth rates were sourced. */
  growthSourceNote?: string | null;
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
  returnOnInvestedCapital: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  trailingPE: number | null;
  enterpriseToEbitda: number | null;
  priceToSales: number | null;
  priceToFcf: number | null;
  pegRatio: number | null;
};
