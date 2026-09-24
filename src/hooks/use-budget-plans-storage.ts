"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { computeMonthSummary } from "@/lib/budget/calculations";
import { normalizeBudgetPlans } from "@/lib/budget/migrate-plan";
import {
  debouncedPlanSaveIsStale,
  flushQueuedPlanSave,
} from "@/lib/budget/plan-save-queue";
import {
  BUDGET_PLAN_CONFLICT_MESSAGE,
  BudgetPlanConflictError,
  isBudgetPlanConflict,
} from "@/lib/budget/plan-version";
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
import { createFirstRunBudgetKit } from "@/lib/journey/first-run";
import {
  createEmptyBudgetPlan,
  getMonthKey,
  type BudgetCurrency,
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
  const baseVersionRef = useRef<Map<string, number>>(new Map());
  const versioningRef = useRef(true);
  const conflictedRef = useRef<Set<string>>(new Set());
  const planEpochRef = useRef<Map<string, number>>(new Map());
  const latestSaveRef = useRef<Map<string, { plan: BudgetPlan; epoch: number }>>(
    new Map(),
  );
  const saveTailRef = useRef<Map<string, Promise<void>>>(new Map());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

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
          baseVersionRef.current = new Map(Object.entries(remote.versions));
          versioningRef.current = remote.versioning;
          conflictedRef.current = new Set();
          // Scheduled rows stay in memory until the user edits. Saving them
          // on open makes two fresh tabs conflict with no user change.
          const opened = normalizeBudgetPlans(remote.plans).map((plan) =>
            materializeDueSchedules(plan),
          );
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
  }, [user, isAuthLoading]);

  const enqueuePlanSave = useCallback(
    (plan: BudgetPlan, options?: { epochAtDequeue?: number }) => {
      if (
        options?.epochAtDequeue != null &&
        debouncedPlanSaveIsStale(
          options.epochAtDequeue,
          planEpochRef.current.get(plan.id) ?? 0,
        )
      ) {
        return Promise.resolve();
      }
      if (conflictedRef.current.has(plan.id)) {
        const error = new BudgetPlanConflictError();
        setSyncError(error.message);
        return Promise.reject(error);
      }
      if (!user || !isSupabaseConfigured()) {
        return Promise.reject(new Error("Could not save the budget plan."));
      }

      const epoch = (planEpochRef.current.get(plan.id) ?? 0) + 1;
      planEpochRef.current.set(plan.id, epoch);
      pendingSaveRef.current.delete(plan.id);
      latestSaveRef.current.set(plan.id, { plan, epoch });

      const userId = user.id;
      const prev = saveTailRef.current.get(plan.id) ?? Promise.resolve();
      const job = prev.catch(() => undefined).then(async () => {
        const latest = latestSaveRef.current.get(plan.id);
        if (!latest || latest.epoch !== epoch) return;
        if (conflictedRef.current.has(latest.plan.id)) {
          throw new BudgetPlanConflictError();
        }
        const versioning = versioningRef.current;
        const expectedVersion = versioning
          ? baseVersionRef.current.has(latest.plan.id)
            ? (baseVersionRef.current.get(latest.plan.id) ?? null)
            : null
          : null;
        const saved = await saveBudgetPlanToCloud(userId, latest.plan, {
          expectedVersion,
          versioning,
        });
        if (versioning) {
          baseVersionRef.current.set(latest.plan.id, saved.version);
        }
        if (conflictedRef.current.size === 0) setSyncError(null);
      });
      const tracked = job.catch((error: unknown) => {
        if (isBudgetPlanConflict(error)) {
          conflictedRef.current.add(plan.id);
          setSyncError(
            error instanceof Error ? error.message : BUDGET_PLAN_CONFLICT_MESSAGE,
          );
        } else {
          setSyncError(
            error instanceof Error ? error.message : "Failed to save budget plan.",
          );
        }
        throw error;
      });
      inflightRef.current.set(plan.id, tracked);
      const tail = tracked.then(
        () => undefined,
        () => undefined,
      );
      saveTailRef.current.set(plan.id, tail);
      void tracked.finally(() => {
        if (inflightRef.current.get(plan.id) === tracked) {
          inflightRef.current.delete(plan.id);
        }
      });
      return tracked;
    },
    [user],
  );

  const flushPlanSave = useCallback(
    async (planId: string) => {
      await flushQueuedPlanSave({
        planId,
        pending: pendingSaveRef.current,
        inflight: inflightRef.current.get(planId),
        save: (plan) => enqueuePlanSave(plan),
      });
    },
    [enqueuePlanSave],
  );

  useEffect(() => {
    if (!isLoaded || isAuthLoading || !user || !isSupabaseConfigured()) {
      return;
    }

    if (pendingSaveRef.current.size === 0) return;

    const timer = window.setTimeout(async () => {
      const toSave = [...pendingSaveRef.current.values()].map((plan) => ({
        plan,
        epochAtDequeue: planEpochRef.current.get(plan.id) ?? 0,
      }));
      pendingSaveRef.current.clear();

      for (const item of toSave) {
        try {
          await enqueuePlanSave(item.plan, { epochAtDequeue: item.epochAtDequeue });
        } catch {
          // enqueuePlanSave records syncError and keeps the server row intact.
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [plans, isLoaded, isAuthLoading, user, enqueuePlanSave]);

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

  const persistNewPlan = useCallback(
    async (plan: BudgetPlan): Promise<BudgetPlan> => {
      setPlans((prev) => [plan, ...prev]);

      if (user && isSupabaseConfigured()) {
        try {
          await enqueuePlanSave(plan);
        } catch {
          // enqueuePlanSave records syncError. A new plan that loses the insert stays local.
        }
      }

      return plan;
    },
    [user, enqueuePlanSave],
  );

  const createPlanAndSave = useCallback(
    async (name: string): Promise<BudgetPlan> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Plan name is required.");
      }

      assertCanCreate();
      return persistNewPlan(createEmptyBudgetPlan(trimmed));
    },
    [assertCanCreate, persistNewPlan],
  );

  const createStarterKitAndSave = useCallback(
    async (
      name = "Budget",
      currency?: BudgetCurrency,
    ): Promise<BudgetPlan> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Plan name is required.");
      }

      assertCanCreate();
      return persistNewPlan(createFirstRunBudgetKit(trimmed, { currency }));
    },
    [assertCanCreate, persistNewPlan],
  );

  const updatePlan = useCallback(
    (
      id: string,
      updater: (plan: BudgetPlan) => BudgetPlan,
      options?: { persist?: boolean },
    ) => {
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
        if (options?.persist !== false) queueSave(updated);
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
      baseVersionRef.current.delete(id);
      conflictedRef.current.delete(id);
      latestSaveRef.current.delete(id);

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
    createStarterKitAndSave,
    updatePlan,
    renamePlan,
    deletePlan,
    getPlan,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    isPlanReady: isPlanLoaded,
    flushPlanSave,
    enqueuePlanSave,
  };
}
