"use client";

import { useUserPreferences } from "@/hooks/use-user-preferences";
import type { DisplayCurrency } from "@/types/currency";

/** Display currency preference (backed by UserPreferencesProvider). */
export function useDisplayCurrency(): {
  currency: DisplayCurrency;
  setCurrency: (next: DisplayCurrency) => void;
  isLoaded: boolean;
} {
  const { currency, setCurrency, isLoaded } = useUserPreferences();
  return { currency, setCurrency, isLoaded };
}
