/**
 * Forecast payload + FY1 estimate selection (no live FMP).
 *   npx tsx --tsconfig tsconfig.json scripts/test-forecast-unit.mts
 */
import {
  buildAnalysisForecast,
  normalizeForecast,
  streetTargetHint,
  EMPTY_FORECAST,
} from "../src/lib/analysis/forecast.ts";
import {
  nearestFutureEstimate,
  buildEstimateOutlook,
} from "../src/lib/market-data/warehouse/estimate-outlook.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const nvdaStreet = {
  consensus: {
    symbol: "NVDA",
    targetHigh: 500,
    targetLow: 218,
    targetConsensus: 319.48,
    targetMedian: 300,
  },
  summary: {
    symbol: "NVDA",
    lastYearCount: 84,
    lastQuarterCount: 27,
    lastMonthCount: 1,
  },
  grades: {
    symbol: "NVDA",
    strongBuy: 2,
    buy: 58,
    hold: 16,
    sell: 3,
    strongSell: 0,
    consensus: "Buy",
  },
};

const fy1 = nearestFutureEstimate(
  [
    {
      date: "2031-01-25",
      __period: "annual",
      revenueAvg: 1_000_000_000_000,
      epsAvg: 20,
    },
    {
      date: "2027-01-31",
      __period: "annual",
      revenueAvg: 200_000_000_000,
      epsAvg: 5.5,
      numAnalystsEps: 12,
      numAnalystsRevenue: 21,
    },
    {
      date: "2026-01-25",
      __period: "annual",
      revenueAvg: 130_000_000_000,
      epsAvg: 3.0,
    },
  ],
  "annual",
  new Date("2026-08-09"),
);
assert(fy1?.date === "2027-01-31", "FY1 is nearest future year not 2031");
assert(fy1?.epsAvg === 5.5, "FY1 eps from nearest row");

const outlook = buildEstimateOutlook(
  [
    {
      date: "2027-01-31",
      __period: "annual",
      revenueAvg: 200_000_000_000,
      epsAvg: 5.5,
      numAnalystsEps: 12,
      numAnalystsRevenue: 21,
    },
    {
      date: "2026-10-31",
      __period: "quarter",
      revenueAvg: 50_000_000_000,
      epsAvg: 1.2,
    },
  ],
  {
    price: 180,
    trailingRevenue: 160_000_000_000,
    trailingEps: 4.0,
    asOf: new Date("2026-08-09"),
  },
);
assert(outlook.available === true, "outlook available");
assert(outlook.forwardPe != null && Math.abs(outlook.forwardPe - 180 / 5.5) < 0.01, "fwd PE from FY1 EPS>0");

const nvda = buildAnalysisForecast({ street: nvdaStreet, estimateOutlook: outlook });
assert(nvda.available === true, "NVDA forecast available");
assert(nvda.ratings?.consensus === "Buy", "NVDA ratings consensus");
assert(nvda.ratings?.buy === 58 && nvda.ratings?.total === 79, "NVDA rating counts");
assert(nvda.priceTarget?.average === 319.48, "NVDA avg target");
assert(nvda.priceTarget?.low === 218 && nvda.priceTarget?.high === 500, "NVDA high/low");
assert(nvda.priceTarget?.analystsCount === 84, "NVDA last-year analyst count");
assert(nvda.estimates?.epsAvg === 5.5, "NVDA FY1 EPS in estimates");
assert(streetTargetHint(nvda, 180)?.vsPricePct != null, "street vs price pct");

const ibit = buildAnalysisForecast({
  street: null,
  estimateOutlook: {
    available: false,
    fy1: null,
    fq1: null,
    forwardPe: null,
    impliedRevenueGrowth: null,
    impliedEpsGrowth: null,
  },
});
assert(ibit.available === false, "IBIT empty");
assert(ibit.ratings == null && ibit.priceTarget == null, "IBIT no invented numbers");
assert(normalizeForecast(null).available === false, "normalize null");
assert(EMPTY_FORECAST.available === false, "empty constant");

const ratingsOnly = buildAnalysisForecast({
  street: { grades: nvdaStreet.grades },
});
assert(ratingsOnly.available && ratingsOnly.ratings != null && ratingsOnly.priceTarget == null, "ratings-only");

const targetsOnly = buildAnalysisForecast({
  street: { consensus: nvdaStreet.consensus, summary: nvdaStreet.summary },
});
assert(targetsOnly.available && targetsOnly.priceTarget != null && targetsOnly.ratings == null, "targets-only");

const inverted = buildAnalysisForecast({
  street: {
    consensus: { targetHigh: 10, targetLow: 50, targetConsensus: 30 },
  },
});
assert(inverted.priceTarget == null, "inverted high<low dropped");

const lossEps = buildEstimateOutlook(
  [{ date: "2027-12-31", __period: "annual", epsAvg: -1.2, revenueAvg: 10 }],
  { price: 20, trailingEps: 1, asOf: new Date("2026-08-09") },
);
assert(lossEps.forwardPe == null, "no forward PE when FY1 EPS ≤ 0");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall forecast unit checks passed");
