"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HomeChecklist } from "@/components/home/home-checklist";
import { EmptyArt } from "@/components/journey/empty-art";
import { PageLoading } from "@/components/layout/page-loading";
import { MotionValue } from "@/components/ui/motion-value";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useAuth } from "@/hooks/use-auth";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  readLastOpenedBudgetPlanId,
  selectHomeBudgetPlan,
} from "@/lib/budget/plan-navigation";
import { leftoverPresenceFromBudgetPlan } from "@/lib/invest/leftover";
import { buildHomeChecklist } from "@/lib/journey/home-checklist";
import { canOpenBudgetPlanOnPlan } from "@/lib/plans/free-access";
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
  const { user } = useAuth();
  const budget = useBudgetPlans();
  const { plan: tier, isLoaded: tierLoaded } = useUserPlan();
  const {
    primaryPortfolio,
    portfolios,
    isLoaded: portfoliosLoaded,
  } = usePortfolioPlans();
  const { plans: retirePlans, isLoaded: retireLoaded } =
    useRetirementPlansStorage();
  const { rates } = useFxRate();
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const [rememberedReady, setRememberedReady] = useState(false);

  useEffect(() => {
    setLastOpenedId(
      readLastOpenedBudgetPlanId(window.localStorage, user?.id),
    );
    setRememberedReady(true);
  }, [user?.id]);

  const selectedBudgetPlan = useMemo(
    () =>
      selectHomeBudgetPlan(budget.plans, lastOpenedId, (planId) =>
        canOpenBudgetPlanOnPlan(tier, budget.plans, planId),
      ),
    [budget.plans, lastOpenedId, tier],
  );
  const leftover = useMemo(
    () => leftoverPresenceFromBudgetPlan(selectedBudgetPlan),
    [selectedBudgetPlan],
  );
  const book = useMemo(
    () => bookPresenceFromPortfolio(primaryPortfolio),
    [primaryPortfolio],
  );
  const assigned = useMemo(
    () =>
      signedInHomeAssignedFromPlans(
        budget.plans,
        undefined,
        selectedBudgetPlan?.id ?? null,
      ),
    [budget.plans, selectedBudgetPlan],
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
        budgetPlanId: selectedBudgetPlan?.id ?? null,
        assumptions: latestRetire,
        rates,
      }),
    [leftover, book, assigned, selectedBudgetPlan, latestRetire, rates],
  );

  const ready =
    budget.isLoaded &&
    portfoliosLoaded &&
    retireLoaded &&
    tierLoaded &&
    rememberedReady;

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
