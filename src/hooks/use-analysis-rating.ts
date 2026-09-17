"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisForecast } from "@/lib/analysis/forecast";
import type { AnalysisRecentEvent } from "@/lib/analysis/recent-events";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisRatingPayload } from "@/lib/analysis/types";

type RatingLoad = {
  rating: InvestSalsaRating;
  forecast: AnalysisForecast | null;
  price: number | null;
  name: string | null;
  description: string | null;
  recentEvents: AnalysisRecentEvent[];
};

const clientRatingCache = new Map<
  string,
  { expiresAt: number; payload: RatingLoad }
>();
const CLIENT_RATING_TTL_MS = 60_000;

async function fetchRatingPayload(symbol: string, force?: boolean): Promise<RatingLoad> {
  const cacheKey = `stock:${symbol}:1M`;
  if (!force) {
    const warm = clientRatingCache.get(cacheKey);
    if (warm && warm.expiresAt > Date.now()) {
      return warm.payload;
    }
  }

  const search = new URLSearchParams({
    symbol,
    type: "stock",
    range: "1M",
    skipHourly: "1",
  });
  if (force) search.set("refresh", "1");

  const response = await fetch(`/api/analysis/rating?${search.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load analysis rating");
  }
  const payload = (await response.json()) as Partial<AnalysisRatingPayload>;
  if (!payload.rating) {
    throw new Error("Incomplete rating payload");
  }

  const loaded: RatingLoad = {
    rating: payload.rating,
    forecast: payload.forecast ?? null,
    price: payload.quote?.price ?? null,
    name: payload.quote?.name ?? null,
    description: payload.quote?.description ?? null,
    recentEvents: payload.recentEvents ?? [],
  };
  clientRatingCache.set(cacheKey, {
    expiresAt: Date.now() + CLIENT_RATING_TTL_MS,
    payload: loaded,
  });
  if (clientRatingCache.size > 40) {
    const first = clientRatingCache.keys().next().value;
    if (first) clientRatingCache.delete(first);
  }
  return loaded;
}

export function useAnalysisRating(symbol: string) {
  const upper = symbol.toUpperCase();
  const [rating, setRating] = useState<InvestSalsaRating | null>(null);
  const [forecast, setForecast] = useState<AnalysisForecast | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<AnalysisRecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchRatingPayload(upper, opts?.force);
      setRating(payload.rating);
      setForecast(payload.forecast);
      setPrice(payload.price);
      setName(payload.name);
      setDescription(payload.description);
      setRecentEvents(payload.recentEvents);
    } catch {
      setRating(null);
      setForecast(null);
      setPrice(null);
      setName(null);
      setDescription(null);
      setRecentEvents([]);
      setError("Rating unavailable for this ticker.");
    } finally {
      setIsLoading(false);
    }
  }, [upper]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    rating,
    forecast,
    price,
    name,
    description,
    recentEvents,
    isLoading,
    error,
    reload: load,
  };
}
