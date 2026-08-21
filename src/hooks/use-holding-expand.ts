"use client";

import { useEffect, useState } from "react";
import type { HoldingExpandFacts } from "@/lib/portfolio/holding-expand";
import type { AssetType } from "@/types/portfolio";

export function useHoldingExpand(
  input: {
    symbol: string;
    type: AssetType;
    priceId?: string;
    name?: string;
    boughtAt?: string | null;
    returnPercent?: number | null;
  } | null,
) {
  const [facts, setFacts] = useState<HoldingExpandFacts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const symbol = input?.symbol ?? "";
  const type = input?.type ?? "stock";
  const priceId = input?.priceId;
  const name = input?.name;
  const boughtAt = input?.boughtAt ?? "";
  const returnPercent =
    input?.returnPercent != null && Number.isFinite(input.returnPercent)
      ? String(input.returnPercent)
      : "";

  useEffect(() => {
    if (!symbol) {
      setFacts(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ symbol, type });
    if (priceId) params.set("priceId", priceId);
    if (name) params.set("name", name);
    if (boughtAt) params.set("boughtAt", boughtAt);
    if (returnPercent) params.set("returnPercent", returnPercent);

    void fetch(`/api/holdings/expand?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load holding facts");
        }
        return (await response.json()) as HoldingExpandFacts;
      })
      .then((payload) => {
        if (!controller.signal.aborted) setFacts(payload);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setFacts(null);
        setError(err instanceof Error ? err.message : "Could not load holding facts");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [symbol, type, priceId, name, boughtAt, returnPercent]);

  return { facts, error, isLoading };
}
