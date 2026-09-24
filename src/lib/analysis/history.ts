import type { AnalysisAssetType, AnalysisChartRange } from "@/lib/analysis/types";
import type { OhlcBar } from "@/lib/analysis/rating/types";
import {
  toEquityHistorySymbol,
  toFmpCryptoSymbol,
} from "@/lib/market-data/fmp/symbols";
import { getCachedOhlcBars } from "@/lib/market-data/warehouse/cached-history";

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
  if (type === "crypto") return toFmpCryptoSymbol(symbol);
  return toEquityHistorySymbol(symbol);
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

  const historySymbol = resolveHistorySymbol(symbol, input.type ?? "stock");
  if (!historySymbol) return [];

  const bars = await getCachedOhlcBars(
    historySymbol,
    input.interval === "1h" ? "hourly" : "daily",
  );
  return bars.filter((bar) => bar.time >= period1.getTime());
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

  const bars = await getCachedOhlcBars(toEquityHistorySymbol(symbol), "daily");
  let ath = fromBars;
  for (const bar of bars) {
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
  const historySymbol = resolveHistorySymbol(input.symbol, input.type);
  const now = Date.now();
  const includeHourly = input.includeHourly !== false;

  // Pass the holding ticker once. fetchOhlcBars resolves it; passing the
  // already-resolved pair would resolve a second time.
  const dailyPromise = fetchOhlcBars({
    symbol: input.symbol,
    type: input.type,
    interval: "1d",
    period1: new Date(now - CHART_RANGE_MS["5Y"]),
  });

  const hourlyPromise = includeHourly
    ? fetchOhlcBars({
        symbol: input.symbol,
        type: input.type,
        interval: "1h",
        period1: new Date(now - 90 * 24 * 60 * 60 * 1000),
      })
    : Promise.resolve([] as OhlcBar[]);

  const [dailyBars, hourlyBars] = await Promise.all([
    dailyPromise,
    hourlyPromise,
  ]);

  const ath = await fetchAthPrice(historySymbol, dailyBars);

  return { yahooSymbol: historySymbol, ath, dailyBars, hourlyBars };
}
