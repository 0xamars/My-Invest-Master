"use client";

import { StatCard } from "@/components/ui/stat-card";
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
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Available to Budget"
        value={formatBudgetMoney(summary.availableToBudget)}
        valueClassName={cn(
          summary.availableToBudget >= 0
            ? "text-[var(--brand-green)]"
            : "text-[var(--brand-red)]",
        )}
        isLoading={isLoading}
      />
      <StatCard
        label="Income This Month"
        value={formatBudgetMoney(summary.totalIncome)}
        isLoading={isLoading}
      />
      <StatCard
        label="Assigned / Spent"
        value={`${formatBudgetMoney(summary.totalAssigned)} / ${formatBudgetMoney(summary.totalSpent)}`}
        isLoading={isLoading}
      />
      <StatCard
        label="Ready to Assign"
        value={formatBudgetMoney(summary.readyToAssign)}
        valueClassName={cn(
          summary.readyToAssign >= 0
            ? "text-[var(--brand-green)]"
            : "text-[var(--brand-red)]",
        )}
        isLoading={isLoading}
      />
    </div>
  );
}
