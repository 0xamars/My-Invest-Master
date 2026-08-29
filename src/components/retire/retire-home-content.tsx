"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Target } from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { RetirementVerdictHero } from "@/components/retirement/retirement-verdict-hero";
import { RetireEmptyState } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { runRetirementMonteCarlo } from "@/lib/retirement/monte-carlo";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";

export function RetireHomeContent() {
  const { plans, isLoaded } = useRetirementPlansStorage();
  const { rates } = useFxRate();

  const latest = useMemo(
    () => [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0],
    [plans],
  );
  const outlook = useMemo(() => {
    if (!latest) return null;
    const plan = normalizeRetirementPlan(latest);
    const projections = computeRetirementProjections(plan);
    const monteCarlo =
      plan.assets.length > 0
        ? runRetirementMonteCarlo(plan, { paths: 500, seed: 17 })
        : null;
    return {
      plan,
      dashboard: computeRetirementDashboard(plan, { projections, monteCarlo }),
    };
  }, [latest]);

  return (
    <div className="relative flex flex-1 flex-col gap-5">
      <CategoryPageHeader
        category="retire"
        title="Freedom"
        description="Know the target, whether the path is on track, how long it lasts, and which lever to pull."
        action={
          <Button
            variant="outline"
            className="gap-2"
            render={<Link href="/freedom/plans" />}
          >
            All plans
            <ArrowRight className="size-4" />
          </Button>
        }
      />

      {!isLoaded ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading Freedom plan…
        </div>
      ) : outlook ? (
        <RetirementVerdictHero
          dashboard={outlook.dashboard}
          currency={outlook.plan.currency}
          rates={rates}
          planName={outlook.plan.name}
          href={`/freedom/plans/${outlook.plan.id}`}
          emptyActions={
            <>
              <Button render={<Link href={`/freedom/plans/${outlook.plan.id}`} />}>
                Import from Invest
              </Button>
              <Button
                variant="outline"
                render={<Link href="/invest" />}
              >
                Open Invest checkup
              </Button>
            </>
          }
        />
      ) : (
        <div className="glass-card">
          <RetireEmptyState
            icon={<Target className="size-5" />}
            title="Map the path."
            description="Set the target age and a 4% nest egg — then import holdings from Invest. Not investment advice."
            actions={
              <Button className="gap-2" render={<Link href="/freedom/plans" />}>
                Start a plan
                <ArrowRight className="size-4" />
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
