import type { AnalysisAssetType, AnalysisChartRange } from "@/lib/analysis/types";
import type { OhlcBar } from "@/lib/analysis/rating/types";
import { allowYahooFallback, isFmpConfigured } from "@/lib/market-data/config";
import {
  fetchFmpAth,
  fetchFmpDailyBars,
  fetchFmpHourlyBars,
} from "@/lib/market-data/fmp/history";
import { isFmpRateLimited } from "@/lib/market-data/fmp/client";

export type AnalysisChartPoint = {
  time: number;
  close: number;
};

export const CHART_RANGE_MS: Record<AnalysisChartRange, number> = {
  "1D": 2 * 24 * 60 * 60 * 1000,
  "1W": 8 * 24 * 60 * 60 * 1000,
  "1M": 35 * 24 * 60 * 60 * 1000,
  "3M": 100 * 24 * 60 * 60 * 1000,
  "1Y": 400 * 24 * 60 * 60 * 1000,
  "5Y": 5.2 * 365 * 24 * 60 * 60 * 1000,
};

export function resolveHistorySymbol(
  symbol: string,
  type: AnalysisAssetType,
): string {
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (type === "crypto") {
    if (upper.endsWith("-USD") || upper.endsWith("-USDT")) return upper;
    return `${upper}-USD`;
  }
  return upper;
}

/** @deprecated Use resolveHistorySymbol */
export const resolveYahooHistorySymbol = resolveHistorySymbol;

async function fetchYahooOhlcBars(input: {
  symbol: string;
  interval: "1d" | "1h";
  period1: Date;
}): Promise<OhlcBar[]> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
    });
    const result = await yahooFinance.chart(input.symbol, {
      period1: input.period1,
      period2: new Date(),
      interval: input.interval,
    });
    const bars: OhlcBar[] = [];
    for (const quote of result.quotes ?? []) {
      const close = quote.close;
      const open = quote.open ?? close;
      const high = quote.high ?? close;
      const low = quote.low ?? close;
      const time = quote.date?.getTime();
      if (
        time == null ||
        close == null ||
        open == null ||
        high == null ||
        low == null ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        continue;
      }
      bars.push({
        time,
        open,
        high,
        low,
        close,
        volume:
          typeof quote.volume === "number" && Number.isFinite(quote.volume)
            ? quote.volume
            : null,
      });
    }
    return bars.sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export async function fetchOhlcBars(input: {
  symbol: string;
  type?: AnalysisAssetType;
  interval: "1d" | "1h";
  period1: Date | string;
}): Promise<OhlcBar[]> {
  const symbol = input.symbol.toUpperCase();
  const period1 =
    typeof input.period1 === "string"
      ? new Date(input.period1)
      : input.period1;

  if (isFmpConfigured() && input.type !== "crypto" && !isFmpRateLimited()) {
    if (input.interval === "1h") {
      const hourly = await fetchFmpHourlyBars(symbol);
      if (hourly.length > 0) {
        return hourly.filter((b) => b.time >= period1.getTime());
      }
    } else {
      const daily = await fetchFmpDailyBars(symbol, {
        from: period1.toISOString().slice(0, 10),
      });
      if (daily.length > 0) return daily;
    }
  }

  if (allowYahooFallback() || input.type === "crypto") {
    return fetchYahooOhlcBars({
      symbol: resolveHistorySymbol(symbol, input.type ?? "stock"),
      interval: input.interval,
      period1,
    });
  }

  return [];
}

export async function fetchAthPrice(
  symbol: string,
  recentDaily?: OhlcBar[],
): Promise<number | null> {
  // Prefer already-fetched daily highs — avoid a second long FMP history pull.
  let fromBars = 0;
  for (const bar of recentDaily ?? []) {
    if (bar.high > fromBars) fromBars = bar.high;
  }
  if (fromBars > 0 && (recentDaily?.length ?? 0) >= 200) {
    return fromBars;
  }

  if (isFmpConfigured() && !isFmpRateLimited()) {
    const ath = await fetchFmpAth(symbol);
    if (ath != null) {
      return Math.max(ath, fromBars);
    }
  }

  if (allowYahooFallback()) {
    try {
      const YahooFinance = (await import("yahoo-finance2")).default;
      const yahooFinance = new YahooFinance({
        suppressNotices: ["yahooSurvey"],
      });
      const monthly = await yahooFinance.chart(symbol, {
        period1: "1970-01-01",
        interval: "1mo",
      });
      let ath = fromBars;
      for (const quote of monthly.quotes ?? []) {
        const high = quote.high ?? quote.close;
        if (typeof high === "number" && high > ath) ath = high;
      }
      return ath > 0 ? ath : null;
    } catch {
      return null;
    }
  }

  let ath = 0;
  for (const bar of recentDaily ?? []) {
    if (bar.high > ath) ath = bar.high;
  }
  return ath > 0 ? ath : null;
}

/** Slice chart points from already-fetched OHLC (no extra FMP call). */
export function chartPointsFromBars(
  bars: OhlcBar[],
  range: AnalysisChartRange,
): AnalysisChartPoint[] {
  const cutoff = Date.now() - CHART_RANGE_MS[range];
  return bars
    .filter((b) => b.time >= cutoff)
    .map((b) => ({ time: b.time, close: b.close }));
}

export async function fetchAnalysisHistory(input: {
  symbol: string;
  type: AnalysisAssetType;
  range: AnalysisChartRange;
}): Promise<AnalysisChartPoint[]> {
  const interval: "1h" | "1d" =
    input.range === "1D" || input.range === "1W" ? "1h" : "1d";

  const bars = await fetchOhlcBars({
    symbol: input.symbol,
    type: input.type,
    interval,
    period1: new Date(Date.now() - CHART_RANGE_MS[input.range]),
  });

  return bars.map((b) => ({ time: b.time, close: b.close }));
}

export async function fetchTechnicalSeries(input: {
  symbol: string;
  type: AnalysisAssetType;
  /** When false, skip hourly (4H confluence unavailable until enrich). */
  includeHourly?: boolean;
}): Promise<{
  yahooSymbol: string;
  ath: number | null;
  dailyBars: OhlcBar[];
  hourlyBars: OhlcBar[];
}> {
  const symbol = resolveHistorySymbol(input.symbol, input.type);
  const now = Date.now();
  const includeHourly = input.includeHourly !== false;
  const stockSym = input.type === "crypto" ? symbol : input.symbol;

  // One canonical daily pull covers technicals + all daily chart ranges (through 5Y).
  const dailyPromise = fetchOhlcBars({
    symbol: stockSym,
    type: input.type,
    interval: "1d",
    period1: new Date(now - CHART_RANGE_MS["5Y"]),
  });

  const hourlyPromise = includeHourly
    ? fetchOhlcBars({
        symbol: stockSym,
        type: input.type,
        interval: "1h",
        period1: new Date(now - 90 * 24 * 60 * 60 * 1000),
      })
    : Promise.resolve([] as OhlcBar[]);

  const [dailyBars, hourlyBars] = await Promise.all([
    dailyPromise,
    hourlyPromise,
  ]);

  const ath = await fetchAthPrice(stockSym, dailyBars);

  return { yahooSymbol: symbol, ath, dailyBars, hourlyBars };
}
