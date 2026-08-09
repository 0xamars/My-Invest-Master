/**
 * Live FMP analyst-estimates coverage probe (no scoring changes).
 *   npx tsx --tsconfig tsconfig.json scripts/probe-fmp-estimates.mts
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

const key = process.env.FMP_API_KEY?.trim();
const base = (
  process.env.FMP_API_BASE?.trim() ||
  "https://financialmodelingprep.com/stable"
).replace(/\/$/, "");

if (!key) {
  console.error("FMP_API_KEY missing");
  process.exit(1);
}

const SYMBOLS = [
  "NVDA",
  "MSFT",
  "AAPL",
  "AMZN",
  "TSLA",
  "HOOD",
  "RIVN",
  "JPM",
  "MSTR",
  "IBIT",
] as const;

type EstRow = Record<string, unknown>;

type FetchResult = {
  status: number;
  ok: boolean;
  rows: EstRow[];
  error?: string;
  bytes: number;
};

async function fmpGet(
  path: string,
  query: Record<string, string | number>,
): Promise<FetchResult> {
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("apikey", key!);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        status: res.status,
        ok: false,
        rows: [],
        error: text.slice(0, 200),
        bytes: text.length,
      };
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        status: res.status,
        ok: false,
        rows: [],
        error: "json_parse_fail",
        bytes: text.length,
      };
    }
    const rows = Array.isArray(data)
      ? (data as EstRow[])
      : data && typeof data === "object" && Array.isArray((data as { historical?: unknown }).historical)
        ? ((data as { historical: EstRow[] }).historical ?? [])
        : [];
    return { status: res.status, ok: true, rows, bytes: text.length };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      rows: [],
      error: e instanceof Error ? e.message : String(e),
      bytes: 0,
    };
  }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
    return Number(v);
  return null;
}

function rowDate(r: EstRow): string | null {
  const d = r.date ?? r.fiscalDate ?? r.period ?? r.calendarYear;
  return d == null ? null : String(d).slice(0, 10);
}

function analystCountKeys(r: EstRow): string[] {
  return Object.keys(r).filter((k) =>
    /numAnalyst|numberOfAnalyst|analysts/i.test(k),
  );
}

function pickEst(r: EstRow): {
  date: string | null;
  revenueAvg: number | null;
  epsAvg: number | null;
  analysts: string;
} {
  const analysts = analystCountKeys(r)
    .map((k) => `${k}=${r[k]}`)
    .join(" ");
  return {
    date: rowDate(r),
    revenueAvg: num(r.revenueAvg ?? r.estimatedRevenueAvg ?? r.revenue),
    epsAvg: num(r.epsAvg ?? r.estimatedEpsAvg ?? r.eps),
    analysts: analysts || "—",
  };
}

function nearestFuture(
  rows: EstRow[],
): { date: string; field: string; value: number } | null {
  const today = new Date().toISOString().slice(0, 10);
  const future = rows
    .map((r) => ({ row: r, ...pickEst(r) }))
    .filter((x) => x.date && x.date >= today && (x.revenueAvg != null || x.epsAvg != null))
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const hit = future[0];
  if (!hit?.date) return null;
  if (hit.revenueAvg != null)
    return { date: hit.date, field: "revenueAvg", value: hit.revenueAvg };
  return { date: hit.date, field: "epsAvg", value: hit.epsAvg! };
}

function hasFy1(
  rows: EstRow[],
  field: "revenueAvg" | "epsAvg",
): boolean {
  return nearestFuture(rows)?.field === field || nearestFuture(rows) != null
    ? rows.some((r) => {
        const p = pickEst(r);
        if (!p.date) return false;
        const today = new Date().toISOString().slice(0, 10);
        if (p.date < today) return false;
        return field === "revenueAvg" ? p.revenueAvg != null : p.epsAvg != null;
      })
    : false;
}

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const store = await import("../src/lib/market-data/warehouse/store.ts");

const outDir = resolve(process.cwd(), "scripts", "output");
mkdirSync(outDir, { recursive: true });

const table: string[] = [];
table.push(
  [
    "symbol",
    "annual_rows",
    "quarter_rows",
    "has_fy1_rev",
    "has_fy1_eps",
    "warehouse_status",
    "notes",
  ].join("\t"),
);

const detail: string[] = [];
detail.push(`base=${base}`);
detail.push(`client_ingest=/analyst-estimates?symbol=&limit=8  (NO period)`);
detail.push("");

let aaplAnnual: EstRow[] | null = null;

for (const symbol of SYMBOLS) {
  const annual = await fmpGet("/analyst-estimates", {
    symbol,
    period: "annual",
    limit: 10,
  });
  await new Promise((r) => setTimeout(r, 80));
  const quarter = await fmpGet("/analyst-estimates", {
    symbol,
    period: "quarter",
    limit: 8,
  });
  await new Promise((r) => setTimeout(r, 80));

  // Our current client path: no period
  const noPeriod = await fmpGet("/analyst-estimates", {
    symbol,
    limit: 8,
  });
  await new Promise((r) => setTimeout(r, 80));

  // Alternate docs path
  const financialEst = await fmpGet("/financial-estimates", {
    symbol,
    period: "annual",
    limit: 10,
  });
  await new Promise((r) => setTimeout(r, 80));

  if (symbol === "AAPL" && annual.ok) aaplAnnual = annual.rows;

  const fy1A = nearestFuture(annual.rows);
  const fy1Q = nearestFuture(quarter.rows);
  const hasFy1Rev =
    hasFy1(annual.rows, "revenueAvg") || hasFy1(quarter.rows, "revenueAvg");
  const hasFy1Eps =
    hasFy1(annual.rows, "epsAvg") || hasFy1(quarter.rows, "epsAvg");

  let warehouseStatus = "unknown";
  let warehouseNotes = "";
  try {
    const refresh = await store.getRefreshState(symbol, "estimates");
    const { data, updatedAt } = await store.readMetrics(symbol, "estimates");
    const emptyMarker = store.isEmptyMarker(data);
    const rows = Array.isArray(data)
      ? data.filter((r) => r && (r as { __empty?: boolean }).__empty !== true)
      : data
        ? [data]
        : [];
    const liveNonEmpty = annual.rows.length > 0 || quarter.rows.length > 0;
    if (emptyMarker || (rows.length === 0 && refresh?.status === "empty")) {
      warehouseStatus = liveNonEmpty
        ? "empty-cached BUT live non-empty"
        : "empty-cached (live also empty)";
    } else if (rows.length === 0) {
      warehouseStatus = liveNonEmpty
        ? "missing/empty vs live data"
        : "missing (live empty)";
    } else {
      warehouseStatus = `cached n=${rows.length} src=${refresh?.status ?? "?"} asOf=${updatedAt ?? refresh?.last_success_at ?? "?"}`;
    }
    warehouseNotes = `refresh=${refresh?.status ?? "none"} err=${refresh?.error_message ?? "—"}`;
  } catch (e) {
    warehouseStatus = `store_error`;
    warehouseNotes = String(e).slice(0, 80);
  }

  // Also check package estimates after warehouse load (may refresh)
  let pkgN = -1;
  try {
    const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
    pkgN = Array.isArray(pkg.estimates) ? pkg.estimates.length : 0;
  } catch {
    pkgN = -1;
  }

  const notes: string[] = [];
  notes.push(
    `http A=${annual.status}/${annual.ok ? "ok" : "fail"} Q=${quarter.status}/${quarter.ok ? "ok" : "fail"}`,
  );
  notes.push(`noPeriod_rows=${noPeriod.rows.length}(${noPeriod.status})`);
  notes.push(
    `financial-estimates_rows=${financialEst.rows.length}(${financialEst.status})`,
  );
  notes.push(`pkg.estimates=${pkgN}`);
  if (fy1A) notes.push(`fy1A=${fy1A.date} ${fy1A.field}`);
  else notes.push("fy1A=none");
  if (fy1Q) notes.push(`fy1Q=${fy1Q.date} ${fy1Q.field}`);
  if (annual.error) notes.push(`Aerr=${annual.error.slice(0, 60)}`);
  if (quarter.error) notes.push(`Qerr=${quarter.error.slice(0, 60)}`);
  notes.push(warehouseNotes);

  table.push(
    [
      symbol,
      annual.ok ? String(annual.rows.length) : `ERR${annual.status}`,
      quarter.ok ? String(quarter.rows.length) : `ERR${quarter.status}`,
      hasFy1Rev ? "Y" : "N",
      hasFy1Eps ? "Y" : "N",
      warehouseStatus,
      notes.join("; "),
    ].join("\t"),
  );

  detail.push(`===== ${symbol} =====`);
  detail.push(
    `annual status=${annual.status} n=${annual.rows.length} bytes=${annual.bytes}`,
  );
  if (annual.rows[0]) {
    detail.push(`annual first keys: ${Object.keys(annual.rows[0]).join(", ")}`);
  }
  for (const r of annual.rows) {
    const p = pickEst(r);
    detail.push(
      `  A ${p.date} revAvg=${p.revenueAvg ?? "null"} epsAvg=${p.epsAvg ?? "null"} ${p.analysts}`,
    );
  }
  detail.push(
    `quarter status=${quarter.status} n=${quarter.rows.length} bytes=${quarter.bytes}`,
  );
  if (quarter.rows[0]) {
    detail.push(`quarter first keys: ${Object.keys(quarter.rows[0]).join(", ")}`);
  }
  for (const r of quarter.rows) {
    const p = pickEst(r);
    detail.push(
      `  Q ${p.date} revAvg=${p.revenueAvg ?? "null"} epsAvg=${p.epsAvg ?? "null"} ${p.analysts}`,
    );
  }
  detail.push(
    `noPeriod n=${noPeriod.rows.length} financial-estimates n=${financialEst.rows.length}`,
  );
  detail.push(`nearest future A=${fy1A ? `${fy1A.date} ${fy1A.field}=${fy1A.value}` : "none"} Q=${fy1Q ? `${fy1Q.date} ${fy1Q.field}=${fy1Q.value}` : "none"}`);
  detail.push("");
}

if (aaplAnnual) {
  const samplePath = resolve(outDir, "fmp-analyst-estimates-AAPL-annual.json");
  writeFileSync(samplePath, JSON.stringify(aaplAnnual, null, 2), "utf8");
  detail.push(`Wrote AAPL annual sample → ${samplePath}`);
}

const report = [table.join("\n"), "", detail.join("\n")].join("\n");
const reportPath = resolve(outDir, "fmp-estimates-probe.txt");
writeFileSync(reportPath, report, "utf8");
console.log(table.join("\n"));
console.log(`\nWrote ${reportPath}`);
if (aaplAnnual) {
  console.log(
    `Wrote AAPL annual JSON (${aaplAnnual.length} rows) → scripts/output/fmp-analyst-estimates-AAPL-annual.json`,
  );
}
