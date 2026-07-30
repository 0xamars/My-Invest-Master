"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryBudgetRow } from "@/lib/budget/calculations";
import { formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import type { BudgetCategoryGroup } from "@/types/budget";

interface BudgetCategoryListProps {
  groups: Array<{ group: BudgetCategoryGroup; categories: CategoryBudgetRow[] }>;
  onAssign: (categoryId: string, amount: number) => void;
  onMoveMoney: (fromCategoryId: string) => void;
  onSetGoal: (categoryId: string) => void;
  onAddCategory: (groupId: string) => void;
  onAddGroup: () => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, direction: "up" | "down") => void;
  onEditCategory: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
}

function statusClass(status: CategoryBudgetRow["status"]): string {
  switch (status) {
    case "overspent":
      return "text-[var(--brand-red)]";
    case "low":
      return "text-[var(--brand-orange)]";
    default:
      return "text-[var(--brand-green)]";
  }
}

function statusBg(status: CategoryBudgetRow["status"]): string {
  switch (status) {
    case "overspent":
      return "bg-[var(--brand-red)]/10 ring-[var(--brand-red)]/25";
    case "low":
      return "bg-[var(--brand-orange)]/10 ring-[var(--brand-orange)]/25";
    default:
      return "bg-[var(--brand-green)]/10 ring-[var(--brand-green)]/20";
  }
}

export function BudgetCategoryList({
  groups,
  onAssign,
  onMoveMoney,
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
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Manage groups, assign money, and track spending
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddGroup}>
          <FolderPlus className="size-3.5" />
          Add Group
        </Button>
      </div>

      <div className="divide-y divide-border/40">
        {groups.map(({ group, categories }, groupIndex) => (
          <div key={group.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.name}
              </h3>
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
            </div>

            <div className="hidden grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto] gap-3 border-b border-border/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground md:grid">
              <span>Category</span>
              <span className="text-right">Assigned</span>
              <span className="text-right">Activity</span>
              <span className="text-right">Available</span>
              <span className="text-right">Actions</span>
            </div>

            {categories.length === 0 ? (
              <div className="px-4 py-4 text-xs text-muted-foreground">
                No categories yet.{" "}
                <button
                  type="button"
                  className="text-[var(--brand-green)] hover:underline"
                  onClick={() => onAddCategory(group.id)}
                >
                  Add one
                </button>
              </div>
            ) : (
              categories.map((row) => (
                <div
                  key={row.category.id}
                  className="grid gap-2 border-b border-border/20 px-4 py-3 last:border-b-0 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.category.name}
                    </p>
                    {row.goal && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Target className="size-3 text-[var(--brand-orange)]" />
                        Goal {formatBudgetMoney(row.goal.targetAmount)}
                        {row.goal.targetDate
                          ? ` by ${new Date(`${row.goal.targetDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    )}
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
                        className="h-8 w-28 text-right tabular-nums"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-sm tabular-nums text-foreground hover:text-[var(--brand-green)]"
                      >
                        {formatBudgetMoney(row.assigned)}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <span className="text-[11px] text-muted-foreground md:hidden">
                      Activity
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatBudgetMoney(row.activity)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <span className="text-[11px] text-muted-foreground md:hidden">
                      Available
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1 ring-inset",
                        statusBg(row.status),
                        statusClass(row.status),
                      )}
                    >
                      {formatBudgetMoney(row.available)}
                    </span>
                  </div>

                  <div className="flex justify-end gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onMoveMoney(row.category.id)}
                      aria-label={`Move money from ${row.category.name}`}
                    >
                      <ArrowLeftRight className="size-3.5" />
                    </Button>
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
                  </div>
                </div>
              ))
            )}
          </div>
        ))}

        {flatCategories.length === 0 && groups.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Add a category group to start budgeting.
          </div>
        )}
      </div>
    </div>
  );
}
