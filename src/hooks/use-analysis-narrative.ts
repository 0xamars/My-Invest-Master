"use client";

import { useEffect, useState } from "react";
import { buildNarrativeContext } from "@/lib/analysis/narrative/context";
import type {
  AnalysisNarrativeBundle,
  NarrativeResponse,
} from "@/lib/analysis/narrative/types";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";

export function useAnalysisNarrative(input: {
  symbol: string | undefined;
  name?: string | null;
  rating: InvestSalsaRating | null;
}): {
  bundle: AnalysisNarrativeBundle | null;
  loading: boolean;
  source: NarrativeResponse["source"] | null;
} {
  const [bundle, setBundle] = useState<AnalysisNarrativeBundle | null>(null);
  const [source, setSource] = useState<NarrativeResponse["source"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const symbol = input.symbol?.toUpperCase();
  const rating = input.rating;
  const name = input.name ?? null;
  const fingerprint = rating
    ? [
        symbol,
        rating.score,
        rating.fundamental.score,
        rating.technical.score,
        rating.technical.fib.zoneLabel,
        rating.fundamental.classification.fundamentalPeriod,
      ].join("|")
    : "";

  useEffect(() => {
    if (!symbol || !rating) {
      setBundle(null);
      setSource(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const context = buildNarrativeContext({ symbol, name, rating });

    void (async () => {
      try {
        const res = await fetch("/api/analysis/narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context }),
        });
        if (!res.ok) throw new Error("narrative failed");
        const data = (await res.json()) as NarrativeResponse;
        if (cancelled) return;
        setBundle(data.bundle ?? null);
        setSource(data.source ?? null);
      } catch {
        if (!cancelled) {
          setBundle(null);
          setSource(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, name, fingerprint, rating]);

  return { bundle, loading, source };
}
