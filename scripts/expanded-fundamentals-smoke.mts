/**
 * Expanded fundamentals integrity smoke.
 *   npx tsx --tsconfig tsconfig.json scripts/expanded-fundamentals-smoke.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2]!;
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!process.env[m[1]!]) process.env[m[1]!] = v;
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);
const { pillarTakeaway } = await import(
  "../src/lib/analysis/fundamental-copy.ts"
);

const SYMBOLS = [
  // Quality / mega-cap
  "NVDA",
  "MSFT",
  "AAPL",
  "GOOGL",
  "META",
  "AMZN",
  // Growth / rich
  "TSLA",
  "PLTR",
  "NFLX",
  "AMD",
  // Financials
  "JPM",
  "BAC",
  "GS",
  "BRK-B",
  // Cyclicals
  "CAT",
  "F",
  "GM",
  // REIT / utilities
  "O",
  "NEE",
  // Loss / weak
  "RIVN",
  "MBLY",
  "UPST",
  // Other
  "HOOD",
  "COIN",
] as const;

type Pillar = {
  id: string;
  score: number | null;
  metrics: Array<{
    id: string;
    score: number | null;
    value: number | null;
    skipped: boolean;
    note: string | null;
  }>;
};

function met(p: Pillar | undefined, id: string) {
  return p?.metrics.find((m) => m.id === id);
}

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

const rows: string[] = [];
const failures: string[] = [];
const skipped: string[] = [];

rows.push(
  [
    "SYM",
    "period",
    "model",
    "FS",
    "P",
    "G",
    "V",
    "F",
    "PE",
    "fwdPE",
    "PEG",
    "EV/EBITDA",
    "P/FCF",
    "FCFy",
    "Ey",
    "cov",
    "ND/EBITDA",
    "D/Rev",
    "OM",
    "FCFm",
    "revG",
    "rev3y",
    "FAILS",
  ].join("\t"),
);

for (const symbol of SYMBOLS) {
  let pkg;
  try {
    pkg = await getAnalysisPackage(symbol, { includeHourly: false });
  } catch (e) {
    skipped.push(`${symbol}: package error ${String(e).slice(0, 80)}`);
    continue;
  }
  if (!pkg.fundamentals) {
    skipped.push(`${symbol}: no fundamentals`);
    continue;
  }
  const f = pkg.fundamentals;
  const rating = buildInvestSalsaRating({
    assetType: "stock",
    price: pkg.quote?.price ?? null,
    ath: pkg.ath,
    fundamentals: f,
    peers: pkg.peers,
    peerContext: pkg.peerContext,
    dailyBars: pkg.dailyBars,
    hourlyBars: pkg.hourlyBars,
    symbol,
    vehicleProfile: pkg.profile
      ? {
          name: pkg.profile.name,
          industry: pkg.profile.industry,
          industryKey: pkg.profile.industryKey,
          sector: pkg.profile.sector,
          sectorKey: pkg.profile.sectorKey,
          description: pkg.profile.description,
          exchange: pkg.profile.exchange,
          isEtf: pkg.profile.isEtf,
          isFund: pkg.profile.isFund,
          raw: pkg.profile.raw,
        }
      : null,
  });

  const fund = rating.fundamental;
  const fs = fund.pillars.find((p) => p.id === "financial_strength") as
    | Pillar
    | undefined;
  const profit = fund.pillars.find((p) => p.id === "profitability") as
    | Pillar
    | undefined;
  const growth = fund.pillars.find((p) => p.id === "growth") as
    | Pillar
    | undefined;
  const val = fund.pillars.find((p) => p.id === "valuation") as
    | Pillar
    | undefined;

  const fails: string[] = [];

  // A. Invalid denominator never scored
  if (f.ebitda != null && f.ebitda <= 0) {
    if (f.netDebtToEbitda != null) fails.push("ND_EBITDA_with_neg_EBITDA");
    if (met(val, "ev_ebitda")?.score != null)
      fails.push("EV_EBITDA_scored_neg_EBITDA");
    if (f.enterpriseToEbitda != null && f.enterpriseToEbitda > 0)
      fails.push("EV_EBITDA_positive_with_neg_EBITDA");
  }
  if (f.freeCashflow != null && f.freeCashflow <= 0) {
    if (f.priceToFcf != null) fails.push("P_FCF_present_neg_FCF");
    if (f.evToFcf != null) fails.push("EV_FCF_present_neg_FCF");
    if (f.fcfYield != null) fails.push("FCF_yield_present_neg_FCF");
    if (met(val, "p_fcf")?.score != null) fails.push("P_FCF_scored_neg_FCF");
    if (met(val, "ev_fcf")?.score != null) fails.push("EV_FCF_scored_neg_FCF");
    if (met(val, "fcf_yield")?.score != null)
      fails.push("FCF_yield_scored_neg_FCF");
  }
  if (f.operatingCashflow != null && f.operatingCashflow <= 0) {
    if (f.priceToOcf != null) fails.push("P_OCF_present_neg_OCF");
    if (met(val, "p_ocf")?.score != null) fails.push("P_OCF_scored_neg_OCF");
  }
  if (f.trailingPE != null && f.trailingPE <= 0) {
    fails.push("PE_nonpositive_stored");
  }
  if (met(val, "pe_ttm")?.score != null && (f.trailingPE == null || f.trailingPE <= 0)) {
    fails.push("PE_scored_invalid");
  }
  if (met(val, "earnings_yield")?.score != null && (f.earningsYield == null || f.earningsYield <= 0)) {
    fails.push("Ey_scored_invalid");
  }

  // Interest coverage 0 is FMP N/A — must not score as distress
  if (f.interestCoverage === 0) fails.push("COV_ZERO_AS_VALUE");

  // PEG without valid PE
  if (
    f.pegRatio != null &&
    f.pegRatio > 0 &&
    (f.trailingPE == null || f.trailingPE <= 0) &&
    (f.forwardPE == null || f.forwardPE <= 0)
  ) {
    fails.push("PEG_WITHOUT_PE");
  }

  // Equity REIT must not be treated as fund vehicle
  const industryBlob = `${f.industry ?? ""} ${f.sector ?? ""}`.toLowerCase();
  if (
    /\breit\b|real estate/.test(industryBlob) &&
    fund.nonOperatingVehicle != null
  ) {
    fails.push("REIT_FALSE_FUND_VEHICLE");
  }

  // C. Profitable large-caps should have PE
  const profitable =
    (f.profitMargins != null && f.profitMargins > 0) ||
    (f.operatingMargins != null && f.operatingMargins > 0);
  const mega = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "AMZN"].includes(
    symbol,
  );
  if (mega && profitable && (f.trailingPE == null || f.trailingPE <= 0)) {
    fails.push("MEGA_MISSING_PE");
  }
  if (
    mega &&
    profitable &&
    f.trailingPE != null &&
    f.trailingPE > 0 &&
    met(val, "pe_ttm")?.score == null
  ) {
    fails.push("MEGA_PE_NOT_SCORED");
  }

  // D. Bank Altman not scored
  const model = fund.classification.businessModel;
  if (model === "bank_insurance") {
    if (met(fs, "altman_z")?.score != null) fails.push("BANK_ALTMAN_SCORED");
  }

  // Loss-makers: no PE, no "Profitable" takeaway
  const lossMaking =
    (f.operatingMargins != null && f.operatingMargins < 0) ||
    (f.profitMargins != null && f.profitMargins < 0) ||
    (f.fcfMargin != null && f.fcfMargin < -0.15);
  if (lossMaking && f.trailingPE != null && f.trailingPE > 0) {
    // PE can exist for GAAP-profitable with neg FCF — only fail if net/op both negative
    if (
      (f.operatingMargins ?? 0) < 0 &&
      (f.profitMargins ?? 0) < 0 &&
      f.trailingPE > 0
    ) {
      // EPS could still be positive TTM with negative margins rare — soft
    }
  }
  if (profit) {
    const take = pillarTakeaway(profit, fund).toLowerCase();
    if (
      lossMaking &&
      (f.operatingMargins ?? 1) < -0.1 &&
      take.includes("profitable") &&
      !take.includes("unprofitable")
    ) {
      fails.push("LOSS_PROFITABLE_TAKEAWAY");
    }
  }

  // E. Strong FCF conversion when both negative
  if (
    f.freeCashflow != null &&
    f.freeCashflow < 0 &&
    f.operatingCashflow != null &&
    f.operatingCashflow < 0
  ) {
    for (const p of [fs, profit]) {
      if (!p) continue;
      const take = pillarTakeaway(p, fund).toLowerCase();
      if (take.includes("strong fcf conversion") || take.includes("solid fcf conversion")) {
        fails.push("FALSE_STRONG_FCF_CONV");
      }
    }
  }

  // FCF yield when FCF > 0 and mcap present
  if (
    f.freeCashflow != null &&
    f.freeCashflow > 0 &&
    f.marketCap != null &&
    f.marketCap > 0 &&
    f.fcfYield == null
  ) {
    fails.push("MISSING_FCF_YIELD");
  }

  // Debt/Revenue when debt + revenue present
  if (
    f.totalDebt != null &&
    f.totalDebt > 0 &&
    f.totalRevenue != null &&
    f.totalRevenue > 0 &&
    f.debtToRevenue == null
  ) {
    fails.push("MISSING_DEBT_REVENUE");
  }

  // Cheap + weak quality should not say "cheap" alone as endorsement without trap — soft check
  if (val && val.score != null && val.score >= 70) {
    const fsScore = fs?.score;
    const pScore = profit?.score;
    if (
      (fsScore != null && fsScore < 45) ||
      (pScore != null && pScore < 45)
    ) {
      // value trap cap should keep score <= 58 typically — if still very high flag
      if (val.score >= 70) fails.push("VALUE_TRAP_CAP_MISS");
    }
  }

  if (fails.length) {
    for (const fl of fails) failures.push(`${symbol}: ${fl}`);
  }

  rows.push(
    [
      symbol,
      f.fundamentalPeriod ?? "—",
      model,
      fmt(fs?.score, 1),
      fmt(profit?.score, 1),
      fmt(growth?.score, 1),
      fmt(val?.score, 1),
      fmt(fund.score, 1),
      fmt(f.trailingPE, 1),
      fmt(f.forwardPE, 1),
      fmt(f.pegRatio, 2),
      fmt(f.enterpriseToEbitda, 1),
      fmt(f.priceToFcf, 1),
      fmt(f.fcfYield, 3),
      fmt(f.earningsYield, 3),
      fmt(f.interestCoverage, 2),
      fmt(f.netDebtToEbitda, 2),
      fmt(f.debtToRevenue, 2),
      fmt(f.operatingMargins, 3),
      fmt(f.fcfMargin, 3),
      fmt(f.revenueGrowth, 3),
      fmt(f.revenueGrowth3y, 3),
      fails.length ? fails.join(",") : "OK",
    ].join("\t"),
  );
}

const report = [
  "===== EXPANDED FUNDAMENTALS SMOKE =====",
  rows.join("\n"),
  "",
  "===== FAILURES =====",
  failures.length ? failures.join("\n") : "(none)",
  "",
  "===== SKIPPED =====",
  skipped.length ? skipped.join("\n") : "(none)",
  "",
  `Tested=${SYMBOLS.length - skipped.length} skipped=${skipped.length} failLines=${failures.length}`,
].join("\n");

writeFileSync(resolve("scripts/_expanded-smoke.txt"), report);
console.log(report);
