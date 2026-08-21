"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Layers, PieChart, RefreshCw, TrendingUp } from "lucide-react";
import { BookMovers } from "@/components/invest/book-movers";
import { ownedNameMovers } from "@/lib/portfolio/book-movers";
import { HoldingExpandPanel } from "@/components/portfolio/holding-expand-panel";
import { PortfolioAllocationChart } from "@/components/analytics/portfolio-allocation-chart";
import { InvestRiskChip, LeverageUtilChip } from "@/components/invest/risk-chip";
import { TargetMixPanel } from "@/components/invest/target-mix-panel";
import { LaunchStillFrame } from "@/components/brand/launch-still";
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
import {
  INVEST_OPTIONS_PATH,
  INVEST_WATCHLIST_PATH,
  investPortfolioPath,
} from "@/lib/chrome/nav";
import { leftoverFromBudgetPlans, pickOpenablePlan } from "@/lib/invest/leftover";
import { LeftoverAction } from "@/components/invest/leftover-action";
import { RefreshRetireAction } from "@/components/invest/refresh-retire-action";
import {
  buildInvestmentCheckup,
  concentrationNoteForWeight,
  riskChipDescription,
} from "@/lib/portfolio/checkup";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import { formatDisplayMoney, formatPercent } from "@/lib/portfolio/format";
import {
  cashValueFromHoldings,
  leverageFlagLabel,
  leverageUtilizationFromPortfolio,
} from "@/lib/portfolio/leverage";
import {
  expiringCallsWithinDays,
  optionsNotionalVsBook,
} from "@/lib/portfolio/options-risk";
import { OPTION_TYPE_LABELS, type OptionsPositionWithMetrics } from "@/types/options";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import type { RetirementPlan } from "@/types/retirement";

export function InvestHomeContent() {
  const {
    portfolio,
    changes,
    optionsSummary,
    activeOptionsCount,
    optionsCount,
    enrichedPositions,
    rates,
    currency,
    isLoaded,
    isLoading,
  } = useInvestSummary();
  const { updateTargetAllocation } = usePortfolioPlans();
  const budget = useBudgetPlans();
  const retirement = useRetirementPlansStorage();
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(
    null,
  );

  const { enrichedHoldings, totals, portfolioId, portfolioName, isViewingPrimary } =
    portfolio;
  const bookHref = portfolioId ? investPortfolioPath(portfolioId) : investPortfolioPath();
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
          ? `/freedom/plans/${retireOutlook.plan.id}`
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

  const leverageUtil = useMemo(
    () =>
      leverageUtilizationFromPortfolio(
        portfolio.portfolio?.leverage,
        cashValueFromHoldings(enrichedHoldings),
      ),
    [portfolio.portfolio?.leverage, enrichedHoldings],
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
        description="The book — checkup, mix, leftover, and options vs the names you own. Not a research terminal."
      />

      <LeftoverAction />
      <RefreshRetireAction />

      {!hasBook ? (
        <LaunchStillFrame still="invest" scrim="right">
          <RetireEmptyState
            icon={<TrendingUp className="size-5" />}
            title="Add the first name."
            description={
              portfolioId
                ? `Open ${portfolioName ? `“${portfolioName}”` : "your Primary book"} and add stocks, crypto, cash, or custom assets.`
                : "Create or open a book, then add stocks, crypto, cash, or custom assets."
            }
            actions={
              <Button render={<Link href={bookHref} />}>
                {portfolioId ? "Open book" : "Create a portfolio"}
              </Button>
            }
          />
        </LaunchStillFrame>
      ) : null}

      {!hasBook ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <ChildCard href={bookHref} label="Portfolio" hint="The book" icon={<PieChart className="size-4" />} />
          <ChildCard href={INVEST_OPTIONS_PATH} label="Options" hint="DTE and premium vs book" icon={<Layers className="size-4" />} />
          <ChildCard href={INVEST_WATCHLIST_PATH} label="Watchlist" hint="Queue only" icon={<Eye className="size-4" />} />
        </div>
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

          <CheckupPanel
            checkup={checkup}
            leverageUtil={leverageUtil}
            holdings={enrichedHoldings}
            expandedHoldingId={expandedHoldingId}
            onToggleExpand={setExpandedHoldingId}
            currency={currency}
            rates={rates}
            changes={changes}
          />

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

          {ownedNameMovers(enrichedHoldings, changes, 1).length > 0 ? (
            <RetirePanel className="px-5 py-4">
              <BookMovers
                holdings={enrichedHoldings}
                changes={changes}
                onSelect={(holdingId) =>
                  setExpandedHoldingId((current) =>
                    current === holdingId ? null : holdingId,
                  )
                }
              />
            </RetirePanel>
          ) : null}

          {optionsCount > 0 ? (
            <OptionsStrip
              currency={currency}
              rates={rates}
              bookValue={totals.currentValue}
              activeCount={activeOptionsCount}
              netPremium={optionsSummary.netPremium}
              percentOfBook={checkup.optionsOverlay?.percentOfPortfolio ?? null}
              positions={enrichedPositions}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <ChildCard href={bookHref} label="Portfolio" hint="The book" icon={<PieChart className="size-4" />} />
            <ChildCard href={INVEST_OPTIONS_PATH} label="Options" hint="DTE and premium vs book" icon={<Layers className="size-4" />} />
            <ChildCard href={INVEST_WATCHLIST_PATH} label="Watchlist" hint="Queue only" icon={<Eye className="size-4" />} />
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
  leverageUtil,
  holdings,
  expandedHoldingId,
  onToggleExpand,
  currency,
  rates,
  changes,
}: {
  checkup: ReturnType<typeof buildInvestmentCheckup>;
  leverageUtil: ReturnType<typeof leverageUtilizationFromPortfolio>;
  holdings: PortfolioHoldingWithPrices[];
  expandedHoldingId: string | null;
  onToggleExpand: (id: string | null) => void;
  currency: DisplayCurrency;
  rates: FxRates;
  changes: Record<string, { change: number; changePercent: number }>;
}) {
  const top = checkup.concentration.topHolding;
  const utilLabel =
    leverageUtil.utilizationPercent != null && leverageUtil.flag !== "unset"
      ? `${leverageUtil.utilizationPercent.toFixed(0)}%`
      : leverageFlagLabel(leverageUtil.flag);

  return (
    <RetirePanel>
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Fat line</h2>
          <InvestRiskChip chip={checkup.riskChip} />
          <LeverageUtilChip
            flag={leverageUtil.flag}
            percent={leverageUtil.utilizationPercent}
          />
        </div>
        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
          Top name {checkup.concentration.topHoldingPercent.toFixed(1)}% · cash{" "}
          {checkup.cashPercent.toFixed(1)}% · util {utilLabel}
          {checkup.mix.length > 0
            ? ` · ${checkup.mix.map((item) => `${item.label} ${item.percent.toFixed(0)}%`).join(" · ")}`
            : ""}
        </p>
        {top && checkup.concentration.note === "flag" ? (
          <p className="mt-2 text-sm">
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() =>
                onToggleExpand(expandedHoldingId === top.id ? null : top.id)
              }
            >
              {top.label}
            </button>{" "}
            is {top.percent.toFixed(1)}% of the book.
          </p>
        ) : null}
        {checkup.dominatingSleeve ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {checkup.dominatingSleeve.label} is{" "}
            {checkup.dominatingSleeve.percent.toFixed(0)}% of the book.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="budget-metric-label">Sleeves</p>
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
              const expanded = expandedHoldingId === holding.id;
              const full = holdings.find((item) => item.id === holding.id);
              return (
                <li key={holding.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-0.5 text-sm hover:bg-muted/40"
                    onClick={() =>
                      onToggleExpand(expanded ? null : holding.id)
                    }
                  >
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
                  </button>
                  {expanded && full ? (
                    <div className="mt-2 rounded-md border border-border/60 bg-muted/15 px-3 py-3">
                      <HoldingExpandPanel
                        holding={full}
                        currency={currency}
                        rates={rates}
                        dayChange={changes[full.symbol] ?? null}
                      />
                    </div>
                  ) : null}
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
        Freedom can refresh quantities from this book.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <RetireVerdictChip verdict={retireOutlook.dashboard.verdict} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          render={<Link href={`/freedom/plans/${retireOutlook.plan.id}`} />}
        >
          Open Freedom
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </RetirePanel>
  );
}

function OptionsStrip({
  currency,
  rates,
  bookValue,
  activeCount,
  netPremium,
  percentOfBook,
  positions,
}: {
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  bookValue: number;
  activeCount: number;
  netPremium: number;
  percentOfBook: number | null;
  positions: OptionsPositionWithMetrics[];
}) {
  const notional = optionsNotionalVsBook(positions, bookValue);
  const expiringCalls = expiringCallsWithinDays(positions, 14);
  const money = (value: number) => formatDisplayMoney(value, currency, rates);

  return (
    <RetirePanel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="size-4 text-primary" />
          <p className="text-sm">
            <span className="font-medium">Options</span>
            <span className="text-muted-foreground">
              {" "}
              · {activeCount} active · net premium{" "}
              {netPremium >= 0 ? "+" : "−"}
              {money(Math.abs(netPremium))}
              {percentOfBook != null
                ? ` (${formatPercent(percentOfBook)} of book)`
                : ""}
              {notional.percentOfBook != null
                ? ` · notional ${money(notional.notional)} (${formatPercent(notional.percentOfBook)} of book)`
                : ` · notional ${money(notional.notional)}`}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          render={<Link href={INVEST_OPTIONS_PATH} />}
        >
          Open options
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
      {expiringCalls.length > 0 ? (
        <ul className="divide-y divide-border/60 px-5 py-2">
          {expiringCalls.map((position) => (
            <li
              key={`${position.ticker}-${position.expiryDate}-${position.strikePrice}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{position.ticker}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {OPTION_TYPE_LABELS[
                    position.optionType as keyof typeof OPTION_TYPE_LABELS
                  ] ?? position.optionType}{" "}
                  {position.strikePrice} · {position.dte} DTE ·{" "}
                  {position.contracts} ct
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {money(position.cost)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-3 text-xs text-muted-foreground">
          No calls expiring within 14 days.
        </p>
      )}
    </RetirePanel>
  );
}

function ChildCard({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3 hover:bg-muted/30"
    >
      {icon}
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
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

