"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { importLegacyLocalDataOnce } from "@/lib/portfolio/legacy-import";
import {
  canAccess as canAccessFeature,
  resolveEffectivePlan,
} from "@/lib/plans/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  loadPreferencesFromCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import type { DisplayCurrency } from "@/types/currency";
import { parseDisplayCurrency } from "@/types/currency";
import type { PlanFeature, UserPlan } from "@/types/plan";

const SAVE_DEBOUNCE_MS = 500;

type UserPreferencesContextValue = {
  currency: DisplayCurrency;
  setCurrency: (next: DisplayCurrency) => void;
  /** Plan stored in Supabase (before admin / env overrides). */
  storedPlan: UserPlan;
  setStoredPlan: (next: UserPlan) => void;
  /** Effective plan used for access checks. */
  plan: UserPlan;
  isPremium: boolean;
  canAccess: (feature: PlanFeature) => boolean;
  isLoaded: boolean;
  /**
   * True only when preferences finished loading successfully from the cloud
   * (or the user is signed out / Supabase is not configured).
   * False while loading or after a prefs load failure — do not run destructive
   * Free-tier consolidation when this is false.
   */
  prefsLoadSucceeded: boolean;
};

const UserPreferencesContext =
  createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [storedPlan, setStoredPlanState] = useState<UserPlan>("free");
  const [isLoaded, setIsLoaded] = useState(false);
  const [prefsLoadSucceeded, setPrefsLoadSucceeded] = useState(false);
  const loadVersionRef = useRef(0);
  const currencyRef = useRef(currency);
  const storedPlanRef = useRef(storedPlan);
  currencyRef.current = currency;
  storedPlanRef.current = storedPlan;

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);
      setPrefsLoadSucceeded(false);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState("USD");
          setStoredPlanState("free");
          setPrefsLoadSucceeded(true);
          setIsLoaded(true);
        }
        return;
      }

      try {
        await importLegacyLocalDataOnce(user.id);
        const remote = await loadPreferencesFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setCurrencyState(
            parseDisplayCurrency(remote?.displayCurrency, "USD"),
          );
          setStoredPlanState(remote?.plan ?? "free");
          setPrefsLoadSucceeded(true);
        }
      } catch {
        if (!cancelled && version === loadVersionRef.current) {
          // Fail safe: keep UI usable as Free for create gates, but mark prefs
          // as untrusted so no destructive Free consolidation can run.
          setCurrencyState("USD");
          setStoredPlanState("free");
          setPrefsLoadSucceeded(false);
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
    setCurrencyState(parseDisplayCurrency(next));
  }, []);

  const setStoredPlan = useCallback((next: UserPlan) => {
    setStoredPlanState(next);
  }, []);

  useEffect(() => {
    if (
      !isLoaded ||
      !prefsLoadSucceeded ||
      isAuthLoading ||
      !user ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        await savePreferencesToCloud(user.id, {
          displayCurrency: currencyRef.current,
          plan: storedPlanRef.current,
        });
      } catch {
        // Preference save failures are non-blocking for the UI.
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currency, storedPlan, isLoaded, prefsLoadSucceeded, isAuthLoading, user]);

  const plan = useMemo(
    () => resolveEffectivePlan(user?.email, storedPlan),
    [user?.email, storedPlan],
  );

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      currency,
      setCurrency,
      storedPlan,
      setStoredPlan,
      plan,
      isPremium: plan === "premium",
      canAccess: (feature: PlanFeature) => canAccessFeature(plan, feature),
      isLoaded,
      prefsLoadSucceeded,
    }),
    [
      currency,
      setCurrency,
      storedPlan,
      setStoredPlan,
      plan,
      isLoaded,
      prefsLoadSucceeded,
    ],
  );

  return createElement(
    UserPreferencesContext.Provider,
    { value },
    children,
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  }
  return context;
}

export function useUserPlan() {
  const {
    plan,
    storedPlan,
    setStoredPlan,
    isPremium,
    canAccess,
    isLoaded,
    prefsLoadSucceeded,
  } = useUserPreferences();

  return {
    plan,
    storedPlan,
    setStoredPlan,
    isPremium,
    canAccess,
    isLoaded,
    prefsLoadSucceeded,
  };
}
