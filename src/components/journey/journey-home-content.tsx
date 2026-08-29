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
import { BrandStill } from "@/components/brand/brand-still";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import { BRAND, BRAND_SIZE } from "@/lib/brand/assets";
import {
  JOURNEY_EDUCATIONAL_FOOTER,
  JOURNEY_HOME_EMPTY,
} from "@/lib/journey/empty-states";
import { journeyFreedomDate } from "@/lib/journey/freedom-date";
import { STATION_STATUS_LABELS, profileSummaryLine } from "@/lib/journey/labels";
import { journeyStations, primaryNextAction } from "@/lib/journey/stations";
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
        Opening your Journey…
      </div>
    );
  }

  const hasBook = book.status === "present";
  const liveProfile = derivedWorking
    ? withDerivedWorking(profile, derivedWorking)
    : profile;
  const stations = journeyStations(liveProfile, { hasBook });
  const next = primaryNextAction(liveProfile, { hasBook });
  const nothingWorking =
    !liveProfile.working.budget &&
    !liveProfile.working.invest &&
    !liveProfile.working.freedom;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="page-title">Journey</h1>
        <p className="page-description">{profileSummaryLine(profile)}</p>
        {nothingWorking ? (
          <>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {JOURNEY_HOME_EMPTY.hint}
            </p>
            <BrandStill
              src={BRAND.journeyStations}
              alt=""
              width={BRAND_SIZE.journeyStations.width}
              height={BRAND_SIZE.journeyStations.height}
              className="mt-4"
              imageClassName="h-44 object-cover object-center sm:h-52"
              sizes="(min-width: 1024px) 48rem, 100vw"
            />
          </>
        ) : null}
      </div>

      <div className="surface-card flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
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
            className="surface-card flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
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

      <div
        className="surface-card px-5 py-5"
        data-empty-state={
          freedomDate.status === "needs-inputs" ? "journey-home-freedom" : undefined
        }
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Freedom date
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight">
          {ready ? freedomDate.label : "…"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {freedomDate.status === "needs-inputs"
            ? JOURNEY_HOME_EMPTY.freedomHint
            : "From leftover and the book only. Leftover is one-time cash, not × 12."}
        </p>
        {ready && freedomDate.status === "needs-inputs" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              render={<Link href={JOURNEY_HOME_EMPTY.leftoverHref} />}
            >
              {JOURNEY_HOME_EMPTY.leftoverLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={JOURNEY_HOME_EMPTY.bookHref} />}
            >
              {JOURNEY_HOME_EMPTY.bookLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {JOURNEY_EDUCATIONAL_FOOTER}
      </p>
    </div>
  );
}
