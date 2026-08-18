"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { computeMonthSummary } from "@/lib/budget/calculations";
import { normalizeBudgetPlans } from "@/lib/budget/migrate-plan";
import { materializeDueSchedules } from "@/lib/budget/scheduled";
import {
  canCreateLimitedResource,
  PlanLimitError,
  resolvePlanForCreateGate,
} from "@/lib/plans/access";
import {
  deleteBudgetPlanFromCloud,
  loadBudgetPlansFromCloud,
  saveBudgetPlanToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createEmptyBudgetPlan,
  getMonthKey,
  type BudgetPlan,
  type BudgetPlanSummary,
} from "@/types/budget";

const SAVE_DEBOUNCE_MS = 500;

function toSummary(plan: BudgetPlan): BudgetPlanSummary {
  const monthKey = getMonthKey();
  const summary = computeMonthSummary(plan, monthKey);
  return {
    id: plan.id,
    name: plan.name,
    availableToBudget: summary.availableToBudget,
    totalAssigned: summary.totalAssigned,
    totalSpent: summary.totalSpent,
    currency: plan.currency,
    updatedAt: plan.updatedAt,
  };
}

export function useBudgetPlansStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    plan: userPlan,
    isLoaded: isPlanLoaded,
    prefsLoadSucceeded,
  } = useUserPlan();
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);
  const pendingSaveRef = useRef<Map<string, BudgetPlan>>(new Map());

  const queueSave = useCallback((plan: BudgetPlan) => {
    pendingSaveRef.current.set(plan.id, plan);
  }, []);

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
    if (!canCreateLimitedResource(effectivePlan, "budget", plans.length)) {
      throw new PlanLimitError("budget");
    }
  }, [userPlan, isPlanLoaded, prefsLoadSucceeded, plans.length]);

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
        const remote = await loadBudgetPlansFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          const opened = normalizeBudgetPlans(remote).map((plan) => {
            const next = materializeDueSchedules(plan);
            if (next !== plan) queueSave(next);
            return next;
          });
          setPlans(opened);
        }
      } catch (error) {
        if (!cancelled && version === loadVersionRef.current) {
          setSyncError(
            error instanceof Error ? error.message : "Failed to load budget plans.",
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
  }, [user, isAuthLoading, queueSave]);

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
          await saveBudgetPlanToCloud(user.id, plan);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error ? error.message : "Failed to save budget plan.",
          );
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [plans, isLoaded, isAuthLoading, user]);

  const createPlan = useCallback(
    (name?: string): BudgetPlan => {
      assertCanCreate();

      const plan = createEmptyBudgetPlan(name);
      setPlans((prev) => [plan, ...prev]);
      queueSave(plan);
      return plan;
    },
    [queueSave, assertCanCreate],
  );

  const createPlanAndSave = useCallback(
    async (name: string): Promise<BudgetPlan> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Plan name is required.");
      }

      assertCanCreate();

      const plan = createEmptyBudgetPlan(trimmed);
      setPlans((prev) => [plan, ...prev]);

      if (user && isSupabaseConfigured()) {
        try {
          await saveBudgetPlanToCloud(user.id, plan);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error ? error.message : "Failed to save budget plan.",
          );
        }
      }

      return plan;
    },
    [user, assertCanCreate],
  );

  const updatePlan = useCallback(
    (id: string, updater: (plan: BudgetPlan) => BudgetPlan) => {
      setPlans((prev) => {
        const index = prev.findIndex((plan) => plan.id === id);
        if (index === -1) return prev;

        const nextPlan = updater(prev[index]);
        if (nextPlan === prev[index]) return prev;
        const updated = {
          ...nextPlan,
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

  const renamePlan = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      updatePlan(id, (plan) => ({ ...plan, name: trimmed }));
    },
    [updatePlan],
  );

  const deletePlan = useCallback(
    async (id: string) => {
      setPlans((prev) => prev.filter((plan) => plan.id !== id));
      pendingSaveRef.current.delete(id);

      if (!user || !isSupabaseConfigured()) return;

      try {
        await deleteBudgetPlanFromCloud(id);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Failed to delete budget plan.",
        );
      }
    },
    [user],
  );

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
    renamePlan,
    deletePlan,
    getPlan,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    isPlanReady: isPlanLoaded,
  };
}
