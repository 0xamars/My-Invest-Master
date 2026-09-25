"use client";

import { useMemo } from "react";
import Link from "next/link";
import { HomeChecklist } from "@/components/home/home-checklist";
import { EmptyArt } from "@/components/journey/empty-art";
import { PageLoading } from "@/components/layout/page-loading";
import { MotionValue } from "@/components/ui/motion-value";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { buildHomeChecklist } from "@/lib/journey/home-checklist";
import {
  buildSignedInHomeCards,
  signedInHomeAssignedFromPlans,
} from "@/lib/journey/signed-in-home";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import { cn } from "@/lib/utils";

function HomeSpark({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <div
      className="mt-4 h-1 w-full rounded-full bg-muted"
      aria-hidden
    >
      <div
        className="h-full bg-[var(--brand-green)]"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function SignedInHomeContent() {
  const budget = useBudgetPlans();
  const {
    primaryPortfolio,
    portfolios,
    isLoaded: portfoliosLoaded,
  } = usePortfolioPlans();
  const { plans: retirePlans, isLoaded: retireLoaded } =
    useRetirementPlansStorage();
  const { rates } = useFxRate();

  const leftover = useMemo(
    () => leftoverPresenceFromBudgetPlans(budget.plans),
    [budget.plans],
  );
  const book = useMemo(
    () => bookPresenceFromPortfolio(primaryPortfolio),
    [primaryPortfolio],
  );
  const assigned = useMemo(
    () => signedInHomeAssignedFromPlans(budget.plans),
    [budget.plans],
  );
  const latestRetire = useMemo(
    () =>
      [...retirePlans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ??
      null,
    [retirePlans],
  );
  const checklist = useMemo(
    () =>
      buildHomeChecklist({
        hasBudget: budget.plans.length > 0,
        hasBook: portfolios.length > 0,
        hasRetirePlan: retirePlans.length > 0,
      }),
    [budget.plans.length, portfolios.length, retirePlans.length],
  );
  const cards = useMemo(
    () =>
      buildSignedInHomeCards({
        leftover,
        book,
        assigned: assigned.assigned,
        budgetPlanId: assigned.planId,
        assumptions: latestRetire,
        rates,
      }),
    [leftover, book, assigned, latestRetire, rates],
  );

  const ready = budget.isLoaded && portfoliosLoaded && retireLoaded;

  if (!ready) {
    return (
      <PageLoading
        label="Loading Home"
        layout="cards"
        cards={["Budget", "Invest", "Retire"]}
      />
    );
  }

  const homeEmpty = cards.every((card) => card.empty);

  return (
    <div className="desk-stack">
      {checklist ? (
        <HomeChecklist items={checklist} />
      ) : homeEmpty ? (
        <div className="budget-panel" data-empty-state="home">
          <div className="empty-stack">
            <EmptyArt kind="home" />
          </div>
        </div>
      ) : null}
      <div className="grid content-start gap-6 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.pillar}
            href={card.href}
            data-home-card={card.pillar}
            className="budget-panel block px-6 py-6 transition-colors hover:border-[var(--brand-green)]/35"
          >
            <p className="budget-metric-label">{card.title}</p>
            <MotionValue
              value={card.metric}
              className={cn(
                "mt-2",
                card.empty
                  ? "text-[1.35rem] font-semibold tracking-tight text-muted-foreground"
                  : "money-hero money-hero--card text-foreground",
              )}
            />
            <p className="mt-1.5 text-sm text-muted-foreground">{card.caption}</p>
            <HomeSpark value={card.spark} />
          </Link>
        ))}
      </div>
    </div>
  );
}
