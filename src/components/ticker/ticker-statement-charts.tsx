"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CHART_GRID_COLOR,
  getChartSeriesColor,
} from "@/lib/portfolio/chart-theme";
import { formatTickerField, TICKER_UNKNOWN } from "@/lib/ticker/format";
import type { TickerChartPoint } from "@/lib/ticker/score-types";

const PANELS = [
  { key: "revenue", label: "Revenue", color: getChartSeriesColor(0), kind: "money" as const },
  { key: "netIncome", label: "Net income", color: getChartSeriesColor(1), kind: "money" as const },
  { key: "epsDiluted", label: "Diluted EPS", color: getChartSeriesColor(2), kind: "ratio" as const },
] as const;

function hasAny(points: TickerChartPoint[], key: (typeof PANELS)[number]["key"]) {
  return points.some((point) => point[key] != null);
}

function Panel({
  points,
  series,
}: {
  points: TickerChartPoint[];
  series: (typeof PANELS)[number];
}) {
  const config = {
    [series.key]: { label: series.label, color: series.color },
  } satisfies ChartConfig;

  if (!hasAny(points, series.key)) {
    return (
      <div>
        <p className="budget-metric-label">{series.label}</p>
        <p className="mt-6 text-sm text-muted-foreground">{TICKER_UNKNOWN}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="budget-metric-label">{series.label}</p>
      <ChartContainer config={config} className="mt-2 aspect-[5/3] h-[140px] w-full">
        <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  formatTickerField({
                    label: series.label,
                    value: typeof value === "number" ? value : null,
                    kind: series.kind,
                  })
                }
              />
            }
          />
          <Bar dataKey={series.key} fill={series.color} radius={3} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function TickerStatementCharts({
  title,
  points,
}: {
  title: string;
  points: TickerChartPoint[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {PANELS.map((series) => (
          <Panel key={series.key} points={points} series={series} />
        ))}
      </div>
    </div>
  );
}
