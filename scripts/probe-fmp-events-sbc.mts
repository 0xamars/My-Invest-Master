/**
 * Probe FMP insider / M&A / cash-flow SBC fields.
 *   npx tsx --tsconfig tsconfig.json scripts/probe-fmp-events-sbc.mts
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

const key = process.env.FMP_API_KEY?.trim();
const base = (
  process.env.FMP_API_BASE?.trim() ||
  "https://financialmodelingprep.com/stable"
).replace(/\/$/, "");

if (!key) {
  console.error("FMP_API_KEY missing");
  process.exit(1);
}

async function hit(
  path: string,
  q: Record<string, string | number> = {},
): Promise<void> {
  const u = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  u.searchParams.set("apikey", key!);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, String(v));
  try {
    const res = await fetch(u);
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 220);
    }
    const n = Array.isArray(parsed)
      ? parsed.length
      : parsed && typeof parsed === "object"
        ? Object.keys(parsed as object).length
        : typeof parsed;
    const sample = Array.isArray(parsed) ? parsed[0] : parsed;
    console.log(`\n=== ${res.status} ${path} ${JSON.stringify(q)} n=${n}`);
    console.log(JSON.stringify(sample, null, 0)?.slice(0, 900));
  } catch (e) {
    console.log(`\n=== ERR ${path}`, e);
  }
}

await hit("/insider-trading/statistics", { symbol: "TSLA" });
await hit("/insider-trading-statistics", { symbol: "AAPL" });
await hit("/mergers-acquisitions-search", { name: "Microsoft" });
await hit("/income-statement", { symbol: "MSFT", period: "annual", limit: 1 });
await hit("/cash-flow-statement", { symbol: "MSFT", period: "quarter", limit: 1 });
await hit("/insider-trading/search", { symbol: "MSFT", page: 0, limit: 8 });
