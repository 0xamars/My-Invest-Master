"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Target } from "lucide-react";
import {
  RetireEmptyState,
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { budgetHabitSnapshot } from "@/lib/budget/habit";
import { formatBudgetMoney } from "@/lib/budget/format";
import {
  leftoverFromBudgetPlans,
  pickOpenablePlan,
} from "@/lib/invest/leftover";
import { buildInvestmentCheckup } from "@/lib/portfolio/checkup";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { formatProjectionMoney } from "@/lib/retirement/format";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import {
  impliedPathSentence,
  whatIfLeverSentence,
} from "@/lib/retirement/path-copy";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { cn } from "@/lib/utils";
import type { BudgetPlan } from "@/types/budget";
import type { RetirementPlan } from "@/types/retirement";

function PathHero({
  plan,
  isLoaded,
}: {
  plan: RetirementPlan | null;
  isLoaded: boolean;
}) {
  const { rates } = useFxRate();

  if (!isLoaded) {
    return (
      <RetirePanel className="min-h-[14rem]">
        <div className="flex items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Checking the path…
        </div>
      </RetirePanel>
    );
  }

  if (!plan) {
    return (
      <RetirePanel>
        <RetireEmptyState
          icon={<Target className="size-5" />}
          title="No retirement plan yet"
          description="Start a plan, then refresh holdings from the Invest book to see whether you are on track."
          actions={
            <Button render={<Link href="/retire/plans" />}>Start a plan</Button>
          }
        />
      </RetirePanel>
    );
  }

  const normalized = normalizeRetirementPlan(plan);
  const projections = computeRetirementProjections(normalized);
  const dashboard = computeRetirementDashboard(normalized, { projections });
  const href = `/retire/plans/${normalized.id}`;
  const money = (value: number) =>
    formatProjectionMoney(value, normalized.currency, rates);
  const path = impliedPathSentence(dashboard, money);
  const lever =
    dashboard.verdict === "empty" ? "" : whatIfLeverSentence(normalized);

  return (
    <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <RetireVerdictChip verdict={dashboard.verdict} />
        <span className="text-xs text-muted-foreground">{normalized.name}</span>
      </div>
      <p
        className={cn(
          "budget-hero-value mt-3",
          dashboard.verdict === "behind"
            ? "text-[var(--brand-orange)]"
            : dashboard.verdict === "empty"
              ? "text-foreground"
              : "text-[var(--brand-green)]",
        )}
      >
        {dashboard.verdict === "ahead"
          ? "Ahead"
          : dashboard.verdict === "behind"
            ? "Behind"
            : dashboard.verdict === "empty"
              ? "Add assets"
              : "On track"}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="budget-metric-label">Years left</dt>
          <dd className="budget-metric-value mt-1">
            {dashboard.yearsToRetirement}
          </dd>
        </div>
        <div>
          <dt className="budget-metric-label">Target</dt>
          <dd className="budget-metric-value mt-1">
            {money(dashboard.targetNestEgg)}
          </dd>
        </div>
        <div>
          <dt className="budget-metric-label">
            {dashboard.gapToday != null && dashboard.gapToday >= 0
              ? "Surplus"
              : "Gap"}
          </dt>
          <dd className="budget-metric-value mt-1">
            {dashboard.gapToday == null
              ? "—"
              : money(Math.abs(dashboard.gapToday))}
          </dd>
        </div>
      </dl>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {path}
      </p>
      {lever ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {lever}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button render={<Link href={href} />}>
          Open plan
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function SupportingLines({
  budgetPlan,
  budgetLoaded,
}: {
  budgetPlan: BudgetPlan | null;
  budgetLoaded: boolean;
}) {
  const leftover = leftoverFromBudgetPlans(budgetPlan ? [budgetPlan] : []);
  const habit = budgetPlan ? budgetHabitSnapshot(budgetPlan) : null;
  const {
    portfolio,
    rates,
    currency,
    isLoaded: investLoaded,
  } = useInvestSummary();
  const checkup = buildInvestmentCheckup(
    portfolio.enrichedHoldings,
    portfolio.totals,
    { portfolioHref: portfolio.portfolioId ? `/portfolio/${portfolio.portfolioId}` : "/portfolio" },
  );

  const budgetHref = budgetPlan ? `/budget/plans/${budgetPlan.id}` : "/budget";
  const inboxHref = budgetPlan
    ? `/budget/plans/${budgetPlan.id}/transactions?inbox=unapproved`
    : "/budget";
  const budgetCue = !budgetLoaded
    ? "Checking leftover…"
    : !budgetPlan
      ? "No budget yet"
      : habit?.needsAttention
        ? [
            habit.inboxCount > 0
              ? `${habit.inboxCount} inbox row${habit.inboxCount === 1 ? "" : "s"}`
              : null,
            habit.overspent.length > 0
              ? `${habit.overspent.length} overspent`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : leftover
          ? `${formatBudgetMoney(leftover.amount, leftover.currency)} leftover`
          : "Ready to Assign is assigned";

  const bookHref = portfolio.portfolioId
    ? `/portfolio/${portfolio.portfolioId}`
    : "/invest";
  const bookCue = !investLoaded
    ? "Checking the book…"
    : checkup.hasData
      ? `${formatDisplayMoney(checkup.totalValue, currency, rates)} · top name ${checkup.concentration.topHoldingPercent.toFixed(1)}%`
      : "No holdings yet";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="budget-metric-label">Budget leftover</p>
          <p className="mt-1 text-sm font-medium">{budgetCue}</p>
        </div>
        <Button
          size="sm"
          render={
            <Link
              href={
                habit?.inboxCount
                  ? inboxHref
                  : budgetHref
              }
            />
          }
        >
          {habit?.inboxCount
            ? "Review inbox"
            : habit?.overspent.length
              ? "Cover overspend"
              : budgetPlan
                ? "Open Budget"
                : "Start Budget"}
          <ArrowRight className="size-3.5" />
        </Button>
      </RetirePanel>
      <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="budget-metric-label">Invest book</p>
          <p className="mt-1 text-sm font-medium">{bookCue}</p>
        </div>
        <Button size="sm" render={<Link href={checkup.hasData ? "/invest" : bookHref} />}>
          {checkup.hasData ? "Open checkup" : "Open Invest"}
          <ArrowRight className="size-3.5" />
        </Button>
      </RetirePanel>
    </div>
  );
}

export function HomeDashboard() {
  const budget = useBudgetPlans();
  const retirement = useRetirementPlansStorage();
  const budgetPlan = pickOpenablePlan(budget.plans);
  const retirePlan = pickOpenablePlan(retirement.plans);

  return (
    <section className="flex flex-col gap-3">
      <PathHero plan={retirePlan} isLoaded={retirement.isLoaded} />
      <SupportingLines
        budgetPlan={budgetPlan}
        budgetLoaded={budget.isLoaded}
      />
    </section>
  );
}
