"use client";

import { useEffect, useMemo, useRef } from "react";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import {
  deriveWorkingFlags,
  withDerivedWorking,
  workingFlagsEqual,
} from "@/lib/journey/working";

/**
 * Recompute working flags from live Budget / Invest / Freedom contexts and
 * persist when they change so Settings stays honest.
 */
export function useSyncWorkingFlags(): ReturnType<typeof deriveWorkingFlags> | null {
  const { profile, saveProfile, isLoaded } = useMoneyProfile();
  const budget = useBudgetPlans();
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
  const { plans, isLoaded: retireLoaded } = useRetirementPlansStorage();
  const persistKeyRef = useRef<string | null>(null);

  const derived = useMemo(() => {
    if (!profile) return null;
    return deriveWorkingFlags({
      flags: profile.flags,
      completedLessons: profile.completedLessons,
      budgetPlans: budget.plans,
      primaryBook: primaryPortfolio,
      freedomPlans: plans,
    });
  }, [profile, budget.plans, primaryPortfolio, plans]);

  const ready =
    isLoaded &&
    budget.isLoaded &&
    portfoliosLoaded &&
    retireLoaded &&
    profile != null &&
    derived != null;

  useEffect(() => {
    if (!ready || !profile || !derived) return;
    if (workingFlagsEqual(profile.working, derived)) {
      persistKeyRef.current = null;
      return;
    }
    const key = `${profile.working.budget}:${profile.working.invest}:${profile.working.freedom}->${derived.budget}:${derived.invest}:${derived.freedom}`;
    if (persistKeyRef.current === key) return;
    persistKeyRef.current = key;
    void saveProfile(withDerivedWorking(profile, derived)).catch(() => {
      persistKeyRef.current = null;
    });
  }, [ready, profile, derived, saveProfile]);

  return derived;
}
