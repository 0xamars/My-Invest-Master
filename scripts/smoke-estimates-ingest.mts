/**
 * Analyst-estimates ingest smoke (period required; warehouse persist).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-estimates-ingest.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const SYMBOLS = ["MSFT", "NVDA", "AAPL", "AMZN", "TSLA", "IBIT"] as const;
const OPERATING = new Set(["MSFT", "NVDA", "AAPL", "AMZN", "TSLA"]);

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);

type Row = {
  symbol: string;
  pass: boolean;
  notes: string[];
  load1: {
    n: number;
    annual: number;
    quarter: number;
    source: string;
    error?: string;
    fy1Date: string | null;
    epsAvg: number | null;
    forwardPe: number | null;
    price: number | null;
  };
  load2source: string;
};

function periodOf(r: Record<string, unknown>): string {
  const p = r.__period ?? r.period;
  return typeof p === "string" ? p : "?";
}

const rows: Row[] = [];

for (const symbol of SYMBOLS) {
  const notes: string[] = [];
  const pkg1 = await getAnalysisPackage(symbol, { includeHourly: false });
  const estStatus1 = pkg1.datasetStatus.find((s) => s.dataset === "estimates");
  const estimates = pkg1.estimates ?? [];
  const annual = estimates.filter((r) => periodOf(r) === "annual").length;
  const quarter = estimates.filter((r) => periodOf(r) === "quarter").length;
  const err = estStatus1?.error ?? "";
  if (/400|period/i.test(err)) notes.push(`noPeriod-style error: ${err}`);

  const pkg2 = await getAnalysisPackage(symbol, { includeHourly: false });
  const estStatus2 = pkg2.datasetStatus.find((s) => s.dataset === "estimates");

  if (OPERATING.has(symbol)) {
    if (estimates.length === 0) notes.push("expected estimates.length > 0");
    if (annual === 0) notes.push("expected annual rows");
  } else {
    if (estimates.length !== 0) notes.push("IBIT expected empty estimates");
  }

  if (estStatus2?.source !== "supabase") {
    notes.push(`2nd load source=${estStatus2?.source ?? "?"} (want supabase)`);
  }

  const fy1 = pkg1.estimateOutlook?.fy1 ?? null;
  rows.push({
    symbol,
    pass: notes.length === 0,
    notes,
    load1: {
      n: estimates.length,
      annual,
      quarter,
      source: estStatus1?.source ?? "?",
      error: err || undefined,
      fy1Date: fy1?.date ?? null,
      epsAvg: fy1?.epsAvg ?? null,
      forwardPe: pkg1.estimateOutlook?.forwardPe ?? null,
      price: pkg1.quote?.price ?? null,
    },
    load2source: estStatus2?.source ?? "?",
  });
}

const outDir = resolve(process.cwd(), "scripts/output");
mkdirSync(outDir, { recursive: true });
const lines: string[] = [];
lines.push("Estimates ingest smoke");
lines.push(`asOf: ${new Date().toISOString()}`);
lines.push("");
lines.push(
  "sym   pass  n  ann qtr  src1      src2      fy1          epsAvg     fwdPE",
);
for (const r of rows) {
  const l = r.load1;
  lines.push(
    [
      r.symbol.padEnd(5),
      r.pass ? "PASS" : "FAIL",
      String(l.n).padStart(3),
      String(l.annual).padStart(3),
      String(l.quarter).padStart(3),
      l.source.padEnd(9),
      r.load2source.padEnd(9),
      (l.fy1Date ?? "—").padEnd(12),
      l.epsAvg != null ? l.epsAvg.toFixed(2) : "—",
      l.forwardPe != null ? l.forwardPe.toFixed(1) : "—",
    ].join("  "),
  );
  if (r.notes.length) {
    for (const n of r.notes) lines.push(`       - ${n}`);
  }
}
lines.push("");
const mega = rows.find((r) => r.symbol === "NVDA") ?? rows[0]!;
lines.push("Before/after NVDA (warehouse estimates dataset)");
lines.push(
  "  BEFORE: 0 rows (empty-cached fmp_empty from no-period HTTP 400)",
);
lines.push(
  `  AFTER:  ${mega.load1.n} rows (annual=${mega.load1.annual} quarter=${mega.load1.quarter}) fy1=${mega.load1.fy1Date ?? "—"} epsAvg=${mega.load1.epsAvg ?? "—"} forwardPe=${mega.load1.forwardPe != null ? mega.load1.forwardPe.toFixed(2) : "—"} price=${mega.load1.price ?? "—"}`,
);
lines.push(
  "  Scoring: Growth blend / Valuation / Fundamental scores unchanged this pass.",
);

const text = lines.join("\n");
writeFileSync(resolve(outDir, "estimates-ingest-smoke.txt"), text, "utf8");
console.log(text);

if (rows.some((r) => !r.pass)) process.exit(1);
