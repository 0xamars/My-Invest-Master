"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { importLegacyLocalDataOnce } from "@/lib/portfolio/legacy-import";
import {
  loadPreferencesFromCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DisplayCurrency } from "@/types/currency";

const SAVE_DEBOUNCE_MS = 500;

export function useDisplayCurrency() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [isLoaded, setIsLoaded] = useState(false);
  const loadVersionRef = useRef(0);

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState("USD");
          setIsLoaded(true);
        }
        return;
      }

      try {
        await importLegacyLocalDataOnce(user.id);
        const remote = await loadPreferencesFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState(remote ?? "USD");
        }
      } catch {
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState("USD");
        }
      } finally {
        if (!cancelled && version === loadVersionRef.current) {
          setIsLoaded(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
  }, []);

  useEffect(() => {
    if (!isLoaded || isAuthLoading || !user || !isSupabaseConfigured()) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        await savePreferencesToCloud(user.id, currency);
      } catch {
        // Preference save failures are non-blocking for the UI.
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currency, isLoaded, isAuthLoading, user]);

  return { currency, setCurrency, isLoaded };
}
