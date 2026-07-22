"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getAnalyticsSummary } from "@/lib/portfolio/analytics";
import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface AnalyticsKpiCardsProps {
  holdings: PortfolioHoldingWithPrices[];
  totals: {
    costValue: number;
    currentValue: number;
    profitLoss: number;
    hasLoadingPrices: boolean;
  };
  currency: DisplayCurrency;
  rates: FxRates;
}

export function AnalyticsKpiCards({
  holdings,
  totals,
  currency,
  rates,
}: AnalyticsKpiCardsProps) {
  const summary = useMemo(
    () => getAnalyticsSummary(holdings, totals),
    [holdings, totals],
  );

  const isLoading = totals.hasLoadingPrices;
  const returnPercent =
    totals.costValue > 0 ? (totals.profitLoss / totals.costValue) * 100 : 0;

  const cards = [
    {
      label: `Total value · ${currency}`,
      value: isLoading
        ? "Loading…"
        : formatDisplayMoney(totals.currentValue, currency, rates),
      subValue: `Cost ${formatDisplayMoney(totals.costValue, currency, rates)}`,
      icon: Wallet,
      isLoading,
    },
    {
      label: `Total P/L · ${currency}`,
      value: isLoading
        ? "Loading…"
        : `${totals.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(totals.profitLoss, currency, rates)}`,
      subValue: formatPercent(returnPercent),
      icon: TrendingUp,
      valueClassName: profitLossClass(totals.profitLoss),
      isLoading,
    },
    {
      label: "Return",
      value: isLoading ? "Loading…" : formatPercent(summary.returnPercent),
      subValue: `${summary.holdingsCount} holdings`,
      icon: PieChart,
      valueClassName: profitLossClass(summary.returnPercent),
      isLoading,
    },
    {
      label: "Winners / losers",
      value: `${summary.winnersCount} / ${summary.losersCount}`,
      subValue: "Positions in profit vs loss",
      icon: Layers,
    },
    {
      label: "Best performer",
      value: summary.bestPerformer
        ? getHoldingChartLabel(summary.bestPerformer)
        : "—",
      subValue: summary.bestPerformer
        ? formatPercent(summary.bestPerformer.profitLossPercent ?? 0)
        : "No P/L data",
      icon: ArrowUpRight,
      valueClassName: summary.bestPerformer
        ? profitLossClass(summary.bestPerformer.profitLoss ?? 0)
        : undefined,
    },
    {
      label: "Worst performer",
      value: summary.worstPerformer
        ? getHoldingChartLabel(summary.worstPerformer)
        : "—",
      subValue: summary.worstPerformer
        ? formatPercent(summary.worstPerformer.profitLossPercent ?? 0)
        : "No P/L data",
      icon: ArrowDownRight,
      valueClassName: summary.worstPerformer
        ? profitLossClass(summary.worstPerformer.profitLoss ?? 0)
        : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="stat-card relative">
          <card.icon className="absolute top-5 right-5 size-4 text-muted-foreground/40" />
          <p className="stat-label pr-6">{card.label}</p>
          <p
            className={`stat-value ${card.isLoading ? "animate-pulse text-muted-foreground" : ""} ${card.valueClassName ?? ""}`}
          >
            {card.value}
          </p>
          {card.subValue && (
            <p className={`stat-sub ${card.valueClassName ?? ""}`}>
              {card.subValue}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
