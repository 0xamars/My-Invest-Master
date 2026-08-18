"use client";

import Link from "next/link";
import { ArrowRight, Loader2, PiggyBank, Target, TrendingUp } from "lucide-react";
import {
  RetireEmptyState,
  RetireMoney,
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import {
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import { isTransactionApproved } from "@/lib/budget/reports";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { formatProjectionMoney } from "@/lib/retirement/format";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { pickFreeAllowedPlanId } from "@/lib/plans/free-access";
import { cn } from "@/lib/utils";
import type { BudgetPlan } from "@/types/budget";
import type { RetirementPlan } from "@/types/retirement";

function latestPlan<T extends { updatedAt: string }>(plans: T[]): T | null {
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}

function pickOpenablePlan<T extends { id: string; createdAt: string; updatedAt: string }>(
  plans: T[],
): T | null {
  const allowedId = pickFreeAllowedPlanId(plans);
  return plans.find((plan) => plan.id === allowedId) ?? latestPlan(plans);
}

function PillarHeader({
  title,
  eyebrow,
  href,
}: {
  title: string;
  eyebrow: string;
  href: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
      <div>
        <p className="budget-metric-label">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-xs text-muted-foreground"
        render={<Link href={href} />}
      >
        Open
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

function BudgetPillar({
  plan,
  isLoaded,
}: {
  plan: BudgetPlan | null;
  isLoaded: boolean;
}) {
  if (!isLoaded) {
    return (
      <RetirePanel className="min-h-[17rem]">
        <PillarHeader title="Budget" eyebrow="This month" href="/budget" />
        <div className="flex items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Checking budget…
        </div>
      </RetirePanel>
    );
  }

  if (!plan) {
    return (
      <RetirePanel>
        <PillarHeader title="Budget" eyebrow="This month" href="/budget" />
        <RetireEmptyState
          icon={<PiggyBank className="size-5" />}
          title="No budget yet"
          description="Give every dollar a job. Ready to Assign and category leftover carry forward."
          actions={
            <Button render={<Link href="/budget" />}>Create a budget</Button>
          }
        />
      </RetirePanel>
    );
  }

  const monthKey = getCurrentMonthKey();
  const summary = computeMonthSummary(plan, monthKey);
  const inboxCount = plan.transactions.filter(
    (tx) => !isTransactionApproved(tx),
  ).length;
  const ready = summary.readyToAssign;
  const href = `/budget/plans/${plan.id}`;
  const inboxHref = `${href}/transactions?inbox=unapproved`;
  const next =
    ready > 0
      ? { href, label: "Assign leftover" }
      : inboxCount > 0
        ? { href: inboxHref, label: "Open register inbox" }
        : { href, label: "Open this month" };

  return (
    <RetirePanel>
      <PillarHeader title={plan.name} eyebrow="Budget · this month" href={href} />
      <div className="grid grid-cols-2 divide-x divide-border/60">
        <div className="px-5 py-4">
          <p className="budget-metric-label">Ready to Assign</p>
          <p
            className={cn(
              "budget-metric-value mt-1.5",
              ready > 0 && "text-[var(--brand-green)]",
              ready < 0 && "text-[var(--brand-red)]",
            )}
          >
            {ready < 0 ? "−" : ""}
            {formatBudgetMoney(ready, plan.currency)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="budget-metric-label">Spent this month</p>
          <p className="budget-metric-value mt-1.5">
            <RetireMoney
              value={formatBudgetMoney(summary.totalSpent, plan.currency)}
              tone="out"
            />
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {inboxCount > 0
            ? `${inboxCount} register row${inboxCount === 1 ? "" : "s"} to approve`
            : ready > 0
              ? "Income waiting for a job."
              : "Every dollar through this month has a job."}
        </p>
        <Button size="sm" render={<Link href={next.href} />}>
          {next.label}
        </Button>
      </div>
    </RetirePanel>
  );
}

function InvestPillar() {
  const {
    portfolio,
    changes,
    rates,
    currency,
    isLoaded,
  } = useInvestSummary();
  const { enrichedHoldings, totals, portfolioId, portfolioName } = portfolio;
  const href = portfolioId ? `/portfolio/${portfolioId}` : "/portfolio";
  const dayChange = getPortfolioDayChange(
    enrichedHoldings,
    changes,
    totals.currentValue,
  );

  if (!isLoaded) {
    return (
      <RetirePanel className="min-h-[17rem]">
        <PillarHeader title="Invest" eyebrow="Portfolio" href="/invest" />
        <div className="flex items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Checking portfolio…
        </div>
      </RetirePanel>
    );
  }

  if (enrichedHoldings.length === 0) {
    return (
      <RetirePanel>
        <PillarHeader title="Invest" eyebrow="Portfolio" href="/invest" />
        <RetireEmptyState
          icon={<TrendingUp className="size-5" />}
          title={portfolioName ? `No holdings in ${portfolioName}` : "No portfolio yet"}
          description="Add stocks, crypto, cash, or custom assets. Retire can refresh from this portfolio later."
          actions={
            <Button render={<Link href={href} />}>
              {portfolioId ? "Add holdings" : "Create a portfolio"}
            </Button>
          }
        />
      </RetirePanel>
    );
  }

  return (
    <RetirePanel>
      <PillarHeader
        title={portfolioName ?? "Portfolio"}
        eyebrow="Invest"
        href={href}
      />
      <div className="grid grid-cols-2 divide-x divide-border/60">
        <div className="px-5 py-4">
          <p className="budget-metric-label">Total value</p>
          <p className="budget-metric-value mt-1.5">
            {totals.hasLoadingPrices
              ? "…"
              : formatDisplayMoney(totals.currentValue, currency, rates)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="budget-metric-label">Day change</p>
          {dayChange ? (
            <p
              className={cn(
                "budget-metric-value mt-1.5",
                profitLossClass(dayChange.change),
              )}
            >
              {dayChange.change >= 0 ? "+" : "−"}
              {formatDisplayMoney(Math.abs(dayChange.change), currency, rates)}
              <span className="ml-1 text-xs font-medium">
                {formatPercent(dayChange.changePercent)}
              </span>
            </p>
          ) : (
            <p className="budget-metric-value mt-1.5 text-muted-foreground">—</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {enrichedHoldings.length} holding{enrichedHoldings.length === 1 ? "" : "s"}
          {totals.hasLoadingPrices ? " · prices updating" : ""}
        </p>
        <Button size="sm" render={<Link href={href} />}>
          Open portfolio
        </Button>
      </div>
    </RetirePanel>
  );
}

function RetirePillar({
  plan,
  isLoaded,
}: {
  plan: RetirementPlan | null;
  isLoaded: boolean;
}) {
  const { rates } = useFxRate();

  if (!isLoaded) {
    return (
      <RetirePanel className="min-h-[17rem]">
        <PillarHeader title="Retire" eyebrow="Plan" href="/retire" />
        <div className="flex items-center justify-center px-5 py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Checking retirement…
        </div>
      </RetirePanel>
    );
  }

  if (!plan) {
    return (
      <RetirePanel>
        <PillarHeader title="Retire" eyebrow="Plan" href="/retire" />
        <RetireEmptyState
          icon={<Target className="size-5" />}
          title="No retirement plan yet"
          description="Set a spending target, import holdings, and see whether you are on track."
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
  const nextLabel =
    dashboard.verdict === "empty" ? "Add assets" : "Open retire levers";

  return (
    <RetirePanel>
      <PillarHeader title={normalized.name} eyebrow="Retire" href="/retire" />
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <RetireVerdictChip verdict={dashboard.verdict} />
          <p className="text-xs text-muted-foreground">
            Need {money(dashboard.targetNestEgg)} to spend{" "}
            {money(dashboard.annualSpending)}/year
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="budget-metric-label">Current</p>
            <p className="budget-metric-value mt-1">
              {money(dashboard.currentPortfolio)}
            </p>
          </div>
          <div>
            <p className="budget-metric-label">Target</p>
            <p className="budget-metric-value mt-1">
              {money(dashboard.targetNestEgg)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {dashboard.verdict === "empty"
            ? "Add assets or refresh from Invest."
            : dashboard.lastsPastPlanEnd
              ? `Lasts past age ${dashboard.planEndAge}`
              : `Runs out at age ${dashboard.depletionAge}`}
        </p>
        <Button size="sm" render={<Link href={href} />}>
          {nextLabel}
        </Button>
      </div>
    </RetirePanel>
  );
}

export function HomeDashboard() {
  const budget = useBudgetPlans();
  const retirement = useRetirementPlansStorage();
  const budgetPlan = pickOpenablePlan(budget.plans);
  const retirePlan = pickOpenablePlan(retirement.plans);

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <BudgetPillar plan={budgetPlan} isLoaded={budget.isLoaded} />
      <InvestPillar />
      <RetirePillar plan={retirePlan} isLoaded={retirement.isLoaded} />
    </section>
  );
}
