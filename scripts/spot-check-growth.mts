/**
 * Spot-check Growth blend for anchor tickers.
 *   npx tsx --tsconfig tsconfig.json scripts/spot-check-growth.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2]!;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]!]) process.env[m[1]!] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);
const { pillarTakeaway } = await import(
  "../src/lib/analysis/fundamental-copy.ts"
);

const TICKERS = ["MSFT", "AMZN", "TSLA", "HOOD", "INFQ", "ONDS"] as const;

for (const symbol of TICKERS) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
  const f = pkg.fundamentals;
  if (!f) {
    console.log(`${symbol}: NO FUNDAMENTALS`);
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
  });
  const growth = rating.fundamental.pillars.find((p) => p.id === "growth");
  const takeaway = growth
    ? pillarTakeaway(growth, rating.fundamental)
    : "—";
  const m = (id: string) => growth?.metrics.find((x) => x.id === id);
  console.log(
    [
      symbol,
      `G=${growth?.score ?? "—"}`,
      `rev=${f.revenueGrowth != null ? (f.revenueGrowth * 100).toFixed(1) + "%" : "—"}`,
      `op=${f.operatingIncomeGrowth != null ? (f.operatingIncomeGrowth * 100).toFixed(1) + "%" : "—"}`,
      `eps=${f.earningsGrowth != null ? (f.earningsGrowth * 100).toFixed(1) + "%" : "—"}`,
      `rev3y=${f.revenueGrowth3y != null ? (f.revenueGrowth3y * 100).toFixed(1) + "%" : "null"}`,
      `eps3y=${f.earningsGrowth3y != null ? (f.earningsGrowth3y * 100).toFixed(1) + "%" : "null"}`,
      `blend=${(m("growth_blend")?.note ?? "—").slice(0, 60)}`,
      `epsGate=${m("eps_growth")?.note?.includes("Excluded") ? "OUT" : "in"}`,
      `| ${takeaway}`,
    ].join(" | "),
  );
}
