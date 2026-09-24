"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageLoading } from "@/components/layout/page-loading";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
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
      className="mt-5 h-1 w-full bg-white/[0.06]"
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
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
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
    return <PageLoading label="Loading Home…" />;
  }

  return (
    <div className="grid flex-1 content-start gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.pillar}
          href={card.href}
          data-home-card={card.pillar}
          className="budget-panel block px-5 py-5 transition-colors hover:border-[var(--brand-green)]/35"
        >
          <p className="budget-metric-label">{card.title}</p>
          <p
            className={cn(
              "mt-3 text-[1.65rem] font-semibold tracking-tight",
              card.empty
                ? "text-muted-foreground"
                : "text-foreground tabular-nums",
            )}
          >
            {card.metric}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{card.caption}</p>
          <HomeSpark value={card.spark} />
        </Link>
      ))}
    </div>
  );
}
