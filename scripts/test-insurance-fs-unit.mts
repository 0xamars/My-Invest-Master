/**
 * Deterministic insurance / bank FS path checks (no live FMP).
 *   npx tsx --tsconfig tsconfig.json scripts/test-insurance-fs-unit.mts
 */
import { classifyCapitalProfile } from "../src/lib/analysis/rating/industry-model.ts";
import { resolveBusinessProfilePolicy } from "../src/lib/analysis/rating/business-profile.ts";
import { computeFinancialStrengthV12 } from "../src/lib/analysis/rating/financial-strength.ts";
import type { FundamentalInputs } from "../src/lib/analysis/rating/types.ts";

function blank(over: Partial<FundamentalInputs>): FundamentalInputs {
  return {
    debtToEquity: null,
    currentRatio: null,
    quickRatio: null,
    freeCashflow: null,
    operatingCashflow: null,
    totalDebt: null,
    totalCash: null,
    ebitda: null,
    totalRevenue: null,
    bookValue: null,
    sharesOutstanding: null,
    grossMargins: null,
    operatingMargins: null,
    profitMargins: null,
    returnOnEquity: null,
    returnOnAssets: null,
    returnOnInvestedCapital: null,
    revenueGrowth: null,
    earningsGrowth: null,
    fcfGrowth: null,
    operatingIncomeGrowth: null,
    revenueGrowth3y: null,
    earningsGrowth3y: null,
    operatingGrowth3y: null,
    revenueEstimateGrowth: null,
    earningsEstimateGrowth: null,
    trailingPE: null,
    forwardPE: null,
    enterpriseToEbitda: null,
    priceToSales: null,
    priceToFcf: null,
    pegRatio: null,
    marketCap: null,
    recommendationKey: null,
    sector: null,
    sectorKey: null,
    industry: null,
    industryKey: null,
    dataAsOf: null,
    equityToAssets: null,
    interestCoverage: null,
    netDebtToEbitda: null,
    debtToEbitda: null,
    cashToDebt: null,
    cashToShortTermDebt: null,
    fcfToDebt: null,
    ocfToDebt: null,
    debtToRevenue: null,
    fcfStability: null,
    altmanZScore: null,
    piotroskiScore: null,
    beneishMScore: null,
    wacc: null,
    ebit: null,
    totalAssets: null,
    workingCapital: null,
    ebitdaMargin: null,
    fcfMargin: null,
    ocfMargin: null,
    cashFlowReliable: true,
    cashFlowNote: null,
    returnOnInvestedCapital3y: null,
    operatingMarginTrend: null,
    grossMarginTrend: null,
    netMarginTrend: null,
    roicTrend: null,
    enterpriseValue: null,
    evToFcf: null,
    evToSales: null,
    priceToOcf: null,
    evToEbit: null,
    fcfYield: null,
    earningsYield: null,
    trailingPeMedian5y: null,
    capitalExpenditure: null,
    researchAndDevelopment: null,
    grossProfit: null,
    grossProfitPrior: null,
    ...over,
  };
}

const emptyPeers = {
  basis: "none" as const,
  label: "none",
  peerCount: 0,
  industryKey: null,
  industry: null,
  sectorKey: null,
  sector: null,
};

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

const lifeClass = classifyCapitalProfile({
  industryKey: "insurance-life",
  sectorKey: "financial-services",
  industry: "Insurance - Life",
  sector: "Financial Services",
  profitMargins: 0.08,
  operatingMargins: 0.1,
  freeCashflow: 1e9,
  revenueGrowth: 0.05,
});
assert(lifeClass === "insurance_life", `Insurance - Life → insurance_life (got ${lifeClass})`);

const multiClass = classifyCapitalProfile({
  industryKey: "insurance-diversified",
  sectorKey: "financial-services",
  industry: "Insurance - Diversified",
  sector: "Financial Services",
  profitMargins: 0.1,
  operatingMargins: 0.12,
  freeCashflow: 2e9,
  revenueGrowth: 0.04,
});
assert(
  multiClass === "insurance_life",
  `Insurance - Diversified → insurance_life (got ${multiClass})`,
);

const lifeAlias = classifyCapitalProfile({
  industryKey: "life-insurance",
  sectorKey: "financial-services",
  industry: "Life Insurance",
  sector: "Financial Services",
  profitMargins: 0.08,
  operatingMargins: 0.1,
  freeCashflow: 1e9,
  revenueGrowth: 0.03,
});
assert(lifeAlias === "insurance_life", `life-insurance key → insurance_life (got ${lifeAlias})`);

const jpmClass = classifyCapitalProfile({
  industryKey: "banks-diversified",
  sectorKey: "financial-services",
  industry: "Banks - Diversified",
  sector: "Financial Services",
  profitMargins: 0.3,
  operatingMargins: 0.35,
  freeCashflow: null,
  revenueGrowth: 0.06,
});
assert(jpmClass === "bank_insurance", `Banks - Diversified → bank_insurance (got ${jpmClass})`);

const msftClass = classifyCapitalProfile({
  industryKey: "software-infrastructure",
  sectorKey: "technology",
  industry: "Software - Infrastructure",
  sector: "Technology",
  profitMargins: 0.35,
  operatingMargins: 0.42,
  freeCashflow: 70e9,
  revenueGrowth: 0.12,
});
assert(msftClass === "industry_peer", `MSFT-like → industry_peer (got ${msftClass})`);

const visaClass = classifyCapitalProfile({
  industryKey: "financial-credit-services",
  sectorKey: "financial-services",
  industry: "Financial - Credit Services",
  sector: "Financial Services",
  profitMargins: 0.5,
  operatingMargins: 0.6,
  freeCashflow: 20e9,
  revenueGrowth: 0.1,
});
assert(
  visaClass === "industry_peer",
  `payments credit-services → industry_peer not bank (got ${visaClass})`,
);

const hoodClass = classifyCapitalProfile({
  industryKey: "financial-capital-markets",
  sectorKey: "financial-services",
  industry: "Financial - Capital Markets",
  sector: "Financial Services",
  profitMargins: 0.3,
  operatingMargins: 0.3,
  freeCashflow: 1e9,
  revenueGrowth: 0.2,
});
assert(
  hoodClass === "brokerage_capital_markets",
  `HOOD-like → brokerage not insurance (got ${hoodClass})`,
);

function cls(
  industry: string,
  industryKey: string,
  sector = "Financial Services",
  sectorKey = "financial-services",
) {
  return classifyCapitalProfile({
    industryKey,
    sectorKey,
    industry,
    sector,
    profitMargins: 0.1,
    operatingMargins: 0.12,
    freeCashflow: 1e9,
    revenueGrowth: 0.05,
  });
}

assert(
  cls("Insurance - Property & Casualty", "insurance-property-casualty") ===
    "insurance_life",
  "P&C insurance → insurance_life",
);
assert(
  cls("Insurance - Reinsurance", "insurance-reinsurance") === "insurance_life",
  "Reinsurance → insurance_life",
);
assert(
  cls("Banks - Regional", "banks-regional") === "bank_insurance",
  "Regional banks → bank_insurance",
);
assert(
  cls("Thrifts & Mortgage Finance", "thrifts-and-mortgage-finance") ===
    "bank_insurance",
  "Thrifts → bank_insurance",
);
assert(
  cls("REIT - Mortgage", "reit-mortgage", "Real Estate", "real-estate") ===
    "reit_utilities",
  "Mortgage REIT → reit_utilities not bank",
);
assert(
  cls("Mortgage Finance", "mortgage-finance") === "bank_insurance",
  "Mortgage Finance (non-REIT) → bank_insurance",
);
assert(
  cls("Financial Conglomerates", "financial-conglomerates") ===
    "brokerage_capital_markets",
  "Financial conglomerates → brokerage",
);
assert(
  cls("Telecom Services", "telecom-services", "Communication Services", "communication-services") ===
    "industry_peer",
  "Telecom → industry_peer",
);
assert(
  cls("Semiconductors", "semiconductors", "Technology", "technology") ===
    "industry_peer",
  "Semiconductors → industry_peer",
);
assert(
  cls("Insurance Brokers", "insurance-brokers") === "brokerage_capital_markets",
  "Insurance brokers → brokerage not insurance_life",
);
assert(
  cls(
    "Investment - Banking & Investment Services",
    "investment-banking-and-investment-services",
  ) === "brokerage_capital_markets",
  "Investment banking → brokerage not deposit bank",
);
assert(
  cls("Real Estate - Services", "real-estate-services", "Real Estate", "real-estate") ===
    "industry_peer",
  "RE services (non-REIT) → industry_peer",
);

const insurerInputs = blank({
  industry: "Insurance - Life",
  industryKey: "insurance-life",
  sector: "Financial Services",
  sectorKey: "financial-services",
  currentRatio: 0,
  quickRatio: 0,
  equityToAssets: 0.05,
  debtToEquity: 26,
  returnOnAssets: 0.006,
  returnOnEquity: 0.12,
  piotroskiScore: 9,
  altmanZScore: 0.24,
  cashToDebt: 66,
  cashFlowReliable: false,
  totalRevenue: 50e9,
  profitMargins: 0.08,
  operatingMargins: 0.1,
  revenueGrowth: 0.04,
});

const insurerPolicy = resolveBusinessProfilePolicy(insurerInputs);
assert(
  !insurerPolicy.criticalFlags.includes("severe_liquidity"),
  "insurer CR=0 does not flag severe_liquidity",
);
assert(
  !insurerPolicy.criticalFlags.includes("impaired_equity"),
  "insurer E/A 5% does not flag impaired_equity",
);
assert(
  insurerPolicy.profile !== "low_quality_fragile",
  `insurer profile is not low_quality_fragile (got ${insurerPolicy.profile})`,
);

const fsInsurer = computeFinancialStrengthV12({
  fundamentals: insurerInputs,
  capitalProfile: "insurance_life",
  peers: [],
  peerContext: emptyPeers,
  policy: insurerPolicy,
});
const cr = fsInsurer.metrics.find((m) => m.id === "current_ratio");
const qr = fsInsurer.metrics.find((m) => m.id === "quick_ratio");
const ea = fsInsurer.metrics.find((m) => m.id === "equity_to_assets");
const alt = fsInsurer.metrics.find((m) => m.id === "altman_z");
const cash = fsInsurer.metrics.find((m) => m.id === "cash_to_debt");
assert(cr?.skipped === true && cr.score == null, "insurer current_ratio unscored");
assert(qr?.skipped === true && qr.score == null, "insurer quick_ratio unscored");
assert(alt?.skipped === true && alt.score == null, "insurer Altman unscored");
assert(cash?.score == null, "insurer cash/debt not a primary FS driver");
assert(
  ea?.score != null && ea.score >= 50,
  `insurer E/A 5% not industrial distress (score=${ea?.score})`,
);
assert(
  fsInsurer.score != null && fsInsurer.score >= 50,
  `insurer FS not crushed by CR/QR=0 (FS=${fsInsurer.score})`,
);

const bankInputs = blank({
  industry: "Banks - Diversified",
  industryKey: "banks-diversified",
  sector: "Financial Services",
  sectorKey: "financial-services",
  currentRatio: 0.84,
  quickRatio: 0.84,
  equityToAssets: 0.075,
  debtToEquity: 330,
  returnOnAssets: 0.013,
  returnOnEquity: 0.16,
  piotroskiScore: 4,
  altmanZScore: 0.22,
  cashToDebt: 0.4,
  cashFlowReliable: false,
  totalRevenue: 160e9,
  profitMargins: 0.3,
  operatingMargins: 0.35,
  revenueGrowth: 0.06,
});
const bankPolicy = resolveBusinessProfilePolicy(bankInputs);
assert(
  !bankPolicy.criticalFlags.includes("impaired_equity"),
  "bank E/A 7.5% does not flag impaired_equity",
);
assert(
  !bankPolicy.criticalFlags.includes("severe_liquidity"),
  "bank CR 0.84 does not flag severe_liquidity",
);
const fsBank = computeFinancialStrengthV12({
  fundamentals: bankInputs,
  capitalProfile: "bank_insurance",
  peers: [],
  peerContext: emptyPeers,
  policy: bankPolicy,
});
assert(
  fsBank.metrics.find((m) => m.id === "current_ratio")?.score == null,
  "bank current_ratio unscored",
);
assert(
  fsBank.score != null && fsBank.score > 30,
  `bank FS not crushed by industrial liquidity (FS=${fsBank.score})`,
);

const industrial = blank({
  industry: "Software - Infrastructure",
  industryKey: "software-infrastructure",
  sector: "Technology",
  sectorKey: "technology",
  currentRatio: 0,
  quickRatio: 0,
  equityToAssets: 0.05,
  debtToEquity: 80,
  returnOnAssets: 0.15,
  altmanZScore: 6,
  cashFlowReliable: true,
  totalRevenue: 200e9,
  profitMargins: 0.35,
  operatingMargins: 0.42,
  freeCashflow: 70e9,
  operatingCashflow: 90e9,
  revenueGrowth: 0.12,
});
const indPolicy = resolveBusinessProfilePolicy(industrial);
assert(
  indPolicy.criticalFlags.includes("severe_liquidity") ||
    indPolicy.criticalFlags.includes("impaired_equity") ||
    indPolicy.profile === "low_quality_fragile",
  "industrial CR=0 / thin E/A still flags distress",
);
const fsInd = computeFinancialStrengthV12({
  fundamentals: industrial,
  capitalProfile: "industry_peer",
  peers: [],
  peerContext: emptyPeers,
  policy: indPolicy,
});
assert(
  fsInd.metrics.find((m) => m.id === "current_ratio")?.score != null,
  "industrial current_ratio still scored",
);

const bamLike = blank({
  industry: "Asset Management",
  industryKey: "asset-management",
  sector: "Financial Services",
  sectorKey: "financial-services",
  currentRatio: 0,
  quickRatio: 0,
  equityToAssets: 0.59,
  debtToEquity: 0,
  returnOnAssets: 0.04,
  altmanZScore: 7.1,
  cashToDebt: 10,
  cashFlowReliable: false,
  totalRevenue: 5e9,
  profitMargins: 0.2,
  operatingMargins: 0.25,
  revenueGrowth: 0.05,
});
const bamPolicy = resolveBusinessProfilePolicy(bamLike);
assert(
  !bamPolicy.criticalFlags.includes("severe_liquidity"),
  "asset manager CR=0 does not flag severe_liquidity",
);
assert(
  bamPolicy.profile !== "low_quality_fragile",
  `asset manager not falsely fragile (got ${bamPolicy.profile})`,
);
const fsBam = computeFinancialStrengthV12({
  fundamentals: bamLike,
  capitalProfile: "brokerage_capital_markets",
  peers: [],
  peerContext: emptyPeers,
  policy: bamPolicy,
});
assert(
  fsBam.metrics.find((m) => m.id === "current_ratio")?.score == null,
  "asset manager CR=0 unscored",
);
assert(
  fsBam.metrics.find((m) => m.id === "altman_z")?.score == null,
  "broker/AM Altman unscored",
);

const reitLike = blank({
  industry: "REIT - Specialty",
  industryKey: "reit-specialty",
  sector: "Real Estate",
  sectorKey: "real-estate",
  currentRatio: 0.35,
  quickRatio: 0.35,
  equityToAssets: 0.06,
  debtToEquity: 12,
  netDebtToEbitda: 6,
  returnOnAssets: 0.03,
  altmanZScore: 1.1,
  cashFlowReliable: true,
  totalRevenue: 10e9,
  profitMargins: 0.2,
  operatingMargins: 0.3,
  freeCashflow: 2e9,
  revenueGrowth: 0.04,
});
const reitPolicy = resolveBusinessProfilePolicy(reitLike);
assert(
  !reitPolicy.criticalFlags.includes("altman_distress"),
  "REIT Altman ~1.1 does not flag industrial distress",
);
assert(
  !reitPolicy.criticalFlags.includes("severe_liquidity"),
  "REIT CR 0.35 does not flag severe_liquidity",
);
assert(
  !reitPolicy.criticalFlags.includes("impaired_equity"),
  "REIT E/A 6% does not flag impaired_equity",
);
assert(
  reitPolicy.profile !== "low_quality_fragile",
  `REIT not falsely fragile (got ${reitPolicy.profile})`,
);

const maLike = blank({
  industry: "Financial - Credit Services",
  industryKey: "financial-credit-services",
  sector: "Financial Services",
  sectorKey: "financial-services",
  currentRatio: 1.06,
  quickRatio: 1.06,
  equityToAssets: 0.097,
  debtToEquity: 439,
  returnOnAssets: 0.22,
  operatingMargins: 0.55,
  profitMargins: 0.45,
  freeCashflow: 12e9,
  cashToDebt: 4.6,
  altmanZScore: 9.7,
  cashFlowReliable: true,
  totalRevenue: 25e9,
  revenueGrowth: 0.1,
});
const maPolicy = resolveBusinessProfilePolicy(maLike);
assert(
  !maPolicy.criticalFlags.includes("dangerous_leverage"),
  "cash-rich payments D/E from buybacks is not dangerous_leverage",
);
assert(
  !maPolicy.criticalFlags.includes("impaired_equity"),
  "asset-light payments E/A ~10% is not impaired_equity",
);
assert(
  maPolicy.profile !== "low_quality_fragile",
  `payments not falsely fragile (got ${maPolicy.profile})`,
);

if (failed > 0) {
  console.error(`\n${failed} insurance FS unit check(s) failed`);
  process.exit(1);
}
console.log("\ninsurance FS unit checks passed");
