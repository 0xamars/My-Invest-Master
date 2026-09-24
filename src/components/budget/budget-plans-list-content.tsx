"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageLoading } from "@/components/layout/page-loading";
import { BudgetPlanNameDialog } from "@/components/budget/budget-plan-name-dialog";
import { DeleteBudgetPlanDialog } from "@/components/budget/delete-budget-plan-dialog";
import { BudgetEmptyState, BudgetPageHeader } from "@/components/budget/budget-ui";
import { BudgetSyncError } from "@/components/budget/budget-sync-error";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { formatBudgetMoney } from "@/lib/budget/format";
import { BUDGET_EMPTY } from "@/lib/journey/empty-states";
import {
  budgetCurrencyFromProfile,
  shouldOfferBudgetFirstRunKit,
} from "@/lib/journey/first-run";
import { cn } from "@/lib/utils";
import type { BudgetPlan } from "@/types/budget";

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function BudgetPlansListContent() {
  const router = useRouter();
  const {
    summaries,
    plans,
    createPlanAndSave,
    createStarterKitAndSave,
    deletePlan,
    isLoaded,
    syncError,
    isPlanReady,
  } = useBudgetPlans();

  const { profile } = useMoneyProfile();
  const [deletingPlan, setDeletingPlan] = useState<BudgetPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const offerKit = shouldOfferBudgetFirstRunKit(summaries);
  const kitCurrency = budgetCurrencyFromProfile(profile?.currency);

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const plan = offerKit
        ? await createStarterKitAndSave(name, kitCurrency)
        : await createPlanAndSave(name);
      setCreateOpen(false);
      router.push(`/budget/plans/${plan.id}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStartKit() {
    if (!isPlanReady) return;
    setIsCreating(true);
    try {
      const plan = await createStarterKitAndSave("Budget", kitCurrency);
      router.push(`/budget/plans/${plan.id}`);
    } finally {
      setIsCreating(false);
    }
  }

  function openCreate() {
    if (!isPlanReady) return;
    setCreateOpen(true);
  }

  function openPlan(planId: string) {
    router.push(`/budget/plans/${planId}`);
  }

  if (!isLoaded) {
    return <PageLoading label="Loading Budget…" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <BudgetPageHeader
        title="Budget"
        description="One spending account, envelopes, leftover, and a real month close."
        action={
          <Button
            onClick={openCreate}
            disabled={isCreating || !isPlanReady}
          >
            <Plus className="size-4" />
            New plan
          </Button>
        }
      />

      {syncError && <BudgetSyncError message={syncError} tone="destructive" />}

      {summaries.length === 0 ? (
        <div data-budget-first-run-kit="1" data-empty-state="budget">
          <BudgetEmptyState
            title={BUDGET_EMPTY.title}
            description={BUDGET_EMPTY.description}
            actions={
              <Button
                onClick={() => void handleStartKit()}
                disabled={isCreating || !isPlanReady}
              >
                <Plus className="size-4" />
                {BUDGET_EMPTY.kitLabel}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const plan = plans.find((item) => item.id === summary.id);

            return (
              <div
                key={summary.id}
                className="budget-panel group relative transition-colors hover:border-[var(--brand-green)]/35"
              >
                <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-[var(--brand-green)]/70 opacity-80" />
                <div className="px-5 py-4 pl-6">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openPlan(summary.id)}
                      className="min-w-0 truncate text-left text-sm font-semibold tracking-tight hover:text-[var(--brand-green)]"
                    >
                      {summary.name}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPlan(summary.id)}
                    className="mt-4 block w-full text-left"
                  >
                    <p className="budget-metric-label">Leftover</p>
                    <p
                      className={cn(
                        "mt-1 text-[1.65rem] font-semibold tracking-tight tabular-nums",
                        summary.availableToBudget < 0
                          ? "text-[var(--brand-red)]"
                          : summary.availableToBudget > 0
                            ? "text-[var(--brand-green)]"
                            : "text-foreground",
                      )}
                    >
                      {formatBudgetMoney(summary.availableToBudget, summary.currency)}
                    </p>
                  </button>
                  <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
                    <span>
                      Assigned{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatBudgetMoney(summary.totalAssigned, summary.currency)}
                      </span>
                    </span>
                    <span>
                      Spent{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatBudgetMoney(summary.totalSpent, summary.currency)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Updated {formatUpdatedAt(summary.updatedAt)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (plan) setDeletingPlan(plan);
                      }}
                      aria-label={`Delete ${summary.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BudgetPlanNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Budget Plan"
        description="Give your plan a name so you can find it on Budget."
        confirmLabel="Create plan"
        onConfirm={handleCreate}
        isSubmitting={isCreating}
      />

      <DeleteBudgetPlanDialog
        plan={deletingPlan}
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
        onConfirm={deletePlan}
      />
    </div>
  );
}
