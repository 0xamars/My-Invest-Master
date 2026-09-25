"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageLoading } from "@/components/layout/page-loading";
import { EmptyArt } from "@/components/journey/empty-art";
import { RetirementDisclaimer } from "@/components/retirement/retirement-disclaimer";
import {
  RetireEmptyState,
  RetirePageHeader,
  RetirePanel,
} from "@/components/retirement/retire-ui";
import { RetirementVerdictHero } from "@/components/retirement/retirement-verdict-hero";
import { RetirementWhatIf } from "@/components/retirement/retirement-what-if";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { FREEDOM_EMPTY } from "@/lib/journey/empty-states";
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
      : createEmptyPlan("Retire");
    return {
      assumptions: latest ? assumptions : null,
      path: bindFreedomPathPlan(assumptions, leftover, book, prices, rates),
    };
  }, [latest, leftover, book, prices, rates]);

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
    <div className="desk-stack">
      <RetirePageHeader
        title="Retire"
        description="One date from leftover and the book. Target, on-track, and the lever on this path."
        action={
          latest ? (
            <Button
              variant="ghost"
              className="btn-quiet gap-2"
              render={<Link href="/retire/plans" />}
            >
              All plans
              <ArrowRight className="size-4" />
            </Button>
          ) : null
        }
      />
      <RetirementDisclaimer />

      {!ready ? (
        <PageLoading label="Loading Retire…" />
      ) : inputsMissing && !latest ? (
        <RetirePanel data-empty-state="retire">
          <RetireEmptyState
            art={<EmptyArt kind="retire" />}
            title={FREEDOM_EMPTY.title}
            description={FREEDOM_EMPTY.description}
            actions={
              <>
                <Button render={<Link href={FREEDOM_EMPTY.leftoverHref} />}>
                  {FREEDOM_EMPTY.leftoverLabel}
                </Button>
                <Button
                  variant="ghost"
                  className="btn-quiet"
                  render={<Link href={FREEDOM_EMPTY.bookHref} />}
                >
                  {FREEDOM_EMPTY.bookLabel}
                </Button>
              </>
            }
          />
        </RetirePanel>
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
                ? `/retire/plans/${basePath.assumptions.id}`
                : undefined
            }
            emptyActions={
              <>
                <Button render={<Link href={FREEDOM_EMPTY.leftoverHref} />}>
                  {FREEDOM_EMPTY.leftoverLabel}
                </Button>
                <Button
                  variant="ghost"
                  className="btn-quiet"
                  render={<Link href={FREEDOM_EMPTY.bookHref} />}
                >
                  {FREEDOM_EMPTY.bookLabel}
                </Button>
              </>
            }
          />

          {!basePath.assumptions && basePath.path.assets.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Spending is an assumption until you save a plan. Retire does
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
