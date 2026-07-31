"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalysisChartPoint } from "@/lib/analysis/history";
import { formatPrice } from "@/lib/portfolio/format";
import type { AnalysisAssetType } from "@/lib/analysis/types";
import type { DisplayCurrency, FxRates } from "@/types/currency";

const chartConfig = {
  close: {
    label: "Price",
    color: "var(--brand-green)",
  },
} satisfies ChartConfig;

export function AnalysisPriceChart({
  points,
  assetType,
  currency,
  rates,
}: {
  points: AnalysisChartPoint[];
  assetType: AnalysisAssetType;
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
        Price history unavailable for this range.
      </div>
    );
  }

  const data = points.map((p) => ({
    time: p.time,
    close: p.close,
    label: new Date(p.time).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-[16/7] h-[260px] w-full"
      initialDimension={{ width: 640, height: 260 }}
    >
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="analysisPriceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
        />
        <YAxis
          domain={["auto", "auto"]}
          width={56}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
          tickFormatter={(value: number) =>
            formatPrice(value, assetType, currency, rates)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                typeof value === "number"
                  ? formatPrice(value, assetType, currency, rates)
                  : String(value)
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke="var(--brand-green)"
          fill="url(#analysisPriceFill)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
