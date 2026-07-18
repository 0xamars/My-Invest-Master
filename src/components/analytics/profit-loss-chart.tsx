"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
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
import { buildProfitLossChartData } from "@/lib/portfolio/analytics";
import { CHART_GRID_COLOR } from "@/lib/portfolio/chart-theme";
import { formatDisplayMoney, formatPercent } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface ProfitLossChartProps {
  holdings: PortfolioHoldingWithPrices[];
  currency: DisplayCurrency;
  rates: FxRates;
}

export function ProfitLossChart({
  holdings,
  currency,
  rates,
}: ProfitLossChartProps) {
  const chartData = useMemo(
    () => buildProfitLossChartData(holdings),
    [holdings],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      profitLoss: { label: "P/L", color: "var(--chart-current)" },
    };
    for (const item of chartData) {
      config[item.id] = { label: item.label, color: item.fill };
    }
    return config;
  }, [chartData]);

  const chartHeight = Math.max(220, chartData.length * 36 + 32);

  return (
    <AnalyticsChartCard
      title="Profit & Loss by Holding"
      description="Unrealized gain or loss per position"
    >
      {chartData.length === 0 ? (
        <AnalyticsChartEmpty message="Add non-cash holdings with cost basis to see P/L." />
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
            <ReferenceLine
              x={0}
              stroke={CHART_GRID_COLOR}
              strokeWidth={1}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const payload = item.payload as {
                      label: string;
                      profitLossPercent: number;
                    };
                    const pl = Number(value);
                    return [
                      `${pl >= 0 ? "+" : ""}${formatDisplayMoney(pl, currency, rates)} · ${formatPercent(payload.profitLossPercent)}`,
                      payload.label,
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="profitLoss"
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
