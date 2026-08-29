"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  BRAND_GREEN,
  BRAND_GREEN_DEEP,
  BRAND_ORANGE,
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
} from "@/lib/portfolio/chart-theme";
import {
  formatProjectionCompactMoney,
  formatProjectionMoney,
} from "@/lib/retirement/format";
import type { OutlookChartRow } from "@/lib/retirement/outlook";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";

const CHART_CONFIG = {
  bad: { label: "Bad", color: BRAND_ORANGE },
  typical: { label: "Typical", color: BRAND_GREEN },
  good: { label: "Good", color: BRAND_GREEN_DEEP },
} satisfies ChartConfig;

const AXIS_TICK = { fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 };

function ageTicks(ages: number[]): number[] {
  if (ages.length <= 8) return ages;
  const step = ages.length > 24 ? 5 : ages.length > 16 ? 4 : 3;
  return ages.filter((_, index) => index % step === 0 || index === ages.length - 1);
}

function OutlookTooltip({
  active,
  payload,
  label,
  currency,
  rates,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    dataKey?: string | number;
  }>;
  label?: string | number;
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[180px] rounded-xl border border-border/40 bg-card/96 px-4 py-3 shadow-2xl">
      <p className="mb-2.5 border-b border-border/35 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Age {label}
      </p>
      <div className="space-y-2">
        {(["bad", "typical", "good"] as const).map((key) => {
          const item = payload.find((entry) => entry.dataKey === key);
          if (!item || item.value == null) return null;
          const config = CHART_CONFIG[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                  style={{ backgroundColor: config.color }}
                />
                <span className="truncate text-xs text-muted-foreground">
                  {config.label}
                </span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                {formatProjectionMoney(Number(item.value), currency, rates)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RetirementOutlookChart({
  rows,
  currency,
  rates,
}: {
  rows: OutlookChartRow[];
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  const ticks = useMemo(
    () => ageTicks(rows.map((row) => row.age)),
    [rows],
  );

  if (rows.length === 0) return null;

  return (
    <ChartContainer
      config={CHART_CONFIG}
      className={cn(
        "aspect-[16/8] h-[240px] w-full",
        "[&_.recharts-cartesian-grid_horizontal_line]:opacity-50",
      )}
    >
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid
          vertical={false}
          stroke={CHART_GRID_COLOR}
          strokeOpacity={0.45}
          strokeDasharray="3 8"
        />
        <XAxis
          dataKey="age"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={48}
          tickCount={4}
          tickFormatter={(value) =>
            formatProjectionCompactMoney(Number(value), currency, rates)
          }
        />
        <ChartTooltip
          cursor={{
            stroke: BRAND_GREEN,
            strokeWidth: 1,
            strokeDasharray: "4 4",
            strokeOpacity: 0.35,
          }}
          content={<OutlookTooltip currency={currency} rates={rates} />}
        />
        <Area
          type="monotone"
          dataKey="bad"
          stackId="range"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="spread"
          stackId="range"
          stroke="none"
          fill={BRAND_GREEN}
          fillOpacity={0.12}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="bad"
          stroke={BRAND_ORANGE}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="typical"
          stroke={BRAND_GREEN}
          strokeWidth={2.25}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="good"
          stroke={BRAND_GREEN_DEEP}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
