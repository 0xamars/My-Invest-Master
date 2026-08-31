/**
 * Assess + tape unit tests (no network).
 *   npx tsx --tsconfig tsconfig.json scripts/test-assess-unit.mts
 */
import {
  buildAssessNote,
  buildMoveVerdict,
  buildTapeFromPackage,
} from "../src/lib/invest/assess/index.ts";
import { buildTapeRead } from "../src/lib/invest/assess/tape-read.ts";
import { INVEST_ASSESS_PATH, investAssessPath } from "../src/lib/chrome/nav.ts";
import type { AnalysisPackage } from "../src/lib/market-data/warehouse/types.ts";
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

function emptyPackage(symbol: string): AnalysisPackage {
  return {
    symbol,
    assetType: "stock",
    asOf: new Date().toISOString(),
    degraded: false,
    confidenceNote: null,
    quote: null,
    profile: {
      name: "Test Co",
      sector: "Technology",
      sectorKey: "technology",
      industry: "Software",
      industryKey: "software-application",
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
    ath: 100,
    fundamentals: null,
    recentEvents: [],
    datasetStatus: [],
  };
}

assert(INVEST_ASSESS_PATH === "/invest/assess", "assess path constant");
assert(investAssessPath("msft") === "/invest/assess/MSFT", "assess symbol path");

const pkg = emptyPackage("MSFT");
const tape = buildTapeFromPackage(pkg);
assert(tape.annual.length === 0, "empty package yields empty annual tape");
assert(tape.incomplete === true, "empty tape marked incomplete");

const read = buildTapeRead({
  name: "Microsoft",
  symbol: "MSFT",
  annual: tape.annual,
  isOperatingTape: true,
});
assert(read.includes("no annual fiscal tape"), "empty read is honest");

const rating = buildInvestSalsaRating({
  assetType: "stock",
  price: 100,
  ath: 150,
  fundamentals: null,
  dailyBars: [],
  hourlyBars: [],
});

const note = buildAssessNote({ pkg, rating, tape });
assert(note.call.verdict === "Wait" || note.call.verdict === "Pass", "incomplete data gets cautious call");
assert(note.decision.length > 0, "decision section populated");
assert(note.fundamentals.trendRead.length > 0, "fundamentals trend read exists");

assert(buildMoveVerdict({ owned: false, call: "Buy", portfolioPercent: null }) === "Buy", "non-owner buy");
assert(buildMoveVerdict({ owned: true, call: "Buy", portfolioPercent: 20 }) === "Hold", "concentrated owner hold on buy");

console.log(failed === 0 ? "All assess unit tests passed." : `${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
