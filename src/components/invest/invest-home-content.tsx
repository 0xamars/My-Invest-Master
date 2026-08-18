"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  PieChart,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { PortfolioAllocationChart } from "@/components/analytics/portfolio-allocation-chart";
import { CategorySummaryLink } from "@/components/category/category-page-header";
import {
  RetireEmptyState,
  RetireMoney,
  RetirePageHeader,
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import {
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import {
  TARGET_ALLOCATION_TYPES,
  type TargetAllocation,
} from "@/lib/portfolio/allocation-targets";
import {
  buildInvestmentCheckup,
  riskChipDescription,
  riskChipLabel,
  type CheckupRiskChip,
} from "@/lib/portfolio/checkup";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { pickFreeAllowedPlanId } from "@/lib/plans/free-access";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";
import type { BudgetPlan } from "@/types/budget";
import type { RetirementPlan } from "@/types/retirement";

function latestPlan<T extends { updatedAt: string }>(plans: T[]): T | null {
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}

function pickOpenablePlan<
  T extends { id: string; createdAt: string; updatedAt: string },
>(plans: T[]): T | null {
  const allowedId = pickFreeAllowedPlanId(plans);
  return plans.find((plan) => plan.id === allowedId) ?? latestPlan(plans);
}

function riskChipClass(chip: CheckupRiskChip): string {
  if (chip === "concentrated") {
    return "budget-available-chip--cash";
  }
  if (chip === "cash-heavy") {
    return "budget-available-chip--low";
  }
  return "budget-available-chip--healthy";
}

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

  const {
    enrichedHoldings,
    totals,
    portfolioId,
    portfolioName,
    isViewingPrimary,
  } = portfolio;
  const portfolioHref = portfolioId ? `/portfolio/${portfolioId}` : "/portfolio";
  const budgetPlan = pickOpenablePlan(budget.plans);
  const retirePlan = pickOpenablePlan(retirement.plans);

  const budgetLeftover = useMemo(() => {
    if (!budgetPlan) return null;
    const ready = computeMonthSummary(
      budgetPlan,
      getCurrentMonthKey(),
    ).readyToAssign;
    if (ready <= 0) return null;
    return {
      amount: ready,
      currency: budgetPlan.currency,
      href: `/budget/plans/${budgetPlan.id}`,
      plan: budgetPlan,
    };
  }, [budgetPlan]);

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
        portfolioHref,
        budgetLeftoverHref: budgetLeftover?.href ?? null,
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
      portfolioHref,
      budgetLeftover?.href,
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
    : "Primary portfolio";

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPortfolio = enrichedHoldings.length > 0;
  const hasOptions = optionsCount > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <RetirePageHeader
        title="Invest"
        description="Check concentration, mix, and drift — then open the portfolio, watchlist, or analysis."
      />

      <JourneyStrip
        budgetLeftover={budgetLeftover}
        retireOutlook={retireOutlook}
      />

      {!hasPortfolio && !hasOptions ? (
        <RetirePanel>
          <RetireEmptyState
            icon={<TrendingUp className="size-5" />}
            title={
              portfolioId
                ? `No holdings in ${portfolioName ? `“${portfolioName}”` : "your Primary portfolio"}`
                : "No portfolio yet"
            }
            description="Add stocks, crypto, cash, or custom assets. The checkup scores concentration and mix once prices are in."
            actions={
              <>
                <Button render={<Link href={portfolioHref} />}>
                  {portfolioId ? "Add holdings" : "Create portfolio"}
                </Button>
                <Button variant="outline" render={<Link href="/watchlist" />}>
                  Open watchlist
                </Button>
              </>
            }
          />
        </RetirePanel>
      ) : (
        <>
          {hasPortfolio ? (
            <CheckupHero
              checkup={checkup}
              showingLabel={showingLabel}
              currency={currency}
              rates={rates}
              isLoading={totals.hasLoadingPrices || isLoading}
              dayChange={dayChange}
            />
          ) : null}

          {hasPortfolio ? (
            <TargetAllocationPanel
              checkup={checkup}
              currency={currency}
              rates={rates}
              portfolioId={portfolioId}
              storedTargets={portfolio.portfolio?.targetAllocation}
              onSave={updateTargetAllocation}
            />
          ) : null}

          {hasPortfolio ? (
            <RetirePanel>
              <div className="category-panel-header px-5 py-4">
                <div className="flex min-w-0 items-center gap-2">
                  <PieChart className="size-4 shrink-0 text-primary" />
                  <h2 className="text-sm font-semibold">Allocation</h2>
                </div>
                <CategorySummaryLink href={portfolioHref} label="View portfolio" />
              </div>
              <div className="px-5 pb-5">
                <PortfolioAllocationChart
                  holdings={enrichedHoldings}
                  currency={currency}
                  rates={rates}
                  compact
                />
              </div>
            </RetirePanel>
          ) : null}

          {hasOptions ? (
            <RetirePanel>
              <div className="category-panel-header px-5 py-4">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">
                    Options
                    <span className="ml-2 font-normal text-muted-foreground">
                      {activeOptionsCount} active
                    </span>
                  </h2>
                </div>
                <CategorySummaryLink href="/options" label="View options" />
              </div>
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
                <StatCard
                  label={`Premium paid · ${currency}`}
                  value={formatDisplayMoney(
                    optionsSummary.premiumPaid,
                    currency,
                    rates,
                  )}
                />
                <StatCard
                  label={`Premium received · ${currency}`}
                  value={formatDisplayMoney(
                    optionsSummary.premiumReceived,
                    currency,
                    rates,
                  )}
                  valueClassName="text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                  label={`Net premium · ${currency}`}
                  value={`${optionsSummary.netPremium >= 0 ? "+" : ""}${formatDisplayMoney(optionsSummary.netPremium, currency, rates)}`}
                  valueClassName={profitLossClass(optionsSummary.netPremium)}
                  subValue={
                    checkup.optionsOverlay?.percentOfPortfolio != null
                      ? `${formatPercent(checkup.optionsOverlay.percentOfPortfolio)} of book`
                      : undefined
                  }
                />
              </div>
            </RetirePanel>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <CategorySummaryLink href={portfolioHref} label="Portfolio" />
        <CategorySummaryLink href="/watchlist" label="Watchlist" />
        <CategorySummaryLink href="/analysis" label="Analysis" />
        <CategorySummaryLink href="/options" label="Options" />
        <CategorySummaryLink href="/retire" label="Retire" />
      </div>
    </div>
  );
}

function JourneyStrip({
  budgetLeftover,
  retireOutlook,
}: {
  budgetLeftover: {
    amount: number;
    currency: BudgetPlan["currency"];
    href: string;
  } | null;
  retireOutlook: {
    plan: RetirementPlan;
    dashboard: ReturnType<typeof computeRetirementDashboard>;
  } | null;
}) {
  if (!budgetLeftover && !retireOutlook) return null;

  return (
    <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      {budgetLeftover ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-[var(--brand-green)]">
            {formatBudgetMoney(budgetLeftover.amount, budgetLeftover.currency)}
          </span>{" "}
          unassigned in Budget.
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-7 px-2 text-xs"
            render={<Link href={budgetLeftover.href} />}
          >
            Assign leftover
            <ArrowRight className="size-3.5" />
          </Button>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Assign leftover → fund Invest → check Retire.
        </p>
      )}
      {retireOutlook ? (
        <div className="flex flex-wrap items-center gap-2">
          <RetireVerdictChip verdict={retireOutlook.dashboard.verdict} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            render={<Link href={`/retire/plans/${retireOutlook.plan.id}`} />}
          >
            Refresh Retire from this portfolio
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </RetirePanel>
  );
}

function CheckupHero({
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
  const top = checkup.concentration.topHolding;
  const money = (value: number) => formatDisplayMoney(value, currency, rates);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "budget-available-chip justify-center",
              riskChipClass(checkup.riskChip),
            )}
          >
            {riskChipLabel(checkup.riskChip)}
          </span>
          <span className="text-xs text-muted-foreground">{showingLabel}</span>
        </div>
        <p
          className={cn(
            "budget-hero-value mt-3",
            checkup.riskChip === "concentrated" && "text-[var(--brand-red)]",
            checkup.riskChip === "cash-heavy" && "text-[var(--brand-orange)]",
            checkup.riskChip === "balanced" && "text-[var(--brand-green)]",
          )}
        >
          {riskChipLabel(checkup.riskChip)}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {riskChipDescription(checkup.riskChip)} Top holding{" "}
          {checkup.concentration.topHoldingPercent.toFixed(1)}% · top 5{" "}
          {checkup.concentration.top5Percent.toFixed(1)}% ·{" "}
          {checkup.concentration.nameCount} name
          {checkup.concentration.nameCount === 1 ? "" : "s"}. Cash is{" "}
          {checkup.cashPercent.toFixed(1)}% of book.
        </p>
        {top && checkup.concentration.note !== "none" ? (
          <p className="mt-2 text-sm">
            {checkup.concentration.note === "flag" ? (
              <span className="font-medium text-[var(--brand-red)]">
                Flag · {top.label} is {top.percent.toFixed(1)}%
              </span>
            ) : (
              <span className="font-medium text-[var(--brand-orange)]">
                Note · {top.label} is {top.percent.toFixed(1)}%
              </span>
            )}
            {top.analysisHref ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-7 px-2 text-xs"
                render={<Link href={top.analysisHref} />}
              >
                Open analysis
                <ArrowRight className="size-3.5" />
              </Button>
            ) : null}
          </p>
        ) : null}
        <Button className="mt-4" render={<Link href={checkup.nextAction.href} />}>
          {checkup.nextAction.label}
        </Button>
      </section>

      <RetirePanel className="grid grid-cols-2 divide-x divide-y divide-border/60">
        <Metric
          label={`Value · ${currency}`}
          value={isLoading ? "…" : money(checkup.totalValue)}
        />
        <Metric
          label="Day change"
          value={
            !dayChange
              ? "—"
              : `${dayChange.change >= 0 ? "+" : "−"}${money(Math.abs(dayChange.change))}`
          }
          hint={dayChange ? formatPercent(dayChange.changePercent) : undefined}
          tone={
            !dayChange ? "neutral" : dayChange.change >= 0 ? "in" : "danger"
          }
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
        <Metric
          label="Modified Dietz"
          value={
            checkup.modifiedDietzPercent == null
              ? "—"
              : formatPercent(checkup.modifiedDietzPercent)
          }
          hint={
            checkup.modifiedDietzPercent == null
              ? "Needs dated buys/sells across more than one day"
              : "Money-weighted from transactions — not a benchmark"
          }
        />
      </RetirePanel>
    </div>
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
    <div className="flex flex-col justify-center px-4 py-4 sm:px-5">
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

function TargetAllocationPanel({
  checkup,
  currency,
  rates,
  portfolioId,
  storedTargets,
  onSave,
}: {
  checkup: ReturnType<typeof buildInvestmentCheckup>;
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  portfolioId: string | null;
  storedTargets: TargetAllocation | undefined;
  onSave: (id: string, targets: TargetAllocation) => void;
}) {
  const [draft, setDraft] = useState<TargetAllocation>(() =>
    storedTargets ?? checkup.targets,
  );
  const [saved, setSaved] = useState(false);

  function setType(type: AssetType, raw: string) {
    const parsed = Number(raw);
    setDraft((prev) => ({
      ...prev,
      [type]: Number.isFinite(parsed) ? parsed : 0,
    }));
    setSaved(false);
  }

  function handleSave() {
    if (!portfolioId) return;
    onSave(portfolioId, draft);
    setSaved(true);
  }

  return (
    <RetirePanel>
      <div className="category-panel-header px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Target className="size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Target allocation</h2>
            <p className="text-xs text-muted-foreground">
              {checkup.targetsAreDefault
                ? "Default 80 / 10 / 10 / 0 until you save your own mix. No trades are placed."
                : "Drift vs your saved mix. Hints only — no auto-trades."}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={!portfolioId}>
          {saved ? "Saved" : "Save targets"}
        </Button>
      </div>
      <div className="grid gap-3 px-5 pb-4 sm:grid-cols-4">
        {TARGET_ALLOCATION_TYPES.map((type) => (
          <label key={type} className="space-y-1.5 text-xs text-muted-foreground">
            {type === "stock"
              ? "Stocks %"
              : type === "crypto"
                ? "Crypto %"
                : type === "cash"
                  ? "Cash %"
                  : "Custom %"}
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft[type]}
              onChange={(event) => setType(type, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="divide-y divide-border/60 border-t border-border/60">
        {checkup.drift.map((row) => (
          <div
            key={row.type}
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {row.actualPercent.toFixed(1)}% now · {row.targetPercent.toFixed(1)}%
                target
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.action === "hold" ? (
                "On target"
              ) : row.action === "trim" ? (
                <>
                  Trim{" "}
                  <span className="font-medium text-[var(--brand-orange)]">
                    {formatDisplayMoney(Math.abs(row.dollarDelta), currency, rates)}
                  </span>
                </>
              ) : (
                <>
                  Add{" "}
                  <span className="font-medium text-[var(--brand-green)]">
                    {formatDisplayMoney(Math.abs(row.dollarDelta), currency, rates)}
                  </span>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </RetirePanel>
  );
}

/** Compact summary still used if other surfaces import it. */
export function InvestSummaryPanel({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <div className="flex flex-wrap gap-2">
      <CategorySummaryLink href="/invest" label="Open Invest" />
    </div>
  ) : (
    <InvestHomeContent />
  );
}
