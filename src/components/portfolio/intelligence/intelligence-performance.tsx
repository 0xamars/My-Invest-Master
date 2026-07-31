"use client";

import {
  AnalyticsChartCard,
  AnalyticsChartEmpty,
} from "@/components/analytics/analytics-chart-card";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import type { PerformanceRow } from "@/lib/portfolio/intelligence";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import { cn } from "@/lib/utils";

interface PerformanceTableProps {
  title: string;
  description: string;
  rows: PerformanceRow[];
  currency: DisplayCurrency;
  rates: FxRates;
  emptyMessage: string;
  showContribution?: boolean;
}

function PerformanceTable({
  title,
  description,
  rows,
  currency,
  rates,
  emptyMessage,
  showContribution = false,
}: PerformanceTableProps) {
  return (
    <AnalyticsChartCard title={title} description={description}>
      {rows.length === 0 ? (
        <AnalyticsChartEmpty message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Ticker</th>
                <th className="pb-2 pr-3 text-right font-medium">P/L %</th>
                <th className="pb-2 pr-3 text-right font-medium">P/L</th>
                {showContribution && (
                  <th className="pb-2 text-right font-medium">Of |P/L|</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.holding.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.holding.name}
                    </p>
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right tabular-nums",
                      profitLossClass(row.profitLossPercent),
                    )}
                  >
                    {formatPercent(row.profitLossPercent)}
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right tabular-nums",
                      profitLossClass(row.profitLoss),
                    )}
                  >
                    {`${row.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(row.profitLoss, currency, rates)}`}
                  </td>
                  {showContribution && (
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.contributionPercent == null
                        ? "—"
                        : `${row.contributionPercent.toFixed(0)}%`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AnalyticsChartCard>
  );
}

interface IntelligencePerformanceProps {
  topGainers: PerformanceRow[];
  topLosers: PerformanceRow[];
  bestContributors: PerformanceRow[];
  worstContributors: PerformanceRow[];
  currency: DisplayCurrency;
  rates: FxRates;
}

export function IntelligencePerformance({
  topGainers,
  topLosers,
  bestContributors,
  worstContributors,
  currency,
  rates,
}: IntelligencePerformanceProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PerformanceTable
        title="Top gainers"
        description="Best unrealized return % in this portfolio"
        rows={topGainers.filter((r) => r.profitLossPercent > 0)}
        currency={currency}
        rates={rates}
        emptyMessage="No unrealized gainers yet."
      />
      <PerformanceTable
        title="Top losers"
        description="Worst unrealized return % in this portfolio"
        rows={topLosers}
        currency={currency}
        rates={rates}
        emptyMessage="No unrealized losers yet."
      />
      <PerformanceTable
        title="Best P/L contributors"
        description="Largest dollar gains vs cost basis"
        rows={bestContributors}
        currency={currency}
        rates={rates}
        emptyMessage="No positive P/L contributors yet."
        showContribution
      />
      <PerformanceTable
        title="Worst P/L contributors"
        description="Largest dollar losses vs cost basis"
        rows={worstContributors}
        currency={currency}
        rates={rates}
        emptyMessage="No negative P/L contributors yet."
        showContribution
      />
    </div>
  );
}
