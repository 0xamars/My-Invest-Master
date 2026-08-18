"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Target } from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { RetirementVerdictHero } from "@/components/retirement/retirement-verdict-hero";
import { RetireEmptyState, RetirePanel } from "@/components/retirement/retire-ui";
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
    <div className="flex flex-1 flex-col gap-5">
      <CategoryPageHeader
        category="retire"
        title="Retire"
        description="Know the target, whether the portfolio is on track, when money runs out, and which lever to pull."
        action={
          <Button
            variant="outline"
            className="gap-2"
            render={<Link href="/retire/plans" />}
          >
            All plans
            <ArrowRight className="size-4" />
          </Button>
        }
      />

      {!isLoaded ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading retirement plan…
        </div>
      ) : outlook ? (
        <RetirementVerdictHero
          dashboard={outlook.dashboard}
          currency={outlook.plan.currency}
          rates={rates}
          planName={outlook.plan.name}
          href={`/retire/plans/${outlook.plan.id}`}
          emptyActions={
            <>
              <Button render={<Link href={`/retire/plans/${outlook.plan.id}`} />}>
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
        <RetirePanel>
          <RetireEmptyState
            icon={<Target className="size-5" />}
            title="No retirement plan yet"
            description="Free accounts can keep one plan. Start with ages, spending, and a 4% target — then import holdings from Invest."
            actions={
              <Button className="gap-2" render={<Link href="/retire/plans" />}>
                Open plans
                <ArrowRight className="size-4" />
              </Button>
            }
          />
        </RetirePanel>
      )}
    </div>
  );
}
