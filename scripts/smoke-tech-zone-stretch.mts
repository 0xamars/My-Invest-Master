/**
 * Zone + Stretch only smoke (post heat/trend rollback).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-tech-zone-stretch.mts
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

const fails: string[] = [];
for (const symbol of ["NVDA", "TSLA"] as const) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: true });
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
  const t = rating.technical;
  const keys = Object.keys(t).sort();
  console.log(
    [
      symbol,
      `T=${t.score}`,
      `zone=${t.fib.zoneLabel ?? "—"}`,
      `near=${t.h4.heatLabel ?? "—"}`,
      `med=${t.daily.heatLabel ?? "—"}`,
      `long=${t.weekly.heatLabel ?? "—"}`,
      `keys=${keys.join(",")}`,
      `signal=${t.daily.signal}`,
    ].join("\t"),
  );
  if (t.score == null) fails.push(`${symbol}_no_score`);
  if (keys.includes("momentumHeat") || keys.includes("trendBackdrop")) {
    fails.push(`${symbol}_leftover_heat_fields`);
  }
  if (t.daily.signal != null) fails.push(`${symbol}_signal_on`);
}

console.log(fails.length ? fails.join("\n") : "ALL PASS");
process.exit(fails.length ? 1 : 0);
