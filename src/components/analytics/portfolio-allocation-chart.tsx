"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
  renderAllocationLabelLine,
  renderAllocationSliceLabel,
} from "@/components/analytics/pie-chart-labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { buildAllocationChartData } from "@/lib/portfolio/allocation-chart";
import { CHART_SLICE_STROKE } from "@/lib/portfolio/chart-theme";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

interface PortfolioAllocationChartProps {
  holdings: PortfolioHoldingWithPrices[];
  currency: DisplayCurrency;
  rates: FxRates;
  compact?: boolean;
}

export function PortfolioAllocationChart({
  holdings,
  currency,
  rates,
  compact = false,
}: PortfolioAllocationChartProps) {
  const chartData = useMemo(
    () => buildAllocationChartData(holdings),
    [holdings],
  );

  const totalValue = useMemo(
    () =>
      chartData.reduce((sum, item) => sum + item.currentValue, 0),
    [chartData],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const item of chartData) {
      config[item.id] = {
        label: item.label,
        color: item.fill,
      };
    }
    return config;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card className="surface-card gap-0 py-0 shadow-none">
        <CardHeader className="border-b border-border/60 px-6 py-5">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Portfolio Allocation
          </CardTitle>
          <CardDescription>
            Distribution of holdings by portfolio percentage
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-10">
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 px-8 py-16 text-center text-sm text-muted-foreground">
            Add assets to your portfolio to see allocation breakdown.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card gap-0 py-0 shadow-none">
      <CardHeader className="border-b border-border/60 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">
              Portfolio Allocation
            </CardTitle>
            <CardDescription>
              {chartData.length} holdings · sorted by weight · largest at 12
              o&apos;clock
            </CardDescription>
          </div>
          <div className="sm:text-right">
            <p className="stat-label">Total value</p>
            <p className="stat-value text-2xl">
              {formatDisplayMoney(totalValue, currency, rates)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-10 pt-6 sm:px-4 lg:px-6">
        <ChartContainer
          config={chartConfig}
          className={
            compact
              ? "mx-auto aspect-square h-[min(560px,65vh)] w-full max-w-4xl [&_.recharts-surface]:overflow-visible"
              : "mx-auto aspect-square h-[min(960px,90vh)] w-full max-w-none [&_.recharts-surface]:overflow-visible"
          }
          initialDimension={
            compact ? { width: 560, height: 560 } : { width: 960, height: 960 }
          }
        >
          <PieChart
            margin={
              compact
                ? { top: 32, right: 108, bottom: 32, left: 108 }
                : { top: 48, right: 148, bottom: 48, left: 148 }
            }
          >
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="min-w-40 border-border/80 px-3 py-2 text-sm shadow-lg"
                  nameKey="id"
                  labelKey="label"
                  formatter={(value, _name, item) => {
                    const payload = item.payload as {
                      currentValue: number;
                      label: string;
                    };
                    return [
                      `${Number(value).toFixed(1)}% · ${formatDisplayMoney(payload.currentValue, currency, rates)}`,
                      payload.label,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="portfolioPercent"
              nameKey="id"
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              outerRadius={compact ? "44%" : "48%"}
              paddingAngle={0}
              stroke={CHART_SLICE_STROKE}
              strokeWidth={2}
              isAnimationActive={false}
              label={renderAllocationSliceLabel}
              labelLine={renderAllocationLabelLine}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
