"use client";

import { CalendarClock } from "lucide-react";
import { BudgetKindBadge, BudgetMoney, BudgetPanel } from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { FREQUENCY_LABELS } from "@/lib/budget/scheduled";
import type { UpcomingScheduledInstance } from "@/lib/budget/scheduled";
import { getTransactionDisplay } from "@/lib/budget/transactions";
import type { BudgetAccount, BudgetCategory } from "@/types/budget";

interface BudgetUpcomingListProps {
  instances: UpcomingScheduledInstance[];
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  onEdit: (scheduleId: string) => void;
}

export function BudgetUpcomingList({
  instances,
  accounts,
  categories,
  onEdit,
}: BudgetUpcomingListProps) {
  if (instances.length === 0) return null;

  return (
    <BudgetPanel>
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <CalendarClock className="size-3.5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Upcoming</h2>
          <p className="text-xs text-muted-foreground">
            Scheduled rows. They post as normal transactions when this plan is opened on or after the date.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {instances.map((instance) => {
          const display = getTransactionDisplay(
            {
              id: instance.scheduleId,
              date: instance.date,
              payee: instance.payee,
              accountId: instance.accountId,
              categoryId: instance.categoryId,
              amount: instance.amount,
              type: instance.type,
              cleared: false,
              transferAccountId: instance.transferAccountId,
              splits: instance.splits,
            },
            accounts,
            categories,
          );

          return (
            <div
              key={`${instance.scheduleId}-${instance.date}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{display.payee}</p>
                  <BudgetKindBadge kind="scheduled" />
                  {display.isTransfer ? <BudgetKindBadge kind="transfer" /> : null}
                  {display.isSplit ? <BudgetKindBadge kind="split" /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatBudgetDate(instance.date)} · {FREQUENCY_LABELS[instance.frequency]}
                  {display.categoryLabel ? ` · ${display.categoryLabel}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <BudgetMoney
                  className="text-sm font-semibold"
                  value={formatBudgetMoney(instance.amount)}
                  prefix={display.amountPrefix || (display.isTransfer ? "↔ " : "")}
                  tone={
                    display.isTransfer
                      ? "neutral"
                      : display.isInflowLike
                        ? "in"
                        : "out"
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(instance.scheduleId)}
                >
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </BudgetPanel>
  );
}
