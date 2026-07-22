"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPricesFromApi } from "@/lib/portfolio/price-client";
import type { OptionsPosition } from "@/types/options";

const REFRESH_INTERVAL_MS = 60_000;

export function useOptionsPrices(positions: OptionsPosition[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const tickers = useMemo(() => {
    const unique = new Set(positions.map((p) => p.ticker.toUpperCase()));
    return [...unique].sort();
  }, [positions]);

  const tickersKey = tickers.join("|");

  const assets = useMemo(
    () =>
      tickers.map((symbol) => ({
        symbol,
        type: "stock" as const,
      })),
    [tickers],
  );

  const loadingSymbols = useMemo(() => {
    if (!isLoading && !isRefreshing) return new Set<string>();
    return new Set(
      tickers.filter((symbol) => prices[symbol] === undefined),
    );
  }, [tickers, isLoading, isRefreshing, prices]);

  const loadPrices = useCallback(
    async (isBackground = false) => {
      if (assets.length === 0) {
        setPrices({});
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
        setLastUpdated(new Date(result.fetchedAt));

        if (
          Object.keys(result.errors ?? {}).length > 0 &&
          Object.keys(result.prices).length === 0
        ) {
          setError("Unable to fetch stock prices.");
        }
      } catch {
        setError("Unable to fetch stock prices.");
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
    void loadPrices(false);
  }, [tickersKey, loadPrices]);

  useEffect(() => {
    if (assets.length === 0) return;

    const interval = setInterval(() => {
      void loadPrices(true);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [assets.length, tickersKey, loadPrices]);

  return {
    prices,
    isLoading: isLoading && !hasFetched.current,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error,
    refetch: () => loadPrices(false),
  };
}
