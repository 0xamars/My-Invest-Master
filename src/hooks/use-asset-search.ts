"use client";

import { useEffect, useState } from "react";
import {
  searchAssetsFromApi,
  type SearchableAssetType,
} from "@/lib/portfolio/asset-search-client";
import type { AssetCatalogItem } from "@/types/portfolio";

const DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useAssetSearch(
  query: string,
  type: SearchableAssetType,
  enabled = true,
) {
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

    const controller = new AbortController();
    setIsSearching(true);
    setError(null);

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await searchAssetsFromApi(
            trimmed,
            type,
            controller.signal,
          );
          setResults(data.slice(0, MAX_RESULTS));
        } catch (caught) {
          if (controller.signal.aborted || isAbortError(caught)) return;
          setError("Search failed. Please try again.");
          setResults([]);
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, type, enabled]);

  return { results, isSearching, error };
}
