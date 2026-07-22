"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { migrateLocalDataToCloud } from "@/lib/portfolio/migrate-local-data";
import {
  loadPreferencesFromCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DisplayCurrency } from "@/types/currency";
import { isDisplayCurrency } from "@/types/currency";

const STORAGE_KEY = "my-invest-master-currency";
const SAVE_DEBOUNCE_MS = 500;

function loadCurrencyFromLocal(): DisplayCurrency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isDisplayCurrency(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "USD";
}

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

      try {
        if (user && isSupabaseConfigured()) {
          await migrateLocalDataToCloud(user.id);
          const remote = await loadPreferencesFromCloud(user.id);
          if (!cancelled && version === loadVersionRef.current) {
            setCurrencyState(remote ?? loadCurrencyFromLocal());
          }
        } else if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState(loadCurrencyFromLocal());
        }
      } catch {
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState(loadCurrencyFromLocal());
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

  const setCurrency = useCallback(
    (next: DisplayCurrency) => {
      setCurrencyState(next);
    },
    [],
  );

  useEffect(() => {
    if (!isLoaded || isAuthLoading) return;

    const timer = window.setTimeout(async () => {
      try {
        if (user && isSupabaseConfigured()) {
          await savePreferencesToCloud(user.id, currency);
          return;
        }
        localStorage.setItem(STORAGE_KEY, currency);
      } catch {
        localStorage.setItem(STORAGE_KEY, currency);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currency, isLoaded, isAuthLoading, user]);

  return { currency, setCurrency, isLoaded };
}
