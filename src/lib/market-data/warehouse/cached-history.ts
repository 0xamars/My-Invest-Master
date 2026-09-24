import type { OhlcBar } from "@/lib/analysis/rating/types";
import { isFmpConfigured } from "@/lib/market-data/config";
import { isFmpRateLimited } from "@/lib/market-data/fmp/client";
import {
  fetchFmpDailyBars,
  fetchFmpHourlyBars,
} from "@/lib/market-data/fmp/history";
import * as store from "@/lib/market-data/warehouse/store";
import {
  DATASET_TTL_MS,
  emptyRetryTtl,
  isFresh,
  isUsableStale,
  newestTimestamp,
  type WarehouseDataset,
} from "@/lib/market-data/warehouse/ttl";

export type HistoryTimeframe = "daily" | "hourly";

const DATASET: Record<HistoryTimeframe, WarehouseDataset> = {
  daily: "price_daily",
  hourly: "price_hourly",
};

const inflight = new Map<string, Promise<OhlcBar[]>>();

async function loadBars(
  symbol: string,
  timeframe: HistoryTimeframe,
): Promise<OhlcBar[]> {
  const dataset = DATASET[timeframe];
  const ttl = DATASET_TTL_MS[dataset];
  const emptyTtl = emptyRetryTtl(dataset);
  const [{ bars, updatedAt }, refresh] = await Promise.all([
    store.readPriceHistory(symbol, timeframe),
    store.getRefreshState(symbol, dataset),
  ]);
  const hasBars = bars.length > 0;
  const checkedAt = newestTimestamp(
    refresh?.last_success_at,
    refresh?.last_attempt_at,
  );
  const emptyConfirmed =
    refresh?.status === "empty" ||
    refresh?.error_message === "fmp_empty" ||
    refresh?.error_message?.startsWith("fmp_empty") === true;

  if (hasBars && isFresh(updatedAt, ttl)) return bars;
  if (emptyConfirmed && checkedAt && isFresh(checkedAt, emptyTtl)) return bars;
  if (hasBars && checkedAt && isFresh(checkedAt, ttl)) return bars;

  const canFetch = isFmpConfigured() && !isFmpRateLimited();
  if (!canFetch) {
    return hasBars && isUsableStale(updatedAt, ttl) ? bars : [];
  }

  try {
    await store.ensureMarketSymbols([
      {
        symbol,
        assetType:
          symbol.endsWith("USD") && symbol.length > 3 ? "crypto" : "stock",
      },
    ]);
    const fresh =
      timeframe === "hourly"
        ? await fetchFmpHourlyBars(symbol)
        : await fetchFmpDailyBars(symbol);
    if (fresh.length > 0) {
      await store.ensureMarketSymbol({ symbol });
      await store.writePriceHistory({ symbol, timeframe, bars: fresh });
      await store.upsertRefreshState({
        symbol,
        dataset,
        status: "ok",
        success: true,
      });
      return fresh;
    }

    await store.upsertRefreshState({
      symbol,
      dataset,
      status: "empty",
      errorMessage: "fmp_empty",
      success: true,
    });
    if (hasBars && isUsableStale(updatedAt, ttl)) return bars;
    return [];
  } catch {
    await store.upsertRefreshState({
      symbol,
      dataset,
      status: "error",
      errorMessage: "FMP history fetch failed",
      success: false,
    });
    return hasBars && isUsableStale(updatedAt, ttl) ? bars : [];
  }
}

/** Daily/hourly bars from `price_history`, refreshed through FMP when stale. */
export async function getCachedOhlcBars(
  symbol: string,
  timeframe: HistoryTimeframe,
): Promise<OhlcBar[]> {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return [];
  const key = `${timeframe}:${upper}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = loadBars(upper, timeframe);
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}
