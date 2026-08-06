/**
 * FMP technical-indicators coverage probe (audit only).
 *   npx tsx --tsconfig tsconfig.json scripts/probe-fmp-technicals.mts
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
const base =
  process.env.FMP_API_BASE?.trim() ||
  "https://financialmodelingprep.com/stable";

if (!key) {
  console.error("FMP_API_KEY missing");
  process.exit(1);
}

type Probe = {
  indicator: string;
  symbol: string;
  periodLength: number;
  timeframe: string;
};

const INDICATORS = [
  "rsi",
  "sma",
  "ema",
  "wma",
  "dema",
  "tema",
  "williams",
  "adx",
  "standarddeviation",
  "macd", // may 404 — not in FMP stable docs
] as const;

const SYMBOLS = ["NVDA", "TSLA", "AAPL", "SPY", "MSFT"] as const;

const TIMEFRAMES = ["1day", "1hour", "4hour", "1week"] as const;

const PERIODS: Record<string, number[]> = {
  rsi: [14],
  sma: [20, 50, 200],
  ema: [20, 50, 200],
  wma: [20],
  dema: [20],
  tema: [20],
  williams: [14],
  adx: [14],
  standarddeviation: [20],
  macd: [12], // guess; may fail
};

async function probeOne(p: Probe): Promise<{
  ok: boolean;
  status: number;
  count: number;
  latest: Record<string, unknown> | null;
  bytes: number;
  ms: number;
  error?: string;
}> {
  const url = new URL(`${base}/technical-indicators/${p.indicator}`);
  url.searchParams.set("symbol", p.symbol);
  url.searchParams.set("periodLength", String(p.periodLength));
  url.searchParams.set("timeframe", p.timeframe);
  url.searchParams.set("apikey", key!);

  const t0 = Date.now();
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    const bytes = text.length;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        count: 0,
        latest: null,
        bytes,
        ms,
        error: text.slice(0, 160),
      };
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: res.status,
        count: 0,
        latest: null,
        bytes,
        ms,
        error: "json_parse_fail",
      };
    }
    const arr = Array.isArray(data)
      ? data
      : data &&
          typeof data === "object" &&
          Array.isArray((data as { historical?: unknown }).historical)
        ? (data as { historical: unknown[] }).historical
        : null;
    if (!arr) {
      return {
        ok: false,
        status: res.status,
        count: 0,
        latest: null,
        bytes,
        ms,
        error: `unexpected_shape:${typeof data}`,
      };
    }
    const latest =
      arr.length > 0 && typeof arr[0] === "object" && arr[0] != null
        ? (arr[0] as Record<string, unknown>)
        : null;
    return { ok: true, status: res.status, count: arr.length, latest, bytes, ms };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      count: 0,
      latest: null,
      bytes: 0,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function summarizeLatest(
  indicator: string,
  latest: Record<string, unknown> | null,
): string {
  if (!latest) return "—";
  const keys = Object.keys(latest).filter((k) => k !== "date");
  const interesting = keys.filter((k) =>
    ["rsi", "sma", "ema", "wma", "dema", "tema", "williams", "adx", "standardDeviation", "macd", "signal", "histogram", "close", "open"].some(
      (x) => k.toLowerCase().includes(x.toLowerCase()),
    ),
  );
  const pick = interesting.length > 0 ? interesting : keys.slice(0, 4);
  return pick
    .map((k) => {
      const v = latest[k];
      return typeof v === "number" ? `${k}=${v.toFixed(2)}` : `${k}=${v}`;
    })
    .join(" ");
}

const lines: string[] = [];
lines.push(`base=${base}`);
lines.push("");

// 1) Indicator × timeframe matrix on AAPL (one period each)
lines.push("===== AAPL indicator × timeframe =====");
lines.push(
  ["indicator", "period", "tf", "ok", "n", "kb", "ms", "sample"].join("\t"),
);
for (const indicator of INDICATORS) {
  const period = PERIODS[indicator]?.[0] ?? 14;
  for (const timeframe of TIMEFRAMES) {
    const r = await probeOne({
      indicator,
      symbol: "AAPL",
      periodLength: period,
      timeframe,
    });
    lines.push(
      [
        indicator,
        period,
        timeframe,
        r.ok ? "Y" : `N(${r.status})`,
        r.count,
        (r.bytes / 1024).toFixed(1),
        r.ms,
        r.ok ? summarizeLatest(indicator, r.latest) : (r.error ?? "").slice(0, 80),
      ].join("\t"),
    );
    await new Promise((r) => setTimeout(r, 120));
  }
}

// 2) Multi-ticker RSI14 daily + EMA50/200 daily sample
lines.push("");
lines.push("===== Multi-ticker samples (1day) =====");
lines.push(
  ["sym", "ind", "period", "ok", "n", "kb", "latest"].join("\t"),
);
for (const symbol of SYMBOLS) {
  for (const [indicator, periods] of [
    ["rsi", [14]],
    ["ema", [50, 200]],
    ["adx", [14]],
    ["williams", [14]],
    ["standarddeviation", [20]],
  ] as const) {
    for (const periodLength of periods) {
      const r = await probeOne({
        indicator,
        symbol,
        periodLength,
        timeframe: "1day",
      });
      lines.push(
        [
          symbol,
          indicator,
          periodLength,
          r.ok ? "Y" : `N(${r.status})`,
          r.count,
          (r.bytes / 1024).toFixed(1),
          r.ok
            ? `${latestDate(r.latest)} ${summarizeLatest(indicator, r.latest)}`
            : (r.error ?? "").slice(0, 60),
        ].join("\t"),
      );
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

function latestDate(latest: Record<string, unknown> | null): string {
  if (!latest?.date) return "";
  return String(latest.date).slice(0, 10);
}

// 3) Call-cost estimate note
lines.push("");
lines.push("===== Call-cost sketch =====");
lines.push(
  "If Analysis fetched FMP technicals naively (no warehouse):",
);
lines.push(
  "  RSI14d + EMA50d + EMA200d + ADX14d = 4 calls/symbol/page (cold)",
);
lines.push(
  "  + RSI14w or 1week if supported; + 1hour variants ⇒ easily 6–10 calls",
);
lines.push(
  "  Payload: daily series often full history (~years) → tens–hundreds KB each",
);
lines.push(
  "Prefer: compute from warehouse price_daily/price_hourly (0 extra FMP calls)",
);

console.log(lines.join("\n"));
