/**
 * Read-only Growth coverage audit against FMP warehouse packages.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/audit-growth-coverage.mts
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

const TICKERS = [
  "MSFT",
  "AMZN",
  "TSLA",
  "GOOGL",
  "META",
  "NVDA",
  "HOOD",
  "JPM",
  "INFQ",
  "ONDS",
  "IONQ",
  "PLTR",
] as const;

type Row = Record<string, unknown>;

function isEmptyRow(r: Row | null | undefined): boolean {
  return !r || r.__empty === true;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(row: Row | null | undefined, ...keys: string[]): number | null {
  if (!row) return null;
  for (const k of keys) {
    const v = num(row[k]);
    if (v != null) return v;
  }
  return null;
}

function pickAny(rows: Row[], ...keys: string[]): { value: number | null; key: string | null } {
  for (const row of rows) {
    if (isEmptyRow(row)) continue;
    for (const k of keys) {
      const v = num(row[k]);
      if (v != null) return { value: v, key: k };
    }
  }
  return { value: null, key: null };
}

function seriesLen(rows: Row[], ...keys: string[]): number {
  let n = 0;
  for (const row of rows) {
    if (isEmptyRow(row)) continue;
    if (pick(row, ...keys) != null) n++;
  }
  return n;
}

function canComputeCagr(rows: Row[], years: number, ...keys: string[]): boolean {
  const slice = rows.filter((r) => !isEmptyRow(r)).slice(0, years + 1);
  if (slice.length < years + 1) return false;
  const newest = pick(slice[0], ...keys);
  const oldest = pick(slice[years], ...keys);
  return newest != null && oldest != null && oldest > 0 && newest > 0;
}

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function cell(available: boolean, sample?: string | null): string {
  if (!available) return "missing";
  return sample ? `avail (${sample})` : "avail";
}

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);

type TickerAudit = {
  symbol: string;
  skipped: boolean;
  skipReason: string | null;
  degraded: boolean;
  confidenceNote: string | null;
  period: string | null;
  growthDataset: { source: string; rows: number; emptyCached: boolean; keysSample: string[] };
  estimatesDataset: {
    source: string;
    rows: number;
    emptyCached: boolean;
    keysSample: string[];
    horizons: string[];
  };
  current: {
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    fcfGrowth: number | null;
    opIncomeGrowthPkg: number | null;
    ebitdaGrowthPkg: number | null;
    growthSourceNote: string | null;
  };
  history: {
    annualRevLen: number;
    annualEpsLen: number;
    annualNiLen: number;
    annualFcfLen: number;
    annualOpLen: number;
    annualEbitdaLen: number;
    cagr3yRevComputable: boolean;
    cagr3yEpsComputable: boolean;
    cagr3yOpComputable: boolean;
    cagr3yFcfComputable: boolean;
    revenueGrowth3y: number | null;
    earningsGrowth3y: number | null;
    operatingGrowth3y: number | null;
    native3yKeys: string[];
  };
  forward: {
    estimatesPresent: boolean;
    revenueEstimateGrowth: number | null;
    earningsEstimateGrowth: number | null;
    revenueAvg: number | null;
    epsAvg: number | null;
    estimatedRevenueGrowthNative: number | null;
    estimatedEpsGrowthNative: number | null;
    longTermGrowthRate: number | null;
    dateKeys: string[];
    notes: string[];
  };
  datasetStatus: Array<{ dataset: string; source: string; error?: string }>;
};

const audits: TickerAudit[] = [];

for (const symbol of TICKERS) {
  process.stderr.write(`… ${symbol}\n`);
  try {
    const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
    const f = pkg.fundamentals;
    if (!f) {
      audits.push({
        symbol,
        skipped: true,
        skipReason: "No fundamentals in package",
        degraded: pkg.degraded,
        confidenceNote: pkg.confidenceNote,
        period: null,
        growthDataset: { source: "?", rows: 0, emptyCached: true, keysSample: [] },
        estimatesDataset: {
          source: "?",
          rows: 0,
          emptyCached: true,
          keysSample: [],
          horizons: [],
        },
        current: {
          revenueGrowth: null,
          earningsGrowth: null,
          fcfGrowth: null,
          opIncomeGrowthPkg: null,
          ebitdaGrowthPkg: null,
          growthSourceNote: null,
        },
        history: {
          annualRevLen: 0,
          annualEpsLen: 0,
          annualNiLen: 0,
          annualFcfLen: 0,
          annualOpLen: 0,
          annualEbitdaLen: 0,
          cagr3yRevComputable: false,
          cagr3yEpsComputable: false,
          cagr3yOpComputable: false,
          cagr3yFcfComputable: false,
          revenueGrowth3y: null,
          earningsGrowth3y: null,
          operatingGrowth3y: null,
          native3yKeys: [],
        },
        forward: {
          estimatesPresent: false,
          revenueEstimateGrowth: null,
          earningsEstimateGrowth: null,
          revenueAvg: null,
          epsAvg: null,
          estimatedRevenueGrowthNative: null,
          estimatedEpsGrowthNative: null,
          longTermGrowthRate: null,
          dateKeys: [],
          notes: ["fundamentals missing"],
        },
        datasetStatus: pkg.datasetStatus.map((s) => ({
          dataset: s.dataset,
          source: s.source,
          error: s.error,
        })),
      });
      continue;
    }

    const growthStatus = pkg.datasetStatus.find((s) => s.dataset === "growth");
    const estimatesStatus = pkg.datasetStatus.find(
      (s) => s.dataset === "estimates",
    );
    const growthRows = (pkg.growth ?? []).filter((r) => !isEmptyRow(r as Row));
    const estimateRows = (pkg.estimates ?? []).filter(
      (r) => !isEmptyRow(r as Row),
    );
    const incomeAnnual = pkg.statements.income.annual ?? [];
    const cashflowAnnual = pkg.statements.cashflow.annual ?? [];

    const keySet = new Set<string>();
    for (const row of growthRows.slice(0, 5)) {
      for (const k of Object.keys(row as Row)) {
        if (/growth|cagr|3y|three/i.test(k)) keySet.add(k);
      }
    }
    const native3yKeys = [...keySet].filter((k) =>
      /3y|three|cagr/i.test(k),
    );

    const estKeySet = new Set<string>();
    const dateKeys: string[] = [];
    for (const row of estimateRows.slice(0, 8)) {
      for (const [k, v] of Object.entries(row as Row)) {
        estKeySet.add(k);
        if (/date|year|period|fiscal/i.test(k) && v != null) {
          dateKeys.push(`${k}=${String(v)}`);
        }
      }
    }

    const firstEst = (estimateRows[0] as Row | undefined) ?? null;
    const opPkg = pickAny(
      growthRows as Row[],
      "operatingIncomeGrowth",
      "growthOperatingIncome",
      "ebitGrowth",
    );
    const ebitdaPkg = pickAny(
      growthRows as Row[],
      "ebitdaGrowth",
      "growthEBITDA",
      "ebitdarGrowth",
    );

    const revG = pickAny(
      growthRows as Row[],
      "revenueGrowth",
      "growthRevenue",
      "growthInRevenue",
    );
    const epsG = pickAny(
      growthRows as Row[],
      "epsgrowth",
      "epsGrowth",
      "growthEPS",
      "growthEPSDiluted",
      "netIncomeGrowth",
      "growthNetIncome",
    );
    const fcfG = pickAny(
      growthRows as Row[],
      "freeCashFlowGrowth",
      "growthFreeCashFlow",
      "fcfGrowth",
    );

    const notes: string[] = [];
    if (estimateRows.length === 0) notes.push("estimates empty");
    if (growthRows.length === 0) notes.push("growth dataset empty");
    if (f.earningsEstimateGrowth == null) {
      notes.push("earningsEstimateGrowth always null in warehouse builder");
    }

    audits.push({
      symbol,
      skipped: false,
      skipReason: null,
      degraded: pkg.degraded,
      confidenceNote: pkg.confidenceNote,
      period: f.fundamentalPeriod ?? null,
      growthDataset: {
        source: growthStatus?.source ?? "missing",
        rows: growthRows.length,
        emptyCached:
          growthStatus?.source === "supabase" && growthRows.length === 0,
        keysSample: [...keySet].slice(0, 24),
      },
      estimatesDataset: {
        source: estimatesStatus?.source ?? "missing",
        rows: estimateRows.length,
        emptyCached:
          estimatesStatus?.source === "supabase" && estimateRows.length === 0,
        keysSample: [...estKeySet].slice(0, 30),
        horizons: dateKeys.slice(0, 12),
      },
      current: {
        revenueGrowth: f.revenueGrowth,
        earningsGrowth: f.earningsGrowth,
        fcfGrowth: f.fcfGrowth,
        opIncomeGrowthPkg: opPkg.value,
        ebitdaGrowthPkg: ebitdaPkg.value,
        growthSourceNote: f.growthSourceNote ?? null,
      },
      history: {
        annualRevLen: seriesLen(incomeAnnual as Row[], "revenue"),
        annualEpsLen: seriesLen(incomeAnnual as Row[], "epsdiluted", "eps"),
        annualNiLen: seriesLen(incomeAnnual as Row[], "netIncome"),
        annualFcfLen: seriesLen(cashflowAnnual as Row[], "freeCashFlow"),
        annualOpLen: seriesLen(
          incomeAnnual as Row[],
          "operatingIncome",
          "ebit",
        ),
        annualEbitdaLen: seriesLen(incomeAnnual as Row[], "ebitda"),
        cagr3yRevComputable: canComputeCagr(
          incomeAnnual as Row[],
          3,
          "revenue",
        ),
        cagr3yEpsComputable: canComputeCagr(
          incomeAnnual as Row[],
          3,
          "epsdiluted",
          "eps",
        ),
        cagr3yOpComputable: canComputeCagr(
          incomeAnnual as Row[],
          3,
          "operatingIncome",
          "ebit",
        ),
        cagr3yFcfComputable: canComputeCagr(
          cashflowAnnual as Row[],
          3,
          "freeCashFlow",
        ),
        revenueGrowth3y: f.revenueGrowth3y,
        earningsGrowth3y: f.earningsGrowth3y,
        operatingGrowth3y: f.operatingGrowth3y,
        native3yKeys,
      },
      forward: {
        estimatesPresent: estimateRows.length > 0,
        revenueEstimateGrowth: f.revenueEstimateGrowth,
        earningsEstimateGrowth: f.earningsEstimateGrowth,
        revenueAvg: pick(
          firstEst,
          "revenueAvg",
          "estimatedRevenueAvg",
          "estimatedRevenueHigh",
        ),
        epsAvg: pick(
          firstEst,
          "epsAvg",
          "estimatedEpsAvg",
          "estimatedEpsAvg",
          "epsEstimatedAvg",
        ),
        estimatedRevenueGrowthNative: pick(
          firstEst,
          "revenueGrowth",
          "estimatedRevenueGrowth",
          "growthRevenue",
        ),
        estimatedEpsGrowthNative: pick(
          firstEst,
          "epsGrowth",
          "estimatedEpsGrowth",
          "growthEps",
        ),
        longTermGrowthRate: pick(
          firstEst,
          "longTermGrowthRate",
          "longtermGrowthRate",
          "ltGrowthRate",
          "growthRate",
        ),
        dateKeys: dateKeys.slice(0, 12),
        notes,
      },
      datasetStatus: pkg.datasetStatus
        .filter((s) =>
          ["growth", "estimates", "income_annual", "cashflow_annual", "income_ttm"].includes(
            s.dataset,
          ),
        )
        .map((s) => ({
          dataset: s.dataset,
          source: s.source,
          error: s.error,
        })),
      // also stash raw package picks for matrix
      _pkgRev: revG,
      _pkgEps: epsG,
      _pkgFcf: fcfG,
    } as TickerAudit & Record<string, unknown>);
  } catch (err) {
    audits.push({
      symbol,
      skipped: true,
      skipReason: err instanceof Error ? err.message : String(err),
      degraded: false,
      confidenceNote: null,
      period: null,
      growthDataset: { source: "error", rows: 0, emptyCached: false, keysSample: [] },
      estimatesDataset: {
        source: "error",
        rows: 0,
        emptyCached: false,
        keysSample: [],
        horizons: [],
      },
      current: {
        revenueGrowth: null,
        earningsGrowth: null,
        fcfGrowth: null,
        opIncomeGrowthPkg: null,
        ebitdaGrowthPkg: null,
        growthSourceNote: null,
      },
      history: {
        annualRevLen: 0,
        annualEpsLen: 0,
        annualNiLen: 0,
        annualFcfLen: 0,
        annualOpLen: 0,
        annualEbitdaLen: 0,
        cagr3yRevComputable: false,
        cagr3yEpsComputable: false,
        cagr3yOpComputable: false,
        cagr3yFcfComputable: false,
        revenueGrowth3y: null,
        earningsGrowth3y: null,
        operatingGrowth3y: null,
        native3yKeys: [],
      },
      forward: {
        estimatesPresent: false,
        revenueEstimateGrowth: null,
        earningsEstimateGrowth: null,
        revenueAvg: null,
        epsAvg: null,
        estimatedRevenueGrowthNative: null,
        estimatedEpsGrowthNative: null,
        longTermGrowthRate: null,
        dateKeys: [],
        notes: ["load error"],
      },
      datasetStatus: [],
    });
  }
}

function mark(ok: boolean, sample?: string | null): string {
  if (!ok) return "missing";
  return sample ? `Y (${sample})` : "Y";
}

const metrics = [
  "period",
  "revGrowth(current)",
  "epsGrowth(current)",
  "fcfGrowth(current)",
  "opIncGrowth(pkg)",
  "ebitdaGrowth(pkg)",
  "annualRev#",
  "annualEps#",
  "annualFcf#",
  "annualOp#",
  "3yRev CAGR computable",
  "3yEps CAGR computable",
  "3yOp CAGR computable",
  "3yFcf CAGR computable",
  "revGrowth3y (derived)",
  "epsGrowth3y (derived)",
  "opGrowth3y (derived)",
  "native 3Y/CAGR keys",
  "estimates rows",
  "revEstimateGrowth (derived)",
  "epsEstimateGrowth (derived)",
  "est revenueAvg",
  "est epsAvg",
  "native est rev growth field",
  "native est eps growth field",
  "LT growth rate",
  "degraded",
] as const;

const lines: string[] = [];
lines.push("# Growth coverage audit (warehouse packages)");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push("## 1) Field matrix");
lines.push("");

// Compact markdown table — one section per ticker for readability, then summary matrix
lines.push("| Metric | " + TICKERS.join(" | ") + " |");
lines.push("|---| " + TICKERS.map(() => "---").join(" | ") + " |");

function row(label: string, fn: (a: TickerAudit) => string) {
  lines.push(
    `| ${label} | ` +
      TICKERS.map((t) => {
        const a = audits.find((x) => x.symbol === t)!;
        if (a.skipped) return a.skipReason?.slice(0, 24) ?? "skip";
        return fn(a);
      }).join(" | ") +
      " |",
  );
}

row("period", (a) => a.period ?? "—");
row("revGrowth", (a) => mark(a.current.revenueGrowth != null, pct(a.current.revenueGrowth)));
row("epsGrowth", (a) => mark(a.current.earningsGrowth != null, pct(a.current.earningsGrowth)));
row("fcfGrowth", (a) => mark(a.current.fcfGrowth != null, pct(a.current.fcfGrowth)));
row("opIncGrowth pkg", (a) => mark(a.current.opIncomeGrowthPkg != null, pct(a.current.opIncomeGrowthPkg)));
row("ebitdaGrowth pkg", (a) => mark(a.current.ebitdaGrowthPkg != null, pct(a.current.ebitdaGrowthPkg)));
row("annualRev n", (a) => String(a.history.annualRevLen));
row("annualEps n", (a) => String(a.history.annualEpsLen));
row("annualFcf n", (a) => String(a.history.annualFcfLen));
row("annualOp n", (a) => String(a.history.annualOpLen));
row("3yRev computable", (a) => (a.history.cagr3yRevComputable ? "Y" : "N"));
row("3yEps computable", (a) => (a.history.cagr3yEpsComputable ? "Y" : "N"));
row("3yOp computable", (a) => (a.history.cagr3yOpComputable ? "Y" : "N"));
row("3yFcf computable", (a) => (a.history.cagr3yFcfComputable ? "Y" : "N"));
row("revGrowth3y", (a) => mark(a.history.revenueGrowth3y != null, pct(a.history.revenueGrowth3y)));
row("epsGrowth3y", (a) => mark(a.history.earningsGrowth3y != null, pct(a.history.earningsGrowth3y)));
row("opGrowth3y", (a) => mark(a.history.operatingGrowth3y != null, pct(a.history.operatingGrowth3y)));
row("native 3Y keys", (a) => (a.history.native3yKeys.length ? a.history.native3yKeys.slice(0, 3).join(",") : "none"));
row("estimates n", (a) => String(a.estimatesDataset.rows));
row("revEstGrowth", (a) => mark(a.forward.revenueEstimateGrowth != null, pct(a.forward.revenueEstimateGrowth)));
row("epsEstGrowth", (a) => mark(a.forward.earningsEstimateGrowth != null, pct(a.forward.earningsEstimateGrowth)));
row("est revenueAvg", (a) => mark(a.forward.revenueAvg != null, a.forward.revenueAvg != null ? String(Math.round(a.forward.revenueAvg / 1e9)) + "B" : null));
row("est epsAvg", (a) => mark(a.forward.epsAvg != null, a.forward.epsAvg != null ? a.forward.epsAvg.toFixed(2) : null));
row("native est revG", (a) => mark(a.forward.estimatedRevenueGrowthNative != null, pct(a.forward.estimatedRevenueGrowthNative)));
row("native est epsG", (a) => mark(a.forward.estimatedEpsGrowthNative != null, pct(a.forward.estimatedEpsGrowthNative)));
row("LT growth", (a) => mark(a.forward.longTermGrowthRate != null, pct(a.forward.longTermGrowthRate)));
row("growth ds", (a) => `${a.growthDataset.source}/${a.growthDataset.rows}`);
row("estimates ds", (a) => `${a.estimatesDataset.source}/${a.estimatesDataset.rows}`);
row("degraded", (a) => (a.degraded ? "Y" : "N"));

lines.push("");
lines.push("## Per-ticker notes");
lines.push("");
for (const a of audits) {
  lines.push(`### ${a.symbol}`);
  if (a.skipped) {
    lines.push(`- SKIP: ${a.skipReason}`);
    lines.push("");
    continue;
  }
  lines.push(`- period=${a.period}; degraded=${a.degraded}; note=${a.confidenceNote ?? "—"}`);
  lines.push(`- growthSource: ${a.current.growthSourceNote ?? "—"}`);
  lines.push(
    `- growth dataset: source=${a.growthDataset.source} rows=${a.growthDataset.rows} keys=${a.growthDataset.keysSample.join(", ") || "—"}`,
  );
  lines.push(
    `- estimates dataset: source=${a.estimatesDataset.source} rows=${a.estimatesDataset.rows} horizons=${a.estimatesDataset.horizons.join("; ") || "—"}`,
  );
  lines.push(
    `- estimate keys sample: ${a.estimatesDataset.keysSample.join(", ") || "—"}`,
  );
  lines.push(`- forward notes: ${a.forward.notes.join("; ") || "—"}`);
  lines.push(
    `- datasetStatus: ${a.datasetStatus.map((s) => `${s.dataset}:${s.source}${s.error ? `(${s.error})` : ""}`).join(", ")}`,
  );
  lines.push("");
}

// Coverage summary counts
const active = audits.filter((a) => !a.skipped);
function coverage(pred: (a: TickerAudit) => boolean): string {
  const n = active.filter(pred).length;
  return `${n}/${active.length}`;
}

lines.push("## 2) Summary — safe Growth sleeves");
lines.push("");
lines.push(`- Tickers loaded: ${active.length}/${TICKERS.length} (skipped: ${audits.filter((a) => a.skipped).map((a) => a.symbol).join(", ") || "none"})`);
lines.push(`- Current revGrowth: ${coverage((a) => a.current.revenueGrowth != null)}`);
lines.push(`- Current epsGrowth: ${coverage((a) => a.current.earningsGrowth != null)}`);
lines.push(`- Current fcfGrowth: ${coverage((a) => a.current.fcfGrowth != null)}`);
lines.push(`- Op income growth (package): ${coverage((a) => a.current.opIncomeGrowthPkg != null)}`);
lines.push(`- EBITDA growth (package): ${coverage((a) => a.current.ebitdaGrowthPkg != null)}`);
lines.push(`- 3Y rev computable from annual: ${coverage((a) => a.history.cagr3yRevComputable)}`);
lines.push(`- 3Y eps computable from annual: ${coverage((a) => a.history.cagr3yEpsComputable)}`);
lines.push(`- 3Y op computable from annual: ${coverage((a) => a.history.cagr3yOpComputable)}`);
lines.push(`- 3Y fcf computable from annual: ${coverage((a) => a.history.cagr3yFcfComputable)}`);
lines.push(`- Derived revGrowth3y present: ${coverage((a) => a.history.revenueGrowth3y != null)}`);
lines.push(`- Derived epsGrowth3y present: ${coverage((a) => a.history.earningsGrowth3y != null)}`);
lines.push(`- Native 3Y/CAGR keys in growth rows: ${coverage((a) => a.history.native3yKeys.length > 0)}`);
lines.push(`- Estimates rows present: ${coverage((a) => a.forward.estimatesPresent)}`);
lines.push(`- Derived revenueEstimateGrowth: ${coverage((a) => a.forward.revenueEstimateGrowth != null)}`);
lines.push(`- Derived earningsEstimateGrowth: ${coverage((a) => a.forward.earningsEstimateGrowth != null)}`);
lines.push(`- Native estimate growth fields: rev ${coverage((a) => a.forward.estimatedRevenueGrowthNative != null)}, eps ${coverage((a) => a.forward.estimatedEpsGrowthNative != null)}`);
lines.push(`- Long-term growth rate field: ${coverage((a) => a.forward.longTermGrowthRate != null)}`);
lines.push("");

const outDir = resolve(process.cwd(), "scripts/output");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const mdPath = resolve(outDir, `growth-coverage-${stamp}.md`);
const jsonPath = resolve(outDir, `growth-coverage-${stamp}.json`);
writeFileSync(mdPath, lines.join("\n"), "utf8");
writeFileSync(jsonPath, JSON.stringify(audits, null, 2), "utf8");
process.stdout.write(lines.join("\n") + "\n");
process.stderr.write(`\nWrote ${mdPath}\nWrote ${jsonPath}\n`);

// silence unused
void metrics;
void cell;
