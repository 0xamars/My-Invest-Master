"use client";

import { useEffect, useState } from "react";
import { fetchPricesFromApi } from "@/lib/portfolio/price-client";
import type { AssetCatalogItem } from "@/types/portfolio";

export function useAssetPrice(asset: AssetCatalogItem | null) {
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) {
      setPrice(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setPrice(null);

      try {
        const result = await fetchPricesFromApi([
          {
            symbol: asset!.symbol,
            type: asset!.type,
            priceId: asset!.priceId,
          },
        ]);

        if (cancelled) return;

        const fetched = result.prices[asset!.symbol.toUpperCase()];
        if (typeof fetched === "number") {
          setPrice(fetched);
        } else {
          setError(
            result.errors?.[asset!.symbol.toUpperCase()] ??
              "Could not fetch current price",
          );
        }
      } catch {
        if (!cancelled) {
          setError("Could not fetch current price");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [asset?.symbol, asset?.type, asset?.priceId]);

  return { price, isLoading, error };
}
