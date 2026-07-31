"use client";

import {
  AnalyticsChartCard,
  AnalyticsChartEmpty,
} from "@/components/analytics/analytics-chart-card";
import { formatAllocationPercent } from "@/lib/portfolio/allocation-chart";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type {
  AssetTypeBreakdownItem,
  SectorBreakdownItem,
} from "@/lib/portfolio/analytics";
import type { DisplayCurrency, FxRates } from "@/types/currency";

interface AllocationPercentTableProps {
  title: string;
  description: string;
  rows: Array<AssetTypeBreakdownItem | SectorBreakdownItem>;
  currency: DisplayCurrency;
  rates: FxRates;
  emptyMessage?: string;
}

export function AllocationPercentTable({
  title,
  description,
  rows,
  currency,
  rates,
  emptyMessage = "No allocation data yet.",
}: AllocationPercentTableProps) {
  return (
    <AnalyticsChartCard title={title} description={description}>
      {rows.length === 0 ? (
        <AnalyticsChartEmpty message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 text-right font-medium">Weight</th>
                <th className="pb-2 pr-3 text-right font-medium">Value</th>
                <th className="pb-2 text-right font-medium">Holdings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.fill }}
                        aria-hidden
                      />
                      <span className="font-medium">{row.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatAllocationPercent(row.percent)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatDisplayMoney(row.value, currency, rates)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AnalyticsChartCard>
  );
}
