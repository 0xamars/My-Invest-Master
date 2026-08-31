"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BRAND_GREEN,
  BRAND_ORANGE,
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  getChartSeriesColor,
} from "@/lib/portfolio/chart-theme";
import { scaleTapeValue } from "@/lib/invest/assess/tape-series";
import type { TapePoint } from "@/lib/invest/assess/types";

type TapeChartPanel = {
  id: string;
  title: string;
  series: Array<{
    key: keyof TapePoint;
    label: string;
    color: string;
  }>;
};

function hasSeries(points: TapePoint[], key: keyof TapePoint): boolean {
  return points.some((p) => p[key] != null && Number.isFinite(p[key] as number));
}

function chartRows(
  points: TapePoint[],
  unit: "millions" | "billions",
  keys: Array<keyof TapePoint>,
) {
  return points.map((point) => {
    const row: Record<string, string | number | null> = { period: point.period };
    for (const key of keys) {
      row[key] = scaleTapeValue(point[key] as number | null, unit);
    }
    return row;
  });
}

function Panel({
  panel,
  points,
  unit,
  unitLabel,
}: {
  panel: TapeChartPanel;
  points: TapePoint[];
  unit: "millions" | "billions";
  unitLabel: string;
}) {
  const activeSeries = panel.series.filter((s) => hasSeries(points, s.key));
  if (activeSeries.length === 0 || points.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-[var(--brand-charcoal)]/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {panel.title}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">No series loaded for this panel.</p>
      </div>
    );
  }

  const config = activeSeries.reduce((acc, series) => {
    acc[series.key] = { label: series.label, color: series.color };
    return acc;
  }, {} as ChartConfig);

  const data = chartRows(
    points,
    unit,
    activeSeries.map((s) => s.key),
  );

  return (
    <div className="rounded-lg border border-border/60 bg-[var(--brand-charcoal)]/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {panel.title}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{unitLabel}</p>
      <ChartContainer config={config} className="mt-3 aspect-[5/2] h-[180px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {activeSeries.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={series.color}
              radius={2}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function TapeChart({
  points,
  unit,
  unitLabel,
  showDividends,
}: {
  points: TapePoint[];
  unit: "millions" | "billions";
  unitLabel: string;
  showDividends: boolean;
}) {
  const panels = useMemo<TapeChartPanel[]>(() => {
    const panel2Series: TapeChartPanel["series"] = [
      { key: "operatingCashFlow", label: "Operating CF", color: getChartSeriesColor(0) },
      { key: "freeCashFlow", label: "Free CF", color: BRAND_GREEN },
      { key: "netIncome", label: "Net income", color: getChartSeriesColor(2) },
      { key: "stockBasedCompensation", label: "SBC", color: BRAND_ORANGE },
    ];
    if (showDividends) {
      panel2Series.push({
        key: "dividendsPaid",
        label: "Dividends",
        color: getChartSeriesColor(4),
      });
    }

    return [
      {
        id: "pnl",
        title: "Revenue · Net income · EBITDA",
        series: [
          { key: "revenue", label: "Revenue", color: getChartSeriesColor(0) },
          { key: "netIncome", label: "Net income", color: BRAND_GREEN },
          { key: "ebitda", label: "EBITDA", color: getChartSeriesColor(2) },
        ],
      },
      {
        id: "cash",
        title: "Cash flow · SBC" + (showDividends ? " · Dividends" : ""),
        series: panel2Series,
      },
      {
        id: "balance",
        title: "Cash + STI vs Total debt",
        series: [
          { key: "cashAndSti", label: "Cash + STI", color: BRAND_GREEN },
          { key: "totalDebt", label: "Total debt", color: BRAND_ORANGE },
        ],
      },
    ];
  }, [showDividends]);

  return (
    <div className="space-y-4">
      {panels.map((panel) => (
        <Panel
          key={panel.id}
          panel={panel}
          points={points}
          unit={unit}
          unitLabel={unitLabel}
        />
      ))}
    </div>
  );
}
