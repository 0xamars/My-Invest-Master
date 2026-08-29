"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [isLoaded, setIsLoaded] = useState(!key);

  useEffect(() => {
    if (!key) {
      setQuotes({});
      setIsLoaded(true);
      return;
    }
    let cancelled = false;
    setIsLoaded(false);
    void fetch(`/api/analysis/ticker/book?symbols=${encodeURIComponent(key)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("book quotes failed");
        return (await response.json()) as { quotes: BookTickerQuote[] };
      })
      .then((payload) => {
        if (cancelled) return;
        const next: Record<string, BookTickerQuote> = {};
        for (const quote of payload.quotes ?? []) {
          next[quote.symbol] = quote;
        }
        setQuotes(next);
      })
      .catch(() => {
        if (!cancelled) setQuotes({});
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { quotes, isLoaded };
}
