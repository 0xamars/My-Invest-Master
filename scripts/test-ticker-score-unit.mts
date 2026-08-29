/**
 * Score: Past + Health + Future. Missing inputs skipped, not failed.
 *   npx tsx --tsconfig tsconfig.json scripts/test-ticker-score-unit.mts
 */
import { assembleTickerSnapshot } from "../src/lib/ticker/assemble.ts";
import { buildBookRows, quoteFromSnapshot } from "../src/lib/ticker/book.ts";
import { TICKER_FRESH_MS, TICKER_STALE_MS } from "../src/lib/ticker/cache.ts";
import { EMPTY_TICKER_BUNDLE } from "../src/lib/ticker/empty-bundle.ts";
import {
  formatTickerCacheAge,
  formatTickerPrice,
  TICKER_UNKNOWN,
} from "../src/lib/ticker/format.ts";
import {
  annualizedGrowth,
  asReturnRatio,
  buildFuturePrint,
  buildTickerScore,
  formatScoreMark,
  isRegulatedHealthVehicle,
  nextYearBurnAtThreeYearTrend,
  scoreAxis,
} from "../src/lib/ticker/score.ts";
import { PRIMARY_NAV_TITLES } from "../src/lib/chrome/nav.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TickerBundle } from "../src/lib/ticker/types.ts";
import type { PortfolioHolding } from "../src/types/portfolio.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const now = 1_700_000_000_000;
const cacheMeta = {
  status: "fresh" as const,
  fromCache: true,
  fmpHit: false,
  fetchedAtMs: now,
  freshUntilMs: now + TICKER_FRESH_MS,
  staleUntilMs: now + TICKER_STALE_MS,
};

function incomeYear(
  year: string,
  extras: Record<string, number> = {},
): Record<string, unknown> {
  return {
    calendarYear: year,
    revenue: extras.revenue ?? 10,
    netIncome: extras.netIncome ?? 4,
    epsdiluted: extras.epsdiluted ?? 1,
    weightedAverageShsOutDil: extras.shares ?? 100,
    operatingIncome: extras.ebit ?? 5,
    interestExpense: extras.interest ?? 0.2,
    ...extras,
  };
}

const emptyScore = buildTickerScore(EMPTY_TICKER_BUNDLE);
assert(
  emptyScore.score.axes.every((axis) => axis.status === "unknown"),
  "empty bundle leaves every axis Unknown",
);
assert(
  formatScoreMark(scoreAxis(emptyScore.score, "past")) === TICKER_UNKNOWN,
  "Past with zero scorable checks prints Unknown",
);
assert(
  formatScoreMark(scoreAxis(emptyScore.score, "future")) === TICKER_UNKNOWN,
  "Future is Unknown when street estimates are missing",
);
assert(
  formatScoreMark(scoreAxis(emptyScore.score, "value")) === TICKER_UNKNOWN,
  "Value stays Unknown this slice",
);
assert(
  formatScoreMark(scoreAxis(emptyScore.score, "dividend")) === TICKER_UNKNOWN,
  "Dividend stays Unknown this slice",
);

const sixYears: TickerBundle = {
  ...EMPTY_TICKER_BUNDLE,
  profile: { companyName: "Example", sector: "Technology", industry: "Software" },
  incomeAnnual: [
    incomeYear("2025", { epsdiluted: 3, revenue: 80, netIncome: 20 }),
    incomeYear("2024", { epsdiluted: 2.2, revenue: 60, netIncome: 14 }),
    incomeYear("2023", { epsdiluted: 1.8, revenue: 50, netIncome: 10 }),
    incomeYear("2022", { epsdiluted: 1.4, revenue: 40, netIncome: 8 }),
    incomeYear("2021", { epsdiluted: 1.1, revenue: 30, netIncome: 6 }),
    incomeYear("2020", { epsdiluted: 1.0, revenue: 24, netIncome: 5 }),
  ],
  incomeGrowth: [
    { growthEPSDiluted: 0.36 },
    { growthEPSDiluted: 0.22 },
    { growthEPSDiluted: 0.29 },
    { growthEPSDiluted: 0.27 },
    { growthEPSDiluted: 0.1 },
  ],
  keyMetricsTtm: { returnOnEquity: 0.25, returnOnCapitalEmployed: 0.22, returnOnAssets: 0.12 },
  keyMetricsAnnual: [
    { returnOnCapitalEmployed: 0.22 },
    { returnOnCapitalEmployed: 0.2 },
    { returnOnCapitalEmployed: 0.18 },
    { returnOnCapitalEmployed: 0.1 },
  ],
  balanceAnnual: [
    {
      calendarYear: "2025",
      cashAndShortTermInvestments: 40,
      totalDebt: 8,
      totalCurrentAssets: 50,
      totalCurrentLiabilities: 20,
      totalNonCurrentLiabilities: 15,
      totalStockholdersEquity: 80,
    },
    {},
    {},
    {},
    {},
    {
      calendarYear: "2020",
      totalDebt: 20,
      totalStockholdersEquity: 40,
    },
  ],
  cashflowAnnual: [
    { calendarYear: "2025", operatingCashFlow: 12, freeCashFlow: 8, stockBasedCompensation: 1 },
  ],
  ratiosTtm: { debtToEquityRatioTTM: 0.1, interestCoverageRatioTTM: 12 },
};

const pastHealth = buildTickerScore(sixYears);
const past = scoreAxis(pastHealth.score, "past")!;
const health = scoreAxis(pastHealth.score, "health")!;
assert(past.status === "scored", "Past scores when checks have inputs");
assert(past.scored === 4, `Past scored all 4 checks, got ${past.scored}`);
assert(past.passed === 4, `Past passed 4 / 4, got ${past.passed}`);
assert(formatScoreMark(past) === "4 / 4", "Past prints n / scored");
assert(health.status === "scored", "Health scores for an industrial");
assert(health.scored === 6, `Health scored 6 industrial checks, got ${health.scored}`);
assert(health.passed === 6, `Health passed 6 / 6, got ${health.passed}`);

const skipRoe: TickerBundle = {
  ...sixYears,
  keyMetricsTtm: { returnOnCapitalEmployed: 0.22 },
};
const skipRoeScore = buildTickerScore(skipRoe);
const skipRoePast = scoreAxis(skipRoeScore.score, "past")!;
const roeCheck = skipRoePast.checks.find((item) => item.id === "roe-20");
assert(roeCheck?.passed === null, "missing ROE is skipped, not failed");
assert(skipRoePast.scored === 3, "Past scored 3 when ROE is missing");
assert(formatScoreMark(skipRoePast) === "3 / 3", "skipped check leaves the denominator");

const failRoe: TickerBundle = {
  ...sixYears,
  keyMetricsTtm: { returnOnEquity: 0.1, returnOnCapitalEmployed: 0.22 },
};
const failRoePast = scoreAxis(buildTickerScore(failRoe).score, "past")!;
assert(failRoePast.passed === 3 && failRoePast.scored === 4, "ROE below 20% fails that check");

assert(asReturnRatio(25) === 0.25, "percent ROE 25 becomes 0.25");
assert(asReturnRatio(0.25) === 0.25, "ratio ROE 0.25 stays 0.25");

const bank: TickerBundle = {
  ...EMPTY_TICKER_BUNDLE,
  profile: { sector: "Financial Services", industry: "Banks—Diversified" },
  balanceAnnual: [
    {
      cashAndShortTermInvestments: 100,
      totalDebt: 10,
      totalCurrentAssets: 200,
      totalCurrentLiabilities: 50,
    },
  ],
};
assert(
  isRegulatedHealthVehicle("Financial Services", "Banks—Diversified"),
  "banks are regulated vehicles",
);
const bankScore = buildTickerScore(bank);
const bankHealth = scoreAxis(bankScore.score, "health")!;
assert(bankHealth.status === "unknown", "bank without deposit/loan fields is Unknown");
assert(bankHealth.scored == null, "bank Health does not reuse industrial checks");
assert(
  bankScore.health.depositField == null && bankScore.health.loanField == null,
  "bank fixture has no deposit or loan fields",
);

const bankWithDeposits: TickerBundle = {
  ...bank,
  balanceAnnual: [{ ...bank.balanceAnnual[0], totalDeposits: 400, netLoan: 250 }],
};
const bankWithDepositsHealth = scoreAxis(buildTickerScore(bankWithDeposits).score, "health")!;
assert(
  bankWithDepositsHealth.status === "unknown",
  "bank with deposits still does not use industrial health checks",
);

const burner: TickerBundle = {
  ...sixYears,
  cashflowAnnual: [
    { calendarYear: "2025", operatingCashFlow: 1, freeCashFlow: -10 },
    { calendarYear: "2024", freeCashFlow: -8 },
    { calendarYear: "2023", freeCashFlow: -6 },
  ],
  balanceAnnual: [
    {
      ...sixYears.balanceAnnual[0],
      cashAndShortTermInvestments: 40,
    },
    {},
    {},
    {},
    {},
    sixYears.balanceAnnual[5]!,
  ],
};
const burnHealth = scoreAxis(buildTickerScore(burner).score, "health")!;
assert(
  burnHealth.checks.some((item) => item.id === "cash-runway-1y"),
  "negative FCF replaces OCF/interest with cash runway",
);
assert(
  !burnHealth.checks.some((item) => item.id === "ocf-vs-debt"),
  "OCF check is not used when trailing FCF is negative",
);
const runway1 = burnHealth.checks.find((item) => item.id === "cash-runway-1y");
assert(runway1?.passed === true, "40 cash covers 10 of one-year burn");
const trendBurn = nextYearBurnAtThreeYearTrend(-10, -8, -6);
assert(trendBurn != null, "three FCF years produce a next-year trend burn");
assert(
  Math.abs((trendBurn as number) - 10 * (1 + (0.25 + 1 / 3) / 2)) < 1e-9,
  "next-year burn is latest |FCF| grown at the 3y |FCF| rate",
);
const runway3 = burnHealth.checks.find((item) => item.id === "cash-runway-3y");
assert(
  runway3?.passed === true,
  "40 cash covers one year of burn at the 3y FCF trend",
);
assert(
  runway3?.inputs.some((item) => item.label === "Next-year burn (3y FCF trend)"),
  "3y runway shows the trend burn, not a three-year FCF sum",
);

const mixedSumBurner: TickerBundle = {
  ...burner,
  cashflowAnnual: [
    { calendarYear: "2025", operatingCashFlow: 1, freeCashFlow: -10 },
    { calendarYear: "2024", freeCashFlow: 20 },
    { calendarYear: "2023", freeCashFlow: -5 },
  ],
  balanceAnnual: [
    { ...burner.balanceAnnual[0], cashAndShortTermInvestments: 1 },
    {},
    {},
    {},
    {},
    burner.balanceAnnual[5]!,
  ],
};
const mixedRunway3 = scoreAxis(buildTickerScore(mixedSumBurner).score, "health")!
  .checks.find((item) => item.id === "cash-runway-3y");
assert(
  mixedRunway3?.passed === false,
  "mixed three-year FCF sum does not auto-pass the 3y runway",
);

const twoYearBurner: TickerBundle = {
  ...burner,
  cashflowAnnual: [
    { calendarYear: "2025", operatingCashFlow: 1, freeCashFlow: -10 },
    { calendarYear: "2024", freeCashFlow: -8 },
  ],
};
const skipRunway3 = scoreAxis(buildTickerScore(twoYearBurner).score, "health")!
  .checks.find((item) => item.id === "cash-runway-3y");
assert(skipRunway3?.passed === null, "missing third FCF year skips 3y runway");
assert(
  nextYearBurnAtThreeYearTrend(-10, -8, null) == null,
  "trend burn is null when a FCF year is missing",
);

const ebitdaOnly: TickerBundle = {
  ...sixYears,
  ratiosTtm: { debtToEquityRatioTTM: 0.1 },
  incomeAnnual: sixYears.incomeAnnual.map((row) => ({
    calendarYear: row.calendarYear,
    revenue: row.revenue,
    netIncome: row.netIncome,
    epsdiluted: row.epsdiluted,
    weightedAverageShsOutDil: row.weightedAverageShsOutDil,
    ebitda: 9,
    interestExpense: 0.2,
  })),
};
const ebitdaOnlyBuilt = buildTickerScore(ebitdaOnly);
assert(ebitdaOnlyBuilt.health.ebit == null, "EBIT does not fall back to EBITDA");
const ebitdaInterest = scoreAxis(ebitdaOnlyBuilt.score, "health")!.checks.find(
  (item) => item.id === "interest-cover",
);
assert(ebitdaInterest?.passed === null, "empty EBIT skips the interest cover check");

const roicOnly: TickerBundle = {
  ...sixYears,
  keyMetricsTtm: { returnOnEquity: 0.25, returnOnInvestedCapital: 0.22, returnOnAssets: 0.12 },
  keyMetricsAnnual: [
    { returnOnInvestedCapital: 0.22 },
    { returnOnInvestedCapital: 0.2 },
    { returnOnInvestedCapital: 0.18 },
    { returnOnInvestedCapital: 0.1 },
  ],
};
const roicOnlyPast = scoreAxis(buildTickerScore(roicOnly).score, "past")!;
const roceCheck = roicOnlyPast.checks.find((item) => item.id === "roce-vs-three-years");
assert(roceCheck?.passed === null, "ROCE does not fall back to ROIC");
assert(buildTickerScore(roicOnly).past.roce == null, "ROIC is not used as ROCE");

const assembled = assembleTickerSnapshot("EX", sixYears, cacheMeta);
assert(assembled.score.axes.length === 5, "snapshot carries five Score axes");
assert(assembled.past.years.length === 6, "Past print keeps the annual years");
assert(assembled.charts.annual.length === 6, "annual statement chart uses income rows");
assert(
  scoreAxis(assembled.score, "future")?.status === "unknown",
  "assembled Future stays Unknown without two forward years",
);

const holding = (partial: Partial<PortfolioHolding> & Pick<PortfolioHolding, "id" | "symbol">): PortfolioHolding => ({
  name: partial.name ?? partial.symbol,
  type: partial.type ?? "stock",
  sector: "Technology",
  category: "Equity",
  subCategory: "Tech",
  costPrice: 10,
  quantity: partial.quantity ?? 1,
  addedAt: "2024-01-01T00:00:00.000Z",
  transactions: [],
  ...partial,
});

const emptyRows = buildBookRows([], {});
assert(emptyRows.length === 0, "empty book has no rows");

const unknownPriceRows = buildBookRows(
  [holding({ id: "1", symbol: "NVDA", quantity: 10 })],
  {},
);
assert(unknownPriceRows[0]?.price === null, "missing cache does not invent a price");
assert(unknownPriceRows[0]?.weight === null, "missing cache does not invent a weight");
assert(unknownPriceRows[0]?.healthMark === TICKER_UNKNOWN, "missing cache Health is Unknown");
assert(formatTickerPrice(null) === TICKER_UNKNOWN, "UI price is Unknown");

const cachedQuote = quoteFromSnapshot("NVDA", assembled, "fresh");
const weighted = buildBookRows(
  [
    holding({ id: "1", symbol: "NVDA", name: "NVIDIA", quantity: 37 }),
    holding({ id: "2", symbol: "MSFT", name: "Microsoft", quantity: 63 }),
  ],
  {
    NVDA: { ...cachedQuote, symbol: "NVDA", price: 10, healthMark: "3 / 6" },
    MSFT: {
      symbol: "MSFT",
      name: "Microsoft",
      price: 10,
      healthMark: "2 / 6",
      fetchedAt: assembled.fetchedAt,
      cacheStatus: "fresh",
    },
  },
);
assert(weighted[0]?.weight === 37, "37% name keeps a 37 weight");
assert(weighted[1]?.weight === 63, "companion weight is 63");

assert(formatTickerCacheAge("not-a-date") === TICKER_UNKNOWN, "bad cache age is Unknown");
assert(PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Freedom", "nav stays three pillars");

const streetYears: TickerBundle = {
  ...sixYears,
  estimates: [
    {
      date: "2027-01-31",
      revenueAvg: 144,
      epsAvg: 4.5,
      netIncomeAvg: 32,
      numAnalystsRevenue: 18,
      numAnalystsEps: 16,
    },
    {
      date: "2026-01-31",
      revenueAvg: 110,
      epsAvg: 3.6,
      netIncomeAvg: 24,
      numAnalystsRevenue: 20,
      numAnalystsEps: 19,
    },
  ],
  earnings: [{ date: "2026-11-18", epsActual: null, epsEstimated: 1.1 }],
  treasury: { date: "2026-08-27", year10: 4.67 },
};

assert(
  Math.abs((annualizedGrowth(80, 144, 2) as number) - (Math.sqrt(144 / 80) - 1)) < 1e-9,
  "FY+2 growth is annualized from latest printed to the second forward year",
);
assert(annualizedGrowth(-5, 2, 2) == null, "loss start does not invent annualized growth");

const streetScore = buildTickerScore(streetYears, { asOf: new Date("2026-08-29T00:00:00.000Z") });
const future = scoreAxis(streetScore.score, "future")!;
assert(streetScore.future.forwardYears === 2, "two street years after 2025 count as forward");
assert(future.status === "scored", "Future scores when two forward years exist");
assert(future.scored === 3, `Future scored 3 checks, got ${future.scored}`);
assert(future.passed === 3, `Future passed 3 / 3, got ${future.passed}`);
assert(formatScoreMark(future) === "3 / 3", "Future prints n / scored");
assert(
  streetScore.future.nextPrintDate === "2026-11-18",
  "next print date uses earnings-company",
);
assert(
  streetScore.future.treasury10y != null &&
    Math.abs(streetScore.future.treasury10y - 0.0467) < 1e-9,
  "Treasury 4.67 is a percent, stored as a ratio",
);
assert(
  future.checks.every((item) =>
    item.inputs.some((field) => /street|treasury|printed|gaap|window/i.test(field.label)),
  ),
  "Future checks print street / Treasury / printed inputs",
);

const oneForward: TickerBundle = {
  ...streetYears,
  estimates: [streetYears.estimates[1]!],
};
const oneForwardAxis = scoreAxis(buildTickerScore(oneForward).score, "future")!;
assert(oneForwardAxis.status === "unknown", "one forward year leaves Future Unknown");
assert(oneForwardAxis.scored == null, "one forward year does not score checks");
assert(
  buildFuturePrint(oneForward).growthWindow === "next-year",
  "one forward year still computes next-year growth",
);

const slowStreet: TickerBundle = {
  ...streetYears,
  estimates: [
    {
      date: "2027-01-31",
      revenueAvg: 88,
      epsAvg: 3.2,
      netIncomeAvg: 22,
      numAnalystsRevenue: 10,
      numAnalystsEps: 10,
    },
    {
      date: "2026-01-31",
      revenueAvg: 84,
      epsAvg: 3.1,
      netIncomeAvg: 21,
      numAnalystsRevenue: 10,
      numAnalystsEps: 10,
    },
  ],
};
const slowFuture = scoreAxis(buildTickerScore(slowStreet).score, "future")!;
assert(slowFuture.passed === 0 && slowFuture.scored === 3, "low street growth fails all three");

const skipTreasury: TickerBundle = { ...streetYears, treasury: null };
const skipTreasuryFuture = scoreAxis(buildTickerScore(skipTreasury).score, "future")!;
const treasuryCheck = skipTreasuryFuture.checks.find(
  (item) => item.id === "street-earnings-vs-treasury",
);
assert(treasuryCheck?.passed === null, "missing Treasury skips the proxy check");
assert(skipTreasuryFuture.scored === 2, "Future scored 2 when Treasury is missing");

const lossTurn: TickerBundle = {
  ...streetYears,
  incomeAnnual: [
    incomeYear("2025", { epsdiluted: -1.2, revenue: 80, netIncome: -6 }),
    ...sixYears.incomeAnnual.slice(1),
  ],
  estimates: [
    {
      date: "2027-01-31",
      revenueAvg: 144,
      epsAvg: 0.4,
      netIncomeAvg: 2,
      numAnalystsRevenue: 8,
      numAnalystsEps: 7,
    },
    {
      date: "2026-01-31",
      revenueAvg: 110,
      epsAvg: -0.2,
      netIncomeAvg: -1,
      numAnalystsRevenue: 8,
      numAnalystsEps: 7,
    },
  ],
};
const lossFuture = scoreAxis(buildTickerScore(lossTurn).score, "future")!;
const earningsCheck = lossFuture.checks.find((item) => item.id === "street-earnings-growth");
assert(earningsCheck?.passed === true, "GAAP loss turning to street profit passes earnings");
assert(
  buildTickerScore(lossTurn).future.earningsGrowth == null,
  "loss start does not invent street earnings growth",
);

const revenueOnlyStreet: TickerBundle = {
  ...streetYears,
  estimates: [
    {
      date: "2027-01-31",
      revenueAvg: 144,
      numAnalystsRevenue: 18,
    },
    {
      date: "2026-01-31",
      revenueAvg: 110,
      numAnalystsRevenue: 20,
    },
  ],
};
const revenueOnlyFuture = scoreAxis(buildTickerScore(revenueOnlyStreet).score, "future")!;
const revenueOnlyEarnings = revenueOnlyFuture.checks.find(
  (item) => item.id === "street-earnings-growth",
);
assert(
  buildTickerScore(revenueOnlyStreet).future.earningsGrowth == null,
  "revenue-only street years leave earnings growth empty",
);
assert(
  buildTickerScore(revenueOnlyStreet).future.lossToProfit === false,
  "latest print is a profit, so loss-to-profit is not true",
);
assert(
  revenueOnlyEarnings?.passed === null,
  "profit with no street EPS or net income skips earnings growth",
);

const lossStaysLoss: TickerBundle = {
  ...streetYears,
  incomeAnnual: [
    incomeYear("2025", { epsdiluted: -1.2, revenue: 80, netIncome: -6 }),
    ...sixYears.incomeAnnual.slice(1),
  ],
  estimates: [
    {
      date: "2027-01-31",
      revenueAvg: 144,
      epsAvg: -0.4,
      netIncomeAvg: -2,
      numAnalystsRevenue: 8,
      numAnalystsEps: 7,
    },
    {
      date: "2026-01-31",
      revenueAvg: 110,
      epsAvg: -0.8,
      netIncomeAvg: -4,
      numAnalystsRevenue: 8,
      numAnalystsEps: 7,
    },
  ],
};
const lossStaysFuture = scoreAxis(buildTickerScore(lossStaysLoss).score, "future")!;
const lossStaysEarnings = lossStaysFuture.checks.find(
  (item) => item.id === "street-earnings-growth",
);
assert(
  buildTickerScore(lossStaysLoss).future.earningsGrowth == null,
  "loss that stays a loss has no annualized earnings growth",
);
assert(
  buildTickerScore(lossStaysLoss).future.lossToProfit === false,
  "loss that stays a loss is not a loss-to-profit turn",
);
assert(
  lossStaysEarnings?.passed === false,
  "loss that stays a loss fails street earnings growth",
);

const noEstimatesAxis = scoreAxis(buildTickerScore(sixYears).score, "future")!;
assert(noEstimatesAxis.status === "unknown", "no annual estimates leave Future Unknown");
assert(
  scoreAxis(buildTickerScore(streetYears).score, "value")?.status === "unknown",
  "Value stays Unknown this slice",
);
assert(
  scoreAxis(buildTickerScore(streetYears).score, "dividend")?.status === "unknown",
  "Dividend stays Unknown this slice",
);

const uiFiles = [
  "src/components/ticker/ticker-score.tsx",
  "src/components/ticker/ticker-read-view.tsx",
  "src/components/ticker/ticker-past-section.tsx",
  "src/components/ticker/ticker-health-section.tsx",
  "src/components/ticker/ticker-future-section.tsx",
  "src/components/invest/invest-home-content.tsx",
  "src/components/invest/invest-book.tsx",
];
const forbidden = [/simply wall/i, /snowflake/i, /\bios\b/i, /\bapple\b/i];
for (const file of uiFiles) {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${file} must not mention ${pattern}`);
  }
}

console.log("ticker score unit tests passed");
