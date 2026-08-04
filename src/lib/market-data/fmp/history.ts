import type { OhlcBar } from "@/lib/analysis/rating/types";
import { fmpFetch, num } from "@/lib/market-data/fmp/client";

type FmpDailyRow = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

type FmpIntradayRow = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

function toBar(row: {
  date?: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}): OhlcBar | null {
  if (!row.date) return null;
  const time = Date.parse(row.date);
  const close = num(row.close) ?? num((row as { price?: unknown }).price);
  const open = num(row.open) ?? close;
  const high = num(row.high) ?? close;
  const low = num(row.low) ?? close;
  if (
    !Number.isFinite(time) ||
    close == null ||
    open == null ||
    high == null ||
    low == null ||
    close <= 0
  ) {
    return null;
  }
  return {
    time,
    open,
    high,
    low,
    close,
    volume: num(row.volume),
  };
}

/**
 * Canonical daily history window — month-rounded so cache keys stay stable
 * across the day and cover 5Y charts + technical series in one FMP call.
 */
export function canonicalDailyFrom(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Daily OHLC from FMP stable historical-price-eod/full.
 * Always requests the canonical ~6y window (one cache key per symbol),
 * then filters to `from` in memory when a shorter window is requested.
 */
export async function fetchFmpDailyBars(
  symbol: string,
  options?: { from?: string; to?: string },
): Promise<OhlcBar[]> {
  const upper = symbol.toUpperCase();
  try {
    const data = await fmpFetch<
      { historical?: FmpDailyRow[] } | FmpDailyRow[]
    >({
      path: "/historical-price-eod/full",
      query: {
        symbol: upper,
        from: canonicalDailyFrom(),
        to: options?.to,
      },
      revalidate: 3600,
    });

    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data.historical)
        ? data.historical
        : [];

    const cutoff = options?.from ? Date.parse(options.from) : null;
    const bars: OhlcBar[] = [];
    for (const row of rows) {
      const bar = toBar(row);
      if (!bar) continue;
      if (cutoff != null && Number.isFinite(cutoff) && bar.time < cutoff) {
        continue;
      }
      bars.push(bar);
    }
    return bars.sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

/**
 * Intraday bars (1hour). Used to build 4H confluence without inventing prices.
 */
export async function fetchFmpHourlyBars(
  symbol: string,
): Promise<OhlcBar[]> {
  const upper = symbol.toUpperCase();
  try {
    const rows = await fmpFetch<FmpIntradayRow[]>({
      path: "/historical-chart/1hour",
      query: { symbol: upper },
      revalidate: 900,
    });
    if (!Array.isArray(rows)) return [];
    const bars: OhlcBar[] = [];
    for (const row of rows) {
      const bar = toBar(row);
      if (bar) bars.push(bar);
    }
    return bars.sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export async function fetchFmpAth(symbol: string): Promise<number | null> {
  // Reuse canonical daily cache — avoid a separate 30y pull.
  const bars = await fetchFmpDailyBars(symbol);
  let ath = 0;
  for (const bar of bars) {
    if (bar.high > ath) ath = bar.high;
  }
  return ath > 0 ? ath : null;
}
