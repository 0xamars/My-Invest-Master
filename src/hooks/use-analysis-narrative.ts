"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildNarrativeContext } from "@/lib/analysis/narrative/context";
import type {
  AnalysisNarrativeBundle,
  NarrativeResponse,
} from "@/lib/analysis/narrative/types";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisForecast } from "@/lib/analysis/forecast";
import type { AnalysisRecentEvent } from "@/lib/analysis/recent-events";

const CLIENT_TTL_MS = 6 * 60 * 60 * 1000;
const CLIENT_FETCH_MS = 120_000;

type Flight = {
  refs: number;
  abort: AbortController;
  promise: Promise<NarrativeResponse | null>;
};

const clientCache = new Map<string, { expiresAt: number; data: NarrativeResponse }>();
const clientFlights = new Map<string, Flight>();

function readClientCache(key: string): NarrativeResponse | null {
  const hit = clientCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    clientCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeClientCache(key: string, data: NarrativeResponse): void {
  if (data.source === "fallback") return;
  clientCache.set(key, { data, expiresAt: Date.now() + CLIENT_TTL_MS });
}

function subscribeNarrative(
  key: string,
  context: unknown,
  force: boolean,
): { promise: Promise<NarrativeResponse | null>; unsubscribe: () => void } {
  if (force) {
    clientCache.delete(key);
    const prior = clientFlights.get(key);
    if (prior) {
      prior.abort.abort();
      clientFlights.delete(key);
    }
  } else {
    const cached = readClientCache(key);
    if (cached) {
      return { promise: Promise.resolve(cached), unsubscribe() {} };
    }
  }

  let flight = clientFlights.get(key);
  if (!flight) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CLIENT_FETCH_MS);
    const promise = fetch("/api/analysis/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
      signal: abort.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("narrative failed");
        return (await res.json()) as NarrativeResponse;
      })
      .then((data) => {
        writeClientCache(key, data);
        return data;
      })
      .catch(() => null)
      .finally(() => {
        clearTimeout(timer);
        if (clientFlights.get(key)?.abort === abort) {
          clientFlights.delete(key);
        }
      });
    flight = { refs: 0, abort, promise };
    clientFlights.set(key, flight);
  }

  flight.refs += 1;
  const current = flight;
  return {
    promise: current.promise,
    unsubscribe() {
      current.refs -= 1;
      if (current.refs > 0) return;
      queueMicrotask(() => {
        if (current.refs > 0) return;
        if (clientFlights.get(key) !== current) return;
        current.abort.abort();
        clientFlights.delete(key);
      });
    },
  };
}

export function useAnalysisNarrative(input: {
  symbol: string | undefined;
  name?: string | null;
  description?: string | null;
  rating: InvestSalsaRating | null;
  recentEvents?: AnalysisRecentEvent[];
  forecast?: AnalysisForecast | null;
  price?: number | null;
}): {
  bundle: AnalysisNarrativeBundle | null;
  loading: boolean;
  source: NarrativeResponse["source"] | null;
  error: string | null;
  retry: () => void;
} {
  const [bundle, setBundle] = useState<AnalysisNarrativeBundle | null>(null);
  const [source, setSource] = useState<NarrativeResponse["source"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const forceRef = useRef(false);

  const symbol = input.symbol?.toUpperCase();
  const rating = input.rating;
  const name = input.name ?? null;
  const description = input.description ?? null;
  const recentEvents = input.recentEvents ?? [];
  const forecast = input.forecast ?? null;
  const price = input.price ?? null;
  const fingerprint = rating
    ? [
        symbol,
        name ?? "",
        rating.score,
        rating.fundamental.score,
        rating.technical.score,
        rating.technical.fib.zoneLabel,
        rating.fundamental.classification.fundamentalPeriod,
        (description ?? "").slice(0, 80),
        recentEvents.map((e) => `${e.type}:${e.date ?? ""}`).join(","),
        forecast?.priceTarget?.average ?? "",
      ].join("|")
    : "";

  const retry = useCallback(() => {
    forceRef.current = true;
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!symbol || !rating || !fingerprint) {
      setBundle(null);
      setSource(null);
      setError(null);
      setLoading(false);
      return;
    }

    const force = forceRef.current;
    forceRef.current = false;

    if (!force) {
      const cached = readClientCache(fingerprint);
      if (cached) {
        setBundle(cached.bundle ?? null);
        setSource(cached.source ?? "cache");
        setError(cached.error ?? null);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const context = buildNarrativeContext({
      symbol,
      name,
      description,
      rating,
      recentEvents,
      forecast,
      price,
    });

    const { promise, unsubscribe } = subscribeNarrative(
      fingerprint,
      context,
      force,
    );

    void promise.then((data) => {
      if (cancelled) return;
      if (!data) {
        setBundle(null);
        setSource(null);
        setError("Narrative unavailable. Retry to generate copy.");
        setLoading(false);
        return;
      }
      setBundle(data.bundle ?? null);
      setSource(data.source ?? null);
      setError(
        data.source === "fallback" && data.error
          ? data.error === "timeout"
            ? "Narrative timed out. Scores above are unchanged."
            : "Narrative unavailable. Scores above are unchanged."
          : null,
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Fingerprint is the request identity. Object identity of rating/events must not
    // start a second LLM call (React Strict Mode / parent re-renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint covers inputs
  }, [fingerprint, retryTick]);

  return { bundle, loading, source, error, retry };
}
