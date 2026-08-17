"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Crown,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { BudgetPlanNameDialog } from "@/components/budget/budget-plan-name-dialog";
import { DeleteBudgetPlanDialog } from "@/components/budget/delete-budget-plan-dialog";
import { BudgetEmptyState, BudgetPageHeader, BudgetPanel } from "@/components/budget/budget-ui";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePremiumUpgradePrompt } from "@/hooks/use-premium-upgrade-prompt";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { formatBudgetMoney } from "@/lib/budget/format";
import {
  canCreateLimitedResource,
  isPlanLimitError,
} from "@/lib/plans/access";
import {
  canOpenBudgetPlanOnPlan,
  pickFreeAllowedPlanId,
} from "@/lib/plans/free-access";
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
  const { plan: userPlan } = useUserPlan();
  const {
    summaries,
    plans,
    createPlanAndSave,
    deletePlan,
    isLoaded,
    syncError,
    isPlanReady,
  } = useBudgetPlans();
  const upgrade = usePremiumUpgradePrompt();

  const [deletingPlan, setDeletingPlan] = useState<BudgetPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const atFreeLimit =
    isPlanReady &&
    !canCreateLimitedResource(userPlan, "budget", plans.length);
  const freeAllowedPlanId = pickFreeAllowedPlanId(plans);

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const plan = await createPlanAndSave(name);
      setCreateOpen(false);
      router.push(`/budget/plans/${plan.id}`);
    } catch (error) {
      if (isPlanLimitError(error)) {
        setCreateOpen(false);
        upgrade.promptLimit(error.resource);
      } else {
        throw error;
      }
    } finally {
      setIsCreating(false);
    }
  }

  function openCreate() {
    if (!isPlanReady) return;
    if (atFreeLimit) {
      upgrade.promptLimit("budget");
      return;
    }
    setCreateOpen(true);
  }

  function openPlan(planId: string) {
    if (!canOpenBudgetPlanOnPlan(userPlan, plans, planId)) {
      upgrade.promptOpen("budget");
      return;
    }
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
        description="Household, side project, or a what-if. Free can open one plan; extras stay listed for cleanup."
        action={
          <Button
            onClick={openCreate}
            disabled={isCreating || !isPlanReady}
          >
            {atFreeLimit ? (
              <Crown className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            New plan
          </Button>
        }
      />

      {atFreeLimit && <PremiumUpgradeCallout resource="budget" />}

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
            title="No plans yet"
            description="Create a budget to track income, assign spending, and keep Ready to Assign honest."
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
            const canOpen = canOpenBudgetPlanOnPlan(
              userPlan,
              plans,
              summary.id,
            );
            const isFreeAllowed = summary.id === freeAllowedPlanId;

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
                    {userPlan === "free" && plans.length > 1 && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                          isFreeAllowed
                            ? "bg-[var(--brand-green)]/12 text-[var(--brand-green)]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isFreeAllowed ? (
                          "Included"
                        ) : (
                          <>
                            <Lock className="size-3" />
                            Premium
                          </>
                        )}
                      </span>
                    )}
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
                      {formatBudgetMoney(summary.availableToBudget)}
                    </p>
                  </button>
                  <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
                    <span>
                      Assigned{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatBudgetMoney(summary.totalAssigned)}
                      </span>
                    </span>
                    <span>
                      Spent{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatBudgetMoney(summary.totalSpent)}
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
                  {!canOpen && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Premium to open this extra plan.
                    </p>
                  )}
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

      <PremiumUpgradeDialog {...upgrade.dialogProps} />
    </div>
  );
}
