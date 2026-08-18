"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  BudgetAvailableChip,
  BudgetEmptyState,
  BudgetGoalBar,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryBudgetRow } from "@/lib/budget/calculations";
import { isCreditCardPaymentsGroup } from "@/lib/budget/credit-card-payments";
import { formatBudgetMoney, formatBudgetMoneySigned } from "@/lib/budget/format";
import { GOAL_TYPE_LABELS } from "@/lib/budget/goals";
import { cn } from "@/lib/utils";
import type { BudgetCategoryGroup } from "@/types/budget";

interface BudgetCategoryListProps {
  groups: Array<{ group: BudgetCategoryGroup; categories: CategoryBudgetRow[] }>;
  currency?: string;
  readyToAssign?: number;
  onAssign: (categoryId: string, amount: number) => void;
  onMoveMoney: (fromCategoryId: string) => void;
  onCoverOverspend: (categoryId: string) => void;
  onAutoAssignUnderfunded: () => void;
  onSetGoal: (categoryId: string) => void;
  onAddCategory: (groupId: string) => void;
  onAddGroup: () => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, direction: "up" | "down") => void;
  onEditCategory: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export function BudgetCategoryList({
  groups,
  currency,
  readyToAssign = 0,
  onAssign,
  onMoveMoney,
  onCoverOverspend,
  onAutoAssignUnderfunded,
  onSetGoal,
  onAddCategory,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onMoveGroup,
  onEditCategory,
  onDeleteCategory,
}: BudgetCategoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState("");

  const flatCategories = useMemo(
    () => groups.flatMap((entry) => entry.categories),
    [groups],
  );

  const underfundedCount = useMemo(
    () =>
      flatCategories.filter((row) => {
        if (row.goalProgress?.status === "underfunded") return true;
        return row.isPaymentCategory && row.available < 0;
      }).length,
    [flatCategories],
  );

  const canAutoAssign = readyToAssign > 0 && underfundedCount > 0;

  function startEdit(row: CategoryBudgetRow) {
    setEditingId(row.category.id);
    setDraftAmount(String(row.assigned));
  }

  function commitEdit(categoryId: string) {
    const parsed = Number.parseFloat(draftAmount);
    if (!Number.isNaN(parsed)) {
      onAssign(categoryId, parsed);
    }
    setEditingId(null);
    setDraftAmount("");
  }

  return (
    <BudgetPanel>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Assign this month. Cover red cash overspend before the month rolls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAutoAssign ? (
            <Button type="button" size="sm" onClick={onAutoAssignUnderfunded}>
              <Sparkles className="size-3.5" />
              Auto-Assign Underfunded
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onAddGroup}>
            <FolderPlus className="size-3.5" />
            Add Group
          </Button>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(4.25rem,1fr))_5.5rem] gap-3 border-y border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground md:grid sm:px-5">
        <span>Category</span>
        <span className="text-right">Assigned</span>
        <span className="text-right">Activity</span>
        <span className="text-right">Available</span>
        <span className="text-right"> </span>
      </div>

      {flatCategories.length === 0 && groups.length === 0 ? (
        <BudgetEmptyState
          icon={<FolderPlus className="size-5" />}
          title="Start with a group"
          description="Add a category group, then give every dollar a job."
          actions={
            <Button type="button" onClick={onAddGroup}>
              <FolderPlus className="size-4" />
              Add Group
            </Button>
          }
        />
      ) : (
        <div>
          {groups.map(({ group, categories }, groupIndex) => {
            const paymentGroup = isCreditCardPaymentsGroup(group);
            return (
            <div key={group.id} className="border-b border-border/40 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/25 px-4 py-2 sm:px-5">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {group.name}
                  </h3>
                  {paymentGroup ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Card spend moves money here. Paying the card is a transfer.
                    </p>
                  ) : null}
                </div>
                {paymentGroup ? null : (
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={groupIndex === 0}
                    onClick={() => onMoveGroup(group.id, "up")}
                    aria-label={`Move ${group.name} up`}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={groupIndex === groups.length - 1}
                    onClick={() => onMoveGroup(group.id, "down")}
                    aria-label={`Move ${group.name} down`}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEditGroup(group.id)}
                    aria-label={`Edit ${group.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDeleteGroup(group.id)}
                    aria-label={`Delete ${group.name}`}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-1"
                    onClick={() => onAddCategory(group.id)}
                  >
                    <Plus className="size-3.5" />
                    Category
                  </Button>
                </div>
                )}
              </div>

              {categories.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
                  {paymentGroup ? (
                    "Payment categories appear automatically for credit cards and lines of credit."
                  ) : (
                    <>
                      No categories yet.{" "}
                      <button
                        type="button"
                        className="font-medium text-[var(--brand-green)] hover:underline"
                        onClick={() => onAddCategory(group.id)}
                      >
                        Add one
                      </button>
                    </>
                  )}
                </div>
              ) : (
                categories.map((row) => {
                  const overspent = row.available < 0;
                  return (
                  <div
                    key={row.category.id}
                    className={cn(
                      "budget-category-row grid gap-2 px-4 py-2.5 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(4.25rem,1fr))_5.5rem] md:items-center md:gap-3 sm:px-5",
                      row.status === "overspent" && "budget-row-overspent",
                      row.status === "credit-overspent" &&
                        "budget-row-credit-overspent",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.category.name}</p>
                      {row.goal && row.goalProgress ? (
                        <div className="mt-1.5 max-w-xs">
                          <BudgetGoalBar
                            assigned={row.goalProgress.assignedThisMonth}
                            needed={row.goalProgress.neededThisMonth}
                            onTrack={row.goalProgress.status === "on-track"}
                          />
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>
                              {GOAL_TYPE_LABELS[row.goal.type] ??
                                GOAL_TYPE_LABELS["target-balance"]}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                                row.goalProgress.status === "on-track"
                                  ? "bg-[var(--brand-green)]/12 text-[var(--brand-green)]"
                                  : "bg-[var(--brand-orange)]/12 text-[var(--brand-orange)]",
                              )}
                            >
                              {row.goalProgress.status === "on-track"
                                ? "On track"
                                : "Underfunded"}
                            </span>
                          </p>
                        </div>
                      ) : null}
                      {row.isPaymentCategory ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Card payment
                          {row.creditOverspend > 0
                            ? ` · underfunded ${formatBudgetMoney(row.creditOverspend, currency)}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="text-[11px] text-muted-foreground md:hidden">
                        Assigned
                      </span>
                      {editingId === row.category.id ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draftAmount}
                          onChange={(event) => setDraftAmount(event.target.value)}
                          onBlur={() => commitEdit(row.category.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(row.category.id);
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 w-24 text-right tabular-nums"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-md px-1.5 py-0.5 text-sm tabular-nums hover:bg-muted"
                        >
                          {formatBudgetMoney(row.assigned, currency)}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="text-[11px] text-muted-foreground md:hidden">
                        Activity
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {row.activity === 0
                          ? "—"
                          : row.isPaymentCategory
                            ? formatBudgetMoneySigned(-row.activity, currency)
                            : formatBudgetMoney(row.activity, currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="text-[11px] text-muted-foreground md:hidden">
                        Available
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <BudgetAvailableChip status={row.status}>
                          {row.available < 0 ? "−" : ""}
                          {formatBudgetMoney(row.available, currency)}
                        </BudgetAvailableChip>
                        {overspent ? (
                          <Button
                            type="button"
                            size="xs"
                            variant={row.status === "overspent" ? "default" : "outline"}
                            onClick={() => onCoverOverspend(row.category.id)}
                          >
                            Cover
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="budget-row-actions flex justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMoveMoney(row.category.id)}
                        aria-label={`Move money from ${row.category.name}`}
                      >
                        <ArrowLeftRight className="size-3.5" />
                      </Button>
                      {row.isPaymentCategory ? null : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onSetGoal(row.category.id)}
                            aria-label={`Set goal for ${row.category.name}`}
                          >
                            <Target className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEditCategory(row.category.id)}
                            aria-label={`Edit ${row.category.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDeleteCategory(row.category.id)}
                            aria-label={`Delete ${row.category.name}`}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
            );
          })}
        </div>
      )}
    </BudgetPanel>
  );
}
