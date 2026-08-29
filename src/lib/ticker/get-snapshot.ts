import { after } from "next/server";
import { isFmpConfigured } from "@/lib/market-data/config";
import { assembleTickerSnapshot, applyCacheMeta } from "@/lib/ticker/assemble";
import {
  cacheWindows,
  classifyCacheAge,
  peekTickerCache,
  writeTickerCache,
} from "@/lib/ticker/cache";
import { EMPTY_TICKER_BUNDLE } from "@/lib/ticker/empty-bundle";
import { bundleLooksEmpty, fetchTickerBundle } from "@/lib/ticker/fetch-bundle";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";
import type { TickerCacheEntry, TickerSnapshot } from "@/lib/ticker/types";

const inflight = new Map<string, Promise<TickerSnapshot>>();

function scheduleRefresh(symbol: string) {
  const run = () => {
    void loadFromFmp(symbol).catch(() => undefined);
  };
  try {
    after(run);
  } catch {
    run();
  }
}

function entryFromSnapshot(
  snapshot: TickerSnapshot,
  fetchedAtMs: number,
): TickerCacheEntry {
  const windows = cacheWindows(fetchedAtMs);
  return {
    snapshot,
    ...windows,
  };
}

function serveEntry(
  entry: TickerCacheEntry,
  status: "fresh" | "stale",
): TickerSnapshot {
  return applyCacheMeta(entry.snapshot, {
    status,
    fromCache: true,
    fmpHit: false,
    fetchedAtMs: entry.fetchedAtMs,
    freshUntilMs: entry.freshUntilMs,
    staleUntilMs: entry.staleUntilMs,
  });
}

/**
 * Read-only. Never calls FMP. Used for first paint when the cache is warm.
 */
export async function peekTickerSnapshot(
  rawSymbol: string,
): Promise<TickerSnapshot | null> {
  const symbol = normalizeTickerSymbol(rawSymbol);
  if (!symbol) return null;
  const entry = await peekTickerCache(symbol);
  if (!entry) return null;
  const status = classifyCacheAge(entry.fetchedAtMs);
  if (status === "miss") return null;
  return serveEntry(entry, status);
}

async function loadFromFmp(symbol: string): Promise<TickerSnapshot> {
  const now = Date.now();
  const windows = cacheWindows(now);
  if (!isFmpConfigured()) {
    return assembleTickerSnapshot(symbol, EMPTY_TICKER_BUNDLE, {
      status: "miss",
      fromCache: false,
      fmpHit: false,
      ...windows,
    });
  }

  const bundle = await fetchTickerBundle(symbol);
  const snapshot = assembleTickerSnapshot(symbol, bundle, {
    status: "fresh",
    fromCache: false,
    fmpHit: true,
    ...windows,
  });

  if (!bundleLooksEmpty(bundle) || snapshot.found) {
    await writeTickerCache(entryFromSnapshot(snapshot, now));
  }
  return snapshot;
}

/**
 * One fetch path: cache first, write-through on miss, stale-while-revalidate.
 */
export async function getTickerSnapshot(
  rawSymbol: string,
  options?: { force?: boolean },
): Promise<TickerSnapshot> {
  const symbol = normalizeTickerSymbol(rawSymbol);
  if (!symbol) {
    const now = Date.now();
    return assembleTickerSnapshot("", EMPTY_TICKER_BUNDLE, {
      status: "miss",
      fromCache: false,
      fmpHit: false,
      ...cacheWindows(now),
    });
  }

  if (!options?.force) {
    const entry = await peekTickerCache(symbol);
    if (entry) {
      const status = classifyCacheAge(entry.fetchedAtMs);
      if (status === "fresh") {
        return serveEntry(entry, "fresh");
      }
      if (status === "stale") {
        scheduleRefresh(symbol);
        return serveEntry(entry, "stale");
      }
    }
  }

  const existing = inflight.get(symbol);
  if (existing) return existing;

  const run = loadFromFmp(symbol);
  inflight.set(symbol, run);
  try {
    return await run;
  } finally {
    inflight.delete(symbol);
  }
}
