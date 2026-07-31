import type { AnalysisAssetType } from "@/lib/analysis/types";
import type { OhlcBar } from "@/lib/analysis/rating/types";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type AnalysisChartPoint = {
  time: number;
  close: number;
};

function toBar(quote: {
  date?: Date;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}): OhlcBar | null {
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
    return null;
  }
  return {
    time,
    open,
    high,
    low,
    close,
    volume:
      typeof quote.volume === "number" && Number.isFinite(quote.volume)
        ? quote.volume
        : null,
  };
}

/** Map crypto tickers to Yahoo symbols when possible. */
export function resolveYahooHistorySymbol(
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

export async function fetchOhlcBars(input: {
  yahooSymbol: string;
  interval: "1d" | "1h";
  period1: Date | string;
  period2?: Date;
}): Promise<OhlcBar[]> {
  try {
    const result = await yahooFinance.chart(input.yahooSymbol, {
      period1: input.period1,
      period2: input.period2 ?? new Date(),
      interval: input.interval,
    });
    const bars: OhlcBar[] = [];
    for (const quote of result.quotes ?? []) {
      const bar = toBar(quote);
      if (bar) bars.push(bar);
    }
    return bars.sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export async function fetchAthPrice(
  yahooSymbol: string,
  recentDaily?: OhlcBar[],
): Promise<number | null> {
  try {
    const monthly = await yahooFinance.chart(yahooSymbol, {
      period1: "1970-01-01",
      interval: "1mo",
    });
    let ath = 0;
    for (const quote of monthly.quotes ?? []) {
      const high = quote.high ?? quote.close;
      if (typeof high === "number" && high > ath) ath = high;
    }
    const daily =
      recentDaily ??
      (await fetchOhlcBars({
        yahooSymbol,
        interval: "1d",
        period1: new Date(Date.now() - 800 * 24 * 60 * 60 * 1000),
      }));
    for (const bar of daily) {
      if (bar.high > ath) ath = bar.high;
    }
    return ath > 0 ? ath : null;
  } catch {
    return null;
  }
}

export async function fetchAnalysisHistory(input: {
  symbol: string;
  type: AnalysisAssetType;
  range: "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";
}): Promise<AnalysisChartPoint[]> {
  const yahooSymbol = resolveYahooHistorySymbol(input.symbol, input.type);
  const now = Date.now();
  const rangeMs: Record<typeof input.range, number> = {
    "1D": 2 * 24 * 60 * 60 * 1000,
    "1W": 8 * 24 * 60 * 60 * 1000,
    "1M": 35 * 24 * 60 * 60 * 1000,
    "3M": 100 * 24 * 60 * 60 * 1000,
    "1Y": 400 * 24 * 60 * 60 * 1000,
    "5Y": 5.2 * 365 * 24 * 60 * 60 * 1000,
  };

  const interval: "1h" | "1d" =
    input.range === "1D" || input.range === "1W" ? "1h" : "1d";

  const bars = await fetchOhlcBars({
    yahooSymbol,
    interval,
    period1: new Date(now - rangeMs[input.range]),
  });

  return bars.map((b) => ({ time: b.time, close: b.close }));
}

export async function fetchTechnicalSeries(input: {
  symbol: string;
  type: AnalysisAssetType;
}): Promise<{
  yahooSymbol: string;
  ath: number | null;
  dailyBars: OhlcBar[];
  hourlyBars: OhlcBar[];
}> {
  const yahooSymbol = resolveYahooHistorySymbol(input.symbol, input.type);
  const now = Date.now();

  const [dailyBars, hourlyBars] = await Promise.all([
    fetchOhlcBars({
      yahooSymbol,
      interval: "1d",
      period1: new Date(now - 400 * 24 * 60 * 60 * 1000),
    }),
    fetchOhlcBars({
      yahooSymbol,
      interval: "1h",
      period1: new Date(now - 90 * 24 * 60 * 60 * 1000),
    }),
  ]);

  const ath = await fetchAthPrice(yahooSymbol, dailyBars);

  return { yahooSymbol, ath, dailyBars, hourlyBars };
}
