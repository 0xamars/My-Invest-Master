"use client";

import { formatBudgetMoney } from "@/lib/budget/format";
import type { AgeOfMoneyResult } from "@/lib/budget/age-of-money";
import type { MonthBudgetSummary } from "@/lib/budget/calculations";
import { cn } from "@/lib/utils";

interface BudgetSummaryStatsProps {
  summary: MonthBudgetSummary;
  ageOfMoney: AgeOfMoneyResult;
  currency?: string;
  isLoading?: boolean;
  monthClosed?: boolean;
  openingLeftover?: number;
  onAssignLeftover?: () => void;
}

export function BudgetSummaryStats({
  summary,
  ageOfMoney,
  currency,
  isLoading,
  monthClosed,
  openingLeftover,
  onAssignLeftover,
}: BudgetSummaryStatsProps) {
  const ready = summary.readyToAssign;
  const readyTone =
    ready > 0
      ? "text-[var(--brand-green)]"
      : ready < 0
        ? "text-[var(--brand-red)]"
        : "text-foreground";

  const leftoverCaption = monthClosed
    ? "This month is closed. Leftover already carried into the next month."
    : ready > 0
      ? "Unassigned money. Put it into envelopes, or leave it to carry when you close the month."
      : ready < 0
        ? "Assigned more than has come in through this month. Move money or record missing income."
        : null;

  return (
    <section className="budget-panel">
      <div className="grid grid-cols-2 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
        <div className="flex flex-col justify-center px-5 py-4">
          <p className="budget-metric-label">Leftover</p>
          <p
            className={cn(
              "budget-hero-value mt-1.5",
              readyTone,
              isLoading && "animate-pulse",
            )}
          >
            {formatBudgetMoney(ready, currency)}
          </p>
          {leftoverCaption ? (
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {leftoverCaption}
            </p>
          ) : null}
          {openingLeftover != null && openingLeftover > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Opened with {formatBudgetMoney(openingLeftover, currency)} leftover
              from the closed month.
            </p>
          ) : null}
          {onAssignLeftover ? (
            <button
              type="button"
              onClick={onAssignLeftover}
              className="mt-2 w-fit text-sm font-medium text-[var(--brand-green)] underline-offset-2 hover:underline"
            >
              Assign leftover
            </button>
          ) : null}
        </div>
        <Metric
          label="Income"
          value={formatBudgetMoney(summary.totalIncome, currency)}
          isLoading={isLoading}
        />
        <Metric
          label="Assigned"
          value={formatBudgetMoney(summary.totalAssigned, currency)}
          isLoading={isLoading}
        />
        <Metric
          label="Spent"
          value={formatBudgetMoney(summary.totalSpent, currency)}
          isLoading={isLoading}
        />
      </div>
      {ageOfMoney.status === "ready" && ageOfMoney.days != null ? (
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Age of Money{" "}
            <span className="font-medium tabular-nums text-foreground">
              {ageOfMoney.days} {ageOfMoney.days === 1 ? "day" : "days"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · typical age of the dollars you just spent
            </span>
          </p>
        </div>
      ) : null}
    </section>
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
    <div className="flex flex-col justify-center px-5 py-4">
      <p className="budget-metric-label">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold tracking-tight tabular-nums",
          isLoading && "animate-pulse text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
