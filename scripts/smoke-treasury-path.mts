/**
 * Smoke: treasury_holding path — MSTR vs MSFT vs COIN.
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-treasury-path.mts
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

const SYMBOLS = ["MSTR", "MSFT", "COIN"] as const;

function met(
  rating: ReturnType<typeof buildInvestSalsaRating>,
  pillarId: string,
  metricId: string,
) {
  const p = rating.fundamental.pillars.find((x) => x.id === pillarId);
  return p?.metrics.find((x) => x.id === metricId);
}

const fails: string[] = [];
const rows: string[] = [];
rows.push(
  [
    "SYM",
    "model",
    "peers",
    "peerBasis",
    "P/FCF_sc",
    "EV/FCF_sc",
    "FCFy_sc",
    "FCFm_sc",
    "DebtRev_sc",
    "DebtAst_sc",
    "V",
    "F",
    "notes",
  ].join("\t"),
);

for (const symbol of SYMBOLS) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
  const profile = pkg.profile;
  const rating = buildInvestSalsaRating({
    assetType: "stock",
    price: pkg.quote?.price ?? null,
    ath: pkg.ath,
    fundamentals: pkg.fundamentals,
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

  const model = rating.fundamental.classification.businessModel;
  const peerBasis = rating.fundamental.peerContext.basis;
  const peerLabel = rating.fundamental.peerContext.label;
  const pFcf = met(rating, "valuation", "p_fcf");
  const evFcf = met(rating, "valuation", "ev_fcf");
  const fcfY = met(rating, "valuation", "fcf_yield");
  const fcfM = met(rating, "profitability", "fcf_margin");
  const debtRev = met(rating, "financial_strength", "debt_to_revenue");
  const debtAst = met(rating, "financial_strength", "debt_to_assets");
  const v = rating.fundamental.pillars.find((p) => p.id === "valuation")?.score;
  const f = rating.fundamental.score;

  rows.push(
    [
      symbol,
      model,
      peerLabel.slice(0, 48),
      peerBasis,
      pFcf?.score ?? "null",
      evFcf?.score ?? "null",
      fcfY?.score ?? "null",
      fcfM?.score ?? "null",
      debtRev?.score ?? "null",
      debtAst?.score ?? "null",
      v ?? "null",
      f ?? "null",
      rating.fundamental.notes.find((n) =>
        n.toLowerCase().includes("treasury"),
      )?.slice(0, 60) ?? "",
    ].join("\t"),
  );

  if (symbol === "MSTR") {
    if (model !== "treasury_holding") fails.push("MSTR_not_treasury");
    if (peerBasis !== "none") fails.push("MSTR_peers_still_on");
    if (peerLabel.toLowerCase().includes("software") && peerBasis !== "none")
      fails.push("MSTR_software_peers");
    if (pFcf?.score != null) fails.push("MSTR_p_fcf_scored");
    if (evFcf?.score != null) fails.push("MSTR_ev_fcf_scored");
    if (fcfY?.score != null) fails.push("MSTR_fcf_yield_scored");
    if (fcfM?.score != null) fails.push("MSTR_fcf_margin_scored");
    // Softened Debt/Rev should not be floor-10 elite-punish only — allow but prefer debt/assets
    if (debtAst?.score == null && pkg.fundamentals?.totalAssets != null)
      fails.push("MSTR_missing_debt_assets");
    const fcf = pkg.fundamentals;
    if (
      fcf?.trailingPE != null &&
      fcf.trailingPE > 0 &&
      (pkg.ratiosTtm as { netIncomePerShareTTM?: number } | null)
        ?.netIncomePerShareTTM != null &&
      ((pkg.ratiosTtm as { netIncomePerShareTTM: number }).netIncomePerShareTTM <=
        0)
    ) {
      fails.push("MSTR_PE_with_neg_EPS");
    }
    if (
      fcf?.ebitda != null &&
      fcf.ebitda <= 0 &&
      fcf.enterpriseToEbitda != null
    ) {
      fails.push("MSTR_EV_EBITDA_with_neg_EBITDA");
    }
  }
  if (symbol === "MSFT") {
    if (model === "treasury_holding") fails.push("MSFT_false_treasury");
    if (peerBasis === "none") fails.push("MSFT_peers_disabled");
  }
  if (symbol === "COIN") {
    if (model === "treasury_holding") fails.push("COIN_false_treasury");
  }
}

console.log(rows.join("\n"));
console.log("\n===== ASSERTIONS =====");
console.log(fails.length ? fails.join("\n") : "ALL PASS");
process.exit(fails.length ? 1 : 0);
