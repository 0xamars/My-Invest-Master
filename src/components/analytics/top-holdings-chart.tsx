"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  AnalyticsChartCard,
  AnalyticsChartEmpty,
} from "@/components/analytics/analytics-chart-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { buildTopHoldingsChartData } from "@/lib/portfolio/analytics";
import { formatAllocationPercent } from "@/lib/portfolio/allocation-chart";
import { getChartSeriesColor } from "@/lib/portfolio/chart-theme";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface TopHoldingsChartProps {
  holdings: PortfolioHoldingWithPrices[];
  currency: DisplayCurrency;
  rates: FxRates;
}

export function TopHoldingsChart({
  holdings,
  currency,
  rates,
}: TopHoldingsChartProps) {
  const chartData = useMemo(
    () =>
      buildTopHoldingsChartData(holdings).map((item, index) => ({
        ...item,
        fill: getChartSeriesColor(index),
      })),
    [holdings],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: "Value", color: "var(--chart-current)" },
    };
    for (const item of chartData) {
      config[item.id] = { label: item.label, color: item.fill };
    }
    return config;
  }, [chartData]);

  const chartHeight = Math.max(220, chartData.length * 36 + 32);

  return (
    <AnalyticsChartCard
      title="Top Holdings"
      description="Largest positions by current value"
    >
      {chartData.length === 0 ? (
        <AnalyticsChartEmpty />
      ) : (
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: chartHeight }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={68}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const payload = item.payload as {
                      label: string;
                      percent: number;
                    };
                    return [
                      `${formatDisplayMoney(Number(value), currency, rates)} · ${formatAllocationPercent(payload.percent)}`,
                      payload.label,
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              barSize={18}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </AnalyticsChartCard>
  );
}
