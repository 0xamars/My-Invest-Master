"use client";

import { useMemo, type ReactNode } from "react";
import { Landmark } from "lucide-react";
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
import {
  BudgetEmptyState,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useBudget } from "@/contexts/budget-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import {
  getAvailableToBudgetSeries,
  getIncomeVsExpensesSeries,
  getNetWorthSeries,
  getNetWorthSnapshot,
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
        description="Net worth, spending, cash flow, and Ready to Assign over time."
      />

      <NetWorthReport budget={budget} />

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

function NetWorthReport({
  budget,
}: {
  budget: ReturnType<typeof useBudget>["budget"];
}) {
  const currentMonth = getCurrentMonthKey();
  const snapshot = useMemo(
    () => getNetWorthSnapshot(budget.accounts, budget.transactions, currentMonth),
    [budget.accounts, budget.transactions, currentMonth],
  );
  const series = useMemo(() => getNetWorthSeries(budget, 6), [budget]);
  const netWorthConfig = {
    assets: { label: "Assets", color: BRAND_GREEN },
    liabilities: { label: "Liabilities", color: BRAND_ORANGE },
    netWorth: { label: "Net worth", color: BRAND_GREEN },
  } satisfies ChartConfig;

  if (budget.accounts.length === 0) {
    return (
      <BudgetPanel>
        <BudgetEmptyState
          icon={<Landmark className="size-5" />}
          title="No accounts yet"
          description="Add an on-budget or tracking account to see net worth. Balances come from the plan’s transactions."
        />
      </BudgetPanel>
    );
  }

  return (
    <ChartFrame
      title="Net worth"
      description="On-budget and tracking balances. Assets minus liabilities (cards, lines of credit, mortgages)."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <NetWorthStat label="Assets" value={snapshot.assets} />
        <NetWorthStat label="Liabilities" value={snapshot.liabilities} />
        <NetWorthStat label="Net worth" value={snapshot.netWorth} emphasize />
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <NetWorthAccountList title="Assets" rows={snapshot.assetAccounts} />
        <NetWorthAccountList
          title="Liabilities"
          rows={snapshot.liabilityAccounts}
          liability
        />
      </div>
      {series.every((row) => row.netWorth === 0 && row.assets === 0 && row.liabilities === 0) ? (
        <ChartEmpty message="Record transactions to see net worth over time." />
      ) : (
        <ChartContainer config={netWorthConfig} className="aspect-[16/7] h-[280px] w-full">
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    name === "assets"
                      ? "Assets"
                      : name === "liabilities"
                        ? "Liabilities"
                        : "Net worth",
                  ]}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="assets" fill={BRAND_GREEN} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar
              dataKey="liabilities"
              fill={BRAND_ORANGE}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              stroke={BRAND_GREEN}
              strokeWidth={2.5}
              dot={{ r: 4, fill: BRAND_GREEN, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </ChartFrame>
  );
}

function NetWorthStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          emphasize && value < 0 && "text-[var(--brand-orange)]",
        )}
      >
        {value < 0 ? "−" : ""}
        {formatBudgetMoney(value)}
      </p>
    </div>
  );
}

function NetWorthAccountList({
  title,
  rows,
  liability,
}: {
  title: string;
  rows: Array<{ account: { id: string; name: string }; balance: number }>;
  liability?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">None</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div
            key={row.account.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate">{row.account.name}</span>
            <span
              className={cn(
                "tabular-nums",
                liability && row.balance > 0 && "text-[var(--brand-orange)]",
              )}
            >
              {formatBudgetMoney(row.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
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
