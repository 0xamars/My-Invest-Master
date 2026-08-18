"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Layers, PieChart, RefreshCw, TrendingUp } from "lucide-react";
import { PortfolioAllocationChart } from "@/components/analytics/portfolio-allocation-chart";
import { InvestRiskChip } from "@/components/invest/risk-chip";
import { TargetMixPanel } from "@/components/invest/target-mix-panel";
import {
  RetireEmptyState,
  RetireMoney,
  RetirePageHeader,
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { leftoverFromBudgetPlans, pickOpenablePlan } from "@/lib/invest/leftover";
import { LeftoverAction } from "@/components/invest/leftover-action";
import {
  buildInvestmentCheckup,
  concentrationNoteForWeight,
  riskChipDescription,
} from "@/lib/portfolio/checkup";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import { formatDisplayMoney, formatPercent } from "@/lib/portfolio/format";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { cn } from "@/lib/utils";
import type { RetirementPlan } from "@/types/retirement";

export function InvestHomeContent() {
  const {
    portfolio,
    changes,
    optionsSummary,
    activeOptionsCount,
    optionsCount,
    rates,
    currency,
    isLoaded,
    isLoading,
  } = useInvestSummary();
  const { updateTargetAllocation } = usePortfolioPlans();
  const budget = useBudgetPlans();
  const retirement = useRetirementPlansStorage();

  const { enrichedHoldings, totals, portfolioId, portfolioName, isViewingPrimary } =
    portfolio;
  const bookHref = portfolioId ? `/portfolio/${portfolioId}` : "/portfolio";
  const retirePlan = pickOpenablePlan(retirement.plans);
  const budgetLeftover = useMemo(
    () => leftoverFromBudgetPlans(budget.plans),
    [budget.plans],
  );

  const retireOutlook = useMemo(() => {
    if (!retirePlan) return null;
    const normalized = normalizeRetirementPlan(retirePlan);
    const projections = computeRetirementProjections(normalized);
    return {
      plan: normalized,
      dashboard: computeRetirementDashboard(normalized, { projections }),
    };
  }, [retirePlan]);

  const checkup = useMemo(
    () =>
      buildInvestmentCheckup(enrichedHoldings, totals, {
        storedTargets: portfolio.portfolio?.targetAllocation,
        netPremium: optionsCount > 0 ? optionsSummary.netPremium : null,
        hasOptions: optionsCount > 0,
        portfolioHref: bookHref,
        budgetLeftoverHref: budgetLeftover
          ? `/budget/plans/${budgetLeftover.budgetPlanId}`
          : null,
        retireRefreshHref: retireOutlook
          ? `/retire/plans/${retireOutlook.plan.id}`
          : null,
      }),
    [
      enrichedHoldings,
      totals,
      portfolio.portfolio?.targetAllocation,
      optionsCount,
      optionsSummary.netPremium,
      bookHref,
      budgetLeftover,
      retireOutlook,
    ],
  );

  const dayChange = getPortfolioDayChange(
    enrichedHoldings,
    changes,
    totals.currentValue,
  );

  const showingLabel = portfolioName
    ? isViewingPrimary
      ? `Primary · ${portfolioName}`
      : portfolioName
    : "Primary book";

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasBook = enrichedHoldings.length > 0;
  const pricesBusy = totals.hasLoadingPrices || isLoading;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <RetirePageHeader
        title="Invest"
        description="Checkup for this book — concentration, mix, drift, and what to do next."
      />

      <LeftoverAction />

      {!hasBook ? (
        <RetirePanel>
          <RetireEmptyState
            icon={<TrendingUp className="size-5" />}
            title={
              portfolioId
                ? `No holdings in ${portfolioName ? `“${portfolioName}”` : "your Primary book"}`
                : "No portfolio yet"
            }
            description="Create or open a book, then add stocks, crypto, cash, or custom assets. The checkup starts once prices are in."
            actions={
              <Button render={<Link href={bookHref} />}>
                {portfolioId ? "Open book" : "Create a portfolio"}
              </Button>
            }
          />
        </RetirePanel>
      ) : (
        <>
          <InvestHero
            checkup={checkup}
            showingLabel={showingLabel}
            currency={currency}
            rates={rates}
            isLoading={pricesBusy}
            dayChange={dayChange}
          />

          <CheckupPanel checkup={checkup} />

          <TargetMixPanel
            checkup={checkup}
            currency={currency}
            rates={rates}
            portfolioId={portfolioId}
            storedTargets={portfolio.portfolio?.targetAllocation}
            onSave={updateTargetAllocation}
          />

          <JourneyStrip retireOutlook={retireOutlook} />

          <RetirePanel>
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
              <PieChart className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Allocation</h2>
            </div>
            <div className="px-5 py-4">
              <PortfolioAllocationChart
                holdings={enrichedHoldings}
                currency={currency}
                rates={rates}
                compact
              />
            </div>
          </RetirePanel>

          {optionsCount > 0 ? (
            <OptionsStrip
              currency={currency}
              rates={rates}
              activeCount={activeOptionsCount}
              netPremium={optionsSummary.netPremium}
              percentOfBook={checkup.optionsOverlay?.percentOfPortfolio ?? null}
            />
          ) : null}

          <div>
            <Button render={<Link href={bookHref} />}>
              Open book
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function InvestHero({
  checkup,
  showingLabel,
  currency,
  rates,
  isLoading,
  dayChange,
}: {
  checkup: ReturnType<typeof buildInvestmentCheckup>;
  showingLabel: string;
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  isLoading: boolean;
  dayChange: ReturnType<typeof getPortfolioDayChange>;
}) {
  const money = (value: number) => formatDisplayMoney(value, currency, rates);
  const nextIsBook = checkup.nextAction.code === "open-portfolio";

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <InvestRiskChip chip={checkup.riskChip} />
          <span className="text-xs text-muted-foreground">{showingLabel}</span>
        </div>
        <p className="budget-hero-value mt-3">
          {isLoading ? "…" : money(checkup.totalValue)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Total value · {currency}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {riskChipDescription(checkup.riskChip)}
        </p>
        {!nextIsBook ? (
          <Button className="mt-4" render={<Link href={checkup.nextAction.href} />}>
            {checkup.nextAction.label}
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </section>

      <RetirePanel className="grid grid-cols-1 divide-y divide-border/60">
        <Metric
          label="Day change"
          value={
            !dayChange
              ? "—"
              : `${dayChange.change >= 0 ? "+" : "−"}${money(Math.abs(dayChange.change))}`
          }
          hint={dayChange ? formatPercent(dayChange.changePercent) : undefined}
          tone={!dayChange ? "neutral" : dayChange.change >= 0 ? "in" : "danger"}
        />
        <Metric
          label="Cost-basis P/L"
          value={
            isLoading
              ? "…"
              : `${checkup.profitLoss >= 0 ? "+" : "−"}${money(Math.abs(checkup.profitLoss))}`
          }
          hint={formatPercent(checkup.profitLossPercent)}
          tone={checkup.profitLoss >= 0 ? "in" : "danger"}
        />
        {checkup.modifiedDietzPercent != null ? (
          <Metric
            label="Modified Dietz"
            value={formatPercent(checkup.modifiedDietzPercent)}
            hint="Money-weighted from dated transactions — not a benchmark"
          />
        ) : null}
      </RetirePanel>
    </div>
  );
}

function CheckupPanel({
  checkup,
}: {
  checkup: ReturnType<typeof buildInvestmentCheckup>;
}) {
  return (
    <RetirePanel>
      <div className="border-b border-border/60 px-5 py-4">
        <h2 className="text-sm font-semibold">Checkup</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Top name {checkup.concentration.topHoldingPercent.toFixed(1)}% · top 5{" "}
          {checkup.concentration.top5Percent.toFixed(1)}% ·{" "}
          {checkup.concentration.nameCount} name
          {checkup.concentration.nameCount === 1 ? "" : "s"} · cash{" "}
          {checkup.cashPercent.toFixed(1)}%
        </p>
      </div>

      <div className="grid gap-px border-b border-border/60 bg-border/60 sm:grid-cols-3">
        <Stat
          label="Top name"
          value={`${checkup.concentration.topHoldingPercent.toFixed(1)}%`}
        />
        <Stat
          label="Top 5"
          value={`${checkup.concentration.top5Percent.toFixed(1)}%`}
        />
        <Stat label="Names" value={String(checkup.concentration.nameCount)} />
      </div>

      <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="budget-metric-label">Mix</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {checkup.mix.map((item) => (
              <li key={item.type} className="flex justify-between gap-3">
                <span>{item.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.percent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="budget-metric-label">Names</p>
          <ul className="mt-2 space-y-1.5">
            {checkup.concentration.topHoldings.map((holding) => {
              const note = concentrationNoteForWeight(holding.percent);
              const row = (
                <span className="flex w-full items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{holding.label}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
                    {note !== "none" ? (
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          note === "flag"
                            ? "text-[var(--brand-red)]"
                            : "text-[var(--brand-orange)]",
                        )}
                      >
                        {note === "flag" ? "Flag" : "Note"}
                      </span>
                    ) : null}
                    {holding.percent.toFixed(1)}%
                  </span>
                </span>
              );

              if (!holding.analysisHref) {
                return <li key={holding.id}>{row}</li>;
              }

              return (
                <li key={holding.id}>
                  <Link
                    href={holding.analysisHref}
                    className="block rounded-md hover:bg-muted/40"
                  >
                    {row}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </RetirePanel>
  );
}

function JourneyStrip({
  retireOutlook,
}: {
  retireOutlook: {
    plan: RetirementPlan;
    dashboard: ReturnType<typeof computeRetirementDashboard>;
  } | null;
}) {
  if (!retireOutlook) return null;

  return (
    <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <p className="text-sm text-muted-foreground">
        Retire can refresh quantities from this book.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <RetireVerdictChip verdict={retireOutlook.dashboard.verdict} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          render={<Link href={`/retire/plans/${retireOutlook.plan.id}`} />}
        >
          Open Retire
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </RetirePanel>
  );
}

function OptionsStrip({
  currency,
  rates,
  activeCount,
  netPremium,
  percentOfBook,
}: {
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  activeCount: number;
  netPremium: number;
  percentOfBook: number | null;
}) {
  return (
    <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Layers className="size-4 text-primary" />
        <p className="text-sm">
          <span className="font-medium">Options</span>
          <span className="text-muted-foreground">
            {" "}
            · {activeCount} active · net premium{" "}
            {netPremium >= 0 ? "+" : "−"}
            {formatDisplayMoney(Math.abs(netPremium), currency, rates)}
            {percentOfBook != null ? ` (${formatPercent(percentOfBook)} of book)` : ""}
          </span>
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        render={<Link href="/options" />}
      >
        Open options
        <ArrowRight className="size-3.5" />
      </Button>
    </RetirePanel>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "in" | "out" | "danger" | "neutral";
}) {
  return (
    <div className="flex flex-col justify-center px-5 py-4">
      <p className="budget-metric-label">{label}</p>
      <p className="budget-metric-value mt-1.5">
        <RetireMoney value={value} tone={tone} />
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="budget-metric-label">{label}</p>
      <p className="budget-metric-value mt-1.5">{value}</p>
    </div>
  );
}
