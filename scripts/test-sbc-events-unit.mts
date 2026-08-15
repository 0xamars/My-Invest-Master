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
  hasBannedProfitWording,
  hasInaccurateValuationLanguage,
  hasSoftenedLosses,
  isFilingContextBullet,
  isOutlookShallow,
  isWikiOverview,
  limitFilingBullets,
  parseNarrativeBundle,
  stripUnhookedSectorGenericItems,
} from "../src/lib/analysis/narrative/parse.ts";
import { inferCopyLanguage } from "../src/lib/analysis/narrative/context.ts";
import { AI_FEATURES, getNarrativeTimeoutMs, resolveAiFeature } from "../src/lib/ai/config.ts";
import { buildFallbackOutlook, fillMissingOutlookThemes } from "../src/lib/analysis/narrative/outlook-fallback.ts";
import {
  inferOutlookBusinessType,
  outlookHasForeignProducts,
  stripForeignOutlookItems,
} from "../src/lib/analysis/narrative/outlook-lock.ts";

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
  !isWikiOverview(
    "Strong margins and a fortress balance sheet, but the stock already looks expensive.",
  ),
  "strong-margins header is accepted",
);
assert(
  !isWikiOverview(
    "Still unprofitable at the operating line, with a stretched balance sheet.",
  ),
  "unprofitable header is accepted",
);

const thickBundle = {
  fundamentalOverview: "Thick profits and a fortress balance sheet.",
  pillars: {
    financialStrength: "",
    profitability: "",
    growth: "",
    valuation: "",
  },
  technicalOverview: "",
  technical: { priceZone: "", meanExtension: "" },
  futureOutlook: { opportunities: [], risks: [] },
  summary: "Thin margins keep the story fragile.",
  summaryBullets: ["Thin profits after a fast ramp."],
};
assert(hasBannedProfitWording(thickBundle), "thick/thin in Summary/header is banned");
assert(
  !hasBannedProfitWording({
    ...thickBundle,
    fundamentalOverview: "Strong margins and cash conversion, but the stock looks expensive.",
    summary: "Growth is very fast and the balance sheet is fortress-like.",
    summaryBullets: ["High margins and cash conversion support the quality case."],
  }),
  "plain strong-margin wording is allowed",
);
assert(
  hasSoftenedLosses(
    {
      ...thickBundle,
      fundamentalOverview: "Margin pressure remains, but growth is still interesting.",
      summary: "The stock already prices expected growth.",
      summaryBullets: ["Margin pressure is the watch item."],
    },
    { earnings: "unprofitable" },
  ),
  "unprofitable names cannot hide behind margin pressure",
);
assert(
  !hasSoftenedLosses(
    {
      ...thickBundle,
      fundamentalOverview: "Still unprofitable at the operating line.",
      summary: "Operating losses continue while the balance sheet is stretched.",
      summaryBullets: ["Not yet profitable; cash-flow is still negative."],
    },
    { earnings: "unprofitable" },
  ),
  "clear unprofitable wording is accepted",
);
assert(
  !hasSoftenedLosses(
    {
      ...thickBundle,
      fundamentalOverview: "Strong margins, but the stock looks expensive.",
      summary: "Cash conversion is high.",
      summaryBullets: ["Growth is very fast."],
    },
    { earnings: "profitable" },
  ),
  "profitable names are not forced to say unprofitable",
);

assert(
  inferCopyLanguage({ capitalOverlay: "treasury_holding" }).earnings === "treasury_marks",
  "treasury overlay is not labeled unprofitable",
);
assert(
  inferCopyLanguage({
    profitability: {
      id: "profitability",
      label: "Profitability",
      score: 18,
      metricsUsed: 1,
      metricsAvailable: 1,
      metrics: [
        {
          id: "operating_margin",
          label: "Operating margin",
          value: -0.22,
          display: "-22%",
          score: 8,
          skipped: false,
        },
      ],
    },
  }).earnings === "unprofitable",
  "negative operating margin is unprofitable",
);
const pltrCopy = inferCopyLanguage({
  profitability: {
    id: "profitability",
    label: "Profitability",
    score: 88,
    metricsUsed: 2,
    metricsAvailable: 2,
    metrics: [
      {
        id: "operating_margin",
        label: "Operating margin",
        value: 0.28,
        display: "28%",
        score: 90,
        skipped: false,
      },
      {
        id: "fcf_margin",
        label: "FCF margin",
        value: 0.31,
        display: "31%",
        score: 92,
        skipped: false,
      },
    ],
  },
  growth: {
    id: "growth",
    label: "Growth",
    score: 86,
    metricsUsed: 0,
    metricsAvailable: 0,
    metrics: [],
  },
  financialStrength: {
    id: "financial_strength",
    label: "Financial strength",
    score: 84,
    metricsUsed: 0,
    metricsAvailable: 0,
    metrics: [],
  },
  valuation: {
    id: "valuation",
    label: "Valuation",
    score: 22,
    metricsUsed: 0,
    metricsAvailable: 0,
    metrics: [],
  },
});
assert(pltrCopy.earnings === "profitable", "positive operating margin is profitable");
assert(pltrCopy.margins === "strong", "high operating margin is strong");
assert(pltrCopy.cash === "converting", "positive FCF is converting");
assert(pltrCopy.growth === "elite", "high growth score is elite");
assert(pltrCopy.balanceSheet === "fortress", "high FS score is fortress");
assert(pltrCopy.valuationConstraint === "expensive", "low valuation score is expensive");
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

const parsedOutlook = parseNarrativeBundle(
  JSON.stringify({
    fundamentalOverview: "Elite margins, but the stock looks expensive.",
    pillars: {
      financialStrength: "Balance sheet looks sturdy.",
      profitability: "Profits are strong.",
      growth: "Growth is still solid.",
      valuation: "Rich on today’s earnings.",
    },
    technicalOverview: "Shares look stretched.",
    technical: { priceZone: "Stretched.", meanExtension: "Above average." },
    summary: "Tesla is priced for platforms. Growth cooled. The stock looks expensive. Shares look stretched. Watch deliveries.",
    summaryBullets: [
      "Tesla is priced for platforms.",
      "Energy mix is working.",
      "The stock looks expensive.",
      "Shares look stretched.",
      "Watch deliveries.",
    ],
    futureOutlook: {
      opportunities: [
        { title: "Energy storage", body: "Deployments are scaling. That can offset uneven car demand. Timing is uncertain." },
        "Autonomy: Robotaxi remains speculative. If it works, software-like economics could follow.",
        { title: "FSD software annuity", body: "Paid driver-assist on the existing fleet is the high-margin path if retention holds." },
        { title: "Robotics", body: "Humanoid / Optimus programs are unproven. Treat them as extra upside, not current earnings." },
      ],
      risks: [
        { title: "Price war", body: "Discounting lifts volume but cuts cash. Rivals can force the same cuts." },
        { title: "China demand", body: "A slowdown in the two largest EV markets hits volume first." },
        { title: "Execution", body: "If autonomy slips, spend looks like a drag. That re-rates the stock." },
        { title: "Valuation", body: "Optimism is already in the price. Misses compress the multiple." },
      ],
    },
  }),
);
assert(parsedOutlook != null, "outlook json parses");
assert(parsedOutlook!.futureOutlook.opportunities.length === 4, "four opportunities");
assert(parsedOutlook!.futureOutlook.opportunities[0]?.title === "Energy storage", "object title");
assert(parsedOutlook!.futureOutlook.opportunities[1]?.title === "Autonomy", "string Title: body");
assert(
  !isOutlookShallow(parsedOutlook!, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
  }),
  "titled TSLA-style outlook is not shallow",
);
assert(
  !isOutlookShallow(parsedOutlook!, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
    packageFacts: [
      { display: "-7.2%" },
      { display: "8.1%" },
      { display: "-2.40B" },
    ],
  }),
  "research-style outlook is not shallow just because package ratios exist",
);

const dumpBundle = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "FSD software", body: "Paid FSD could lift operating margin 4.2% after revenue growth -2.9%." },
      { title: "Robotaxi", body: "FY1 revenue growth 2.4% is not the robotaxi story. Status unknown in this package." },
      { title: "Energy storage", body: "Gross margin 18.9% so storage must earn its keep. Not in this package." },
      { title: "Optimus", body: "Humanoid is an early option. Operating status is not in this package." },
    ],
    risks: [
      { title: "Capex", body: "Free cash flow 5.76B can still be absorbed. Dollar capex is not in this package." },
      { title: "Multiple", body: "P/E 180x is tied to unproven cash. Revenue growth -2.9%." },
      { title: "Rivals", body: "Price cuts hit gross margin 18.9%." },
      { title: "Margins", body: "Operating margin 4.2% is thin. Net margin 3.7%." },
    ],
  },
};
assert(
  isOutlookShallow(dumpBundle, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
  }),
  "ratio laundry list / package-unknown refrain is shallow",
);

const anchoredBundle = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "FSD software annuity", body: "Paid driver-assist on a base already in the millions is the high-margin path if retention holds." },
      { title: "Robotaxi and Cybercab", body: "Unsupervised rides are the re-rate path if unit economics work at scale." },
      { title: "Energy storage", body: "Storage demand is structural if project margins hold below the prior peak." },
      { title: "Optimus", body: "Humanoid robotics is an early option, not current earnings." },
    ],
    risks: [
      { title: "Capex regime", body: "Latest-quarter free cash flow went negative as the build cycle stayed elevated." },
      { title: "Valuation", body: "The multiple is tied to unproven autonomy cash flows." },
      { title: "Competition", body: "Rivals, NHTSA reviews, and city permits can delay unsupervised driving." },
      { title: "Dilution", body: "Share-count expansion from stock awards shrinks the slice of any future win." },
    ],
  },
};
assert(
  !isOutlookShallow(anchoredBundle, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
  }),
  "one public narrative anchor per some bullets is not a dump",
);

const tslaFb = buildFallbackOutlook({
  symbol: "TSLA",
  name: "Tesla, Inc.",
  industry: "Auto Manufacturers",
  description: "Tesla designs electric vehicles and energy generation and storage systems.",
});
assert(tslaFb.opportunities.length >= 2 && tslaFb.opportunities.length <= 5, "fallback 2–5 opps");
assert(tslaFb.risks.length >= 2 && tslaFb.risks.length <= 5, "fallback 2–5 risks");
assert(tslaFb.opportunities.every((o) => o.title && o.body), "fallback titled");
assert(tslaFb.opportunities.some((o) => /energy|storage/i.test(`${o.title} ${o.body}`)), "fallback energy");
assert(tslaFb.opportunities.some((o) => /autonom|robotaxi|cybercab/i.test(`${o.title} ${o.body}`)), "fallback autonomy");
assert(tslaFb.opportunities.some((o) => /fsd|software annuity|paid driver/i.test(`${o.title} ${o.body}`)), "fallback FSD");
assert(tslaFb.opportunities.some((o) => /humanoid|optimus/i.test(`${o.title} ${o.body}`)), "fallback Optimus");
assert(tslaFb.risks.some((o) => /capex|cash/i.test(`${o.title} ${o.body}`)), "fallback capex risk");
assert(tslaFb.risks.some((o) => /dilut|share count/i.test(`${o.title} ${o.body}`)), "fallback dilution");
assert(
  !tslaFb.opportunities.some((o) => /price target|fair value/i.test(`${o.title} ${o.body}`)),
  "fallback no target/FV",
);
assert(
  !/lorem ipsum|not in this package|growth opportunities/i.test(
    [...tslaFb.opportunities, ...tslaFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "fallback not lorem or package-unknown",
);

const filled = fillMissingOutlookThemes(
  {
    opportunities: [
      { title: "Paid FSD software attach", body: "Attach would lift operating margin 4.2% if take rates rise." },
      { title: "Robotaxi and Cybercab bet", body: "City counts are unknown here." },
      { title: "Energy storage scale-up", body: "Gross margin 18.9% so storage must earn its keep." },
      { title: "Cheaper next vehicle platforms", body: "Revenue growth of -2.9% shows volume is soft." },
      { title: "Modest sales rebound path", body: "FY1 consensus of 2.4% is only a small bounce." },
    ],
    risks: [
      { title: "Capex", body: "FCF 5.76B can still be absorbed by spend." },
      { title: "Multiple", body: "Tied to unproven cash flows." },
      { title: "Rivals", body: "Price cuts hit gross margin 18.9%." },
      { title: "Margins", body: "Operating margin 4.2% is thin." },
    ],
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    industry: "Auto Manufacturers",
    description: "Tesla designs electric vehicles and energy generation and storage systems.",
  },
);
assert(
  filled.opportunities.some((o) => /humanoid|optimus/i.test(`${o.title} ${o.body}`)),
  "fill splices humanoid when missing",
);
assert(
  filled.opportunities.some((o) => /robotaxi|cybercab/i.test(`${o.title} ${o.body}`)),
  "fill keeps robotaxi",
);
assert(filled.opportunities.length >= 4 && filled.opportunities.length <= 5, "fill stays within 5");

const ondasId = {
  symbol: "ONDS",
  name: "Ondas Holdings",
  industry: "Communication Equipment",
  description:
    "Ondas Holdings provides private wireless, industrial radios, and drone systems for rail and critical infrastructure.",
};
assert(inferOutlookBusinessType(ondasId) === "early_hardware", "ONDS is early hardware");
assert(
  inferOutlookBusinessType({
    description: "unmanned aerial vehicles and drone services",
    industry: "Communication Equipment",
  }) !== "ev_energy",
  "aerial vehicles are not auto EV",
);
const ondasContam = {
  opportunities: [
    { title: "FSD software", body: "Paid FSD could lift margins if attach holds." },
    { title: "Private radios", body: "Rail radios can scale if standards stick." },
    { title: "Robotaxi network", body: "Cybercab is the re-rate path." },
    { title: "Drone fleets", body: "Orders convert if customers take delivery." },
  ],
  risks: [
    { title: "Optimus option", body: "Humanoid robots are early." },
    { title: "Cash burn", body: "Hardware ramps burn cash before scale." },
    { title: "Order lumpiness", body: "A few contracts make the year." },
    { title: "Dilution", body: "Funding expands the share count." },
  ],
};
assert(outlookHasForeignProducts(ondasContam, ondasId), "ONDS FSD/robotaxi is foreign");
const ondasClean = stripForeignOutlookItems(ondasContam, ondasId);
assert(
  !ondasClean.opportunities.some((o) => /fsd|robotaxi|cybercab/i.test(`${o.title} ${o.body}`)),
  "strip removes Tesla products from ONDS",
);
assert(
  ondasClean.opportunities.some((o) => /radio/i.test(`${o.title} ${o.body}`)),
  "strip keeps Ondas radios",
);
const ondasFb = buildFallbackOutlook(ondasId);
assert(
  !/fsd|robotaxi|cybercab|optimus|megapack/i.test(
    [...ondasFb.opportunities, ...ondasFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "ONDS fallback has no Tesla products",
);
assert(ondasFb.opportunities.some((o) => /radio|drone|wireless|order/i.test(`${o.title} ${o.body}`)), "ONDS fallback hardware themes");
assert(
  ondasFb.risks.some((o) => /fcc|faa/i.test(`${o.title} ${o.body}`)),
  "ONDS fallback names FCC/FAA-class gates",
);

const mrvlFb = buildFallbackOutlook({
  symbol: "MRVL",
  name: "Marvell Technology",
  industry: "Semiconductors",
  description: "Marvell supplies custom silicon, electro-optics, and ethernet for cloud and 5G.",
});
assert(inferOutlookBusinessType({ industry: "Semiconductors", description: "custom silicon and optics" }) === "semi", "MRVL family semi");
assert(!/cuda|geforce|fsd/i.test(mrvlFb.opportunities.map((o) => `${o.title} ${o.body}`).join(" ")), "MRVL fallback not GPU megacap");
assert(mrvlFb.opportunities.some((o) => /custom|optics|ethernet/i.test(`${o.title} ${o.body}`)), "MRVL fallback custom/optics");
assert(
  /handful of large cloud/i.test(
    [...mrvlFb.opportunities, ...mrvlFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "MRVL fallback uses honest buyer-scale language",
);
assert(
  !/\bhyperscalers?\b/i.test(
    [...mrvlFb.opportunities, ...mrvlFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "MRVL fallback avoids bare hyperscalers",
);

const mfcFb = buildFallbackOutlook({
  symbol: "MFC",
  name: "Manulife",
  industry: "Insurance - Life",
  capitalOverlay: "insurance_life",
  description: "Manulife provides financial advice, insurance, and wealth and asset management in Asia, Canada, and the United States.",
});
assert(inferOutlookBusinessType({ industry: "Insurance - Life", capitalOverlay: "insurance_life" }) === "insurer", "MFC insurer");
assert(mfcFb.opportunities.some((o) => /wealth|premium|investment|region/i.test(`${o.title} ${o.body}`)), "MFC fallback insurer economics");
assert(
  mfcFb.opportunities.some((o) => /canada|united states/i.test(`${o.title} ${o.body}`)),
  "MFC fallback names profile regions",
);

const mstrFb = buildFallbackOutlook({
  symbol: "MSTR",
  name: "MicroStrategy",
  capitalOverlay: "treasury_holding",
  industry: "Software - Application",
  description: "Bitcoin treasury company that also sells enterprise analytics software.",
});
assert(inferOutlookBusinessType({ capitalOverlay: "treasury_holding", industry: "Software - Application" }) === "treasury_nav", "MSTR treasury");
assert(mstrFb.opportunities.some((o) => /holdings|treasury|nav/i.test(`${o.title} ${o.body}`)), "MSTR fallback treasury");
assert(mstrFb.risks.some((o) => /dilut|debt|premium/i.test(`${o.title} ${o.body}`)), "MSTR fallback funding risk");
assert(
  mstrFb.risks.some((o) => /atm|at-the-market|convertible/i.test(`${o.title} ${o.body}`)),
  "MSTR fallback names ATM/converts",
);
assert(
  mstrFb.opportunities.some((o) => /software|operating/i.test(`${o.title} ${o.body}`)) &&
    /small/i.test(mstrFb.opportunities.map((o) => `${o.title} ${o.body}`).join(" ")),
  "MSTR fallback software small vs treasury",
);

function bodySentenceCount(body: string): number {
  return body
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.replace(/[.!?]/g, "").trim().length > 12).length;
}
assert(
  [...tslaFb.opportunities, ...tslaFb.risks].every((o) => bodySentenceCount(o.body) <= 2),
  "TSLA fallback bodies are 1–2 sentences",
);
assert(
  [...mstrFb.opportunities, ...mstrFb.risks].every((o) => bodySentenceCount(o.body) <= 2),
  "MSTR fallback bodies are 1–2 sentences",
);
assert(
  [...mrvlFb.opportunities, ...mrvlFb.risks].every((o) => bodySentenceCount(o.body) <= 2),
  "MRVL fallback bodies are 1–2 sentences",
);

const insurerCtx = {
  industry: "Insurance - Life",
  capitalOverlay: "insurance_life",
  description:
    "Manulife provides financial advice, insurance, and wealth and asset management in Asia, Canada, and the United States.",
};
const asiaOnlyInsurer = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Asia growth", body: "Premiums can expand across Asia if households keep buying protection." },
      { title: "Wealth fees", body: "Fee products can lift earnings quality if persistency holds." },
      { title: "Investment book", body: "A constructive rate backdrop can lift reported profit." },
      { title: "Capital strength", body: "Solvency lets the firm keep writing business through weaker years." },
    ],
    risks: [
      { title: "Credit cycle", body: "A credit event would hit investment income and book value." },
      { title: "Slow premiums", body: "A stall in Asia leaves the stock looking expensive versus slow compounding." },
      { title: "Guarantees", body: "Guaranteed products can become expensive if longevity moves the wrong way." },
      { title: "Rates", body: "Rate-sensitive multiples can compress even if the franchise is intact." },
    ],
  },
};
assert(
  isOutlookShallow(asiaOnlyInsurer, insurerCtx),
  "insurer Asia-growth-only is shallow",
);
const nestedInsurer = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Hong Kong and Japan wealth", body: "Hong Kong and Japan remain core growth markets for wealth and protection if persistency holds." },
      { title: "Canada workplace", body: "Canada workplace and retirement products can lift fee income if contributions hold." },
      { title: "John Hancock mix", body: "John Hancock protection and annuities in the U.S. are a second engine if new business stays profitable." },
      { title: "Investment book", body: "A constructive rate and credit backdrop can lift reported profit. This is cyclical." },
    ],
    risks: [
      { title: "Credit and rates", body: "A credit event would hit the investment book and book value." },
      { title: "Home-market stall", body: "A stall in Canada or U.S. premiums leaves the stock expensive versus slow compounding." },
      { title: "Guarantees", body: "Guaranteed products can become expensive if markets or longevity move the wrong way." },
      { title: "FX in Asia", body: "Currency swings in Hong Kong and Japan move reported results even if local franchises are intact." },
    ],
  },
};
assert(
  !isOutlookShallow(nestedInsurer, insurerCtx),
  "insurer nested regions and products are not shallow",
);

const semiCtx = {
  industry: "Semiconductors",
  description: "custom silicon, electro-optics, and ethernet for cloud and 5G",
};
const vagueSemi = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Custom ASICs", body: "Design-wins can convert to production if cloud programs stay funded." },
      { title: "Optics", body: "Optical interconnects scale if data-center build-outs continue." },
      { title: "Ethernet", body: "Switching silicon ramps if hyperscalers spend again." },
      { title: "Design-win lag", body: "Sockets already won can still become revenue if customers take silicon." },
    ],
    risks: [
      { title: "Customer concentration", body: "Hyperscalers dominate the book. A pause at a major customer is a growth stall." },
      { title: "Cycle", body: "A pause in cloud spend shows up fast in custom programs." },
      { title: "Rivals", body: "Merchant silicon and in-house custom can take sockets." },
      { title: "Valuation", body: "The multiple assumes design-wins keep converting." },
    ],
  },
};
assert(
  isOutlookShallow(vagueSemi, semiCtx),
  "semi hyperscalers-only concentration is shallow",
);
const namedSemi = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Custom ASICs", body: "Design-wins can convert to production if Amazon, Google, and Microsoft programs stay funded." },
      { title: "Optics", body: "Optical interconnects scale if data-center build-outs continue." },
      { title: "Ethernet", body: "Switching silicon ramps if those cloud buyers spend again." },
      { title: "Design-win lag", body: "Sockets already won can still become revenue if customers take silicon." },
    ],
    risks: [
      { title: "Customer concentration", body: "Amazon, Google, and Microsoft dominate custom-silicon programs. A pause at one of those accounts is a growth stall." },
      { title: "Cycle", body: "A pause in cloud spend shows up fast in custom programs." },
      { title: "Rivals", body: "Merchant silicon and in-house custom can take sockets." },
      { title: "Valuation", body: "The multiple assumes design-wins keep converting." },
    ],
  },
};
assert(
  !isOutlookShallow(namedSemi, semiCtx),
  "semi named cloud buyers are not shallow",
);
const scaleSemi = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Custom ASICs", body: "Design-wins can convert to production if a handful of large cloud buyers keep programs funded." },
      { title: "Optics", body: "Optical interconnects scale if data-center build-outs continue." },
      { title: "Ethernet", body: "Switching silicon ramps if those accounts spend again." },
      { title: "Design-win lag", body: "Sockets already won can still become revenue if customers take silicon." },
    ],
    risks: [
      { title: "Customer concentration", body: "A handful of large cloud buyers typically dominate custom-silicon programs. A pause at one of those accounts is a growth stall." },
      { title: "Cycle", body: "A pause in cloud spend shows up fast in custom programs." },
      { title: "Rivals", body: "Merchant silicon and in-house custom can take sockets." },
      { title: "Valuation", body: "The multiple assumes design-wins keep converting." },
    ],
  },
};
assert(
  !isOutlookShallow(scaleSemi, semiCtx),
  "semi honest scale language is not shallow",
);

const wordySemi = {
  ...namedSemi,
  futureOutlook: {
    opportunities: namedSemi.futureOutlook.opportunities.map((o) => ({
      title: o.title,
      body: `${o.body} That path works only if volumes hold. Treat this as an extra year of the same cycle.`,
    })),
    risks: namedSemi.futureOutlook.risks.map((o) => ({
      title: o.title,
      body: `${o.body} The condition is that customers keep spending. Treat this as a slow bleed if they do not.`,
    })),
  },
};
assert(isOutlookShallow(wordySemi, semiCtx), "essay-length outlook is shallow");

const mstrCtx = {
  capitalOverlay: "treasury_holding",
  industry: "Software - Application",
  description: "Bitcoin treasury company that also sells enterprise analytics software.",
};
const thinTreasury = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "More bitcoin", body: "The company can keep adding bitcoin if funding stays open." },
      { title: "Software sidecar", body: "Analytics software is an extra line." },
      { title: "Brand", body: "The bitcoin story keeps the name in the news." },
      { title: "Borrowed money", body: "Borrowed money can add to the pile when prices rise." },
    ],
    risks: [
      { title: "Price swings", body: "Bitcoin can fall and the stock follows." },
      { title: "Competition", body: "Other treasury names can copy the model." },
      { title: "Execution", body: "Software sales can miss." },
      { title: "Valuation", body: "The multiple assumes the bitcoin bet keeps working." },
    ],
  },
};
assert(isOutlookShallow(thinTreasury, mstrCtx), "treasury without holdings/ATM/premium scale is shallow");
const scaledTreasury = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Holdings scale", body: "This is one of the largest corporate bitcoin treasuries; adding coins only helps if funding does not cut NAV per share." },
      { title: "Software sidecar", body: "Analytics software is small next to the treasury and should not carry the multiple." },
      { title: "ATM funding", body: "ATM equity can buy more bitcoin if the stock trades at a premium to NAV." },
      { title: "Leverage", body: "Debt can add holdings when bitcoin rises." },
    ],
    risks: [
      { title: "ATM dilution", body: "At-the-market equity can dilute holders as fast as the treasury grows." },
      { title: "Debt vs bitcoin", body: "Leverage against a swinging bitcoin pile can force sales." },
      { title: "Premium to NAV", body: "A premium to NAV can compress even if holdings are unchanged." },
      { title: "Tiny operating cash", body: "Operating cash is too small to cover interest; the thesis lives on the mark." },
    ],
  },
};
assert(
  !isOutlookShallow(scaledTreasury, mstrCtx),
  "treasury with holdings, ATM, and premium/debt scale is not shallow",
);

const emptyOutlook = {
  ...parsedOutlook!,
  futureOutlook: { opportunities: [], risks: [] },
};
assert(
  isOutlookShallow(emptyOutlook, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
  }),
  "empty outlook is shallow",
);

const compactTsla = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "FSD software annuity", body: "Paid driver-assist on the existing fleet is the high-margin path if owners keep the subscription." },
      { title: "Energy storage", body: "Megapack can offset uneven car sales if project margins hold." },
    ],
    risks: [
      { title: "Capex and FCF", body: "Latest-quarter free cash flow was negative as factory spend stayed elevated." },
      { title: "NHTSA and permits", body: "NHTSA reviews and city permits can delay unsupervised driving." },
    ],
  },
};
assert(
  !isOutlookShallow(compactTsla, {
    industry: "Auto Manufacturers",
    description: "electric vehicles and energy generation and storage",
  }),
  "short TSLA outlook with main platforms is not shallow",
);

const compactMstr = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Holdings scale", body: "This is one of the largest corporate bitcoin treasuries; adding coins only helps if funding does not cut NAV per share." },
    ],
    risks: [
      { title: "ATM dilution", body: "At-the-market equity can dilute holders as fast as the treasury grows." },
      { title: "Premium to NAV", body: "A premium to NAV can compress even if holdings are unchanged." },
    ],
  },
};
assert(
  !isOutlookShallow(compactMstr, mstrCtx),
  "short treasury outlook with scale is not shallow",
);

const compactMfc = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Hong Kong wealth", body: "Hong Kong remains a core growth market for wealth and protection if persistency holds." },
      { title: "Canada workplace", body: "Canada workplace retirement can lift fee income if contributions hold." },
    ],
    risks: [
      { title: "Investment book", body: "A credit event would hit the investment book and book value." },
    ],
  },
};
assert(
  !isOutlookShallow(compactMfc, insurerCtx),
  "short insurer outlook with named regions is not shallow",
);

const flncId = {
  symbol: "FLNC",
  name: "Fluence Energy, Inc.",
  industry: "Electrical Equipment & Parts",
  description:
    "Fluence Energy provides energy storage products and services, including integrated battery systems and software and controls for grid and commercial projects.",
};
assert(inferOutlookBusinessType(flncId) === "grid_storage", "FLNC is grid storage");
assert(inferOutlookBusinessType({
  industry: "Auto Manufacturers",
  description: "electric vehicles and energy generation and storage",
}) === "ev_energy", "Tesla energy line stays EV not grid storage");
const flncGeneric = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Storage demand", body: "Storage demand is growing as renewables need more batteries on the grid." },
      { title: "Energy transition", body: "The energy transition drives more storage as more wind and solar come online." },
    ],
    risks: [
      { title: "Policy delays", body: "Policy delays hurt the industry and slow project awards." },
      { title: "Sector headwind", body: "Industry-wide headwinds can hit storage names together." },
    ],
  },
};
assert(isOutlookShallow(flncGeneric, flncId), "FLNC sector-generic storage/policy outlook is shallow");
const strippedFlnc = stripUnhookedSectorGenericItems(flncGeneric.futureOutlook, flncId);
assert(
  strippedFlnc.opportunities.length === 0 && strippedFlnc.risks.length === 0,
  "unhooked storage-demand bullets are dropped",
);
const flncSpecific = {
  ...parsedOutlook!,
  futureOutlook: {
    opportunities: [
      { title: "Integrated systems", body: "Fluence grows if its bundled storage hardware plus software and controls win projects and then commission." },
      { title: "Backlog conversion", body: "Contracted projects only help when they commission on time and at the bid margin." },
    ],
    risks: [
      { title: "Project margins", body: "Bid margins on this backlog can collapse if commissioning overruns hit." },
      { title: "Working capital", body: "Projects tie up cash between order and commissioning; a stretched balance sheet is the break." },
    ],
  },
};
assert(
  !isOutlookShallow(flncSpecific, flncId),
  "FLNC outlook tied to systems, software, backlog, and capital is not shallow",
);
const flncFb = buildFallbackOutlook(flncId);
assert(
  !/megapack|fsd|robotaxi|cybercab/i.test(
    [...flncFb.opportunities, ...flncFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "FLNC fallback has no Tesla products",
);
assert(
  flncFb.opportunities.some((o) => /software|control|backlog|commission/i.test(`${o.title} ${o.body}`)),
  "FLNC fallback names systems/software/backlog",
);
assert(
  !/renewables need|policy delays hurt the industry/i.test(
    [...flncFb.opportunities, ...flncFb.risks].map((o) => `${o.title} ${o.body}`).join(" "),
  ),
  "FLNC fallback is not sector-generic policy copy",
);

assert(
  AI_FEATURES["analysis.narrative_bundle"].model === "x-ai/grok-4.6",
  "narrative AI_FEATURES model is grok-4.6",
);
assert(
  AI_FEATURES["analysis.company_blurb"].model === "google/gemini-2.5-flash-lite",
  "blurb AI_FEATURES model is flash-lite",
);
assert(
  AI_FEATURES["analysis.future_outlook"].model === "x-ai/grok-4.6",
  "future_outlook AI_FEATURES model matches narrative_bundle",
);
assert(
  resolveAiFeature("analysis.narrative_bundle").source === "AI_FEATURES" ||
    resolveAiFeature("analysis.narrative_bundle").source === "ENV_OVERRIDE",
  "narrative resolve source is explicit",
);
if (!process.env.AI_MODEL_OVERRIDE && !process.env.NARRATIVE_MODEL && !process.env.AI_MODEL_NARRATIVE) {
  assert(
    resolveAiFeature("analysis.narrative_bundle").config.model === "x-ai/grok-4.6",
    "without env override, narrative uses AI_FEATURES grok-4.6",
  );
  assert(
    resolveAiFeature("analysis.company_blurb").config.model ===
      "google/gemini-2.5-flash-lite",
    "without env override, blurb uses AI_FEATURES flash-lite",
  );
  assert(
    resolveAiFeature("analysis.narrative_bundle").source === "AI_FEATURES",
    "without env override, source is AI_FEATURES",
  );
}
if (!process.env.NARRATIVE_TIMEOUT_MS) {
  assert(getNarrativeTimeoutMs() === 90_000, "narrative timeout default is 90s");
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall sbc/events unit checks passed");
