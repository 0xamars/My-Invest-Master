"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Crown,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { BudgetPlanNameDialog } from "@/components/budget/budget-plan-name-dialog";
import { DeleteBudgetPlanDialog } from "@/components/budget/delete-budget-plan-dialog";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget Plans</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Create separate budget plans for household, side projects, or any
            scenario. Free can open one plan; extras stay listed for cleanup.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="gap-2"
          disabled={isCreating || !isPlanReady}
        >
          {atFreeLimit ? (
            <Crown className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          Create New Budget Plan
        </Button>
      </div>

      {atFreeLimit && <PremiumUpgradeCallout resource="budget" />}

      {syncError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      {summaries.length === 0 ? (
        <Card className="surface-card border-dashed shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="size-6" />
            </div>
            <CardTitle>No budget plans yet</CardTitle>
            <CardDescription>
              Create your first budget plan to track income, spending, and
              category assignments.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              onClick={openCreate}
              className="gap-2"
              disabled={isCreating || !isPlanReady}
            >
              <Plus className="size-4" />
              Create New Budget Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const plan = plans.find((item) => item.id === summary.id);
            const canOpen = canOpenBudgetPlanOnPlan(
              userPlan,
              plans,
              summary.id,
            );
            const isFreeAllowed = summary.id === freeAllowedPlanId;

            return (
              <Card
                key={summary.id}
                className="surface-card gap-0 py-0 shadow-none transition-colors hover:border-border"
              >
                <CardHeader className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate text-base font-semibold">
                      {summary.name}
                    </CardTitle>
                    {userPlan === "free" && plans.length > 1 && (
                      <span
                        className={
                          isFreeAllowed
                            ? "inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary"
                            : "inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
                        }
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
                  <CardDescription>Available to budget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-4">
                  <p className="stat-value text-xl">
                    {formatBudgetMoney(summary.availableToBudget)}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned</p>
                      <p className="font-medium tabular-nums">
                        {formatBudgetMoney(summary.totalAssigned)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spent</p>
                      <p className="font-medium tabular-nums">
                        {formatBudgetMoney(summary.totalSpent)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Updated {formatUpdatedAt(summary.updatedAt)}
                  </p>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => openPlan(summary.id)}
                    >
                      {canOpen ? (
                        <Pencil className="size-3.5" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => plan && setDeletingPlan(plan)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
