"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BudgetDialogProvider } from "@/components/budget/budget-dialog-provider";
import { BudgetShell } from "@/components/budget/budget-shell";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import { Button } from "@/components/ui/button";
import { BudgetPlanProvider } from "@/contexts/budget-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { canOpenBudgetPlanOnPlan } from "@/lib/plans/free-access";

export default function BudgetPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const { getPlan, plans, isLoaded } = useBudgetPlans();
  const { plan: userPlan, isLoaded: isPlanLoaded } = useUserPlan();
  const plan = getPlan(planId);
  const canOpen = canOpenBudgetPlanOnPlan(userPlan, plans, planId);

  if (!isLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading budget plan…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold">Budget plan not found</p>
        <p className="max-w-md text-sm text-muted-foreground">
          This plan may have been deleted or the link is invalid.
        </p>
        <Button variant="outline" className="gap-2" render={<Link href="/budget" />}>
          <ArrowLeft className="size-4" />
          Back to Budget Plans
        </Button>
      </div>
    );
  }

  return (
    <FreeResourceOpenGuard
      resource="budget"
      isResourceLoaded={isLoaded && isPlanLoaded}
      canOpen={canOpen}
      listHref="/budget"
      listLabel="Back to Budget Plans"
    >
      <BudgetPlanProvider planId={planId}>
        <BudgetDialogProvider>
          <BudgetShell planId={planId} planName={plan.name}>
            {children}
          </BudgetShell>
        </BudgetDialogProvider>
      </BudgetPlanProvider>
    </FreeResourceOpenGuard>
  );
}
