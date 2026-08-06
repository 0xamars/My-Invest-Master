/**
 * Relative drawdown Price Zone smoke.
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-relative-drawdown.mts
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
const { formatDrawdownPct } = await import(
  "../src/lib/analysis/rating/relative-drawdown.ts"
);

const SYMBOLS = ["NVDA", "AAPL", "TSLA", "MSFT", "KO", "MSTR"] as const;
const fails: string[] = [];

console.log(
  [
    "SYM",
    "absZone",
    "absSc",
    "dd%",
    "relStatus",
    "pctile",
    "relSc",
    "zoneSc",
    "T",
  ].join("\t"),
);

for (const symbol of SYMBOLS) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
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
  });
  const fib = rating.technical.fib;
  const rel = fib.relative;
  console.log(
    [
      symbol,
      fib.zoneLabel ?? "—",
      fib.absoluteScore ?? "—",
      formatDrawdownPct(rel.drawdown) ?? "—",
      rel.statusLabel ?? "—",
      rel.percentile != null ? (rel.percentile * 100).toFixed(0) + "%" : "—",
      rel.score ?? "—",
      fib.score ?? "—",
      rating.technical.score ?? "—",
    ].join("\t"),
  );

  if (rating.technical.score == null) fails.push(`${symbol}_no_T`);
  if (fib.score == null) fails.push(`${symbol}_no_zone_score`);
  if ((pkg.dailyBars?.length ?? 0) >= 252 && !rel.available) {
    fails.push(`${symbol}_rel_missing_with_history`);
  }
  if (rel.statusLabel && /percentile|ATH|Z-score/i.test(rel.statusLabel)) {
    fails.push(`${symbol}_jargon`);
  }
  if (rating.technical.daily.signal != null) fails.push(`${symbol}_signal`);
}

console.log(fails.length ? fails.join("\n") : "ALL PASS");
process.exit(fails.length ? 1 : 0);
