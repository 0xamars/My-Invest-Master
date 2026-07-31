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
    try {
      const response = await fetch("/api/fx");
      if (!response.ok) throw new Error("Failed to fetch FX rates");
      const data = (await response.json()) as FxRates;
      setRates(data);
      setError(null);
    } catch {
      // Keep last-known or default rates so values still format; surface clearly.
      setError(
        "Unable to load live exchange rates. Showing values with fallback FX rates.",
      );
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
