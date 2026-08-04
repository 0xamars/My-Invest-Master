/**
 * Run Fundamental metric audit against FMP warehouse packages.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/run-fundamental-regression.mts
 *   npm run test:fundamentals
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const {
  FUNDAMENTAL_REGRESSION_UNIVERSE,
  captureFromRating,
  buildSuiteReport,
  formatSuiteReport,
  skippedCapture,
} = await import("../src/lib/analysis/rating/fundamental-regression.ts");

const captures = [];

for (const entry of FUNDAMENTAL_REGRESSION_UNIVERSE) {
  const { symbol, bucket } = entry;
  process.stderr.write(`… ${symbol}\n`);
  try {
    const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
    if (!pkg.fundamentals) {
      captures.push(
        skippedCapture(symbol, bucket, "No fundamentals in package"),
      );
      continue;
    }

    const capture = captureFromRating({
      symbol,
      bucket,
      fundamentals: pkg.fundamentals,
      peers: pkg.peers ?? [],
      peerContext: pkg.peerContext,
      price: pkg.quote?.price ?? null,
    });
    captures.push(capture);
  } catch (err) {
    captures.push(
      skippedCapture(
        symbol,
        bucket,
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}

const report = buildSuiteReport(captures);
const text = formatSuiteReport(report);

const outDir = resolve(process.cwd(), "scripts", "output");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(outDir, `fundamental-regression-${stamp}.md`);
const jsonPath = resolve(outDir, `fundamental-regression-${stamp}.json`);
writeFileSync(reportPath, text, "utf8");
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      tested: report.tested,
      skipped: report.skipped,
      failures: report.failures,
      flags: report.flags,
      byRule: report.byRule,
      anchorsOk: report.anchorsOk,
      captures: report.captures,
      philosophyGaps: [
        "Absolute score scales differ from GF Financial Strength / MS Moat ranks",
        "Peer-relative banding vs GF industry percentile can diverge without data error",
        "Reinvestment soft-weighting is intentional vs pure FCF-first screens",
        "Forward estimates unused until warehouse /analyst-estimates populates",
      ],
    },
    null,
    2,
  ),
  "utf8",
);

console.log(text);
console.log(`\nWrote ${reportPath}`);
console.log(`Wrote ${jsonPath}`);

const hardFails = report.failures.length;
if (hardFails > 0) {
  process.exitCode = 1;
}
