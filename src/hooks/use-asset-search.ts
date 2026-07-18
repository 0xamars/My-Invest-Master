"use client";

import { useEffect, useState } from "react";
import { searchAssetsFromApi } from "@/lib/portfolio/asset-search-client";
import type { AssetCatalogItem, AssetType } from "@/types/portfolio";

const DEBOUNCE_MS = 350;

export function useAssetSearch(query: string, type: AssetType, enabled: boolean) {
  const [results, setResults] = useState<AssetCatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || !trimmed) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setError(null);

    const timeout = setTimeout(async () => {
      try {
        const data = await searchAssetsFromApi(trimmed, type);
        if (!cancelled) {
          setResults(data);
        }
      } catch {
        if (!cancelled) {
          setError("Search failed. Please try again.");
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, type, enabled]);

  return { results, isSearching, error };
}
