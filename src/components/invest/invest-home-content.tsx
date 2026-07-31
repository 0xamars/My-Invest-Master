"use client";

import Link from "next/link";
import { Layers, PieChart, RefreshCw } from "lucide-react";
import { PortfolioAllocationChart } from "@/components/analytics/portfolio-allocation-chart";
import {
  CategoryPageHeader,
  CategorySummaryLink,
} from "@/components/category/category-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";

interface InvestSummaryPanelProps {
  compact?: boolean;
}

export function InvestSummaryPanel({ compact = false }: InvestSummaryPanelProps) {
  const {
    portfolio,
    optionsSummary,
    activeOptionsCount,
    optionsCount,
    rates,
    currency,
    isLoaded,
    isLoading,
  } = useInvestSummary();

  const {
    enrichedHoldings,
    totals,
    portfolioId,
    portfolioName,
    isViewingPrimary,
  } = portfolio;
  const totalPlPercent =
    totals.costValue === 0 ? 0 : (totals.profitLoss / totals.costValue) * 100;

  const portfolioHref = portfolioId
    ? `/portfolio/${portfolioId}`
    : "/portfolio";
  const showingLabel = portfolioName
    ? isViewingPrimary
      ? `Showing Primary · ${portfolioName}`
      : `Showing · ${portfolioName}`
    : "Showing Primary portfolio";

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPortfolio = enrichedHoldings.length > 0;
  const hasOptions = optionsCount > 0;

  if (!hasPortfolio && !hasOptions) {
    return (
      <div className="category-empty-panel">
        <p className="text-sm text-muted-foreground">
          {portfolioId
            ? `No holdings in ${portfolioName ? `“${portfolioName}”` : "your Primary portfolio"} yet. Open it to add positions, or manage portfolios to create another.`
            : "No portfolios yet. Create your first portfolio to see your Invest overview here."}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {portfolioId ? (
            <CategorySummaryLink href={portfolioHref} label="Open portfolio" />
          ) : null}
          <CategorySummaryLink
            href="/portfolio"
            label={portfolioId ? "Manage portfolios" : "Create portfolio"}
          />
          <CategorySummaryLink href="/options" label="Open options" />
          <CategorySummaryLink href="/watchlist" label="Open watchlist" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasPortfolio && (
        <section className="category-panel">
          <div className="category-panel-header">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <PieChart className="size-4 shrink-0 text-primary" />
                <h2 className="truncate text-sm font-semibold">
                  {showingLabel}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {isViewingPrimary
                  ? "Invest uses your Primary portfolio as the default."
                  : "Temporarily showing the portfolio you have open."}
              </p>
            </div>
            {!compact && (
              <CategorySummaryLink
                href={portfolioHref}
                label="View portfolio"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={`Total value · ${currency}`}
              value={
                totals.hasLoadingPrices
                  ? "Loading…"
                  : formatDisplayMoney(totals.currentValue, currency, rates)
              }
              isLoading={totals.hasLoadingPrices || isLoading}
            />
            <StatCard
              label={`Total cost · ${currency}`}
              value={formatDisplayMoney(totals.costValue, currency, rates)}
            />
            <StatCard
              label={`Total P/L · ${currency}`}
              value={
                totals.hasLoadingPrices
                  ? "Loading…"
                  : `${totals.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(totals.profitLoss, currency, rates)}`
              }
              subValue={
                totals.hasLoadingPrices ? undefined : formatPercent(totalPlPercent)
              }
              valueClassName={
                totals.hasLoadingPrices
                  ? undefined
                  : profitLossClass(totals.profitLoss)
              }
              isLoading={totals.hasLoadingPrices || isLoading}
            />
          </div>

          {!compact && (
            <PortfolioAllocationChart
              holdings={enrichedHoldings}
              currency={currency}
              rates={rates}
              compact
            />
          )}
        </section>
      )}

      {hasOptions && (
        <section className="category-panel">
          <div className="category-panel-header">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">
                Options
                <span className="ml-2 font-normal text-muted-foreground">
                  {activeOptionsCount} active
                </span>
              </h2>
            </div>
            {!compact && (
              <CategorySummaryLink href="/options" label="View options" />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={`Premium paid · ${currency}`}
              value={formatDisplayMoney(optionsSummary.premiumPaid, currency, rates)}
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
            />
          </div>
        </section>
      )}

      {compact && (
        <div className="flex flex-wrap gap-2">
          <CategorySummaryLink href="/invest" label="Open Invest" />
          <CategorySummaryLink href={portfolioHref} label="View portfolio" />
          <CategorySummaryLink href="/watchlist" label="Watchlist" />
          <CategorySummaryLink href="/options" label="Options" />
        </div>
      )}
    </div>
  );
}

export function InvestHomeContent() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <CategoryPageHeader
        category="invest"
        title="Invest"
        description="Your portfolio, watchlist, and options at a glance — drill into each area for full detail."
      />
      <InvestSummaryPanel />
    </div>
  );
}
