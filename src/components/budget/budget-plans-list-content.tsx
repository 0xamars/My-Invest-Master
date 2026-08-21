"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { BudgetPlanNameDialog } from "@/components/budget/budget-plan-name-dialog";
import { DeleteBudgetPlanDialog } from "@/components/budget/delete-budget-plan-dialog";
import { BudgetEmptyState, BudgetPageHeader, BudgetPanel } from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { formatBudgetMoney } from "@/lib/budget/format";
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
    deletePlan,
    isLoaded,
    syncError,
    isPlanReady,
  } = useBudgetPlans();

  const [deletingPlan, setDeletingPlan] = useState<BudgetPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const plan = await createPlanAndSave(name);
      setCreateOpen(false);
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
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading budget plans…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <BudgetPageHeader
        title="Budget"
        description="Household, side project, or a what-if. Create as many plans as you need."
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

      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      {summaries.length === 0 ? (
        <BudgetPanel>
          <BudgetEmptyState
            icon={<Wallet className="size-5" />}
            title="Start a budget."
            description="Track income, assign spending, and keep Ready to Assign honest."
            actions={
              <Button onClick={openCreate} disabled={isCreating || !isPlanReady}>
                <Plus className="size-4" />
                Create a plan
              </Button>
            }
          />
        </BudgetPanel>
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
                    <p className="budget-metric-label">Ready to Assign</p>
                    <p
                      className={cn(
                        "mt-1 text-[1.65rem] font-semibold tracking-tight tabular-nums",
                        summary.availableToBudget < 0
                          ? "text-[var(--brand-red)]"
                          : "text-[var(--brand-green)]",
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
        description="Give your plan a name so you can find it easily in the sidebar and overview."
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
