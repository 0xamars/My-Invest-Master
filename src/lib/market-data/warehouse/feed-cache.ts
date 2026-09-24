import { isFmpConfigured } from "@/lib/market-data/config";
import { isFmpRateLimited } from "@/lib/market-data/fmp/client";
import { isEmptyMarker } from "@/lib/market-data/warehouse/store";
import * as store from "@/lib/market-data/warehouse/store";
import {
  feedEmptyTtl,
  feedTtl,
  isFresh,
  isUsableStale,
  type FeedDataset,
} from "@/lib/market-data/warehouse/ttl";

const inflight = new Map<string, Promise<unknown>>();

/**
 * JSON feed cache in `market_cache`.
 * A burst of identical reads shares one FMP fetch, then the warehouse row.
 */
export async function loadCachedFeed<T>(input: {
  cacheKey: string;
  dataset: FeedDataset;
  emptyValue: T;
  isEmpty: (value: T) => boolean;
  fetchFmp: () => Promise<T>;
}): Promise<T> {
  const key = `${input.dataset}:${input.cacheKey}`;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const run = loadUncoalesced(input);
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

async function loadUncoalesced<T>(input: {
  cacheKey: string;
  dataset: FeedDataset;
  emptyValue: T;
  isEmpty: (value: T) => boolean;
  fetchFmp: () => Promise<T>;
}): Promise<T> {
  const ttl = feedTtl(input.dataset);
  const emptyTtl = feedEmptyTtl(input.dataset);
  const cached = await store.readMarketCache(input.cacheKey, input.dataset);
  const updatedAt = cached?.updatedAt ?? null;
  const emptyMarked = cached ? isEmptyMarker(cached.data) : false;
  const value =
    cached && !emptyMarked ? (cached.data as T) : input.emptyValue;
  const hasValue = cached != null && !emptyMarked && !input.isEmpty(value);

  if (hasValue && isFresh(updatedAt, ttl)) return value;
  if (emptyMarked && isFresh(updatedAt, emptyTtl)) return input.emptyValue;

  if (!isFmpConfigured() || isFmpRateLimited()) {
    if (hasValue && isUsableStale(updatedAt, ttl)) return value;
    return input.emptyValue;
  }

  try {
    const fresh = await input.fetchFmp();
    if (!input.isEmpty(fresh)) {
      await store.writeMarketCache({
        cacheKey: input.cacheKey,
        dataset: input.dataset,
        data: fresh,
      });
      return fresh;
    }
    await store.writeMarketCache({
      cacheKey: input.cacheKey,
      dataset: input.dataset,
      data: { __empty: true, recordedAt: new Date().toISOString() },
    });
    if (hasValue && isUsableStale(updatedAt, ttl)) return value;
    return input.emptyValue;
  } catch {
    if (hasValue && isUsableStale(updatedAt, ttl)) return value;
    return input.emptyValue;
  }
}
