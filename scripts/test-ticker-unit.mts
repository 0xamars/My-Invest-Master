/**
 * Public-stock ticker read: FMP assembly, unknown gaps, cache windows.
 *   npx tsx --tsconfig tsconfig.json scripts/test-ticker-unit.mts
 */
import { assembleTickerSnapshot } from "../src/lib/ticker/assemble.ts";
import {
  TICKER_FRESH_MS,
  TICKER_STALE_MS,
  cacheWindows,
  classifyCacheAge,
} from "../src/lib/ticker/cache.ts";
import { EMPTY_TICKER_BUNDLE } from "../src/lib/ticker/empty-bundle.ts";
import {
  formatTickerField,
  formatTickerPrice,
  TICKER_UNKNOWN,
} from "../src/lib/ticker/format.ts";
import { investTickerPath, normalizeTickerSymbol } from "../src/lib/ticker/symbol.ts";
import { INVEST_LEGACY_REDIRECTS } from "../src/lib/invest/legacy-redirects.ts";
import {
  INVEST_CHILD_NAV,
  PRIMARY_NAV_TITLES,
} from "../src/lib/chrome/nav.ts";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(normalizeTickerSymbol("nvda") === "NVDA", "normalizes ticker case");
assert(normalizeTickerSymbol(" BRK.B ") === "BRK.B", "allows dotted tickers");
assert(normalizeTickerSymbol("not a ticker!!") === null, "rejects junk");
assert(normalizeTickerSymbol("") === null, "rejects empty");
assert(investTickerPath("nvda") === "/analysis/NVDA", "path is analysis symbol");

assert(
  !INVEST_LEGACY_REDIRECTS.some((entry) => entry.source === "/analysis/:symbol"),
  "ticker route is not redirected away",
);
assert(
  INVEST_LEGACY_REDIRECTS.some((entry) => entry.source === "/analysis"),
  "analysis hub still folds into Invest",
);
assert(
  PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Freedom",
  "nav stays three pillars",
);
assert(
  !INVEST_CHILD_NAV.some((item) => item.href === "/analysis"),
  "Analysis is not an Invest child product",
);

const now = 1_700_000_000_000;
assert(classifyCacheAge(now, now + 1_000) === "fresh", "seconds-old is fresh");
assert(
  classifyCacheAge(now, now + TICKER_FRESH_MS + 1) === "stale",
  "past fresh window is stale",
);
assert(
  classifyCacheAge(now, now + TICKER_STALE_MS + 1) === "miss",
  "past stale window is a miss",
);
const windows = cacheWindows(now);
assert(windows.freshUntilMs - now === TICKER_FRESH_MS, "fresh window");
assert(windows.staleUntilMs - now === TICKER_STALE_MS, "stale window");

const empty = assembleTickerSnapshot("ZZZZ", EMPTY_TICKER_BUNDLE, {
  status: "miss",
  fromCache: false,
  fmpHit: true,
  fetchedAtMs: now,
  freshUntilMs: now + TICKER_FRESH_MS,
  staleUntilMs: now + TICKER_STALE_MS,
});
assert(empty.found === false, "empty FMP bundle is not found");
assert(empty.source === "fmp", "source is FMP only");
assert(empty.quote.price === null, "missing price stays null");
assert(empty.profile.description === null, "missing profile stays null");
assert(
  empty.keyMetrics.every((field) => field.value === null),
  "key metrics are unknown without FMP rows",
);
assert(
  empty.estimates.every((field) => field.value === null),
  "estimates are unknown without FMP rows",
);
assert(
  formatTickerField(empty.keyMetrics[0]!) === TICKER_UNKNOWN,
  "UI prints Unknown, not a invented figure",
);
assert(formatTickerPrice(null) === TICKER_UNKNOWN, "missing price is Unknown");

const nvda = assembleTickerSnapshot(
  "NVDA",
  {
    profile: {
      companyName: "NVIDIA Corporation",
      sector: "Technology",
      industry: "Semiconductors",
      country: "US",
      description: "Designs GPUs.",
      ceo: "Jensen Huang",
      exchangeShortName: "NASDAQ",
      currency: "USD",
      beta: 1.7,
      isEtf: false,
    },
    quote: {
      name: "NVIDIA Corporation",
      price: 120.5,
      change: 2.1,
      changesPercentage: 1.77,
      marketCap: 3_000_000_000_000,
      currency: "USD",
    },
    incomeAnnual: [
      {
        calendarYear: "2025",
        revenue: 100_000_000_000,
        grossProfit: 70_000_000_000,
        operatingIncome: 50_000_000_000,
        netIncome: 40_000_000_000,
        eps: 2.5,
        weightedAverageShsOut: 24_000_000_000,
      },
      {
        calendarYear: "2024",
        revenue: 60_000_000_000,
        netIncome: 20_000_000_000,
        weightedAverageShsOut: 24_600_000_000,
      },
    ],
    balanceAnnual: [
      {
        calendarYear: "2025",
        cashAndCashEquivalents: 30_000_000_000,
        totalDebt: 10_000_000_000,
        totalStockholdersEquity: 80_000_000_000,
        totalAssets: 120_000_000_000,
      },
    ],
    cashflowAnnual: [
      {
        calendarYear: "2025",
        operatingCashFlow: 45_000_000_000,
        capitalExpenditure: -4_000_000_000,
        freeCashFlow: 41_000_000_000,
        commonStockRepurchased: -8_000_000_000,
      },
    ],
    keyMetricsTtm: {
      peRatio: 45.2,
      pbRatio: 35.1,
      roe: 0.88,
    },
    ratiosTtm: {
      grossProfitMargin: 0.7,
      operatingProfitMargin: 0.5,
      netProfitMargin: 0.4,
    },
    growth: {
      revenueGrowth: 0.66,
      netIncomeGrowth: 1.0,
    },
    estimates: [
      {
        date: "2099-01-31",
        estimatedRevenueAvg: 130_000_000_000,
        estimatedEpsAvg: 3.1,
        numberAnalystEstimatedRevenue: 42,
      },
    ],
  },
  {
    status: "fresh",
    fromCache: true,
    fmpHit: false,
    fetchedAtMs: now,
    freshUntilMs: now + TICKER_FRESH_MS,
    staleUntilMs: now + TICKER_STALE_MS,
  },
);

assert(nvda.found, "profile+quote means found");
assert(nvda.profile.name === "NVIDIA Corporation", "uses FMP company name");
assert(nvda.quote.price === 120.5, "uses FMP price");
assert(nvda.quote.marketCap === 3_000_000_000_000, "uses FMP market cap");
assert(
  nvda.income.find((item) => item.label === "Revenue")?.value === 100_000_000_000,
  "income revenue is FMP",
);
assert(
  nvda.cashflow.find((item) => item.label === "Free cash flow")?.value ===
    41_000_000_000,
  "FCF is FMP",
);
assert(
  nvda.balance.find((item) => item.label === "Total debt")?.value ===
    10_000_000_000,
  "debt is FMP",
);
assert(
  nvda.margins.find((item) => item.label === "Gross margin")?.value === 0.7,
  "gross margin prefers FMP ratio",
);
assert(
  nvda.growth.find((item) => item.label === "Revenue growth")?.value === 0.66,
  "growth prefers FMP growth row",
);
assert(
  nvda.shares.find((item) => item.label === "Shares outstanding")?.value ===
    24_000_000_000,
  "share count is FMP",
);
const shareYoy = nvda.shares.find((item) => item.label === "Share count YoY")?.value;
assert(
  shareYoy != null && Math.abs(shareYoy - (24_000_000_000 - 24_600_000_000) / 24_600_000_000) < 1e-9,
  "share YoY is computed only from two FMP share counts",
);
assert(
  nvda.estimates.find((item) => item.label === "Estimated EPS")?.value === 3.1,
  "estimates use FMP analyst row",
);
assert(nvda.years[0]?.fiscalYear === "2025", "annual highlights keep FMP years");
assert(nvda.cache.fromCache === true, "cache meta is preserved");
assert(nvda.cache.fmpHit === false, "peek path must not claim an FMP hit");

const missingEstimates = assembleTickerSnapshot(
  "XYZ",
  {
    ...EMPTY_TICKER_BUNDLE,
    profile: { companyName: "Example" },
    quote: { price: 10 },
  },
  {
    status: "fresh",
    fromCache: false,
    fmpHit: true,
    fetchedAtMs: now,
    freshUntilMs: now + TICKER_FRESH_MS,
    staleUntilMs: now + TICKER_STALE_MS,
  },
);
assert(
  missingEstimates.estimates.every((field) => field.value === null),
  "no fake estimates when FMP omits them",
);
assert(
  formatTickerField({
    label: "Estimated EPS",
    value: null,
    kind: "ratio",
  }) === TICKER_UNKNOWN,
  "missing estimate displays Unknown",
);

console.log("ticker unit tests passed");
