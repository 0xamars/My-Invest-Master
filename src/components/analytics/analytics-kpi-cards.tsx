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
import { cn } from "@/lib/utils";
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

function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  valueClassName,
  isLoading,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <Icon className="size-4 shrink-0 text-muted-foreground/70" />
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tabular-nums tracking-tight",
          isLoading && "animate-pulse text-muted-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className={cn("mt-0.5 text-xs text-muted-foreground", valueClassName)}>
          {subValue}
        </p>
      )}
    </div>
  );
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

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        label={`Total Value (${currency})`}
        value={
          isLoading
            ? "Loading…"
            : formatDisplayMoney(totals.currentValue, currency, rates)
        }
        subValue={`Cost ${formatDisplayMoney(totals.costValue, currency, rates)}`}
        icon={Wallet}
        isLoading={isLoading}
      />
      <KpiCard
        label={`Total P/L (${currency})`}
        value={
          isLoading
            ? "Loading…"
            : `${totals.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(totals.profitLoss, currency, rates)}`
        }
        subValue={formatPercent(returnPercent)}
        icon={TrendingUp}
        valueClassName={profitLossClass(totals.profitLoss)}
        isLoading={isLoading}
      />
      <KpiCard
        label="Return"
        value={isLoading ? "Loading…" : formatPercent(summary.returnPercent)}
        subValue={`${summary.holdingsCount} active holdings`}
        icon={PieChart}
        valueClassName={profitLossClass(summary.returnPercent)}
        isLoading={isLoading}
      />
      <KpiCard
        label="Winners / Losers"
        value={`${summary.winnersCount} / ${summary.losersCount}`}
        subValue="Positions in profit vs loss"
        icon={Layers}
      />
      <KpiCard
        label="Best Performer"
        value={
          summary.bestPerformer
            ? getHoldingChartLabel(summary.bestPerformer)
            : "—"
        }
        subValue={
          summary.bestPerformer
            ? formatPercent(summary.bestPerformer.profitLossPercent ?? 0)
            : "No P/L data"
        }
        icon={ArrowUpRight}
        valueClassName={
          summary.bestPerformer
            ? profitLossClass(summary.bestPerformer.profitLoss ?? 0)
            : undefined
        }
      />
      <KpiCard
        label="Worst Performer"
        value={
          summary.worstPerformer
            ? getHoldingChartLabel(summary.worstPerformer)
            : "—"
        }
        subValue={
          summary.worstPerformer
            ? formatPercent(summary.worstPerformer.profitLossPercent ?? 0)
            : "No P/L data"
        }
        icon={ArrowDownRight}
        valueClassName={
          summary.worstPerformer
            ? profitLossClass(summary.worstPerformer.profitLoss ?? 0)
            : undefined
        }
      />
    </div>
  );
}
