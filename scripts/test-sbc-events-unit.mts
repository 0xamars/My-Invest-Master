/**
 * SBC label + investor-event summarizers (no live FMP).
 *   npx tsx --tsconfig tsconfig.json scripts/test-sbc-events-unit.mts
 */
import { sbcBurdenLabel } from "../src/lib/analysis/rating/sbc.ts";
import {
  mergerSearchName,
  summarizeInsiderTrading,
  summarizeMergers,
} from "../src/lib/market-data/warehouse/investor-events.ts";
import {
  coerceSummaryBullets,
  hasInaccurateValuationLanguage,
  isFilingContextBullet,
  isWikiOverview,
  limitFilingBullets,
} from "../src/lib/analysis/narrative/parse.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

assert(sbcBurdenLabel(0.01, false) === "low", "general low SBC");
assert(sbcBurdenLabel(0.05, false) === "normal", "general normal SBC");
assert(sbcBurdenLabel(0.12, false) === "high", "general high SBC");
assert(sbcBurdenLabel(0.09, true) === "normal", "software wider normal");
assert(sbcBurdenLabel(0.22, true) === "high", "software extreme high");
assert(sbcBurdenLabel(null, false) === null, "missing SBC no label");

const now = Date.parse("2026-08-01");
const insider = summarizeInsiderTrading(
  [
    {
      transactionType: "S-Sale",
      transactionDate: "2026-07-10",
      securitiesTransacted: 1000,
    },
    {
      transactionType: "S-Sale",
      transactionDate: "2026-07-12",
      securitiesTransacted: 500,
    },
    {
      transactionType: "P-Purchase",
      transactionDate: "2026-07-15",
      securitiesTransacted: 100,
    },
    {
      transactionType: "M-Exempt",
      transactionDate: "2026-07-16",
      securitiesTransacted: 9_000_000,
    },
    {
      transactionType: "S-Sale",
      transactionDate: "2025-01-01",
      securitiesTransacted: 50,
    },
  ],
  now,
);
assert(insider != null, "insider summary present");
assert(insider?.summary.includes("Net insider selling") === true, "net selling");
assert(insider?.summary.includes("2 open-market sales vs 1 purchases") === true, "counts P/S only");

assert(summarizeInsiderTrading([], now) == null, "empty insiders skipped");

const ma = summarizeMergers(
  [
    {
      symbol: "MSFT",
      companyName: "Microsoft Corporation",
      targetedCompanyName: "Example Co",
      targetedSymbol: "EXCO",
      transactionDate: "2026-03-01",
    },
    {
      symbol: "MSFT",
      targetedCompanyName: "Old Deal Inc",
      transactionDate: "2016-08-31",
    },
    {
      symbol: "AAPL",
      targetedCompanyName: "Wrong Co",
      transactionDate: "2026-04-01",
    },
  ],
  "MSFT",
  now,
);
assert(ma.length === 1, "one recent MSFT deal");
assert(ma[0]?.summary.includes("Example Co") === true, "acquire target name");

assert(mergerSearchName("Tesla, Inc.") === "Tesla", "strip Inc");
assert(mergerSearchName("Microsoft Corporation") === "Microsoft", "strip Corporation");

const bullets = coerceSummaryBullets(
  ["Posture one.", "Working two.", "Weak three.", "Stretched four.", "Watch five."],
  "",
);
assert(bullets.length === 5, "summaryBullets array kept");

const fromPara = coerceSummaryBullets(
  [],
  "Tesla is priced for platforms. Growth cooled. The stock looks expensive. Shares look stretched. Watch deliveries.",
);
assert(fromPara.length >= 4, "paragraph split into bullets");

const filingLimited = limitFilingBullets([
  "Tesla is priced for platforms.",
  "Net insider selling over the last 90 days (2 sales vs 0 purchases).",
  "Insiders have been net sellers this quarter.",
]);
assert(filingLimited.length === 2, "only one filing bullet kept");
assert(
  filingLimited.filter((b) => isFilingContextBullet(b)).length === 1,
  "duplicate filing dropped",
);
assert(
  isFilingContextBullet("Insiders show net open-market selling over the last 90 days."),
  "paraphrased insider bullet still counts",
);

assert(
  isWikiOverview(
    "NVIDIA makes graphics and data-center chips across the U.S., Taiwan, and China.",
  ),
  "wiki bio is rejected",
);
assert(
  !isWikiOverview(
    "Elite margins and a fortress balance sheet, but the stock already prices in a lot of success.",
  ),
  "score header is accepted",
);
assert(
  hasInaccurateValuationLanguage(
    {
      fundamentalOverview: "The stock sits near fair value on forward earnings.",
      pillars: {
        financialStrength: "",
        profitability: "",
        growth: "",
        valuation: "Fairly valued on expected growth.",
      },
      technicalOverview: "",
      technical: { priceZone: "", meanExtension: "" },
      futureOutlook: { opportunities: [], risks: [] },
      summary: "",
      summaryBullets: [],
    },
    "current",
  ),
  "forward precision blocked when basis=current",
);
assert(
  !hasInaccurateValuationLanguage(
    {
      fundamentalOverview: "The stock is rich on today’s earnings.",
      pillars: {
        financialStrength: "",
        profitability: "",
        growth: "",
        valuation: "Full price versus current profits.",
      },
      technicalOverview: "",
      technical: { priceZone: "", meanExtension: "" },
      futureOutlook: { opportunities: [], risks: [] },
      summary: "",
      summaryBullets: [],
    },
    "current",
  ),
  "current-earnings wording allowed",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall sbc/events unit checks passed");
