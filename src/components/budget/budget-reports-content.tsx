"use client";

import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { BudgetPageHeader, BudgetPanel } from "@/components/budget/budget-ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useBudget } from "@/contexts/budget-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import {
  getAvailableToBudgetSeries,
  getIncomeVsExpensesSeries,
  getSpendingByCategory,
} from "@/lib/budget/reports";
import {
  BRAND_GREEN,
  BRAND_ORANGE,
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  getChartSeriesColor,
} from "@/lib/portfolio/chart-theme";
import { shiftMonthKey, formatMonthLabel } from "@/types/budget";

const AXIS_TICK = { fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 };

export function BudgetReportsContent() {
  const { budget } = useBudget();
  const currentMonth = getCurrentMonthKey();
  const lastMonth = shiftMonthKey(currentMonth, -1);

  const thisMonthSpending = useMemo(
    () => getSpendingByCategory(budget, currentMonth),
    [budget, currentMonth],
  );
  const lastMonthSpending = useMemo(
    () => getSpendingByCategory(budget, lastMonth),
    [budget, lastMonth],
  );

  const cashFlowSeries = useMemo(
    () => getIncomeVsExpensesSeries(budget, 6),
    [budget],
  );

  const availableSeries = useMemo(
    () => getAvailableToBudgetSeries(budget, 6),
    [budget],
  );

  const cashFlowConfig = {
    income: { label: "Income", color: BRAND_GREEN },
    expenses: { label: "Expenses", color: BRAND_ORANGE },
  } satisfies ChartConfig;

  const availableConfig = {
    available: { label: "Available to Budget", color: BRAND_GREEN },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Reports"
        description="Spending, cash flow, and Ready to Assign over time."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SpendingByCategoryChart
          title={`Spending by Category — ${formatMonthLabel(currentMonth)}`}
          data={thisMonthSpending}
        />
        <SpendingByCategoryChart
          title={`Spending by Category — ${formatMonthLabel(lastMonth)}`}
          data={lastMonthSpending}
        />
      </div>

      <ChartFrame
        title="Income vs Expenses"
        description="Monthly cash flow over the last 6 months"
      >
        {cashFlowSeries.every((row) => row.income === 0 && row.expenses === 0) ? (
          <ChartEmpty message="Add transactions to see income and expense trends." />
        ) : (
          <ChartContainer config={cashFlowConfig} className="aspect-[16/7] h-[280px] w-full">
            <BarChart data={cashFlowSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke={CHART_GRID_COLOR}
                strokeOpacity={0.45}
                strokeDasharray="3 8"
              />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(value) => formatBudgetMoney(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      formatBudgetMoney(Number(value)),
                      name === "income" ? "Income" : "Expenses",
                    ]}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" fill={BRAND_GREEN} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" fill={BRAND_ORANGE} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartFrame>

      <ChartFrame
        title="Ready to Assign"
        description="Balance over the last 6 months"
      >
        {availableSeries.every((row) => row.available === 0) ? (
          <ChartEmpty message="Assign income to categories to track Ready to Assign." />
        ) : (
          <ChartContainer config={availableConfig} className="aspect-[16/7] h-[280px] w-full">
            <ComposedChart data={availableSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke={CHART_GRID_COLOR}
                strokeOpacity={0.45}
                strokeDasharray="3 8"
              />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(value) => formatBudgetMoney(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [
                      formatBudgetMoney(Number(value)),
                      "Available",
                    ]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="available"
                stroke={BRAND_GREEN}
                strokeWidth={2.5}
                dot={{ r: 4, fill: BRAND_GREEN, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </ChartFrame>
    </div>
  );
}

function ChartFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <BudgetPanel>
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="px-4 pb-5">{children}</div>
    </BudgetPanel>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SpendingByCategoryChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ categoryId: string; categoryName: string; amount: number }>;
}) {
  const chartData = data.slice(0, 8).map((row, index) => ({
    ...row,
    label: row.categoryName,
    fill: getChartSeriesColor(index),
  }));

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      amount: { label: "Spent", color: BRAND_ORANGE },
    };
    for (const row of chartData) {
      config[row.categoryId] = { label: row.categoryName, color: row.fill };
    }
    return config;
  }, [chartData]);

  return (
    <ChartFrame title={title} description="Top categories by spending">
      {chartData.length === 0 ? (
        <ChartEmpty message="No spending recorded for this month." />
      ) : (
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: Math.max(220, chartData.length * 36 + 32) }}
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
              width={100}
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => [
                    formatBudgetMoney(Number(value)),
                    (item.payload as { label: string }).label,
                  ]}
                />
              }
            />
            <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {chartData.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </ChartFrame>
  );
}
