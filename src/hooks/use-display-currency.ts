"use client";

import { useCallback, useEffect, useState } from "react";
import type { DisplayCurrency } from "@/types/currency";
import { isDisplayCurrency } from "@/types/currency";

const STORAGE_KEY = "my-invest-master-currency";

export function useDisplayCurrency() {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isDisplayCurrency(stored)) {
        setCurrencyState(stored);
      }
    } catch {
      // ignore
    }
    setIsLoaded(true);
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { currency, setCurrency, isLoaded };
}
