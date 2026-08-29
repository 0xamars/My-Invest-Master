"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { useSyncWorkingFlags } from "@/hooks/use-sync-working-flags";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import {
  commandCenterLiveFromPlans,
  commandCenterNextAction,
  stationCardHref,
  stationMetricLabel,
} from "@/lib/journey/command-center";
import { JOURNEY_EDUCATIONAL_FOOTER } from "@/lib/journey/empty-states";
import { journeyFreedomDate } from "@/lib/journey/freedom-date";
import { JOURNEY_HOME_STATUS_LABELS } from "@/lib/journey/labels";
import { journeyStations } from "@/lib/journey/stations";
import { withDerivedWorking } from "@/lib/journey/working";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import { MONEY_PROFILE_PATH } from "@/lib/routes";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";

export function JourneyHomeContent() {
  const router = useRouter();
  const { profile, isLoaded } = useMoneyProfile();
  const budget = useBudgetPlans();
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
  const { plans, isLoaded: retireLoaded } = useRetirementPlansStorage();
  const derivedWorking = useSyncWorkingFlags();

  useEffect(() => {
    if (isLoaded && !profile) {
      router.replace(MONEY_PROFILE_PATH);
    }
  }, [isLoaded, profile, router]);

  const leftover = useMemo(
    () => leftoverPresenceFromBudgetPlans(budget.plans),
    [budget.plans],
  );
  const book = useMemo(
    () => bookPresenceFromPortfolio(primaryPortfolio),
    [primaryPortfolio],
  );
  const latestPlan = useMemo(
    () => [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0],
    [plans],
  );
  const freedomDate = useMemo(
    () =>
      journeyFreedomDate({
        leftover,
        book,
        assumptions: latestPlan ? normalizeRetirementPlan(latestPlan) : null,
      }),
    [leftover, book, latestPlan],
  );

  const ready = isLoaded && budget.isLoaded && portfoliosLoaded && retireLoaded;

  if (!isLoaded || !profile) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Opening your path…
      </div>
    );
  }

  const hasBook = book.status === "present";
  const liveProfile = derivedWorking
    ? withDerivedWorking(profile, derivedWorking)
    : profile;
  const stations = journeyStations(liveProfile, { hasBook });
  const live = commandCenterLiveFromPlans({
    budgetPlans: budget.plans,
    leftover,
    hasHoldings: hasBook,
    hasFreedomPlan: plans.length > 0,
    budgetWorking: liveProfile.working.budget,
  });
  const next = commandCenterNextAction(liveProfile, live);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="page-title">Your path</h1>
        <p className="page-description">{next.label}</p>
      </div>

      <div>
        <Button size="lg" render={<Link href={next.href} />}>
          {next.label}
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {stations.map((station) => {
          const href = stationCardHref(station);
          const metric = ready
            ? stationMetricLabel(
                station.pillar,
                leftover,
                book,
                freedomDate.label,
              )
            : "…";
          return (
            <Link
              key={station.pillar}
              href={href}
              className="surface-card flex flex-col gap-2 px-5 py-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="text-base font-semibold">{station.title}</h2>
                <Badge variant="outline">
                  {JOURNEY_HOME_STATUS_LABELS[station.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{metric}</p>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {JOURNEY_EDUCATIONAL_FOOTER}
      </p>
    </div>
  );
}
