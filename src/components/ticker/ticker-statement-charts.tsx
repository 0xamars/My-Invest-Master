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
import type { TickerChartPoint, TickerTrendPoint } from "@/lib/ticker/score-types";
import type { TickerField } from "@/lib/ticker/types";

type SeriesDef = {
  key: string;
  label: string;
  kind: TickerField["kind"];
};

const STATEMENT_PANELS: SeriesDef[] = [
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "netIncome", label: "Net income", kind: "money" },
  { key: "epsDiluted", label: "Diluted EPS", kind: "ratio" },
];

const TREND_PANELS: SeriesDef[] = [
  { key: "freeCashFlow", label: "Free cash flow", kind: "money" },
  { key: "grossMargin", label: "Gross margin", kind: "percent" },
  { key: "operatingMargin", label: "Operating margin", kind: "percent" },
  { key: "netMargin", label: "Net margin", kind: "percent" },
  { key: "fcfMargin", label: "FCF margin", kind: "percent" },
];

function hasAny(
  points: Array<Record<string, string | number | null | undefined>>,
  key: string,
) {
  return points.some((point) => point[key] != null);
}

function Panel({
  points,
  series,
  color,
}: {
  points: Array<Record<string, string | number | null | undefined>>;
  series: SeriesDef;
  color: string;
}) {
  const config = {
    [series.key]: { label: series.label, color },
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
          <Bar dataKey={series.key} fill={color} radius={3} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function ChartBlock({
  title,
  points,
  series,
}: {
  title: string;
  points: Array<Record<string, string | number | null | undefined>>;
  series: SeriesDef[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div
        className={
          series.length > 3
            ? "mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            : "mt-3 grid gap-4 md:grid-cols-3"
        }
      >
        {series.map((item, index) => (
          <Panel
            key={item.key}
            points={points}
            series={item}
            color={getChartSeriesColor(index)}
          />
        ))}
      </div>
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
  return <ChartBlock title={title} points={points} series={STATEMENT_PANELS} />;
}

export function TickerTrendCharts({
  title,
  points,
}: {
  title: string;
  points: TickerTrendPoint[];
}) {
  return <ChartBlock title={title} points={points} series={TREND_PANELS} />;
}
