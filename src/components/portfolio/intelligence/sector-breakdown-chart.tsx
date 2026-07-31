"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
  AnalyticsChartCard,
  AnalyticsChartEmpty,
} from "@/components/analytics/analytics-chart-card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAllocationPercent } from "@/lib/portfolio/allocation-chart";
import { CHART_SLICE_STROKE } from "@/lib/portfolio/chart-theme";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { SectorBreakdownItem } from "@/lib/portfolio/analytics";
import type { DisplayCurrency, FxRates } from "@/types/currency";

interface SectorBreakdownChartProps {
  sectors: SectorBreakdownItem[];
  currency: DisplayCurrency;
  rates: FxRates;
}

export function SectorBreakdownChart({
  sectors,
  currency,
  rates,
}: SectorBreakdownChartProps) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const item of sectors) {
      config[item.id] = { label: item.label, color: item.fill };
    }
    return config;
  }, [sectors]);

  return (
    <AnalyticsChartCard
      title="Sector mix"
      description="Portfolio value by holding sector"
    >
      {sectors.length === 0 ? (
        <AnalyticsChartEmpty message="Add holdings with sectors to see this breakdown." />
      ) : (
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[280px] w-full max-w-sm"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="id"
                  labelKey="label"
                  formatter={(value, _name, item) => {
                    const payload = item.payload as {
                      value: number;
                      count: number;
                      label: string;
                    };
                    return [
                      `${formatAllocationPercent(Number(value))} · ${formatDisplayMoney(payload.value, currency, rates)} · ${payload.count} holding${payload.count === 1 ? "" : "s"}`,
                      payload.label,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={sectors}
              dataKey="percent"
              nameKey="id"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              stroke={CHART_SLICE_STROKE}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {sectors.map((entry) => (
                <Cell key={entry.id} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="id" />} />
          </PieChart>
        </ChartContainer>
      )}
    </AnalyticsChartCard>
  );
}
