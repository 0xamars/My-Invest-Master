"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Target } from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { RetirementVerdictHero } from "@/components/retirement/retirement-verdict-hero";
import { RetirementWhatIf } from "@/components/retirement/retirement-what-if";
import { RetireEmptyState, RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import {
  bindFreedomPathPlan,
  bookPresenceFromPortfolio,
  pickFreedomLever,
} from "@/lib/retirement/freedom-path";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import {
  compareRetirementScenarios,
  type RetirementScenarioId,
} from "@/lib/retirement/scenarios";
import { createEmptyPlan, type RetirementPlan } from "@/types/retirement";

export function RetireHomeContent() {
  const budget = useBudgetPlans();
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
  const { plans, isLoaded, updatePlan } = useRetirementPlansStorage();
  const { rates } = useFxRate();
  const { prices } = usePortfolioPrices(primaryPortfolio?.holdings ?? []);
  const [preview, setPreview] = useState<RetirementPlan | null>(null);
  const [selectedId, setSelectedId] = useState<RetirementScenarioId | null>(
    null,
  );

  const leftover = useMemo(
    () => leftoverPresenceFromBudgetPlans(budget.plans),
    [budget.plans],
  );
  const book = useMemo(
    () => bookPresenceFromPortfolio(primaryPortfolio),
    [primaryPortfolio],
  );

  const latest = useMemo(
    () => [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0],
    [plans],
  );

  const basePath = useMemo(() => {
    const assumptions = latest
      ? normalizeRetirementPlan(latest)
      : createEmptyPlan("Freedom");
    return {
      assumptions: latest ? assumptions : null,
      path: bindFreedomPathPlan(assumptions, leftover, book, prices),
    };
  }, [latest, leftover, book, prices]);

  const displayed = preview ?? basePath.path;
  const dashboard = useMemo(
    () => computeRetirementDashboard(displayed),
    [displayed],
  );
  const lever = pickFreedomLever(leftover, book, dashboard);

  const whatIfs = useMemo(
    () =>
      basePath.path.assets.length > 0
        ? compareRetirementScenarios(basePath.path, {
            includeBase: false,
            paths: 200,
            seed: 17,
          })
        : [],
    [basePath.path],
  );

  const ready = isLoaded && budget.isLoaded && portfoliosLoaded;
  const inputsMissing =
    leftover.status !== "present" && book.status === "missing";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <CategoryPageHeader
        category="retire"
        title="Freedom"
        description="One date from leftover and the book. Target, on-track, and the lever on this path."
        action={
          latest ? (
            <Button
              variant="outline"
              className="gap-2"
              render={<Link href="/freedom/plans" />}
            >
              All plans
              <ArrowRight className="size-4" />
            </Button>
          ) : null
        }
      />

      {!ready ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading Freedom…
        </div>
      ) : inputsMissing && !latest ? (
        <div className="glass-card">
          <RetireEmptyState
            icon={<Target className="size-5" />}
            title="Leftover and the book are missing"
            description="Freedom will not invent cash. Assign leftover in Budget, or add holdings in Invest."
            actions={
              <>
                <Button render={<Link href="/budget" />}>Open Budget</Button>
                <Button variant="outline" render={<Link href="/invest" />}>
                  Open Invest
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          <RetirementVerdictHero
            dashboard={dashboard}
            currency={displayed.currency}
            rates={rates}
            planName={basePath.assumptions?.name}
            leftover={leftover}
            book={book}
            lever={lever}
            href={
              basePath.assumptions
                ? `/freedom/plans/${basePath.assumptions.id}`
                : undefined
            }
            emptyActions={
              <>
                <Button render={<Link href="/budget" />}>Open Budget</Button>
                <Button variant="outline" render={<Link href="/invest" />}>
                  Open Invest
                </Button>
              </>
            }
          />

          {!basePath.assumptions && basePath.path.assets.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Spending is an assumption until you save a plan. Freedom does
              not invent leftover or book cash.
            </p>
          ) : null}

          {whatIfs.length > 0 ? (
            <RetirePanel className="px-5 py-5 sm:px-6">
              <RetirementWhatIf
                comparisons={whatIfs}
                selectedId={selectedId}
                currency={displayed.currency}
                rates={rates}
                dirty={preview != null}
                onSelect={(next, id) => {
                  setSelectedId(id as RetirementScenarioId);
                  setPreview(next);
                }}
                onApply={(next) => {
                  const saved = basePath.assumptions;
                  if (!saved) return;
                  updatePlan(saved.id, () => ({
                    ...saved,
                    annualLifestyleSpending: next.annualLifestyleSpending,
                    retirementAge: next.retirementAge,
                    retirementYear: next.retirementYear,
                    annualContribution: 0,
                  }));
                  setPreview(null);
                  setSelectedId(null);
                }}
                onReset={() => {
                  setPreview(null);
                  setSelectedId(null);
                }}
              />
            </RetirePanel>
          ) : null}
        </>
      )}
    </div>
  );
}
