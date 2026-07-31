"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPricesFromApi } from "@/lib/portfolio/price-client";
import type { PriceRequestAsset } from "@/types/portfolio";
import type { WatchlistItem } from "@/types/watchlist";

const REFRESH_INTERVAL_MS = 60_000;

function toPriceRequest(item: WatchlistItem): PriceRequestAsset {
  return {
    symbol: item.symbol,
    type: item.type,
    priceId: item.priceId,
  };
}

export function useWatchlistPrices(items: WatchlistItem[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [changes, setChanges] = useState<
    Record<string, { change: number; changePercent: number }>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const assets = useMemo(() => items.map(toPriceRequest), [items]);

  const assetsKey = useMemo(
    () =>
      items
        .map((item) => `${item.symbol}:${item.type}:${item.priceId ?? ""}`)
        .sort()
        .join("|"),
    [items],
  );

  const loadingSymbols = useMemo(() => {
    if (!isLoading && !isRefreshing) return new Set<string>();
    return new Set(
      items
        .filter((item) => prices[item.symbol] === undefined)
        .map((item) => item.symbol),
    );
  }, [items, isLoading, isRefreshing, prices]);

  const loadPrices = useCallback(
    async (isBackground = false) => {
      if (assets.length === 0) {
        setPrices({});
        setChanges({});
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        return;
      }

      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await fetchPricesFromApi(assets);
        setPrices((prev) => ({ ...prev, ...result.prices }));
        if (result.changes) {
          setChanges((prev) => ({ ...prev, ...result.changes }));
        }
        setLastUpdated(new Date(result.fetchedAt));

        const failedCount = Object.keys(result.errors ?? {}).length;
        if (failedCount > 0 && Object.keys(result.prices).length === 0) {
          setError("Unable to fetch prices. Please try again.");
        }
      } catch {
        setError("Unable to fetch prices. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        hasFetched.current = true;
      }
    },
    [assets],
  );

  useEffect(() => {
    hasFetched.current = false;
    setPrices({});
    setChanges({});
    void loadPrices(false);
  }, [assetsKey, loadPrices]);

  useEffect(() => {
    if (assets.length === 0) return;

    const timer = window.setInterval(() => {
      void loadPrices(true);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [assets.length, loadPrices]);

  return {
    prices,
    changes,
    isLoading,
    isRefreshing,
    lastUpdated,
    error,
    loadingSymbols,
    refresh: () => loadPrices(false),
  };
}
