export const SCORE_AXIS_KEYS = [
  "past",
  "future",
  "health",
  "value",
  "dividend",
] as const;

export type ScoreAxisKey = (typeof SCORE_AXIS_KEYS)[number];

export type ScoreCheckInput = {
  label: string;
  value: string;
};

export type ScoreCheck = {
  id: string;
  label: string;
  /** true/false when every input is present; null means skipped. */
  passed: boolean | null;
  inputs: ScoreCheckInput[];
};

export type ScoreAxis = {
  key: ScoreAxisKey;
  label: string;
  passed: number | null;
  scored: number | null;
  status: "scored" | "unknown";
  checks: ScoreCheck[];
  note: string | null;
};

export type TickerScore = {
  axes: ScoreAxis[];
};

export type PastYearPrint = {
  fiscalYear: string | null;
  revenue: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  sharesDiluted: number | null;
};

export type TickerPastPrint = {
  years: PastYearPrint[];
  revenueStreak: string;
  netIncomeStreak: string;
  epsDiluted: number | null;
  roe: number | null;
  roce: number | null;
  roa: number | null;
  shareCountChange: number | null;
  stockBasedCompensation: number | null;
  sbcVsNetIncome: number | null;
};

export type TickerHealthPrint = {
  cashAndSti: number | null;
  totalDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  longTermLiabilities: number | null;
  debtToEquity: number | null;
  debtToEquityFiveYearsAgo: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  interestCoverage: number | null;
  ebit: number | null;
  interestExpense: number | null;
  altmanZ: number | null;
  piotroski: number | null;
  regulatedVehicle: boolean;
  depositField: number | null;
  loanField: number | null;
};

export type FutureYearPrint = {
  fiscalYear: string | null;
  revenue: number | null;
  eps: number | null;
  netIncome: number | null;
  numberOfAnalysts: number | null;
  analystsRevenue: number | null;
  analystsEps: number | null;
};

export type TickerFuturePrint = {
  years: FutureYearPrint[];
  forwardYears: number;
  nextPrintDate: string | null;
  treasury10y: number | null;
  treasuryDate: string | null;
  printedFiscalYear: string | null;
  printedRevenue: number | null;
  printedEps: number | null;
  printedNetIncome: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  growthWindow: "fy2-annualized" | "next-year" | null;
  lossToProfit: boolean | null;
};

export type TickerChartPoint = {
  period: string;
  revenue: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
};

export type TickerStatementCharts = {
  annual: TickerChartPoint[];
  quarterly: TickerChartPoint[];
};
