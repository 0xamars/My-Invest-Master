/**
 * Live Forecast payload + warehouse cache check.
 *   npx tsx --tsconfig tsconfig.json scripts/verify-forecast.mts
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

const symbols = ["NVDA", "MSFT", "TSLA", "MFC", "IBIT"];

for (const symbol of symbols) {
  console.log(`\n======== ${symbol} cold ========`);
  const a = await getAnalysisPackage(symbol, { includeHourly: false });
  const street = a.datasetStatus.find((s) => s.dataset === "street_consensus");
  const est = a.datasetStatus.find((s) => s.dataset === "estimates");
  console.log("street", street?.source, street?.error ?? "");
  console.log("estimates", est?.source, est?.error ?? "");
  console.log("fwdPE", a.fundamentals?.forwardPE);
  console.log("revEst", a.fundamentals?.revenueEstimateGrowth);
  console.log("epsEst", a.fundamentals?.earningsEstimateGrowth);
  console.log("valBasis pe_forward would use fwdPE>0", a.fundamentals?.forwardPE != null && a.fundamentals.forwardPE > 0);
  console.log("FORECAST", JSON.stringify(a.forecast, null, 2));

  console.log(`======== ${symbol} warm ========`);
  const b = await getAnalysisPackage(symbol, { includeHourly: false });
  const street2 = b.datasetStatus.find((s) => s.dataset === "street_consensus");
  const est2 = b.datasetStatus.find((s) => s.dataset === "estimates");
  console.log("street", street2?.source, "estimates", est2?.source);
}
