/**
 * Early Opp 16-step framework (no network).
 *   npx tsx --tsconfig tsconfig.json scripts/test-early-opp-unit.mts
 */
import { EARLY_OPP_STEPS, EARLY_OPP_STEP_IDS } from "../src/lib/analysis/early-opp/steps.ts";
import { extractEarlyOppFacts } from "../src/lib/analysis/early-opp/facts.ts";
import { earlyOppCountsFromSteps, scoreEarlyOppSteps } from "../src/lib/analysis/early-opp/score.ts";
import { EARLY_OPP_DISCLAIMER } from "../src/lib/analysis/early-opp/format.ts";
import { INVEST_EARLY_OPP_PATH, investEarlyOppPath } from "../src/lib/chrome/nav.ts";
import { PRIMARY_NAV_TITLES } from "../src/lib/chrome/nav.ts";
import type { TickerSnapshot, TickerStatementYear } from "../src/lib/ticker/types.ts";
import type { AnalysisPackage } from "../src/lib/market-data/warehouse/types.ts";
import type { InvestSalsaRating } from "../src/lib/analysis/rating/types.ts";
import { buildInvestSalsaRating } from "../src/lib/analysis/rating/index.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

function year(partial: Partial<TickerStatementYear> & { fiscalYear: string }): TickerStatementYear {
  return {
    revenue: null,
    grossProfit: null,
    operatingIncome: null,
    netIncome: null,
    eps: null,
    operatingCashFlow: null,
    capex: null,
    freeCashFlow: null,
    cash: null,
    totalDebt: null,
    equity: null,
    totalAssets: null,
    sharesOut: null,
    sharesDiluted: null,
    ...partial,
  };
}

function emptySnapshot(symbol: string): TickerSnapshot {
  return {
    symbol,
    source: "fmp",
    found: true,
    fetchedAt: new Date().toISOString(),
    cache: {
      status: "fresh",
      fromCache: true,
      fmpHit: false,
      freshUntil: new Date().toISOString(),
      staleUntil: new Date().toISOString(),
    },
    profile: {
      name: `${symbol} Test`,
      exchange: "NASDAQ",
      currency: "USD",
      sector: "Technology",
      industry: "Semiconductors",
      country: "US",
      description: "Test issuer",
      ceo: null,
      website: null,
      ipoDate: null,
      employees: null,
      isEtf: false,
      isFund: false,
    },
    quote: {
      price: 100,
      change: 1,
      changePercent: 1,
      marketCap: 1e12,
      volume: 1e7,
      averageVolume: 8e6,
      dayLow: 99,
      dayHigh: 101,
      week52Low: 50,
      week52High: 120,
      beta: 1.2,
    },
    keyMetrics: [],
    income: [],
    cashflow: [],
    balance: [],
    growth: [],
    margins: [],
    shares: [],
    estimates: [],
    years: [],
    score: { axes: [] },
    past: {
      years: [],
      revenueStreak: "Unknown",
      netIncomeStreak: "Unknown",
      epsDiluted: null,
      roe: null,
      roce: null,
      roa: null,
      shareCountChange: null,
      stockBasedCompensation: null,
      sbcVsNetIncome: null,
    },
    health: {
      cashAndSti: null,
      totalDebt: null,
      currentAssets: null,
      currentLiabilities: null,
      longTermLiabilities: null,
      debtToEquity: null,
      debtToEquityFiveYearsAgo: null,
      operatingCashFlow: null,
      freeCashFlow: null,
      interestCoverage: null,
      ebit: null,
      interestExpense: null,
      altmanZ: null,
      piotroski: null,
      regulatedVehicle: false,
      depositField: null,
      loanField: null,
    },
    future: {
      years: [],
      forwardYears: 0,
      nextPrintDate: null,
      treasury10y: null,
      treasuryDate: null,
      printedFiscalYear: null,
      printedRevenue: null,
      printedEps: null,
      printedNetIncome: null,
      revenueGrowth: null,
      earningsGrowth: null,
      growthWindow: null,
      lossToProfit: null,
    },
    street: {
      targetHigh: null,
      targetLow: null,
      targetConsensus: null,
      targetMedian: null,
      strongBuy: null,
      buy: null,
      hold: null,
      sell: null,
      strongSell: null,
      consensus: null,
    },
    charts: { annual: [], quarterly: [], trends: [] },
  };
}

function emptyPackage(symbol: string): AnalysisPackage {
  return {
    symbol,
    assetType: "stock",
    asOf: new Date().toISOString(),
    degraded: false,
    confidenceNote: null,
    quote: null,
    profile: {
      name: `${symbol} Test`,
      sector: "Technology",
      sectorKey: "technology",
      industry: "Semiconductors",
      industryKey: "semiconductors",
      country: "US",
      exchange: "NASDAQ",
      currency: "USD",
      description: "Test",
      marketCap: 1e12,
      isEtf: false,
      isFund: false,
      raw: null,
    },
    statements: {
      income: { annual: [], quarter: [], ttm: [] },
      balance: { annual: [], quarter: [], ttm: [] },
      cashflow: { annual: [], quarter: [], ttm: [] },
    },
    ratiosTtm: null,
    ratiosAnnual: [],
    keyMetricsTtm: null,
    keyMetricsAnnual: [],
    financialScores: null,
    enterpriseValues: [],
    ownerEarnings: [],
    growth: [],
    estimates: [],
    estimateOutlook: {
      available: false,
      fy1: null,
      fq1: null,
      forwardPe: null,
      impliedRevenueGrowth: null,
      impliedEpsGrowth: null,
    },
    forecast: {
      available: false,
      ratings: null,
      priceTarget: null,
      estimates: null,
    },
    dcf: null,
    peers: [],
    peerContext: {
      basis: "none",
      label: "No peers",
      peerCount: 0,
      industryKey: null,
      industry: null,
      sectorKey: null,
      sector: null,
    },
    dailyBars: [],
    hourlyBars: [],
    ath: 120,
    fundamentals: null,
    recentEvents: [],
    datasetStatus: [],
  };
}

assert(EARLY_OPP_STEPS.length === 16, "sixteen step definitions");
assert(EARLY_OPP_STEP_IDS.length === 16, "sixteen step ids");
assert(
  EARLY_OPP_STEPS.every((step, index) => step.number === index + 1),
  "steps are numbered 1–16",
);
assert(INVEST_EARLY_OPP_PATH === "/invest/early-opp", "early opp path");
assert(investEarlyOppPath("flnc") === "/invest/early-opp/FLNC", "symbol path");
assert(PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Retire", "nav stays three pillars");
assert(/not personalized investment advice/i.test(EARLY_OPP_DISCLAIMER), "disclaimer is educational");

const emptyFacts = extractEarlyOppFacts({
  snapshot: emptySnapshot("TEST"),
  pkg: emptyPackage("TEST"),
  rating: null,
});
const emptySteps = scoreEarlyOppSteps(emptyFacts, null);
assert(emptySteps.length === 16, "empty facts still return 16 steps");
assert(
  emptySteps.every((step) => step.status === "pass" || step.status === "soft" || step.status === "fail" || step.status === "unknown"),
  "every status is pass/soft/fail/unknown",
);
assert(emptySteps.find((s) => s.id === "know_yourself")?.status === "unknown", "temperament is not scored");
assert(emptySteps.find((s) => s.id === "exit_plan")?.status === "unknown", "exit plan is not scored");
assert(emptySteps.find((s) => s.id === "peg")?.status === "unknown", "missing PEG is unknown, not invented");
assert(
  emptySteps.find((s) => s.id === "peg")?.numbers.every((n) => n.value != null || n.kind === "text") !== false,
  "PEG numbers omit invented values",
);
assert(
  !emptySteps.some((step) => /leftover|ready to assign/i.test(step.explanation)),
  "no leftover bars in early opp copy",
);

const golden: TickerSnapshot = {
  ...emptySnapshot("GOLD"),
  income: [
    { label: "Revenue", value: 120, kind: "money" },
    { label: "Net income", value: 30, kind: "money" },
  ],
  cashflow: [
    { label: "Operating cash flow", value: 40, kind: "money" },
    { label: "Capital expenditure", value: -20, kind: "money" },
    { label: "Free cash flow", value: 20, kind: "money" },
  ],
  growth: [
    { label: "Revenue growth", value: 0.4, kind: "percent" },
    { label: "FCF growth", value: 0.35, kind: "percent" },
  ],
  margins: [
    { label: "Gross margin", value: 0.6, kind: "percent" },
    { label: "Operating margin", value: 0.3, kind: "percent" },
    { label: "FCF margin", value: 0.16, kind: "percent" },
  ],
  keyMetrics: [
    { label: "ROIC", value: 0.22, kind: "percent" },
    { label: "P/E", value: 25, kind: "multiple" },
  ],
  years: [
    year({
      fiscalYear: "2025",
      revenue: 120,
      grossProfit: 72,
      freeCashFlow: 20,
      capex: -20,
      netIncome: 30,
      totalDebt: 10,
      cash: 40,
    }),
    year({
      fiscalYear: "2024",
      revenue: 80,
      grossProfit: 44,
      freeCashFlow: 12,
      capex: -12,
      netIncome: 18,
      totalDebt: 10,
      cash: 30,
    }),
    year({
      fiscalYear: "2023",
      revenue: 55,
      grossProfit: 28,
      freeCashFlow: 8,
      capex: -8,
      netIncome: 10,
    }),
  ],
  street: {
    targetHigh: 140,
    targetLow: 90,
    targetConsensus: 120,
    targetMedian: 118,
    strongBuy: 12,
    buy: 10,
    hold: 4,
    sell: 0,
    strongSell: 0,
    consensus: "Buy",
  },
};

const goldenPkg: AnalysisPackage = {
  ...emptyPackage("GOLD"),
  fundamentals: {
    debtToEquity: 0.2,
    currentRatio: 2,
    quickRatio: 1.5,
    freeCashflow: 20,
    operatingCashflow: 40,
    totalDebt: 10,
    totalCash: 40,
    ebitda: 45,
    totalRevenue: 120,
    bookValue: 50,
    sharesOutstanding: 10,
    grossMargins: 0.6,
    operatingMargins: 0.3,
    profitMargins: 0.25,
    returnOnEquity: 0.3,
    returnOnAssets: 0.15,
    returnOnInvestedCapital: 0.22,
    revenueGrowth: 0.4,
    earningsGrowth: 0.5,
    fcfGrowth: 0.35,
    operatingIncomeGrowth: 0.4,
    revenueGrowth3y: 0.48,
    earningsGrowth3y: 0.5,
    operatingGrowth3y: 0.4,
    revenueEstimateGrowth: null,
    earningsEstimateGrowth: 0.3,
    trailingPE: 25,
    forwardPE: 20,
    enterpriseToEbitda: 18,
    priceToSales: 8,
    priceToFcf: 25,
    pegRatio: 0.7,
    marketCap: 1e12,
    recommendationKey: "buy",
    sector: "Technology",
    sectorKey: "technology",
    industry: "Semiconductors",
    industryKey: "semiconductors",
    dataAsOf: "2025-12-31",
    equityToAssets: 0.6,
    interestCoverage: 20,
    netDebtToEbitda: -0.5,
    debtToEbitda: 0.2,
    cashToDebt: 4,
    cashToShortTermDebt: 8,
    fcfToDebt: 2,
    ocfToDebt: 4,
    debtToRevenue: 0.08,
    fcfStability: 80,
    altmanZScore: 6,
    piotroskiScore: 8,
    beneishMScore: null,
    wacc: 0.09,
    ebit: 36,
    totalAssets: 80,
    workingCapital: 20,
    ebitdaMargin: 0.37,
    fcfMargin: 0.16,
    ocfMargin: 0.33,
    returnOnInvestedCapital3y: 0.2,
    operatingMarginTrend: 0.02,
    grossMarginTrend: 0.01,
    netMarginTrend: 0.01,
    roicTrend: 0.02,
    enterpriseValue: 1.1e12,
    evToFcf: 40,
    evToSales: 9,
    priceToOcf: 20,
    evToEbit: 25,
    fcfYield: 0.02,
    earningsYield: 0.04,
    trailingPeMedian5y: null,
    capitalExpenditure: -20,
    researchAndDevelopment: 10,
    grossProfit: 72,
    grossProfitPrior: 44,
  },
  recentEvents: [
    { type: "insider", summary: "CEO bought shares in the latest FMP insider tape.", date: "2026-01-02" },
  ],
};

const goldenRating = {
  score: 82,
  label: "Strong",
  confidence: "Medium",
  weights: { fundamental: 0.7, technical: 0.3 },
  fundamental: {
    available: true,
    score: 80,
    version: "v1.2",
    pillars: [
      { id: "financial_strength", label: "FS", score: 80, metrics: [], metricsUsed: 4, metricsAvailable: 4 },
      { id: "profitability", label: "P", score: 78, metrics: [], metricsUsed: 4, metricsAvailable: 4 },
      { id: "growth", label: "G", score: 85, metrics: [], metricsUsed: 4, metricsAvailable: 4 },
      { id: "valuation", label: "V", score: 55, metrics: [], metricsUsed: 4, metricsAvailable: 4 },
    ],
    outlook: { company: "Strong", industry: "Strong", adjustment: 0, reason: "" },
    classification: {
      businessModel: "industry_peer",
      businessModelLabel: "Operating company",
      industry: "Semiconductors",
      industryKey: "semiconductors",
      sector: "Technology",
      sectorKey: "technology",
      growthProfile: "reinvesting_growth_compounder",
      growthProfileLabel: "Reinvesting",
      criticalFlags: [],
      reinvestmentSoftWeighting: false,
      fundamentalPeriod: "ttm",
      periodSelectionReason: null,
      ttmSource: "native",
      constructedTtmFields: [],
    },
    peerContext: {
      basis: "none",
      label: "No peers",
      peerCount: 0,
      industryKey: null,
      industry: null,
      sectorKey: null,
      sector: null,
    },
    metricsUsed: 16,
    metricsExpected: 16,
    missingMetrics: [],
    dataAsOf: null,
    notes: [],
    nonOperatingVehicle: null,
  },
  technical: {
    available: true,
    score: 70,
    fib: {
      level: null,
      ath: 120,
      price: 100,
      zone: "green",
      zoneLabel: "Constructive",
      score: 70,
      absoluteScore: 70,
      relative: {
        available: false,
        drawdown: null,
        percentile: null,
        status: null,
        statusLabel: null,
        score: null,
        barsUsed: 0,
        peak: null,
      },
    },
    daily: {
      timeframe: "1D",
      label: "MEDIUM TERM",
      available: true,
      priceZ: null,
      macdZ: null,
      status: "Green",
      heat: "green",
      heatLabel: "NEAR FAIR",
      signal: "None",
      score: 60,
      barsUsed: 20,
    },
    h4: {
      timeframe: "4H",
      label: "NEAR TERM",
      available: false,
      priceZ: null,
      macdZ: null,
      status: null,
      heat: null,
      heatLabel: null,
      signal: null,
      score: null,
      barsUsed: 0,
    },
    weekly: {
      timeframe: "1W",
      label: "LONG TERM",
      available: false,
      priceZ: null,
      macdZ: null,
      status: null,
      heat: null,
      heatLabel: null,
      signal: null,
      score: null,
      barsUsed: 0,
    },
    notes: [],
  },
  radar: [],
  notes: [],
  fairValue: buildInvestSalsaRating({
    assetType: "stock",
    price: 100,
    ath: 120,
    fundamentals: null,
    dailyBars: null,
    hourlyBars: null,
  }).fairValue,
} as InvestSalsaRating;

const goldenFacts = extractEarlyOppFacts({
  snapshot: golden,
  pkg: goldenPkg,
  rating: goldenRating,
});
assert(goldenFacts.pegRatio === 0.7, "PEG comes from loaded fundamentals");
assert(goldenFacts.fcf === 20, "FCF from statements");
assert(goldenFacts.capexRising === true, "CapEx abs rose 12 → 20");
assert(goldenFacts.insiderTone === "buy", "insider buy classified from FMP summary");

const goldenSteps = scoreEarlyOppSteps(goldenFacts, null);
assert(goldenSteps.length === 16, "golden path has 16 steps");
assert(goldenSteps.find((s) => s.id === "financials_fcf")?.status === "pass", "FCF golden passes");
assert(goldenSteps.find((s) => s.id === "follow_the_money")?.status === "pass", "rising CapEx passes follow-the-money");
assert(goldenSteps.find((s) => s.id === "peg")?.status === "pass", "PEG < 1 passes");
assert(goldenSteps.find((s) => s.id === "kill_switches")?.status === "pass", "clean tape passes kill switches");
assert(goldenSteps.find((s) => s.id === "ownership")?.status === "pass", "insider buy passes ownership");
assert(goldenSteps.find((s) => s.id === "s_curve")?.status === "pass", "accelerating revenue passes S-curve");
assert(
  goldenSteps.find((s) => s.id === "peg")?.numbers.some((n) => n.label === "PEG" && n.display.includes("0.70")),
  "PEG number is the loaded 0.7, not invented",
);

const burn: TickerSnapshot = {
  ...emptySnapshot("BURN"),
  cashflow: [
    { label: "Operating cash flow", value: -8, kind: "money" },
    { label: "Free cash flow", value: -12, kind: "money" },
    { label: "Capital expenditure", value: -30, kind: "money" },
  ],
  growth: [{ label: "Revenue growth", value: 0.2, kind: "percent" }],
  margins: [{ label: "Gross margin", value: 0.1, kind: "percent" }],
  years: [
    year({
      fiscalYear: "2025",
      revenue: 50,
      grossProfit: 4,
      freeCashFlow: -12,
      capex: -30,
      totalDebt: 80,
      cash: 5,
    }),
    year({
      fiscalYear: "2024",
      revenue: 40,
      grossProfit: 8,
      freeCashFlow: -4,
      capex: -10,
      totalDebt: 40,
      cash: 8,
    }),
  ],
  past: {
    ...emptySnapshot("BURN").past,
    shareCountChange: 0.2,
  },
};
const burnPkg: AnalysisPackage = {
  ...emptyPackage("BURN"),
  fundamentals: {
    ...(goldenPkg.fundamentals as NonNullable<AnalysisPackage["fundamentals"]>),
    freeCashflow: -12,
    operatingCashflow: -8,
    totalDebt: 80,
    totalCash: 5,
    totalRevenue: 50,
    revenueGrowth: 0.2,
    fcfGrowth: -1,
    pegRatio: 3.2,
    returnOnInvestedCapital: -0.1,
    debtToRevenue: 1.6,
    grossMargins: 0.08,
    fcfMargin: -0.24,
  },
};
const burnFacts = extractEarlyOppFacts({ snapshot: burn, pkg: burnPkg, rating: null });
const burnSteps = scoreEarlyOppSteps(burnFacts, null);
assert(burnSteps.find((s) => s.id === "financials_fcf")?.status === "fail", "negative FCF fails financials");
assert(burnSteps.find((s) => s.id === "kill_switches")?.status === "fail", "burn + leverage fails kill switches");
assert(burnSteps.find((s) => s.id === "peg")?.status === "fail", "PEG 3.2 fails");
assert(burnSteps.find((s) => s.id === "capex_roic")?.status === "fail", "high CapEx + negative ROIC fails");

const withAi = scoreEarlyOppSteps(emptyFacts, {
  secularTheme: "AI accelerators are a multi-year spend wave.",
  secularStatus: "pass",
  sCurveNote: null,
  stackRole: "Sells accelerators into the compute stack.",
  winnerNote: null,
  moatNote: "CUDA-like lock-in is hard to copy in three years.",
  moatCopyTest: "hard_to_copy",
  whyMoving: "Moved with the sector; no unique catalyst in the facts.",
});
assert(withAi.find((s) => s.id === "secular_trend")?.status === "pass", "AI can score secular when present");
assert(withAi.find((s) => s.id === "who_gets_capex")?.source === "hybrid", "stack role is hybrid");
assert(withAi.find((s) => s.id === "moat")?.status === "pass", "copy-test hard_to_copy passes moat");
assert(withAi.find((s) => s.id === "peg")?.status === "unknown", "AI must not invent a PEG");

const counts = earlyOppCountsFromSteps(goldenSteps);
assert(counts.pass + counts.soft + counts.fail + counts.unknown === 16, "counts sum to 16");

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nearly-opp unit ok");
