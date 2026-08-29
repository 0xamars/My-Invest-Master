"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CategoryBudgetRow } from "@/lib/budget/calculations";
import { isCreditCardPaymentsGroup } from "@/lib/budget/credit-card-payments";
import { formatBudgetMoney, formatBudgetMoneySigned } from "@/lib/budget/format";
import { GOAL_TYPE_LABELS } from "@/lib/budget/goals";
import { cn } from "@/lib/utils";
import type { BudgetCategoryGroup } from "@/types/budget";

const ENVELOPE_GRID =
  "md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(5.5rem,1fr))_2.75rem]";

function EnvelopeRowMenu({
  name,
  monthClosed,
  overspent,
  isPaymentCategory,
  onCoverOverspend,
  onMoveMoney,
  onSetGoal,
  onRename,
  onDelete,
  className,
}: {
  name: string;
  monthClosed: boolean;
  overspent: boolean;
  isPaymentCategory: boolean;
  onCoverOverspend: () => void;
  onMoveMoney: () => void;
  onSetGoal: () => void;
  onRename: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label={`${name} actions`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        {overspent && !monthClosed ? (
          <DropdownMenuItem onClick={onCoverOverspend}>
            Cover overspend
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={monthClosed} onClick={onMoveMoney}>
          <ArrowLeftRight className="size-4" />
          Move money
        </DropdownMenuItem>
        {isPaymentCategory ? null : (
          <>
            <DropdownMenuItem onClick={onSetGoal}>
              <Target className="size-4" />
              Set goal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface BudgetCategoryListProps {
  groups: Array<{ group: BudgetCategoryGroup; categories: CategoryBudgetRow[] }>;
  currency?: string;
  readyToAssign?: number;
  monthClosed?: boolean;
  onAssign: (categoryId: string, amount: number) => void;
  onMoveMoney: (fromCategoryId: string) => void;
  onCoverOverspend: (categoryId: string) => void;
  onAutoAssignUnderfunded: () => void;
  onResetAvailable: () => void;
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
  monthClosed = false,
  onAssign,
  onMoveMoney,
  onCoverOverspend,
  onAutoAssignUnderfunded,
  onResetAvailable,
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

  const leftoverCount = useMemo(
    () =>
      flatCategories.filter(
        (row) => !row.isPaymentCategory && row.available > 0,
      ).length,
    [flatCategories],
  );

  const canAutoAssign = readyToAssign > 0 && underfundedCount > 0;
  const canResetAvailable = leftoverCount > 0;

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
          <h2 className="text-sm font-semibold tracking-tight">Envelopes</h2>
          <p className="text-xs text-muted-foreground">
            {monthClosed
              ? "This month is closed. Envelope balances already carried forward."
              : "Fund envelopes this month. Cover red cash overspend before you close."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!monthClosed && canResetAvailable ? (
            <Button type="button" variant="outline" size="sm" onClick={onResetAvailable}>
              <RotateCcw className="size-3.5" />
              Reset Available
            </Button>
          ) : null}
          {!monthClosed && canAutoAssign ? (
            <Button type="button" size="sm" variant="outline" onClick={onAutoAssignUnderfunded}>
              <Sparkles className="size-3.5" />
              Auto-Assign Underfunded
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onAddGroup}>
            <FolderPlus className="size-3.5" />
            Add group
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "hidden gap-3 border-y border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground md:grid sm:px-5",
          ENVELOPE_GRID,
        )}
      >
        <span>Envelope</span>
        <span className="text-right">Assigned</span>
        <span className="text-right">Activity</span>
        <span className="text-right">Available</span>
        <span className="text-right">Actions</span>
      </div>

      {flatCategories.length === 0 && groups.length === 0 ? (
        <BudgetEmptyState
          icon={<FolderPlus className="size-5" />}
          title="Start with a group"
          description="Add an envelope group, then give every dollar a job."
          actions={
            <Button type="button" onClick={onAddGroup}>
              <FolderPlus className="size-4" />
              Add group
            </Button>
          }
        />
      ) : (
        <div>
          {groups.map(({ group, categories }, groupIndex) => {
            const paymentGroup = isCreditCardPaymentsGroup(group);
            return (
            <div key={group.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center justify-between gap-2 bg-muted/50 px-4 py-2 sm:px-5 md:grid md:gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(5.5rem,1fr))_2.75rem]">
                <div className="min-w-0">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {group.name}
                  </h3>
                  {paymentGroup ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Card spend moves money here. Paying the card is a transfer.
                    </p>
                  ) : null}
                </div>
                <span className="hidden md:block" />
                <span className="hidden md:block" />
                <span className="hidden md:block" />
                <div className="flex justify-end">
                  {paymentGroup ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${group.name} actions`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => onAddCategory(group.id)}>
                          <Plus className="size-4" />
                          Add envelope
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditGroup(group.id)}>
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={groupIndex === 0}
                          onClick={() => onMoveGroup(group.id, "up")}
                        >
                          <ChevronUp className="size-4" />
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={groupIndex === groups.length - 1}
                          onClick={() => onMoveGroup(group.id, "down")}
                        >
                          <ChevronDown className="size-4" />
                          Move down
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteGroup(group.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {categories.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
                  {paymentGroup ? (
                    "Payment envelopes appear automatically for credit cards and lines of credit."
                  ) : (
                    <>
                      No envelopes yet.{" "}
                      <button
                        type="button"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
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
                      "budget-category-row grid min-h-12 items-center gap-2 px-4 py-2 md:gap-3 sm:px-5",
                      ENVELOPE_GRID,
                      row.status === "overspent" && "budget-row-overspent",
                      row.status === "credit-overspent" &&
                        "budget-row-credit-overspent",
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
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
                                "text-[10px] font-semibold uppercase tracking-[0.06em]",
                                row.goalProgress.status === "on-track"
                                  ? "text-[var(--brand-green)]"
                                  : "text-[var(--brand-orange)]",
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
                      <div className="shrink-0 md:hidden">
                        <EnvelopeRowMenu
                          name={row.category.name}
                          monthClosed={monthClosed}
                          overspent={overspent}
                          isPaymentCategory={row.isPaymentCategory}
                          onCoverOverspend={() => onCoverOverspend(row.category.id)}
                          onMoveMoney={() => onMoveMoney(row.category.id)}
                          onSetGoal={() => onSetGoal(row.category.id)}
                          onRename={() => onEditCategory(row.category.id)}
                          onDelete={() => onDeleteCategory(row.category.id)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="text-[11px] text-muted-foreground md:hidden">
                        Assigned
                      </span>
                      {editingId === row.category.id && !monthClosed ? (
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
                          onClick={() => {
                            if (monthClosed) return;
                            startEdit(row);
                          }}
                          disabled={monthClosed}
                          className="rounded-md px-1.5 py-0.5 text-sm tabular-nums hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
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
                      <BudgetAvailableChip status={row.status} available={row.available}>
                        {row.available < 0 ? "−" : ""}
                        {formatBudgetMoney(row.available, currency)}
                      </BudgetAvailableChip>
                    </div>

                    <div className="hidden justify-end md:flex">
                      <EnvelopeRowMenu
                        name={row.category.name}
                        monthClosed={monthClosed}
                        overspent={overspent}
                        isPaymentCategory={row.isPaymentCategory}
                        onCoverOverspend={() => onCoverOverspend(row.category.id)}
                        onMoveMoney={() => onMoveMoney(row.category.id)}
                        onSetGoal={() => onSetGoal(row.category.id)}
                        onRename={() => onEditCategory(row.category.id)}
                        onDelete={() => onDeleteCategory(row.category.id)}
                        className="budget-row-actions"
                      />
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
