/**
 * Street Outlook package dump (no scoring).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-street-outlook.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  displayEpsGrowth,
  formatForwardPe,
  formatGrowthRate,
  streetOutlookPlainLine,
} from "../src/lib/analysis/street-outlook.ts";

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

const SYMBOLS = ["NVDA", "MSFT", "AAPL", "IBIT", "RIVN"] as const;

for (const symbol of SYMBOLS) {
  const pkg1 = await getAnalysisPackage(symbol, { includeHourly: false });
  const pkg2 = await getAnalysisPackage(symbol, { includeHourly: false });
  const o = pkg1.estimateOutlook;
  const estStatus = pkg2.datasetStatus.find((s) => s.dataset === "estimates");
  const plain = streetOutlookPlainLine(o);
  console.log(
    [
      symbol.padEnd(5),
      o.available ? "YES" : "empty",
      `fwdPE=${formatForwardPe(o.forwardPe)}`,
      `revG=${formatGrowthRate(o.impliedRevenueGrowth)}`,
      `epsG=${formatGrowthRate(displayEpsGrowth(o))}`,
      `fy1=${o.fy1?.date ?? "—"}`,
      `eps=${o.fy1?.epsAvg ?? "—"}`,
      `n=${pkg1.estimates.length}`,
      `cache2=${estStatus?.source ?? "?"}`,
      `F=${pkg1.fundamentals ? "ok" : "na"}`,
    ].join("  "),
  );
  if (plain) console.log(`      ${plain}`);
}
