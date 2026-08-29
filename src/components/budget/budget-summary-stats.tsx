"use client";

import { AGE_OF_MONEY_MIN_OUTFLOWS, type AgeOfMoneyResult } from "@/lib/budget/age-of-money";
import { formatBudgetMoney } from "@/lib/budget/format";
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

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <p className="budget-metric-label">Leftover</p>
        <p
          className={cn(
            "budget-hero-value mt-2",
            readyTone,
            isLoading && "animate-pulse",
          )}
        >
          {formatBudgetMoney(ready, currency)}
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {monthClosed
            ? "This month is closed. Leftover already carried into the next month."
            : ready > 0
              ? "Unassigned money. Put it into envelopes, or leave it to carry when you close the month."
              : ready < 0
                ? "Assigned more than has come in through this month. Move money or record missing income."
                : "Every dollar through this month already has a job."}
        </p>
        {openingLeftover != null && openingLeftover > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Opened with {formatBudgetMoney(openingLeftover, currency)} leftover
            from the closed month.
          </p>
        ) : null}
        {onAssignLeftover ? (
          <button
            type="button"
            onClick={onAssignLeftover}
            className="mt-3 text-sm font-medium text-[var(--brand-green)] underline-offset-2 hover:underline"
          >
            Assign leftover
          </button>
        ) : null}
        <AgeOfMoneyBlock ageOfMoney={ageOfMoney} isLoading={isLoading} />
      </section>

      <div className="budget-panel grid grid-cols-3 divide-x divide-border/60">
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
    </div>
  );
}

function AgeOfMoneyBlock({
  ageOfMoney,
  isLoading,
}: {
  ageOfMoney: AgeOfMoneyResult;
  isLoading?: boolean;
}) {
  if (ageOfMoney.status === "ready" && ageOfMoney.days != null) {
    return (
      <div className="mt-5 border-t border-border/50 pt-4">
        <p className="budget-metric-label">Age of Money</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
            isLoading && "animate-pulse",
          )}
        >
          {ageOfMoney.days} {ageOfMoney.days === 1 ? "day" : "days"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Typical age of the dollars you just spent.
        </p>
      </div>
    );
  }

  if (ageOfMoney.status === "insufficient") {
    const remaining = Math.max(
      0,
      AGE_OF_MONEY_MIN_OUTFLOWS - ageOfMoney.outflowCount,
    );
    return (
      <div className="mt-5 border-t border-border/50 pt-4">
        <p className="budget-metric-label">Age of Money</p>
        <p className="mt-1 text-base font-semibold tracking-tight">
          Not enough history yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {remaining > 0
            ? `${remaining} more spend${remaining === 1 ? "" : "s"} to calculate.`
            : `${ageOfMoney.outflowCount} spends so far.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-border/50 pt-4">
      <p className="budget-metric-label">Age of Money</p>
      <p className="mt-1 text-base font-semibold tracking-tight">—</p>
        <p className="mt-1 text-sm text-muted-foreground">
        Add a few spends to calculate.
      </p>
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
