"use client";

import { formatBudgetMoney } from "@/lib/budget/format";
import type { MonthBudgetSummary } from "@/lib/budget/calculations";
import { cn } from "@/lib/utils";

interface BudgetSummaryStatsProps {
  summary: MonthBudgetSummary;
  isLoading?: boolean;
}

export function BudgetSummaryStats({
  summary,
  isLoading,
}: BudgetSummaryStatsProps) {
  const ready = summary.readyToAssign;
  const readyTone =
    ready > 0
      ? "text-[var(--brand-green)]"
      : ready < 0
        ? "text-[var(--brand-red)]"
        : "text-foreground";

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <p className="budget-metric-label">Ready to Assign</p>
        <p
          className={cn(
            "budget-hero-value mt-2",
            readyTone,
            isLoading && "animate-pulse",
          )}
        >
          {formatBudgetMoney(ready)}
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {ready > 0
            ? "Income waiting for a job. Assign it to categories — leftovers carry into later months."
            : ready < 0
              ? "Assigned more than has come in through this month. Move money or record missing income."
              : "Every dollar through this month already has a job."}
        </p>
      </section>

      <div className="budget-panel grid grid-cols-3 divide-x divide-border/60">
        <Metric
          label="Income"
          value={formatBudgetMoney(summary.totalIncome)}
          isLoading={isLoading}
        />
        <Metric
          label="Assigned"
          value={formatBudgetMoney(summary.totalAssigned)}
          isLoading={isLoading}
        />
        <Metric
          label="Spent"
          value={formatBudgetMoney(summary.totalSpent)}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-4 sm:px-5">
      <p className="budget-metric-label">{label}</p>
      <p
        className={cn(
          "budget-metric-value mt-1.5",
          isLoading && "animate-pulse text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
