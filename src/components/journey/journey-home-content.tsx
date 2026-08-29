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
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { journeyFreedomDate } from "@/lib/journey/freedom-date";
import { STATION_STATUS_LABELS, profileSummaryLine } from "@/lib/journey/labels";
import { journeyStations, primaryNextAction } from "@/lib/journey/stations";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import { MONEY_PROFILE_PATH } from "@/lib/routes";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";

export function JourneyHomeContent() {
  const router = useRouter();
  const { profile, isLoaded } = useMoneyProfile();
  const budget = useBudgetPlans();
  const { primaryPortfolio, isLoaded: portfoliosLoaded } = usePortfolioPlans();
  const { plans, isLoaded: retireLoaded } = useRetirementPlansStorage();

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
        Opening your Journey…
      </div>
    );
  }

  const stations = journeyStations(profile);
  const next = primaryNextAction(profile);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="page-title">Journey</h1>
        <p className="page-description">{profileSummaryLine(profile)}</p>
      </div>

      <div className="glass-card flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{next.label}</p>
        </div>
        <Button render={<Link href={next.href} />}>
          {next.label}
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {stations.map((station) => (
          <div
            key={station.pillar}
            className="glass-card flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">{station.title}</h2>
              <Badge variant="outline">{STATION_STATUS_LABELS[station.status]}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={station.learnHref} />}
              >
                Learn
              </Button>
              <Button size="sm" render={<Link href={station.doHref} />}>
                Do
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Freedom date
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight">
          {ready ? freedomDate.label : "…"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          From leftover and the book only. Leftover is one-time cash, not × 12.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Educational. Not financial advice. You can lose money.
      </p>
    </div>
  );
}
