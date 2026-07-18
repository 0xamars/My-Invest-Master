"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { buildCostVsValueChartData } from "@/lib/portfolio/analytics";
import {
  CHART_COST_COLOR,
  CHART_CURRENT_COLOR,
  CHART_GRID_COLOR,
} from "@/lib/portfolio/chart-theme";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface CostVsValueChartProps {
  holdings: PortfolioHoldingWithPrices[];
  currency: DisplayCurrency;
  rates: FxRates;
}

export function CostVsValueChart({
  holdings,
  currency,
  rates,
}: CostVsValueChartProps) {
  const chartData = useMemo(
    () => buildCostVsValueChartData(holdings),
    [holdings],
  );

  const chartConfig = {
    cost: { label: "Cost basis", color: CHART_COST_COLOR },
    current: { label: "Current value", color: CHART_CURRENT_COLOR },
  } satisfies ChartConfig;

  return (
    <AnalyticsChartCard
      title="Cost vs Current Value"
      description="Top holdings — invested amount compared to market value"
    >
      {chartData.length === 0 ? (
        <AnalyticsChartEmpty message="Add holdings with cost basis to compare values." />
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-[4/3] h-[280px] w-full"
        >
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={CHART_GRID_COLOR}
              strokeOpacity={1}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-24}
              textAnchor="end"
              height={56}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value) =>
                formatDisplayMoney(Number(value), currency, rates)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatDisplayMoney(Number(value), currency, rates),
                    chartConfig[name as keyof typeof chartConfig]?.label ?? name,
                  ]}
                />
              }
            />
            <Bar
              dataKey="cost"
              fill={CHART_COST_COLOR}
              radius={[4, 4, 0, 0]}
              barSize={20}
              isAnimationActive={false}
            />
            <Bar
              dataKey="current"
              fill={CHART_CURRENT_COLOR}
              radius={[4, 4, 0, 0]}
              barSize={20}
              isAnimationActive={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      )}
    </AnalyticsChartCard>
  );
}
