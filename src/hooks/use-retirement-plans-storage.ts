"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  canCreateLimitedResource,
  PlanLimitError,
  resolvePlanForCreateGate,
} from "@/lib/plans/access";
import { canCreateRetirementFromPortfolio } from "@/lib/plans/free-access";
import {
  deleteRetirementPlanFromCloud,
  loadRetirementPlansFromCloud,
  saveRetirementPlanToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import {
  createEmptyPlan,
  getPlanTotalValue,
  type RetirementPlan,
  type RetirementPlanAsset,
  type RetirementPlanSummary,
} from "@/types/retirement";

const SAVE_DEBOUNCE_MS = 500;

function toSummary(plan: RetirementPlan): RetirementPlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    retirementYear: plan.retirementYear,
    totalPortfolioValue: getPlanTotalValue(plan),
    updatedAt: plan.updatedAt,
  };
}

export function useRetirementPlansStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    plan: userPlan,
    isLoaded: isPlanLoaded,
    prefsLoadSucceeded,
  } = useUserPlan();
  const [plans, setPlans] = useState<RetirementPlan[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);
  const pendingSaveRef = useRef<Map<string, RetirementPlan>>(new Map());

  const assertCanCreate = useCallback(() => {
    const effectivePlan = resolvePlanForCreateGate(userPlan, {
      isPlanLoaded,
      prefsLoadSucceeded,
    });
    if (!effectivePlan) {
      throw new Error(
        "Plan preferences are still loading. Try again in a moment.",
      );
    }
    if (
      !canCreateLimitedResource(effectivePlan, "retirement", plans.length)
    ) {
      throw new PlanLimitError("retirement");
    }
    return effectivePlan;
  }, [userPlan, isPlanLoaded, prefsLoadSucceeded, plans.length]);

  const assertCanCreateFromPortfolio = useCallback(() => {
    const effectivePlan = assertCanCreate();
    if (!canCreateRetirementFromPortfolio(effectivePlan)) {
      throw new Error("PREMIUM_FEATURE:retirement_from_portfolio");
    }
  }, [assertCanCreate]);

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);
      setSyncError(null);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setPlans([]);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const remote = await loadRetirementPlansFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setPlans(remote.map((plan) => normalizeRetirementPlan(plan)));
        }
      } catch (error) {
        if (!cancelled && version === loadVersionRef.current) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to load retirement plans.",
          );
          setPlans([]);
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

  useEffect(() => {
    if (!isLoaded || isAuthLoading || !user || !isSupabaseConfigured()) {
      return;
    }

    if (pendingSaveRef.current.size === 0) return;

    const timer = window.setTimeout(async () => {
      const toSave = new Map(pendingSaveRef.current);
      pendingSaveRef.current.clear();

      for (const plan of toSave.values()) {
        try {
          await saveRetirementPlanToCloud(user.id, plan);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save retirement plan.",
          );
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [plans, isLoaded, isAuthLoading, user]);

  const queueSave = useCallback((plan: RetirementPlan) => {
    pendingSaveRef.current.set(plan.id, plan);
  }, []);

  const createPlan = useCallback(
    (options?: {
      name?: string;
      assets?: RetirementPlanAsset[];
    }): RetirementPlan => {
      if (options?.assets && options.assets.length > 0) {
        assertCanCreateFromPortfolio();
      } else {
        assertCanCreate();
      }

      const plan = createEmptyPlan(options?.name);
      if (options?.assets) {
        plan.assets = options.assets;
      }

      setPlans((prev) => [plan, ...prev]);
      queueSave(plan);
      return plan;
    },
    [queueSave, assertCanCreate, assertCanCreateFromPortfolio],
  );

  const createPlanAndSave = useCallback(
    async (options?: {
      name?: string;
      assets?: RetirementPlanAsset[];
    }): Promise<RetirementPlan> => {
      if (options?.assets && options.assets.length > 0) {
        assertCanCreateFromPortfolio();
      } else {
        assertCanCreate();
      }

      const plan = createEmptyPlan(options?.name);
      if (options?.assets) {
        plan.assets = options.assets;
      }

      setPlans((prev) => [plan, ...prev]);

      if (user && isSupabaseConfigured()) {
        try {
          await saveRetirementPlanToCloud(user.id, plan);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save retirement plan.",
          );
        }
      }

      return plan;
    },
    [user, assertCanCreate, assertCanCreateFromPortfolio],
  );

  const updatePlan = useCallback(
    (id: string, updater: (plan: RetirementPlan) => RetirementPlan) => {
      setPlans((prev) => {
        const index = prev.findIndex((plan) => plan.id === id);
        if (index === -1) return prev;

        const updated = {
          ...updater(prev[index]),
          updatedAt: new Date().toISOString(),
        };
        const next = [...prev];
        next[index] = updated;
        queueSave(updated);
        return next;
      });
    },
    [queueSave],
  );

  const deletePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
    pendingSaveRef.current.delete(id);

    if (!user || !isSupabaseConfigured()) return;

    try {
      await deleteRetirementPlanFromCloud(id);
      setSyncError(null);
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : "Failed to delete retirement plan.",
      );
    }
  }, [user]);

  const getPlan = useCallback(
    (id: string) => plans.find((plan) => plan.id === id),
    [plans],
  );

  const summaries = plans.map(toSummary);

  return {
    plans,
    summaries,
    createPlan,
    createPlanAndSave,
    updatePlan,
    deletePlan,
    getPlan,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    isPlanReady: isPlanLoaded,
  };
}
