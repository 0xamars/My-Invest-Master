"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { useBudget } from "@/contexts/budget-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import {
  getAvailableToBudgetSeries,
  getIncomeVsExpensesForMonths,
  getNetWorthSeries,
  getNetWorthSnapshot,
  getSpendingByCategoryInRange,
  getSpendingByPayee,
  REPORT_RANGE_LABELS,
  REPORT_RANGE_PRESETS,
  resolveReportDateRange,
  type ReportRangePreset,
} from "@/lib/budget/reports";
import {
  BRAND_GREEN,
  BRAND_ORANGE,
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  getChartSeriesColor,
} from "@/lib/portfolio/chart-theme";
import { formatMonthLabel } from "@/types/budget";

const AXIS_TICK = { fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 };

export function BudgetReportsContent() {
  const { budget, planId } = useBudget();
  const [preset, setPreset] = useState<ReportRangePreset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () =>
      resolveReportDateRange(preset, {
        fromDate: customFrom || undefined,
        toDate: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  const spending = useMemo(
    () => getSpendingByCategoryInRange(budget, range.fromDate, range.toDate),
    [budget, range.fromDate, range.toDate],
  );
  const payeeSpending = useMemo(
    () => getSpendingByPayee(budget, range.fromDate, range.toDate),
    [budget, range.fromDate, range.toDate],
  );
  const cashFlowSeries = useMemo(
    () => getIncomeVsExpensesForMonths(budget, range.monthKeys),
    [budget, range.monthKeys],
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

  const rangeLabel =
    range.monthKeys.length === 1
      ? formatMonthLabel(range.monthKeys[0]!)
      : `${formatMonthLabel(range.monthKeys[0]!)} – ${formatMonthLabel(range.monthKeys[range.monthKeys.length - 1]!)}`;

  function registerHref(query: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const suffix = params.toString();
    return `/budget/plans/${planId}/transactions${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Reports"
        description="Spending, payees, and cash flow for a date range. Click a category or payee bar to open matching register rows."
      />

      <BudgetPanel>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Date range</h2>
            <p className="text-xs text-muted-foreground">
              Applies to Spending, Payees, and Income vs Expenses.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_RANGE_PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="outline"
                className="budget-range-chip"
                data-active={preset === value}
                onClick={() => setPreset(value)}
              >
                {REPORT_RANGE_LABELS[value]}
              </Button>
            ))}
          </div>
        </div>
        {preset === "custom" ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-border/50 px-4 py-3 sm:px-5">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">From</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">To</span>
              <Input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </BudgetPanel>

      <NetWorthReport budget={budget} />

      <div className="grid gap-6 xl:grid-cols-2">
        <SpendingByCategoryChart
          title={`Spending by Category — ${rangeLabel}`}
          data={spending}
          hrefForRow={(row) =>
            registerHref({
              category: row.categoryId,
              from: range.fromDate,
              to: range.toDate,
            })
          }
        />
        <PayeeSpendingChart
          title={`Spending by Payee — ${rangeLabel}`}
          data={payeeSpending}
          hrefForRow={(row) =>
            registerHref({
              payee: row.payee,
              from: range.fromDate,
              to: range.toDate,
            })
          }
        />
      </div>

      <ChartFrame
        title="Income vs Expenses"
        description={`Monthly cash flow · ${rangeLabel}`}
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
  hrefForRow,
}: {
  title: string;
  data: Array<{ categoryId: string; categoryName: string; amount: number }>;
  hrefForRow: (row: { categoryId: string }) => string;
}) {
  return (
    <HorizontalSpendChart
      title={title}
      description="Top categories by spending. Click a bar to open the register."
      empty="No spending recorded for this range."
      rows={data.slice(0, 8).map((row) => ({
        key: row.categoryId,
        label: row.categoryName,
        amount: row.amount,
        href: hrefForRow(row),
      }))}
    />
  );
}

function PayeeSpendingChart({
  title,
  data,
  hrefForRow,
}: {
  title: string;
  data: Array<{ payee: string; amount: number }>;
  hrefForRow: (row: { payee: string }) => string;
}) {
  return (
    <HorizontalSpendChart
      title={title}
      description="Top payees by spending. Click a bar to open the register."
      empty="No payee spending recorded for this range."
      rows={data.slice(0, 8).map((row) => ({
        key: row.payee,
        label: row.payee,
        amount: row.amount,
        href: hrefForRow(row),
      }))}
    />
  );
}

function HorizontalSpendChart({
  title,
  description,
  empty,
  rows,
}: {
  title: string;
  description: string;
  empty: string;
  rows: Array<{ key: string; label: string; amount: number; href: string }>;
}) {
  const chartData = rows.map((row, index) => ({
    ...row,
    fill: getChartSeriesColor(index),
  }));

  const router = useRouter();
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      amount: { label: "Spent", color: BRAND_ORANGE },
    };
    for (const row of chartData) {
      config[row.key] = { label: row.label, color: row.fill };
    }
    return config;
  }, [chartData]);

  return (
    <ChartFrame title={title} description={description}>
      {chartData.length === 0 ? (
        <ChartEmpty message={empty} />
      ) : (
        <>
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
              <Bar
                dataKey="amount"
                radius={[0, 6, 6, 0]}
                maxBarSize={18}
                cursor="pointer"
                onClick={(data) => {
                  const href = (data as { href?: string } | undefined)?.href;
                  if (href) router.push(href);
                }}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap gap-1.5 px-1">
            {chartData.map((row) => (
              <Button
                key={row.key}
                type="button"
                size="xs"
                variant="outline"
                render={<Link href={row.href} />}
              >
                {row.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </ChartFrame>
  );
}
