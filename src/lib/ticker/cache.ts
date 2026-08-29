import type { TickerCacheEntry, TickerCacheStatus } from "@/lib/ticker/types";

/** Fresh window — warm cache is served without calling FMP. */
export const TICKER_FRESH_MS = 15 * 60_000;
/** Serve stale this long while a background refresh runs. */
export const TICKER_STALE_MS = 24 * 60 * 60_000;

const memory = new Map<string, TickerCacheEntry>();
const RUNTIME_NAMESPACE = "ticker-read-v3";

export function classifyCacheAge(
  fetchedAtMs: number,
  now = Date.now(),
): TickerCacheStatus {
  const age = now - fetchedAtMs;
  if (age <= TICKER_FRESH_MS) return "fresh";
  if (age <= TICKER_STALE_MS) return "stale";
  return "miss";
}

export function cacheWindows(fetchedAtMs: number) {
  return {
    fetchedAtMs,
    freshUntilMs: fetchedAtMs + TICKER_FRESH_MS,
    staleUntilMs: fetchedAtMs + TICKER_STALE_MS,
  };
}

function memoryGet(symbol: string): TickerCacheEntry | null {
  const entry = memory.get(symbol);
  if (!entry) return null;
  if (classifyCacheAge(entry.fetchedAtMs) === "miss") {
    memory.delete(symbol);
    return null;
  }
  return entry;
}

function memorySet(symbol: string, entry: TickerCacheEntry) {
  memory.set(symbol, entry);
  if (memory.size > 200) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}

async function runtimeGet(symbol: string): Promise<TickerCacheEntry | null> {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: RUNTIME_NAMESPACE });
    const value = await cache.get(symbol);
    if (!value || typeof value !== "object") return null;
    const entry = value as TickerCacheEntry;
    if (
      !entry.snapshot ||
      typeof entry.fetchedAtMs !== "number" ||
      classifyCacheAge(entry.fetchedAtMs) === "miss"
    ) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

async function runtimeSet(symbol: string, entry: TickerCacheEntry) {
  try {
    const { getCache } = await import("@vercel/functions");
    const cache = getCache({ namespace: RUNTIME_NAMESPACE });
    const ttlSec = Math.ceil(TICKER_STALE_MS / 1000);
    await cache.set(symbol, entry, {
      ttl: ttlSec,
      tags: ["ticker-read-v3", `ticker:${symbol}`],
      name: "ticker-read-v3",
    });
  } catch {
    // Local / missing Runtime Cache — memory still holds the write-through.
  }
}

export async function peekTickerCache(
  symbol: string,
): Promise<TickerCacheEntry | null> {
  const local = memoryGet(symbol);
  if (local) return local;
  const remote = await runtimeGet(symbol);
  if (remote) {
    memorySet(symbol, remote);
    return remote;
  }
  return null;
}

export async function writeTickerCache(entry: TickerCacheEntry): Promise<void> {
  const symbol = entry.snapshot.symbol;
  memorySet(symbol, entry);
  await runtimeSet(symbol, entry);
}

/** Test helper. */
export function resetTickerCacheForTests() {
  memory.clear();
}
