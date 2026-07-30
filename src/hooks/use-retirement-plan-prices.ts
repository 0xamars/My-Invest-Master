"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPricesFromApi } from "@/lib/portfolio/price-client";
import type { RetirementPlanAsset } from "@/types/retirement";
import type { PriceRequestAsset } from "@/types/portfolio";
import { isLivePricedAsset } from "@/types/portfolio";

function toPriceRequest(asset: RetirementPlanAsset): PriceRequestAsset | null {
  if (!isLivePricedAsset(asset.type)) return null;
  return {
    symbol: asset.symbol,
    type: asset.type,
    priceId: asset.priceId,
  };
}

export function useRetirementPlanPrices(assets: RetirementPlanAsset[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const priceRequests = useMemo(
    () =>
      assets
        .map(toPriceRequest)
        .filter((asset): asset is PriceRequestAsset => asset !== null),
    [assets],
  );

  const assetsKey = useMemo(
    () =>
      assets
        .filter((asset) => isLivePricedAsset(asset.type))
        .map((asset) => `${asset.symbol}:${asset.type}:${asset.priceId ?? ""}`)
        .sort()
        .join("|"),
    [assets],
  );

  const loadingSymbols = useMemo(() => {
    if (!isLoading && !isRefreshing) return new Set<string>();
    return new Set(
      assets
        .filter(
          (asset) =>
            isLivePricedAsset(asset.type) && prices[asset.symbol] === undefined,
        )
        .map((asset) => asset.symbol),
    );
  }, [assets, isLoading, isRefreshing, prices]);

  const loadPrices = useCallback(
    async (isBackground = false) => {
      if (priceRequests.length === 0) {
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
        const result = await fetchPricesFromApi(priceRequests);
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
    [priceRequests],
  );

  useEffect(() => {
    hasFetched.current = false;
    setPrices({});
    void loadPrices(false);
  }, [assetsKey, loadPrices]);

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
