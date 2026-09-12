"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageLoading } from "@/components/layout/page-loading";
import { RetirePageHeader } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { commandCenterLiveFromPlans } from "@/lib/journey/command-center";
import { JOURNEY_EDUCATIONAL_FOOTER } from "@/lib/journey/empty-states";
import { journeyFreedomDate } from "@/lib/journey/freedom-date";
import {
  buildSignedInHomeCards,
  signedInHomeBudgetWorking,
  signedInHomeNextAction,
} from "@/lib/journey/signed-in-home";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import { cn } from "@/lib/utils";

export function SignedInHomeContent() {
  const budget = useBudgetPlans();
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
  const { plans: retirePlans, isLoaded: retireLoaded } =
    useRetirementPlansStorage();

  const leftover = useMemo(
    () => leftoverPresenceFromBudgetPlans(budget.plans),
    [budget.plans],
  );
  const book = useMemo(
    () => bookPresenceFromPortfolio(primaryPortfolio),
    [primaryPortfolio],
  );
  const latestRetire = useMemo(
    () =>
      [...retirePlans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ??
      null,
    [retirePlans],
  );
  const freedom = useMemo(
    () =>
      journeyFreedomDate({
        leftover,
        book,
        assumptions: latestRetire,
      }),
    [leftover, book, latestRetire],
  );
  const live = useMemo(
    () =>
      commandCenterLiveFromPlans({
        budgetPlans: budget.plans,
        leftover,
        hasHoldings: book.status === "present",
        hasFreedomPlan: retirePlans.length > 0,
        budgetWorking: signedInHomeBudgetWorking(budget.plans),
      }),
    [budget.plans, leftover, book, retirePlans.length],
  );
  const cards = useMemo(
    () =>
      buildSignedInHomeCards({
        leftover,
        book,
        freedom,
        budgetPlanId: live.budgetPlanId,
      }),
    [leftover, book, freedom, live.budgetPlanId],
  );
  const next = useMemo(() => signedInHomeNextAction(live), [live]);

  const ready = budget.isLoaded && portfoliosLoaded && retireLoaded;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <RetirePageHeader
        title="Home"
        description="Budget, Invest, and Retire in one view. Not advice."
        action={
          next ? (
            <Button className="gap-2" render={<Link href={next.href} />}>
              {next.label}
              <ArrowRight className="size-4" />
            </Button>
          ) : null
        }
      />

      {!ready ? (
        <PageLoading label="Loading Home…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
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
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {card.caption}
              </p>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{JOURNEY_EDUCATIONAL_FOOTER}</p>
    </div>
  );
}
