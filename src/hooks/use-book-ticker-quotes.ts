"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FMP_DISPLAY_UNAVAILABLE,
  readFailureMessage,
} from "@/lib/market-data/display-gate";
import type { BookTickerQuote } from "@/lib/ticker/book";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";

export function useBookTickerQuotes(symbols: string[]) {
  const key = useMemo(() => {
    const unique = [
      ...new Set(
        symbols
          .map((symbol) => normalizeTickerSymbol(symbol))
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    ].sort();
    return unique.join(",");
  }, [symbols]);

  const [quotes, setQuotes] = useState<Record<string, BookTickerQuote>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(!key);

  useEffect(() => {
    if (!key) {
      setQuotes({});
      setError(null);
      setIsLoaded(true);
      return;
    }
    let cancelled = false;
    setIsLoaded(false);
    void fetch(`/api/analysis/ticker/book?symbols=${encodeURIComponent(key)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readFailureMessage(response, "book quotes failed"));
        }
        return (await response.json()) as { quotes: BookTickerQuote[] };
      })
      .then((payload) => {
        if (cancelled) return;
        const next: Record<string, BookTickerQuote> = {};
        for (const quote of payload.quotes ?? []) {
          next[quote.symbol] = quote;
        }
        setQuotes(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuotes({});
        setError(
          err instanceof Error && err.message === FMP_DISPLAY_UNAVAILABLE
            ? err.message
            : null,
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { quotes, isLoaded, error };
}
