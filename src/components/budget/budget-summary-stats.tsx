"use client";

import { formatBudgetMoney } from "@/lib/budget/format";
import type { AgeOfMoneyResult } from "@/lib/budget/age-of-money";
import type { MonthBudgetSummary } from "@/lib/budget/calculations";
import { Button } from "@/components/ui/button";
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
      ? "text-[var(--brand-green-text)]"
      : ready < 0
        ? "text-[var(--fg-danger-text)]"
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
      <div
        className={cn(
          "budget-leftover",
          ready > 0 && "budget-leftover--in",
          ready < 0 && "budget-leftover--out",
        )}
      >
        <div className="min-w-0">
          <p className="budget-metric-label">Leftover</p>
          <p
            className={cn(
              "budget-hero-value mt-1",
              readyTone,
              isLoading && "animate-pulse",
            )}
          >
            {formatBudgetMoney(ready, currency)}
          </p>
          {leftoverCaption ? (
            <p className="mt-1.5 max-w-md text-xs leading-snug text-muted-foreground">
              {leftoverCaption}
            </p>
          ) : null}
          {openingLeftover != null && openingLeftover > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Opened with {formatBudgetMoney(openingLeftover, currency)} leftover
              from the closed month.
            </p>
          ) : null}
        </div>
        {onAssignLeftover ? (
          <Button type="button" size="sm" onClick={onAssignLeftover}>
            Assign leftover
          </Button>
        ) : null}
      </div>
      <div className="budget-summary-grid">
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
        <div className="border-t border-border px-4 py-2 sm:px-5">
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
    <div className="flex min-w-0 flex-col justify-center">
      <p className="budget-metric-label">{label}</p>
      <p
        className={cn(
          "budget-metric-value mt-0.5",
          isLoading && "animate-pulse text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
