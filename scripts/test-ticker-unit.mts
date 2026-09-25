/**
 * Public-stock ticker read: FMP assembly, unknown gaps, cache windows.
 *   npx tsx --tsconfig tsconfig.json scripts/test-ticker-unit.mts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { formatBookCacheLine } from "../src/lib/ticker/book.ts";
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
  formatBookCacheLine([], { isLoaded: false }) === "Loading prices…",
  "book cache loading is explicit",
);
assert(
  formatBookCacheLine([
    {
      symbol: "VOO",
      name: "Vanguard",
      price: null,
      change: null,
      healthMark: "Unknown",
      fetchedAt: null,
      cacheStatus: "miss",
    },
  ]) === "Prices · cache miss",
  "book cache miss is labeled",
);
assert(
  formatBookCacheLine([
    {
      symbol: "VOO",
      name: "Vanguard",
      price: 500,
      change: 2,
      healthMark: "A",
      fetchedAt: new Date().toISOString(),
      cacheStatus: "stale",
    },
  ])?.includes("stale"),
  "stale book quotes say refreshing",
);

assert(
  !INVEST_LEGACY_REDIRECTS.some((entry) => entry.source === "/analysis/:symbol"),
  "ticker route is not redirected away",
);
assert(
  INVEST_LEGACY_REDIRECTS.some((entry) => entry.source === "/analysis"),
  "analysis hub still folds into Invest",
);
assert(
  PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Retire",
  "nav stays three pillars",
);
assert(
  !PRIMARY_NAV_TITLES.some((title) => /plaid|connect|bank/i.test(title)),
  "Plaid Connect is not a nav pillar",
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
assert(empty.street.targetConsensus == null, "empty street target stays null");
assert(empty.charts.trends.length === 0, "empty trends stay empty");
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
    ...EMPTY_TICKER_BUNDLE,
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
assert(
  nvda.charts.trends.some((point) => point.freeCashFlow === 41_000_000_000),
  "Past trend charts use cached FCF",
);
assert(nvda.street.consensus == null, "missing grades stay Unknown");
assert(nvda.cache.fromCache === true, "cache meta is preserved");
assert(nvda.cache.fmpHit === false, "peek path must not claim an FMP hit");
assert(nvda.score.axes.length === 5, "Score has five axes");
assert(
  nvda.score.axes.find((axis) => axis.key === "future")?.status === "unknown",
  "one forward estimate year leaves Future Unknown",
);
assert(nvda.future.forwardYears === 1, "NVDA fixture has one forward estimate year");
assert(
  nvda.future.years.some((year) => year.eps === 3.1),
  "Future print keeps the street EPS estimate",
);
assert(
  nvda.score.axes.find((axis) => axis.key === "past")?.status === "scored",
  "Past can score from FMP rows",
);

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
  missingEstimates.future.years.length === 0,
  "missing annual estimates leave Future empty",
);
assert(
  missingEstimates.score.axes.find((axis) => axis.key === "future")?.status ===
    "unknown",
  "Future is Unknown when street estimates are missing",
);
assert(
  missingEstimates.score.axes.find((axis) => axis.key === "value")?.status ===
    "unknown",
  "Value stays Unknown",
);
assert(
  missingEstimates.score.axes.find((axis) => axis.key === "dividend")?.status ===
    "unknown",
  "Dividend stays Unknown",
);
assert(
  formatTickerField({
    label: "Estimated EPS",
    value: null,
    kind: "ratio",
  }) === TICKER_UNKNOWN,
  "missing estimate displays Unknown",
);

const leftoverPage = readFileSync(
  join(process.cwd(), "src/components/analysis/analysis-ticker-content.tsx"),
  "utf8",
);
assert(!/Browse Market/.test(leftoverPage), "ticker leftover must not browse Market");
assert(
  !/Open Watchlist|Add to Watchlist/.test(leftoverPage),
  "ticker leftover must not mount Watchlist",
);
assert(
  !/AnalysisCompanyBlurb|company-blurb/.test(leftoverPage),
  "ticker leftover must not mount a generated blurb",
);
const narrativeRoute = readFileSync(
  join(process.cwd(), "src/app/api/analysis/narrative/route.ts"),
  "utf8",
);
assert(
  existsSync(join(process.cwd(), "src/app/api/analysis/narrative/route.ts")),
  "narrative route is restored",
);
assert(
  narrativeRoute.includes("export async function POST"),
  "narrative route accepts POST",
);
assert(
  narrativeRoute.includes("getNarrativeBundle"),
  "narrative route generates from FMP/rating context",
);
assert(
  !existsSync(join(process.cwd(), "src/app/api/analysis/company-blurb/route.ts")),
  "company-blurb route is gone",
);

const tickerView = readFileSync(
  join(process.cwd(), "src/components/ticker/ticker-read-view.tsx"),
  "utf8",
);
assert(tickerView.includes('value="past"'), "ticker has Past tab");
assert(tickerView.includes('value="now"'), "ticker has Now tab");
assert(tickerView.includes('value="future"'), "ticker has Future tab");
assert(!/value="health"/i.test(tickerView), "Health is folded into Now, not a tab");
assert(!/Simply Wall|Snowflake/i.test(tickerView), "ticker UI does not name desk leftovers");
assert(
  !/Browse Market|Open Watchlist|Add to Watchlist/.test(tickerView),
  "ticker page has no Market/Watchlist blurbs",
);
assert(
  tickerView.includes("TickerRatingEngine"),
  "ticker mounts the Rating Engine",
);
assert(
  tickerView.includes("name={profile.name}"),
  "ticker passes FMP name into narrative context",
);
assert(
  tickerView.includes("description={profile.description}"),
  "ticker passes FMP description into narrative context",
);
assert(
  tickerView.indexOf("TickerRatingEngine") < tickerView.indexOf("TickerScoreGraphic"),
  "Rating Engine sits above house Score",
);
assert(
  tickerView.indexOf("TickerScoreGraphic") < tickerView.indexOf("data-ticker-tabs"),
  "Score sits above Past/Now/Future tabs",
);

const ratingEngine = readFileSync(
  join(process.cwd(), "src/components/ticker/ticker-rating-engine.tsx"),
  "utf8",
);
assert(
  ratingEngine.includes("AnalysisRatingSection"),
  "Rating Engine reuses the house rating section",
);
assert(
  ratingEngine.includes("includeNarrative"),
  "Rating Engine enables the Analysis narrative left pane",
);
assert(
  !ratingEngine.includes("includeNarrative={false}"),
  "Rating Engine no longer leaves narrative unshipped",
);
assert(
  ratingEngine.includes("symbol={symbol}"),
  "Rating Engine passes the ticker into narrative context",
);
assert(!/Simply Wall|GuruFocus|YNAB|Snowflake/i.test(ratingEngine), "Rating Engine UI does not name leftovers");

const ratingSection = readFileSync(
  join(process.cwd(), "src/components/analysis/analysis-rating-section.tsx"),
  "utf8",
);
assert(
  ratingSection.includes("AnalysisRatingRadar"),
  "Rating Engine still mounts the spider/radar",
);
assert(
  ratingSection.includes("AnalysisForecastPanel"),
  "Rating Engine still mounts street forecast",
);
assert(
  ratingSection.includes("Profitability"),
  "Rating Engine still names Profitability",
);
assert(
  ratingSection.includes("InvestSalsa Summary"),
  "Rating Engine still mounts the AI summary pane",
);
assert(
  ratingSection.includes("Future opportunities"),
  "Rating Engine still mounts future opportunities",
);
assert(
  ratingSection.includes("Key risks"),
  "Rating Engine still mounts key risks",
);
assert(
  /Generated from FMP and rating context/.test(ratingSection),
  "Summary is labeled generated / not part of the score",
);

const tickerPageFiles = [
  "src/components/ticker/ticker-read-view.tsx",
  "src/components/ticker/ticker-past-section.tsx",
  "src/components/ticker/ticker-now-section.tsx",
  "src/components/ticker/ticker-future-section.tsx",
  "src/components/ticker/ticker-health-section.tsx",
  "src/components/ticker/ticker-score.tsx",
  "src/components/ticker/ticker-rating-engine.tsx",
].map((path) => readFileSync(join(process.cwd(), path), "utf8"));
const tickerPageText = tickerPageFiles.join("\n");
assert(!/Snowflake/i.test(tickerPageText), "ticker files do not name Snowflake");
assert(
  !/Browse Market|Open Watchlist|Add to Watchlist/.test(tickerPageText),
  "ticker files have no Market/Watchlist blurbs",
);
assert(
  !tickerPageFiles[5]!.includes('"value"') ||
    !/const ORDER[\s\S]*"value"/.test(tickerPageFiles[5]!),
  "Value petal is not drawn until inputs exist",
);
assert(
  !/const ORDER[\s\S]*"dividend"/.test(tickerPageFiles[5]!),
  "Dividend petal is not drawn until inputs exist",
);

const street = assembleTickerSnapshot(
  "NVDA",
  {
    ...EMPTY_TICKER_BUNDLE,
    profile: { companyName: "NVIDIA Corporation" },
    quote: { price: 120 },
    priceTarget: {
      targetHigh: 200,
      targetLow: 80,
      targetConsensus: 150,
      targetMedian: 148,
    },
    gradesConsensus: {
      strongBuy: 12,
      buy: 8,
      hold: 3,
      sell: 1,
      strongSell: 0,
      consensus: "Buy",
    },
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
assert(street.street.targetConsensus === 150, "street consensus is FMP");
assert(street.street.consensus === "Buy", "street rating is FMP");
assert(street.street.strongBuy === 12, "street grades are FMP");

console.log("ticker unit tests passed");
