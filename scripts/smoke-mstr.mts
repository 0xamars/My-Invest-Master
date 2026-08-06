/**
 * MSTR-only fundamental integrity + rating smoke.
 */
import { readFileSync } from "node:fs";
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
const { detectNonOperatingVehicle } = await import(
  "../src/lib/analysis/rating/non-operating-vehicle.ts"
);

const pkg = await getAnalysisPackage("MSTR", { includeHourly: false });
const f = pkg.fundamentals;
const profile = pkg.profile;
const vehicle = detectNonOperatingVehicle(
  profile
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
);

const rating = buildInvestSalsaRating({
  assetType: "stock",
  price: pkg.quote?.price ?? null,
  ath: pkg.ath,
  fundamentals: f,
  peers: pkg.peers,
  peerContext: pkg.peerContext,
  dailyBars: pkg.dailyBars,
  hourlyBars: pkg.hourlyBars,
  symbol: "MSTR",
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

function met(
  pillarId: string,
  metricId: string,
): { value: number | null; score: number | null; skipped: boolean } {
  const p = rating.fundamental.pillars.find((x) => x.id === pillarId);
  const m = p?.metrics.find((x) => x.id === metricId);
  return {
    value: m?.value ?? null,
    score: m?.score ?? null,
    skipped: m?.skipped ?? true,
  };
}

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "null";
  return v.toFixed(d);
}

const fails: string[] = [];
if (!f) {
  console.log("NO FUNDAMENTALS");
  process.exit(1);
}

// Integrity assertions
if ((f.trailingPE != null && f.trailingPE > 0) || (f.pegRatio != null && f.pegRatio > 0)) {
  // Need EPS > 0 roughly — use earnings yield or margins; check via PE presence with loss
  // Better: if net/op margins deeply neg and PE present, flag; also if EPS from ratios
}
const ratios = pkg.ratiosTtm as Record<string, unknown> | null;
const eps =
  typeof ratios?.netIncomePerShareTTM === "number"
    ? (ratios.netIncomePerShareTTM as number)
    : null;

if (eps != null && eps <= 0) {
  if (f.trailingPE != null && f.trailingPE > 0) fails.push("PE_with_EPS_le_0");
  if (f.pegRatio != null && f.pegRatio > 0) fails.push("PEG_with_EPS_le_0");
  if (f.earningsYield != null && f.earningsYield > 0)
    fails.push("Ey_with_EPS_le_0");
}
if (f.ebitda != null && f.ebitda <= 0) {
  if (f.netDebtToEbitda != null) fails.push("ND_EBITDA_with_EBITDA_le_0");
  if (f.enterpriseToEbitda != null) fails.push("EV_EBITDA_with_EBITDA_le_0");
  if (met("valuation", "ev_ebitda").score != null)
    fails.push("EV_EBITDA_scored_EBITDA_le_0");
}
if (f.freeCashflow != null && f.freeCashflow <= 0) {
  if (f.priceToFcf != null) fails.push("P_FCF_with_FCF_le_0");
  if (f.evToFcf != null) fails.push("EV_FCF_with_FCF_le_0");
  if (f.fcfYield != null) fails.push("FCF_yield_with_FCF_le_0");
}
if (f.interestCoverage === 0) fails.push("COV_ZERO");
if (vehicle.isNonOperating) fails.push("FALSE_FUND_VEHICLE");

const fs = rating.fundamental.pillars.find((p) => p.id === "financial_strength");
const pr = rating.fundamental.pillars.find((p) => p.id === "profitability");
const gr = rating.fundamental.pillars.find((p) => p.id === "growth");
const va = rating.fundamental.pillars.find((p) => p.id === "valuation");

const lines: string[] = [];
lines.push("===== MSTR PROFILE =====");
lines.push(`name: ${profile?.name}`);
lines.push(`sector/industry: ${profile?.sector} / ${profile?.industry}`);
lines.push(`isEtf=${profile?.isEtf} isFund=${profile?.isFund}`);
lines.push(
  `vehicle: ${vehicle.isNonOperating ? `${vehicle.kind} (${vehicle.reason})` : "operating"}`,
);
lines.push(
  `businessModel: ${rating.fundamental.classification.businessModel}`,
);
lines.push(
  `growthProfile: ${rating.fundamental.classification.growthProfile} (${rating.fundamental.classification.growthProfileLabel})`,
);
lines.push(
  `softWeighting: ${rating.fundamental.classification.reinvestmentSoftWeighting}`,
);
lines.push(`peers: ${rating.fundamental.peerContext.basis} (${rating.fundamental.peerContext.peerCount}) — ${rating.fundamental.peerContext.label}`);
lines.push(`period: ${f.fundamentalPeriod} | ${f.periodSelectionReason ?? ""}`);
lines.push("");
lines.push("===== SCORES =====");
lines.push(
  `FS=${fs?.score ?? "null"} P=${pr?.score ?? "null"} G=${gr?.score ?? "null"} V=${va?.score ?? "null"} F=${rating.fundamental.score ?? "null"} T=${rating.technical.score ?? "null"} overall=${rating.score ?? "null"}`,
);
lines.push(`label=${rating.label} confidence=${rating.confidence}`);
lines.push("");
lines.push("===== KEY METRICS (package → metric score) =====");
const rows: Array<[string, number | null | undefined, number | null]> = [
  ["trailing PE", f.trailingPE, met("valuation", "pe_ttm").score],
  ["forward PE", f.forwardPE, met("valuation", "pe_forward").score],
  ["PEG", f.pegRatio, met("valuation", "peg").score],
  ["EV/EBITDA", f.enterpriseToEbitda, met("valuation", "ev_ebitda").score],
  ["P/FCF", f.priceToFcf, met("valuation", "p_fcf").score],
  ["EV/FCF", f.evToFcf, met("valuation", "ev_fcf").score],
  ["P/OCF", f.priceToOcf, met("valuation", "p_ocf").score],
  ["FCF yield", f.fcfYield, met("valuation", "fcf_yield").score],
  ["earnings yield", f.earningsYield, met("valuation", "earnings_yield").score],
  ["interest coverage", f.interestCoverage, met("financial_strength", "interest_coverage").score],
  ["ND/EBITDA", f.netDebtToEbitda, met("financial_strength", "net_debt_ebitda").score],
  ["Debt/Revenue", f.debtToRevenue, met("financial_strength", "debt_to_revenue").score],
  ["OCF/debt", f.ocfToDebt, met("financial_strength", "ocf_to_debt").score],
  ["current ratio", f.currentRatio, met("financial_strength", "current_ratio").score],
  ["operating margin", f.operatingMargins, met("profitability", "operating_margin").score],
  ["FCF margin", f.fcfMargin, met("profitability", "fcf_margin").score],
  ["revenue growth", f.revenueGrowth, met("growth", "revenue_growth").score],
  ["revenue 3Y CAGR", f.revenueGrowth3y, met("growth", "revenue_growth_3y").score],
];
lines.push("metric\tvalue\tscore");
for (const [label, value, score] of rows) {
  lines.push(`${label}\t${fmt(value, 4)}\t${score == null ? "null" : score}`);
}

lines.push("");
lines.push("===== PEERS / DESC =====");
const peerSyms = (pkg.peers ?? [])
  .slice(0, 12)
  .map((p) =>
    typeof p === "string"
      ? p
      : ((p as { symbol?: string; ticker?: string }).symbol ??
        (p as { ticker?: string }).ticker ??
        "?"),
  );
lines.push(`peerSymbols: ${peerSyms.join(", ") || "(none)"}`);
lines.push(`industryKey=${profile?.industryKey} sectorKey=${profile?.sectorKey}`);
lines.push(`desc: ${(profile?.description ?? "").slice(0, 360)}`);
lines.push(
  `fcf/revenue=${f.totalRevenue && f.freeCashflow != null ? (f.freeCashflow / f.totalRevenue).toFixed(2) : "n/a"} | |ebitda|/revenue=${f.totalRevenue && f.ebitda != null ? (Math.abs(f.ebitda) / f.totalRevenue).toFixed(2) : "n/a"}`,
);

lines.push("");
lines.push("===== RAW CONTEXT =====");
lines.push(
  `price=${pkg.quote?.price} mcap=${f.marketCap} ebitda=${f.ebitda} fcf=${f.freeCashflow} ocf=${f.operatingCashflow} eps(netIncomePerShare)=${eps}`,
);
lines.push(
  `totalDebt=${f.totalDebt} totalCash=${f.totalCash} totalRevenue=${f.totalRevenue} ROIC=${f.returnOnInvestedCapital} book/sh=${f.bookValue} Eq/Assets=${f.equityToAssets}`,
);
lines.push(`altman=${f.altmanZScore} D/E=${f.debtToEquity}`);
lines.push(`estimates rows=${Array.isArray(pkg.estimates) ? pkg.estimates.length : 0}`);

lines.push("");
lines.push("===== ASSERTIONS =====");
lines.push(fails.length ? fails.join("\n") : "ALL PASS");

lines.push("");
lines.push("===== NOTES (first 10) =====");
for (const n of rating.fundamental.notes.slice(0, 10)) lines.push(`- ${n}`);

console.log(lines.join("\n"));
