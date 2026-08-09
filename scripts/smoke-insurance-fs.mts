/**
 * Dump FS path + liquidity metrics for insurers vs banks/industrials.
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-insurance-fs.mts
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
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]!]) process.env[m[1]!] = v;
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const symbols = process.argv.slice(2);
const tickers =
  symbols.length > 0
    ? symbols.map((s) => s.toUpperCase())
    : ["MFC", "MET", "PRU", "SLF", "JPM", "BAC", "MSFT", "TSLA", "RIVN"];

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);

const MET_IDS = [
  "current_ratio",
  "quick_ratio",
  "cash_to_debt",
  "equity_to_assets",
  "debt_to_equity",
  "altman_z",
  "piotroski",
  "roa_capital",
];

for (const symbol of tickers) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
  const f = pkg.fundamentals;
  if (!f) {
    console.log(`\n=== ${symbol} NO FUNDAMENTALS ===`);
    continue;
  }
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
    vehicleProfile: pkg.profile,
  });
  const fund = rating.fundamental;
  const fs = fund.pillars.find((p) => p.id === "financial_strength");
  const mets = (fs?.metrics ?? []).filter((m) => MET_IDS.includes(m.id));
  console.log(`\n=== ${symbol} ===`);
  console.log(
    "industry:",
    f.industry,
    "| key:",
    f.industryKey,
    "| sector:",
    f.sector,
    f.sectorKey,
  );
  console.log("path:", fund.classification.businessModel);
  console.log("frame:", fund.classification.businessModelLabel);
  console.log(
    "profile:",
    fund.classification.growthProfile,
    "| flags:",
    fund.classification.criticalFlags.join(",") || "(none)",
  );
  console.log(
    "FS:",
    fs?.score,
    "| fund:",
    fund.score,
    "| CR:",
    f.currentRatio,
    "| QR:",
    f.quickRatio,
    "| E/A:",
    f.equityToAssets,
    "| D/E:",
    f.debtToEquity,
    "| cashReliable:",
    f.cashFlowReliable,
  );
  for (const m of mets) {
    console.log(
      `  ${m.id}: value=${m.value} score=${m.score} skipped=${m.skipped}${m.note ? ` (${m.note})` : ""}`,
    );
  }
}
