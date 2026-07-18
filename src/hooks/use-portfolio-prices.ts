"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPricesFromApi } from "@/lib/portfolio/price-client";
import type { PortfolioHolding, PriceRequestAsset } from "@/types/portfolio";
import { isLivePricedAsset } from "@/types/portfolio";

const REFRESH_INTERVAL_MS = 60_000;

function toPriceRequest(holding: PortfolioHolding): PriceRequestAsset | null {
  if (!isLivePricedAsset(holding.type)) return null;
  return {
    symbol: holding.symbol,
    type: holding.type,
    priceId: holding.priceId,
  };
}

export function usePortfolioPrices(holdings: PortfolioHolding[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const assets = useMemo(
    () =>
      holdings
        .map(toPriceRequest)
        .filter((asset): asset is PriceRequestAsset => asset !== null),
    [holdings],
  );

  const assetsKey = useMemo(
    () =>
      holdings
        .filter((h) => isLivePricedAsset(h.type))
        .map((h) => `${h.symbol}:${h.type}:${h.priceId ?? ""}`)
        .sort()
        .join("|"),
    [holdings],
  );

  const loadingSymbols = useMemo(() => {
    if (!isLoading && !isRefreshing) return new Set<string>();
    return new Set(
      holdings
        .filter(
          (h) =>
            isLivePricedAsset(h.type) && prices[h.symbol] === undefined,
        )
        .map((h) => h.symbol),
    );
  }, [holdings, isLoading, isRefreshing, prices]);

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
    void loadPrices(false);
  }, [assetsKey, loadPrices]);

  useEffect(() => {
    if (assets.length === 0) return;

    const interval = setInterval(() => {
      void loadPrices(true);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [assets.length, assetsKey, loadPrices]);

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
