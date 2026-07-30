"use client";

import { RefreshCw } from "lucide-react";
import { AnalyticsKpiCards } from "@/components/analytics/analytics-kpi-cards";
import { AssetTypeChart } from "@/components/analytics/asset-type-chart";
import { CostVsValueChart } from "@/components/analytics/cost-vs-value-chart";
import { PortfolioAllocationChart } from "@/components/analytics/portfolio-allocation-chart";
import { ProfitLossChart } from "@/components/analytics/profit-loss-chart";
import { TopHoldingsChart } from "@/components/analytics/top-holdings-chart";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { useEnrichedPortfolio } from "@/hooks/use-enriched-portfolio";
import { hasAnalyticsData } from "@/lib/portfolio/analytics";

export function AnalyticsContent() {
  const {
    enrichedHoldings,
    totals,
    currency,
    setCurrency,
    rates,
    isLoaded,
    isLoading,
    isRefreshing,
    lastUpdated,
    error,
    portfolioName,
    isViewingPrimary,
  } = useEnrichedPortfolio();

  if (!isLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = hasAnalyticsData(enrichedHoldings);
  const showingLabel = portfolioName
    ? isViewingPrimary
      ? `Showing Primary · ${portfolioName}`
      : `Showing · ${portfolioName}`
    : "Showing Primary portfolio";

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-description">
            {showingLabel}
            {lastUpdated && !isLoading
              ? ` · updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · refreshing" : ""}`
              : ""}
          </p>
        </div>
        <CurrencyToggle
          currency={currency}
          onChange={setCurrency}
          rates={rates}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasData ? (
        <>
          <AnalyticsKpiCards
            holdings={enrichedHoldings}
            totals={totals}
            currency={currency}
            rates={rates}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <AssetTypeChart
              holdings={enrichedHoldings}
              currency={currency}
              rates={rates}
            />
            <TopHoldingsChart
              holdings={enrichedHoldings}
              currency={currency}
              rates={rates}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ProfitLossChart
              holdings={enrichedHoldings}
              currency={currency}
              rates={rates}
            />
            <CostVsValueChart
              holdings={enrichedHoldings}
              currency={currency}
              rates={rates}
            />
          </div>

          <PortfolioAllocationChart
            holdings={enrichedHoldings}
            currency={currency}
            rates={rates}
            compact
          />
        </>
      ) : (
        <PortfolioAllocationChart
          holdings={enrichedHoldings}
          currency={currency}
          rates={rates}
        />
      )}
    </div>
  );
}
