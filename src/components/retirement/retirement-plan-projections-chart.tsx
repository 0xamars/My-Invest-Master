"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticsChartCard,
  AnalyticsChartEmpty,
} from "@/components/analytics/analytics-chart-card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildProjectionChartConfig,
  buildProjectionChartData,
  computeProjectionYDomain,
  findDepletionYear,
  sortAssetsForCompositionStack,
  PROJECTION_CHART_VIEWS,
  PROJECTION_DEPLETION_LINE_COLOR,
  PROJECTION_NEGATIVE,
  PROJECTION_POSITIVE,
  PROJECTION_PRIMARY_LINE,
  PROJECTION_RETIREMENT_LINE_COLOR,
  PROJECTION_SECONDARY_LINE,
  PROJECTION_TOOLTIP_HIDDEN_KEYS,
  type ProjectionChartView,
} from "@/lib/retirement/chart-data";
import { ProjectionXAxisLabels } from "@/components/retirement/projection-x-axis-labels";
import {
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  getProjectionAssetColor,
} from "@/lib/portfolio/chart-theme";
import {
  formatProjectionCompactMoney,
  formatProjectionMoney,
  formatProjectionSpending,
} from "@/lib/retirement/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { MonteCarloPercentileBand } from "@/lib/retirement/monte-carlo";
import type { RetirementPlanAsset, YearProjection } from "@/types/retirement";

interface RetirementPlanProjectionsChartProps {
  projections: YearProjection[];
  assets: RetirementPlanAsset[];
  currency: DisplayCurrency;
  rates: FxRates;
  retirementYear: number;
  percentiles?: MonteCarloPercentileBand[];
}

const AXIS_TICK = { fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 };

function buildXAxisTicks(years: number[]): number[] {
  if (years.length <= 8) return years;

  const step = years.length > 24 ? 5 : years.length > 16 ? 4 : 3;
  return years.filter((_, index) => {
    return index % step === 0 || index === years.length - 1;
  });
}

function ProjectionChartTooltip({
  active,
  payload,
  label,
  currency,
  rates,
  chartConfig,
}: {
  active?: boolean;
  payload?: Array<{
    type?: string;
    value?: number | string;
    dataKey?: string | number;
    name?: string | number;
    color?: string;
  }>;
  label?: string | number;
  currency: DisplayCurrency;
  rates: FxRates;
  chartConfig: ChartConfig;
}) {
  if (!active || !payload?.length) return null;

  const seen = new Set<string>();
  const items = payload.filter((item) => {
    const key = String(item.dataKey ?? item.name ?? "value");
    if (
      item.type === "none" ||
      item.value == null ||
      PROJECTION_TOOLTIP_HIDDEN_KEYS.has(key) ||
      seen.has(key)
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return (
    <div className="min-w-[210px] rounded-xl border border-border/40 bg-card/96 px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="mb-2.5 border-b border-border/35 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Year {label}
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "value");
          const configEntry = chartConfig[key as keyof typeof chartConfig];
          const color =
            (configEntry && "color" in configEntry && configEntry.color) ||
            (typeof item.color === "string" ? item.color : PROJECTION_PRIMARY_LINE);

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                  style={{ backgroundColor: String(color) }}
                />
                <span className="truncate text-xs text-muted-foreground">
                  {configEntry?.label ?? key}
                </span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                {key === "lifestyleSpending" || key === "portfolioWithdrawal"
                  ? formatProjectionSpending(
                      Math.abs(Number(item.value)),
                      currency,
                      rates,
                    )
                  : formatProjectionMoney(Number(item.value), currency, rates)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RetirementPlanProjectionsChart({
  projections,
  assets,
  currency,
  rates,
  retirementYear,
  percentiles,
}: RetirementPlanProjectionsChartProps) {
  const [view, setView] = useState<ProjectionChartView>("total-closing");
  const gradientIdPrefix = useId().replace(/:/g, "");

  const chartData = useMemo(
    () => buildProjectionChartData(projections, assets, percentiles),
    [projections, assets, percentiles],
  );
  const showMonteCarloBand = Boolean(
    percentiles &&
      percentiles.length > 0 &&
      chartData.some((row) => row.p90 != null),
  );

  const compositionAssets = useMemo(
    () => sortAssetsForCompositionStack(assets),
    [assets],
  );

  const chartAssets = view === "composition" ? compositionAssets : assets;

  const chartConfig = useMemo(() => {
    const configAssets = view === "composition" ? assets : chartAssets;
    const raw = buildProjectionChartConfig(view, configAssets);
    return raw satisfies ChartConfig;
  }, [view, chartAssets, assets]);

  const assetKeys = useMemo(
    () => chartAssets.map((asset) => `asset_${asset.id}`),
    [chartAssets],
  );

  const yearValues = useMemo(
    () => chartData.map((row) => row.year),
    [chartData],
  );

  const xAxisTicks = useMemo(() => buildXAxisTicks(yearValues), [yearValues]);

  const yDomain = useMemo(
    () => computeProjectionYDomain(chartData, view, assetKeys),
    [chartData, view, assetKeys],
  );

  const depletionYear = useMemo(
    () => findDepletionYear(projections),
    [projections],
  );

  const showRetirementLine = useMemo(
    () => chartData.some((row) => row.year >= retirementYear),
    [chartData, retirementYear],
  );

  const showDepletionLine = useMemo(
    () =>
      depletionYear !== null &&
      chartData.some((row) => row.year === depletionYear),
    [chartData, depletionYear],
  );

  const retirementLineX = retirementYear - 0.5;
  const depletionLineX =
    depletionYear !== null ? depletionYear - 0.5 : null;

  const milestoneLabels = useMemo(() => {
    const items: Array<{
      x: number;
      year: number;
      caption: string;
      color: string;
    }> = [];

    if (showRetirementLine) {
      items.push({
        x: retirementLineX,
        year: retirementYear,
        caption: "Retirement Year",
        color: PROJECTION_RETIREMENT_LINE_COLOR,
      });
    }

    if (showDepletionLine && depletionYear !== null && depletionLineX !== null) {
      items.push({
        x: depletionLineX,
        year: depletionYear,
        caption: "Depletion Year",
        color: PROJECTION_DEPLETION_LINE_COLOR,
      });
    }

    return items;
  }, [
    showRetirementLine,
    showDepletionLine,
    retirementLineX,
    retirementYear,
    depletionLineX,
    depletionYear,
  ]);

  const isBarView =
    view === "appreciation-vs-expenses" ||
    view === "net-change" ||
    view === "income-vs-spend";

  return (
    <AnalyticsChartCard
      title="Portfolio Projections"
      description={
        showMonteCarloBand
          ? "Portfolio if markets are bad, typical, or good — plus the other year-by-year views."
          : "Interactive view of projected portfolio growth and spending"
      }
      contentClassName="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {projections.length} years projected · {assets.length} assets
          {depletionYear !== null && (
            <span className="ml-2 text-xs text-[var(--brand-red)]">
              Depletes {depletionYear}
            </span>
          )}
        </p>
        <Select
          value={view}
          onValueChange={(value) => setView(value as ProjectionChartView)}
        >
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="Chart view" />
          </SelectTrigger>
          <SelectContent>
            {PROJECTION_CHART_VIEWS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.id === "total-closing" && showMonteCarloBand
                  ? "Bad, typical, good"
                  : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <AnalyticsChartEmpty message="Add assets to generate projection charts." />
      ) : (
        <ChartContainer
          config={chartConfig}
          className={cn(
            "aspect-[16/9] h-[440px] w-full",
            "[&_.recharts-cartesian-grid_horizontal_line]:opacity-50",
            "[&_.recharts-reference-line-line]:opacity-95",
          )}
        >
          <ComposedChart
            key={`${view}-${compositionAssets.map((a) => a.id).join(",")}`}
            data={chartData}
            margin={{ top: 12, right: 16, left: 4, bottom: 72 }}
            barCategoryGap={isBarView ? "18%" : undefined}
          >
            <defs>
              <linearGradient
                id={`${gradientIdPrefix}-line-fill`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={PROJECTION_PRIMARY_LINE}
                  stopOpacity={0.42}
                />
                <stop
                  offset="55%"
                  stopColor={PROJECTION_PRIMARY_LINE}
                  stopOpacity={0.12}
                />
                <stop
                  offset="100%"
                  stopColor={PROJECTION_PRIMARY_LINE}
                  stopOpacity={0.01}
                />
              </linearGradient>

              {view === "composition" &&
                compositionAssets.map((asset) => {
                  const color = getProjectionAssetColor(asset.id, assets);
                  return (
                    <linearGradient
                      key={asset.id}
                      id={`${gradientIdPrefix}-area-${asset.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={color} stopOpacity={0.92} />
                      <stop offset="50%" stopColor={color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.18} />
                    </linearGradient>
                  );
                })}
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={CHART_GRID_COLOR}
              strokeOpacity={0.45}
              strokeDasharray="3 8"
            />

            <XAxis
              dataKey="year"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={xAxisTicks}
              tick={false}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={54}
              domain={yDomain}
              tickCount={6}
              allowDataOverflow
              tickFormatter={(value) =>
                formatProjectionCompactMoney(Number(value), currency, rates)
              }
            />

            <ChartTooltip
              cursor={{
                stroke: PROJECTION_RETIREMENT_LINE_COLOR,
                strokeWidth: 1,
                strokeDasharray: "4 4",
                strokeOpacity: 0.35,
              }}
              content={
                <ProjectionChartTooltip
                  currency={currency}
                  rates={rates}
                  chartConfig={chartConfig}
                />
              }
            />

            {showRetirementLine && (
              <ReferenceLine
                x={retirementLineX}
                stroke={PROJECTION_RETIREMENT_LINE_COLOR}
                strokeWidth={0.75}
                strokeDasharray="4 4"
                strokeOpacity={0.9}
                ifOverflow="extendDomain"
              />
            )}

            {showDepletionLine && depletionLineX !== null && (
              <ReferenceLine
                x={depletionLineX}
                stroke={PROJECTION_DEPLETION_LINE_COLOR}
                strokeWidth={0.75}
                strokeDasharray="4 4"
                strokeOpacity={0.9}
                ifOverflow="extendDomain"
              />
            )}

            <ProjectionXAxisLabels
              xAxisTicks={xAxisTicks}
              milestones={milestoneLabels}
            />

            {view === "total-closing" && (
              <>
                {showMonteCarloBand && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="bad"
                      stackId="mc"
                      stroke="none"
                      fill="transparent"
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="spread"
                      stackId="mc"
                      stroke="none"
                      fill={PROJECTION_PRIMARY_LINE}
                      fillOpacity={0.12}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="bad"
                      stroke="var(--brand-orange)"
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="typical"
                      stroke={PROJECTION_PRIMARY_LINE}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: PROJECTION_PRIMARY_LINE,
                        fill: "var(--background)",
                      }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="good"
                      stroke="var(--brand-green-deep)"
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </>
                )}
                {!showMonteCarloBand && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="closingBalance"
                      fill={`url(#${gradientIdPrefix}-line-fill)`}
                      stroke="none"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="closingBalance"
                      stroke={PROJECTION_PRIMARY_LINE}
                      strokeWidth={2.75}
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: PROJECTION_PRIMARY_LINE,
                        fill: "var(--background)",
                      }}
                      isAnimationActive={false}
                    />
                  </>
                )}
              </>
            )}

            {view === "opening-vs-closing" && (
              <>
                <Line
                  type="monotone"
                  dataKey="openingBalance"
                  stroke={PROJECTION_SECONDARY_LINE}
                  strokeWidth={2.25}
                  strokeOpacity={0.9}
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: PROJECTION_SECONDARY_LINE,
                    fill: "var(--background)",
                  }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="closingBalance"
                  stroke={PROJECTION_PRIMARY_LINE}
                  strokeWidth={2.75}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: PROJECTION_PRIMARY_LINE,
                    fill: "var(--background)",
                  }}
                  isAnimationActive={false}
                />
              </>
            )}

            {view === "composition" &&
              compositionAssets.map((asset) => {
                const key = `asset_${asset.id}`;
                const color = getProjectionAssetColor(asset.id, assets);
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="composition"
                    fill={`url(#${gradientIdPrefix}-area-${asset.id}`}
                    stroke={color}
                    strokeWidth={0.75}
                    strokeOpacity={0.55}
                    isAnimationActive={false}
                  />
                );
              })}

            {view === "income-vs-spend" && (
              <>
                <Bar
                  dataKey="income"
                  fill={PROJECTION_POSITIVE}
                  fillOpacity={0.92}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={12}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="lifestyleSpending"
                  fill={PROJECTION_NEGATIVE}
                  fillOpacity={0.88}
                  radius={[0, 0, 5, 5]}
                  maxBarSize={12}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="portfolioWithdrawal"
                  fill={PROJECTION_DEPLETION_LINE_COLOR}
                  fillOpacity={0.8}
                  radius={[0, 0, 5, 5]}
                  maxBarSize={12}
                  isAnimationActive={false}
                />
              </>
            )}

            {view === "appreciation-vs-expenses" && (
              <>
                <Bar
                  dataKey="assetAppreciation"
                  fill={PROJECTION_POSITIVE}
                  fillOpacity={0.92}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="lifestyleSpending"
                  fill={PROJECTION_NEGATIVE}
                  fillOpacity={0.88}
                  radius={[0, 0, 5, 5]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
              </>
            )}

            {view === "net-change" && (
              <Bar
                dataKey="netChange"
                radius={[5, 5, 0, 0]}
                maxBarSize={18}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={
                      entry.netChange >= 0
                        ? PROJECTION_POSITIVE
                        : PROJECTION_NEGATIVE
                    }
                    fillOpacity={0.92}
                  />
                ))}
              </Bar>
            )}

            {view === "post-growth-vs-close" && (
              <>
                <Line
                  type="monotone"
                  dataKey="balanceAfterAppreciation"
                  stroke={PROJECTION_SECONDARY_LINE}
                  strokeWidth={2.25}
                  strokeDasharray="7 5"
                  strokeOpacity={0.92}
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: PROJECTION_SECONDARY_LINE,
                    fill: "var(--background)",
                  }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="closingBalance"
                  stroke={PROJECTION_PRIMARY_LINE}
                  strokeWidth={2.75}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    stroke: PROJECTION_PRIMARY_LINE,
                    fill: "var(--background)",
                  }}
                  isAnimationActive={false}
                />
              </>
            )}

            <ChartLegend
              content={<ChartLegendContent className="pt-3" />}
              wrapperStyle={{ paddingTop: 8 }}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </AnalyticsChartCard>
  );
}
