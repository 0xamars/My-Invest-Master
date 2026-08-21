"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { BookNewsSection } from "@/components/home/book-news-section";
import { BookMovers } from "@/components/invest/book-movers";
import { LeverageUtilChip } from "@/components/invest/risk-chip";
import {
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { formatBudgetMoney } from "@/lib/budget/format";
import { investPortfolioPath } from "@/lib/chrome/nav";
import {
  leftoverFromBudgetPlans,
  pickOpenablePlan,
} from "@/lib/invest/leftover";
import { bookSymbols } from "@/lib/portfolio/book-movers";
import { buildInvestmentCheckup } from "@/lib/portfolio/checkup";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import { formatDisplayMoney, formatPercent } from "@/lib/portfolio/format";
import {
  cashValueFromHoldings,
  leverageUtilizationFromPortfolio,
} from "@/lib/portfolio/leverage";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";

export function HomeDashboard() {
  const budget = useBudgetPlans();
  const retirement = useRetirementPlansStorage();
  const {
    portfolio,
    changes,
    rates,
    currency,
    isLoaded: investLoaded,
  } = useInvestSummary();
  const leftover = leftoverFromBudgetPlans(budget.plans);
  const retirePlan = pickOpenablePlan(retirement.plans);
  const budgetPlan = pickOpenablePlan(budget.plans);

  const checkup = buildInvestmentCheckup(
    portfolio.enrichedHoldings,
    portfolio.totals,
    {
      portfolioHref: portfolio.portfolioId
        ? investPortfolioPath(portfolio.portfolioId)
        : "/invest",
    },
  );
  const dayChange = getPortfolioDayChange(
    portfolio.enrichedHoldings,
    changes,
    portfolio.totals.currentValue,
  );
  const leverageUtil = leverageUtilizationFromPortfolio(
    portfolio.portfolio?.leverage,
    cashValueFromHoldings(portfolio.enrichedHoldings),
  );
  const symbols = bookSymbols(portfolio.enrichedHoldings);

  const retireOutlook = (() => {
    if (!retirePlan) return null;
    const normalized = normalizeRetirementPlan(retirePlan);
    const projections = computeRetirementProjections(normalized);
    return {
      plan: normalized,
      dashboard: computeRetirementDashboard(normalized, { projections }),
    };
  })();

  const leftoverHref = leftover
    ? `/budget/plans/${leftover.budgetPlanId}`
    : budgetPlan
      ? `/budget/plans/${budgetPlan.id}`
      : "/budget";
  const bookHref = checkup.hasData
    ? "/invest"
    : portfolio.portfolioId
      ? investPortfolioPath(portfolio.portfolioId)
      : "/invest";
  const retireHref = retireOutlook
    ? `/freedom/plans/${retireOutlook.plan.id}`
    : "/freedom/plans";

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <ScoreCard
          label="Leftover"
          loaded={budget.isLoaded}
          value={
            leftover
              ? formatBudgetMoney(leftover.amount, leftover.currency)
              : budgetPlan
                ? "Assigned"
                : "No budget"
          }
          hint={leftover ? "Ready to Assign" : undefined}
          actionHref={leftoverHref}
          actionLabel={budgetPlan ? "Open Budget" : "Start Budget"}
        />
        <ScoreCard
          label="Book"
          loaded={investLoaded}
          value={
            checkup.hasData
              ? formatDisplayMoney(checkup.totalValue, currency, rates)
              : "No holdings"
          }
          hint={
            dayChange
              ? `${dayChange.change >= 0 ? "+" : "−"}${formatDisplayMoney(Math.abs(dayChange.change), currency, rates)} · ${formatPercent(dayChange.changePercent)}`
              : undefined
          }
          chip={
            checkup.hasData ? (
              <LeverageUtilChip
                flag={leverageUtil.flag}
                percent={leverageUtil.utilizationPercent}
              />
            ) : null
          }
          actionHref={bookHref}
          actionLabel={checkup.hasData ? "Open Invest" : "Open book"}
        />
        <ScoreCard
          label="Freedom"
          loaded={retirement.isLoaded}
          value={
            !retireOutlook
              ? "No plan"
              : retireOutlook.dashboard.verdict === "ahead"
                ? "Ahead"
                : retireOutlook.dashboard.verdict === "behind"
                  ? "Behind"
                  : retireOutlook.dashboard.verdict === "empty"
                    ? "Add assets"
                    : "On track"
          }
          chip={
            retireOutlook ? (
              <RetireVerdictChip verdict={retireOutlook.dashboard.verdict} />
            ) : null
          }
          actionHref={retireHref}
          actionLabel={retireOutlook ? "Open Freedom" : "Start a plan"}
        />
      </div>

      {checkup.hasData ? (
        <RetirePanel className="grid gap-5 px-5 py-4 lg:grid-cols-2">
          <BookMovers holdings={portfolio.enrichedHoldings} changes={changes} />
          <BookNewsSection symbols={symbols} />
        </RetirePanel>
      ) : null}
    </section>
  );
}

function ScoreCard({
  label,
  loaded,
  value,
  hint,
  chip,
  actionHref,
  actionLabel,
}: {
  label: string;
  loaded: boolean;
  value: string;
  hint?: string;
  chip?: ReactNode;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <RetirePanel className="flex flex-col justify-between gap-3 px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="budget-metric-label">{label}</p>
          {chip}
        </div>
        {loaded ? (
          <p className="budget-metric-value mt-2">{value}</p>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking…
          </p>
        )}
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <Button size="sm" className="w-fit" render={<Link href={actionHref} />}>
        {actionLabel}
        <ArrowRight className="size-3.5" />
      </Button>
    </RetirePanel>
  );
}
