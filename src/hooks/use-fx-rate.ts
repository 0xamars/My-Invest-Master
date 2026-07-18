"use client";

import { useCallback, useEffect, useState } from "react";
import type { FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function useFxRate() {
  const [rates, setRates] = useState<FxRates>(DEFAULT_FX_RATES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/fx");
      if (!response.ok) throw new Error("Failed to fetch FX rates");
      const data = (await response.json()) as FxRates;
      setRates(data);
    } catch {
      setError("Unable to load exchange rates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
    const interval = setInterval(() => void loadRates(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadRates]);

  return { rates, isLoading, error, refetch: loadRates };
}
