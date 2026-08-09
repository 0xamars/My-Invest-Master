/**
 * Multi-ticker Fundamental + Technical accuracy audit.
 *   npx tsx --tsconfig tsconfig.json scripts/audit-rating-universe.mts
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
const {
  TECH_FIB_WEIGHT,
  TECH_4H_WEIGHT,
  TECH_1D_WEIGHT,
  TECH_1W_WEIGHT,
} = await import("../src/lib/analysis/rating/bands.ts");
const { weightedAverage } = await import("../src/lib/analysis/rating/math.ts");
const { RELATIVE_DRAWDOWN_MIN_BARS } = await import(
  "../src/lib/analysis/rating/relative-drawdown.ts"
);

const SYMBOLS = [
  "NVDA",
  "MSFT",
  "AAPL",
  "GOOGL",
  "META",
  "AMZN",
  "TSLA",
  "PLTR",
  "NFLX",
  "AMD",
  "JPM",
  "BAC",
  "GS",
  "BRK-B",
  "CAT",
  "F",
  "GM",
  "O",
  "NEE",
  "RIVN",
  "UPST",
  "HOOD",
  "COIN",
  "MSTR",
  "IBIT",
  "SPY",
  "MU",
  "AVGO",
  "CRM",
] as const;

type Met = {
  id: string;
  score: number | null;
  value: number | null;
  skipped: boolean;
  note: string | null;
};

function met(
  pillar:
    | { metrics: Met[] }
    | undefined,
  id: string,
): Met | undefined {
  return pillar?.metrics.find((m) => m.id === id);
}

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

const summary: string[] = [];
const failures: string[] = [];
const skipped: string[] = [];
const details: string[] = [];

summary.push(
  [
    "SYM",
    "path",
    "FS",
    "P",
    "G",
    "V",
    "F",
    "T",
    "Ovr",
    "flags",
    "result",
  ].join("\t"),
);

if (
  Math.abs(TECH_FIB_WEIGHT - 0.4) > 1e-9 ||
  Math.abs(TECH_4H_WEIGHT - 0.2) > 1e-9 ||
  Math.abs(TECH_1D_WEIGHT - 0.3) > 1e-9 ||
  Math.abs(TECH_1W_WEIGHT - 0.1) > 1e-9
) {
  failures.push(
    `GLOBAL: tech weights not 0.40/0.20/0.30/0.10 (${TECH_FIB_WEIGHT}/${TECH_4H_WEIGHT}/${TECH_1D_WEIGHT}/${TECH_1W_WEIGHT})`,
  );
}

for (const symbol of SYMBOLS) {
  let pkg;
  try {
    pkg = await getAnalysisPackage(symbol, { includeHourly: true });
  } catch (e) {
    skipped.push(`${symbol}: package error ${String(e).slice(0, 100)}`);
    continue;
  }

  const profile = pkg.profile;
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
    vehicleProfile: profile
      ? {
          name: profile.name,
          industry: profile.industry,
          industryKey: profile.industryKey,
          sector: profile.sector,
          sectorKey: profile.sectorKey,
          description: profile.description,
          exchange: profile.exchange,
          isEtf: profile.isEtf,
          isFund: profile.isFund,
          raw: profile.raw,
        }
      : null,
  });

  const fund = rating.fundamental;
  const tech = rating.technical;
  const fs = fund.pillars.find((p) => p.id === "financial_strength");
  const profit = fund.pillars.find((p) => p.id === "profitability");
  const growth = fund.pillars.find((p) => p.id === "growth");
  const val = fund.pillars.find((p) => p.id === "valuation");
  const model = fund.classification.businessModel;
  const vehicle = fund.nonOperatingVehicle;
  const fails: string[] = [];
  const notes: string[] = [];

  const ratios = (pkg.ratiosTtm ?? null) as Record<string, unknown> | null;
  const eps =
    typeof ratios?.netIncomePerShareTTM === "number"
      ? (ratios.netIncomePerShareTTM as number)
      : null;

  // ——— Fundamental assertions ———
  if (f && !vehicle) {
    if (eps != null && eps <= 0) {
      if (f.trailingPE != null && f.trailingPE > 0) fails.push("PE_with_EPS_le_0");
      if (f.pegRatio != null && f.pegRatio > 0) fails.push("PEG_with_EPS_le_0");
      if (f.earningsYield != null && f.earningsYield > 0)
        fails.push("Ey_with_EPS_le_0");
      if (met(val, "pe_ttm")?.score != null) fails.push("PE_scored_EPS_le_0");
      if (met(val, "peg")?.score != null) fails.push("PEG_scored_EPS_le_0");
      if (met(val, "earnings_yield")?.score != null)
        fails.push("Ey_scored_EPS_le_0");
    }
    if (f.ebitda != null && f.ebitda <= 0) {
      if (f.netDebtToEbitda != null) fails.push("ND_EBITDA_with_EBITDA_le_0");
      if (f.enterpriseToEbitda != null && f.enterpriseToEbitda > 0)
        fails.push("EV_EBITDA_pkg_with_EBITDA_le_0");
      if (met(val, "ev_ebitda")?.score != null)
        fails.push("EV_EBITDA_scored_EBITDA_le_0");
      if (met(fs, "net_debt_ebitda")?.score != null)
        fails.push("ND_EBITDA_scored_EBITDA_le_0");
    }
    if (f.freeCashflow != null && f.freeCashflow <= 0) {
      if (f.priceToFcf != null) fails.push("P_FCF_with_FCF_le_0");
      if (f.evToFcf != null) fails.push("EV_FCF_with_FCF_le_0");
      if (f.fcfYield != null) fails.push("FCF_yield_with_FCF_le_0");
      if (met(val, "p_fcf")?.score != null) fails.push("P_FCF_scored_FCF_le_0");
      if (met(val, "ev_fcf")?.score != null) fails.push("EV_FCF_scored_FCF_le_0");
      if (met(val, "fcf_yield")?.score != null)
        fails.push("FCF_yield_scored_FCF_le_0");
    }
    if (f.operatingCashflow != null && f.operatingCashflow <= 0) {
      if (f.priceToOcf != null) fails.push("P_OCF_with_OCF_le_0");
      if (met(val, "p_ocf")?.score != null) fails.push("P_OCF_scored_OCF_le_0");
    }
    if (f.interestCoverage === 0) fails.push("COV_ZERO");
    if (f.interestCoverage != null && f.interestCoverage < 0) {
      const covScore = met(fs, "interest_coverage")?.score;
      if (covScore != null && covScore >= 50)
        fails.push("NEG_COV_SCORED_HEALTHY");
    }

    if (
      f.pegRatio != null &&
      f.pegRatio > 0 &&
      (f.trailingPE == null || f.trailingPE <= 0) &&
      (f.forwardPE == null || f.forwardPE <= 0)
    ) {
      fails.push("PEG_WITHOUT_PE");
    }

    const mega = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "AMZN"].includes(
      symbol,
    );
    const profitable =
      (f.profitMargins != null && f.profitMargins > 0) ||
      (f.operatingMargins != null && f.operatingMargins > 0);
    if (mega && profitable && eps != null && eps > 0) {
      if (f.trailingPE == null || f.trailingPE <= 0) fails.push("MEGA_MISSING_PE");
      else if (pkg.quote?.price != null && pkg.quote.price > 0) {
        const implied = pkg.quote.price / eps;
        if (implied > 0 && Math.abs(f.trailingPE - implied) / implied > 0.45) {
          fails.push(
            `PE_VS_PRICE_EPS_GAP(${f.trailingPE.toFixed(1)} vs ${implied.toFixed(1)})`,
          );
        }
      }
    }

    if (
      f.freeCashflow != null &&
      f.freeCashflow > 0 &&
      f.marketCap != null &&
      f.marketCap > 0 &&
      f.fcfYield == null &&
      model !== "treasury_holding"
    ) {
      fails.push("MISSING_FCF_YIELD");
    }
    if (
      f.totalDebt != null &&
      f.totalDebt > 0 &&
      f.totalRevenue != null &&
      f.totalRevenue > 0 &&
      f.debtToRevenue == null
    ) {
      fails.push("MISSING_DEBT_REVENUE");
    }

    if (model === "bank_insurance" && met(fs, "altman_z")?.score != null) {
      fails.push("BANK_ALTMAN_SCORED");
    }

    const periods = new Set(
      [
        fund.classification.fundamentalPeriod,
        f.fundamentalPeriod,
      ].filter(Boolean),
    );
    if (periods.size > 1) fails.push("PERIOD_MISMATCH");

    if (profit) {
      const take = pillarTakeaway(profit, fund).toLowerCase();
      const lossy =
        (f.operatingMargins != null && f.operatingMargins < -0.1) ||
        (f.profitMargins != null && f.profitMargins < -0.1);
      if (
        lossy &&
        take.includes("profitable") &&
        !take.includes("unprofitable")
      ) {
        fails.push("LOSS_PROFITABLE_TAKEAWAY");
      }
    }
    if (
      f.freeCashflow != null &&
      f.freeCashflow < 0 &&
      f.operatingCashflow != null &&
      f.operatingCashflow < 0
    ) {
      for (const p of [fs, profit]) {
        if (!p) continue;
        const take = pillarTakeaway(p, fund).toLowerCase();
        if (
          take.includes("strong fcf conversion") ||
          take.includes("solid fcf conversion") ||
          take.includes("strong cash conversion")
        ) {
          fails.push("FALSE_STRONG_FCF_CONV");
        }
      }
    }

    if (
      val &&
      val.score != null &&
      val.score >= 70 &&
      ((fs?.score != null && fs.score < 45) ||
        (profit?.score != null && profit.score < 45))
    ) {
      fails.push("VALUE_TRAP_CAP_MISS");
    }

    // Path checks
    if (symbol === "MSTR") {
      if (model !== "treasury_holding") fails.push("MSTR_NOT_TREASURY");
      if (tech.daily.signal != null) fails.push("MSTR_SIGNAL");
      if (met(val, "p_fcf")?.score != null && (met(val, "p_fcf")?.score ?? 0) >= 80)
        fails.push("MSTR_ELITE_PFCF");
      if (fund.peerContext.basis !== "none") fails.push("MSTR_PEERS_ON");
    }
    if (symbol === "COIN" && model === "treasury_holding") {
      fails.push("COIN_FALSE_TREASURY");
    }
    if (
      (symbol === "MSFT" || symbol === "AAPL") &&
      model === "treasury_holding"
    ) {
      fails.push(`${symbol}_FALSE_TREASURY`);
    }
    if (symbol === "O" && vehicle) fails.push("O_FALSE_FUND");
    if (symbol === "O" && model !== "reit_utilities") {
      notes.push(`O_model=${model}`);
      if (model === "industry_peer") {
        /* REIT overlay preferred but not always a hard fail if sector is real estate */
      }
    }
  }

  if (vehicle) {
    if (fund.score != null) fails.push("VEHICLE_HAS_F_SCORE");
    if (fs?.score != null || profit?.score != null || val?.score != null) {
      fails.push("VEHICLE_CORP_PILLARS");
    }
    notes.push(`vehicle=${vehicle.kind}`);
  }

  // ETF / IBIT / SPY should be non-operating
  if (symbol === "IBIT" || symbol === "SPY") {
    if (!vehicle) fails.push(`${symbol}_NOT_NONOPERATING`);
  }

  // ——— Technical assertions ———
  const techKeys = Object.keys(tech);
  if (techKeys.includes("momentumHeat") || techKeys.includes("trendBackdrop")) {
    fails.push("HEAT_FIELDS_PRESENT");
  }
  if (tech.daily.signal != null || tech.h4.signal != null || tech.weekly.signal != null) {
    fails.push("SIGNAL_NOT_NULL");
  }

  const parts: Array<{ weight: number; value: number }> = [];
  if (tech.fib.score != null)
    parts.push({ weight: TECH_FIB_WEIGHT, value: tech.fib.score });
  if (tech.h4.score != null)
    parts.push({ weight: TECH_4H_WEIGHT, value: tech.h4.score });
  if (tech.daily.score != null)
    parts.push({ weight: TECH_1D_WEIGHT, value: tech.daily.score });
  if (tech.weekly.score != null)
    parts.push({ weight: TECH_1W_WEIGHT, value: tech.weekly.score });
  const expectedT = weightedAverage(parts);
  if (
    tech.score != null &&
    expectedT != null &&
    Math.abs(tech.score - expectedT) > 0.6
  ) {
    fails.push(`T_WEIGHT_MISMATCH(${tech.score} vs ${expectedT.toFixed(1)})`);
  }

  const rel = tech.fib.relative;
  const dailyCount = pkg.dailyBars?.length ?? 0;
  if (dailyCount >= RELATIVE_DRAWDOWN_MIN_BARS && !rel.available && !vehicle) {
    fails.push("REL_MISSING_WITH_HISTORY");
  }
  if (rel.available && rel.drawdown != null && rel.peak != null && rel.peak > 0) {
    const lastClose =
      pkg.dailyBars && pkg.dailyBars.length > 0
        ? [...pkg.dailyBars].sort((a, b) => a.time - b.time).at(-1)!.close
        : pkg.quote?.price;
    if (lastClose != null && lastClose > 0) {
      const implied = (rel.peak - lastClose) / rel.peak;
      if (Math.abs(implied - rel.drawdown) > 0.04) {
        fails.push(
          `DD_PCT_MISMATCH(${(rel.drawdown * 100).toFixed(1)} vs ${(implied * 100).toFixed(1)})`,
        );
      }
    }
  }
  if (
    rel.available &&
    rel.drawdown != null &&
    rel.drawdown < 0.02 &&
    rel.status === "deep"
  ) {
    fails.push("ATH_MARKED_DEEP");
  }
  if (
    tech.fib.zone === "red" &&
    rel.available &&
    rel.status === "deep" &&
    (rel.drawdown ?? 1) < 0.05
  ) {
    fails.push("FOMO_LABELED_DEEP");
  }

  const absScore = tech.fib.absoluteScore;
  if (
    rel.available &&
    rel.score != null &&
    absScore != null &&
    tech.fib.score != null
  ) {
    const hybrid = 0.8 * rel.score + 0.2 * absScore;
    if (Math.abs(tech.fib.score - hybrid) > 1.2) {
      fails.push(
        `ZONE_NOT_HYBRID(${tech.fib.score} vs ${hybrid.toFixed(1)})`,
      );
    }
  }
  if (!rel.available && absScore != null && tech.fib.score != null) {
    if (Math.abs(tech.fib.score - absScore) > 0.2) {
      fails.push("ZONE_FALLBACK_NOT_ABS");
    }
  }

  // Sanity: mega quality directional
  if (["MSFT", "AAPL", "NVDA"].includes(symbol) && !vehicle && f) {
    if (fs?.score != null && fs.score < 50) fails.push("MEGA_WEAK_FS");
    if (profit?.score != null && profit.score < 45) fails.push("MEGA_WEAK_P");
    if (val?.score != null && val.score >= 75) fails.push("MEGA_V_CHEAP");
  }
  if (symbol === "TSLA" && val?.score != null && val.score >= 75) {
    fails.push("TSLA_V_CHEAP");
  }

  const flagBits: string[] = [];
  if (pkg.degraded) flagBits.push("degraded");
  if (!Array.isArray(pkg.estimates) || pkg.estimates.length === 0)
    flagBits.push("noEst");
  flagBits.push(`peers=${fund.peerContext.peerCount}`);
  if (vehicle) flagBits.push(vehicle.kind);
  if (model === "treasury_holding") flagBits.push("treasury");

  const result = fails.length ? "FAIL" : "PASS";
  if (fails.length) {
    for (const fl of fails) failures.push(`${symbol}: ${fl}`);
  }

  summary.push(
    [
      symbol,
      vehicle ? `vehicle:${vehicle.kind}` : model,
      fmt(fs?.score),
      fmt(profit?.score),
      fmt(growth?.score),
      fmt(val?.score),
      fmt(fund.score),
      fmt(tech.score),
      fmt(rating.score),
      flagBits.join(","),
      result,
    ].join("\t"),
  );

  details.push(
    [
      `--- ${symbol} ${profile?.name ?? ""} ---`,
      `sector/ind=${profile?.sector}/${profile?.industry} isEtf=${profile?.isEtf} isFund=${profile?.isFund}`,
      `path=${model} vehicle=${vehicle?.kind ?? "no"} period=${f?.fundamentalPeriod ?? "n/a"}`,
      `FS=${fmt(fs?.score)} P=${fmt(profit?.score)} G=${fmt(growth?.score)} V=${fmt(val?.score)} F=${fmt(fund.score)} T=${fmt(tech.score)} O=${fmt(rating.score)}`,
      `zone=${tech.fib.zoneLabel ?? "—"} rel=${rel.statusLabel ?? "—"} dd=${rel.drawdown != null ? (rel.drawdown * 100).toFixed(1) + "%" : "—"} zoneSc=${fmt(tech.fib.score)} absSc=${fmt(absScore)} relSc=${fmt(rel.score)}`,
      `stretch N=${tech.h4.heatLabel ?? "—"}/${fmt(tech.h4.score)} M=${tech.daily.heatLabel ?? "—"}/${fmt(tech.daily.score)} L=${tech.weekly.heatLabel ?? "—"}/${fmt(tech.weekly.score)}`,
      f
        ? `PE=${fmt(f.trailingPE)} fwd=${fmt(f.forwardPE)} PEG=${fmt(f.pegRatio, 2)} EV/EBITDA=${fmt(f.enterpriseToEbitda)} P/FCF=${fmt(f.priceToFcf)} EV/FCF=${fmt(f.evToFcf)} P/OCF=${fmt(f.priceToOcf)} FCFy=${fmt(f.fcfYield, 3)} Ey=${fmt(f.earningsYield, 3)}`
        : "no fundamentals",
      f
        ? `cov=${fmt(f.interestCoverage, 2)} ND/EBITDA=${fmt(f.netDebtToEbitda, 2)} D/Rev=${fmt(f.debtToRevenue, 2)} OCF/D=${fmt(f.ocfToDebt, 3)} CR=${fmt(f.currentRatio, 2)} OM=${fmt(f.operatingMargins, 3)} FCFm=${fmt(f.fcfMargin, 3)} ROIC=${fmt(f.returnOnInvestedCapital, 3)} revG=${fmt(f.revenueGrowth, 3)} rev3y=${fmt(f.revenueGrowth3y, 3)}`
        : "",
      `eps=${eps} ebitda=${f?.ebitda ?? "n/a"} fcf=${f?.freeCashflow ?? "n/a"} ocf=${f?.operatingCashflow ?? "n/a"}`,
      fails.length ? `FAILS: ${fails.join(", ")}` : "OK",
      notes.length ? `notes: ${notes.join("; ")}` : "",
      "",
    ].join("\n"),
  );
}

const report = [
  "===== RATING UNIVERSE AUDIT =====",
  summary.join("\n"),
  "",
  "===== FAILURES =====",
  failures.length ? failures.join("\n") : "(none)",
  "",
  "===== SKIPPED =====",
  skipped.length ? skipped.join("\n") : "(none)",
  "",
  `failLines=${failures.length} skipped=${skipped.length}`,
  "",
  "===== DETAILS =====",
  details.join("\n"),
].join("\n");

const out = resolve(process.cwd(), "scripts", "output", "rating-universe-audit.txt");
writeFileSync(out, report, "utf8");
console.log(summary.join("\n"));
console.log("\n===== FAILURES =====");
console.log(failures.length ? failures.join("\n") : "(none)");
console.log("\n===== SKIPPED =====");
console.log(skipped.length ? skipped.join("\n") : "(none)");
console.log(`\nWrote ${out}`);
process.exit(failures.length ? 1 : 0);
