"use client";

import { useMemo } from "react";
import { Eye, Plus, Sparkles } from "lucide-react";
import { AssetTypeChart } from "@/components/analytics/asset-type-chart";
import { AllocationPercentTable } from "@/components/portfolio/intelligence/allocation-percent-table";
import {
  ConcentrationRiskPanel,
  IntelligenceInsightsPanel,
} from "@/components/portfolio/intelligence/concentration-risk-panel";
import { IntelligencePerformance } from "@/components/portfolio/intelligence/intelligence-performance";
import { SectorBreakdownChart } from "@/components/portfolio/intelligence/sector-breakdown-chart";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { buildPortfolioIntelligence } from "@/lib/portfolio/intelligence";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface PortfolioIntelligenceContentProps {
  holdings: PortfolioHoldingWithPrices[];
  totals: {
    costValue: number;
    currentValue: number;
    profitLoss: number;
    hasLoadingPrices: boolean;
  };
  currency: DisplayCurrency;
  rates: FxRates;
  portfolioName: string;
  isPrimary: boolean;
  multiPortfolio: boolean;
  onAddHolding: () => void;
}

export function PortfolioIntelligenceContent({
  holdings,
  totals,
  currency,
  rates,
  portfolioName,
  isPrimary,
  multiPortfolio,
  onAddHolding,
}: PortfolioIntelligenceContentProps) {
  const { plan } = useUserPlan();

  const intelligence = useMemo(
    () => buildPortfolioIntelligence(holdings, totals),
    [holdings, totals],
  );

  const contextLabel = multiPortfolio
    ? isPrimary
      ? `${portfolioName} · Primary`
      : `${portfolioName} · Viewing`
    : portfolioName;

  if (holdings.length === 0) {
    return (
      <Card className="surface-card border-dashed shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Eye className="size-6" />
          </div>
          <CardTitle>No holdings to analyze</CardTitle>
          <CardDescription>
            Add stocks, crypto, cash, or custom assets to this portfolio to see
            allocation, concentration, and risk insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button className="gap-2" onClick={onAddHolding}>
            <Plus className="size-4" />
            Add transaction
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!intelligence.hasData || totals.hasLoadingPrices) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatCard
              key={index}
              label="Loading"
              value="…"
              isLoading
            />
          ))}
        </div>
        <Card className="surface-card shadow-none">
          <CardContent className="flex min-h-[200px] items-center justify-center px-6 py-10 text-sm text-muted-foreground">
            {totals.hasLoadingPrices
              ? "Waiting for live prices to finish loading…"
              : "Prices are needed before intelligence can be calculated."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Portfolio Intelligence
        </p>
        <p className="text-sm text-muted-foreground">
          Rules-based snapshot for{" "}
          <span className="font-medium text-foreground">{contextLabel}</span>
          . Based on your holdings and live prices — not AI predictions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={`Total value · ${currency}`}
          value={formatDisplayMoney(intelligence.totalValue, currency, rates)}
        />
        <StatCard
          label={`Total cost · ${currency}`}
          value={formatDisplayMoney(intelligence.totalCost, currency, rates)}
        />
        <StatCard
          label={`Total P/L · ${currency}`}
          value={`${intelligence.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(intelligence.profitLoss, currency, rates)}`}
          subValue={formatPercent(intelligence.profitLossPercent)}
          valueClassName={profitLossClass(intelligence.profitLoss)}
        />
        <StatCard
          label="Holdings"
          value={String(intelligence.pricedCount)}
          subValue={
            intelligence.holdingsCount !== intelligence.pricedCount
              ? `${intelligence.holdingsCount} total · ${intelligence.pricedCount} priced`
              : undefined
          }
        />
        <StatCard
          label="Portfolio context"
          value={isPrimary ? "Primary" : "Secondary"}
          subValue={multiPortfolio ? portfolioName : "Single portfolio"}
        />
      </div>

      <ConcentrationRiskPanel
        concentration={intelligence.concentration}
        overallRisk={intelligence.overallRisk}
      />

      <IntelligenceInsightsPanel insights={intelligence.insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AssetTypeChart
          holdings={holdings}
          currency={currency}
          rates={rates}
        />
        <SectorBreakdownChart
          sectors={intelligence.sectorBreakdown}
          currency={currency}
          rates={rates}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AllocationPercentTable
          title="Asset type weights"
          description="Equity, crypto, cash, and other by portfolio value"
          rows={intelligence.assetTypeBreakdown}
          currency={currency}
          rates={rates}
        />
        <AllocationPercentTable
          title="Sector weights"
          description="Top sector concentrations from holding tags"
          rows={intelligence.sectorBreakdown}
          currency={currency}
          rates={rates}
          emptyMessage="No sector data on holdings yet."
        />
      </div>

      {intelligence.concentration.top5Holdings.length > 0 && (
        <AllocationPercentTable
          title="Top concentrations"
          description="Largest holdings by current portfolio weight"
          rows={intelligence.concentration.top5Holdings.map((holding, index) => ({
            id: holding.id,
            label: holding.symbol,
            value: holding.currentValue ?? 0,
            count: 1,
            percent: holding.portfolioPercent ?? 0,
            fill: `var(--chart-series-${(index % 12) + 1})`,
          }))}
          currency={currency}
          rates={rates}
        />
      )}

      <IntelligencePerformance
        topGainers={intelligence.topGainers}
        topLosers={intelligence.topLosers}
        bestContributors={intelligence.bestContributors}
        worstContributors={intelligence.worstContributors}
        currency={currency}
        rates={rates}
      />

      {plan === "free" && (
        <PremiumUpgradeCallout feature="ai_portfolio_insights" />
      )}

      {plan === "premium" && (
        <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Deeper Premium insights (scenario stress, correlation, and AI
              explanations) can plug into these same insight codes later. This
              view stays fully rules-based today.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
