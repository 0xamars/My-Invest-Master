"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Plus } from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import {
  AddCategoryDialog,
  AddCategoryGroupDialog,
} from "@/components/budget/add-category-dialog";
import {
  DeleteCategoryDialog,
  DeleteCategoryGroupDialog,
  EditCategoryDialog,
  EditCategoryGroupDialog,
} from "@/components/budget/category-management-dialogs";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
import { BudgetCategoryList } from "@/components/budget/budget-category-list";
import {
  MoveMoneyDialog,
  SetCategoryGoalDialog,
} from "@/components/budget/budget-dialogs";
import { BudgetMonthNav } from "@/components/budget/budget-month-nav";
import { BudgetSummaryStats } from "@/components/budget/budget-summary-stats";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/contexts/budget-context";
import {
  buildCategoryRows,
  computeMonthSummary,
  getCurrentMonthKey,
  getSortedTransactions,
} from "@/lib/budget/calculations";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";

export function BudgetContent() {
  const {
    budget,
    planId,
    isLoaded,
    syncError,
    addCategoryGroup,
    addCategory,
    updateCategoryGroup,
    moveCategoryGroup,
    deleteCategoryGroup,
    updateCategory,
    deleteCategory,
    assignToCategory,
    moveMoney,
    setCategoryGoal,
    removeCategoryGoal,
  } = useBudget();
  const { openAddTransaction } = useBudgetDialog();

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
  const [groupOpen, setGroupOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryGroupId, setCategoryGroupId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFromCategoryId, setMoveFromCategoryId] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalCategoryId, setGoalCategoryId] = useState<string | null>(null);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const summary = useMemo(
    () => computeMonthSummary(budget, monthKey),
    [budget, monthKey],
  );

  const categoryRows = useMemo(
    () => buildCategoryRows(budget, monthKey),
    [budget, monthKey],
  );

  const recentTransactions = useMemo(() => {
    return getSortedTransactions(budget.transactions)
      .filter((tx) => tx.date.startsWith(monthKey))
      .slice(0, 5);
  }, [budget.transactions, monthKey]);

  const activeGroup = budget.categoryGroups.find(
    (group) => group.id === categoryGroupId,
  );
  const activeCategory = budget.categories.find(
    (category) => category.id === goalCategoryId,
  );
  const activeGoal = budget.goals.find(
    (goal) => goal.categoryId === goalCategoryId,
  );
  const editingGroup = budget.categoryGroups.find(
    (group) => group.id === editGroupId,
  );
  const deletingGroup = budget.categoryGroups.find(
    (group) => group.id === deleteGroupId,
  );
  const editingCategory = budget.categories.find(
    (category) => category.id === editCategoryId,
  );
  const deletingCategory = budget.categories.find(
    (category) => category.id === deleteCategoryId,
  );
  const deleteGroupCategoryCount = deletingGroup
    ? budget.categories.filter((category) => category.groupId === deletingGroup.id)
        .length
    : 0;
  const otherGroupsForDelete = deletingGroup
    ? budget.categoryGroups.filter((group) => group.id !== deletingGroup.id)
    : [];

  function categoryName(categoryId: string | null): string {
    if (!categoryId) return "Ready to Assign";
    return (
      budget.categories.find((category) => category.id === categoryId)?.name ??
      "Unknown"
    );
  }

  function accountName(accountId: string): string {
    return (
      budget.accounts.find((account) => account.id === accountId)?.name ??
      "Unknown"
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <CategoryPageHeader
        category="budget"
        title="Budget"
        description="Give every dollar a job — track income, assign spending, and stay in control."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BudgetMonthNav monthKey={monthKey} onMonthChange={setMonthKey} />
            <Button type="button" onClick={openAddTransaction}>
              <Plus className="size-4" />
              Add Transaction
            </Button>
          </div>
        }
      />

      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/10 px-4 py-3 text-sm text-[var(--brand-red)]">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      <BudgetSummaryStats summary={summary} isLoading={!isLoaded} />

      <BudgetCategoryList
        groups={categoryRows}
        onAssign={(categoryId, amount) =>
          assignToCategory(monthKey, categoryId, amount)
        }
        onMoveMoney={(categoryId) => {
          setMoveFromCategoryId(categoryId);
          setMoveOpen(true);
        }}
        onSetGoal={(categoryId) => {
          setGoalCategoryId(categoryId);
          setGoalOpen(true);
        }}
        onAddCategory={(groupId) => {
          setCategoryGroupId(groupId);
          setCategoryOpen(true);
        }}
        onAddGroup={() => setGroupOpen(true)}
        onEditGroup={(groupId) => {
          setEditGroupId(groupId);
          setEditGroupOpen(true);
        }}
        onDeleteGroup={(groupId) => {
          setDeleteGroupId(groupId);
          setDeleteGroupOpen(true);
        }}
        onMoveGroup={(groupId, direction) => moveCategoryGroup(groupId, direction)}
        onEditCategory={(categoryId) => {
          setEditCategoryId(categoryId);
          setEditCategoryOpen(true);
        }}
        onDeleteCategory={(categoryId) => {
          setDeleteCategoryId(categoryId);
          setDeleteCategoryOpen(true);
        }}
      />

      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Recent Transactions
            </h2>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            render={<Link href={`/budget/plans/${planId}/transactions`} />}
          >
            View all
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No transactions this month yet.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.payee}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBudgetDate(tx.date)} · {accountName(tx.accountId)} ·{" "}
                    {categoryName(tx.categoryId)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    tx.type === "inflow"
                      ? "text-[var(--brand-green)]"
                      : "text-[var(--brand-orange)]",
                  )}
                >
                  {tx.type === "inflow" ? "+" : "−"}
                  {formatBudgetMoney(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCategoryGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        onAdd={addCategoryGroup}
      />

      <AddCategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        groupName={activeGroup?.name}
        onAdd={(name) => {
          if (categoryGroupId) addCategory(categoryGroupId, name);
        }}
      />

      <MoveMoneyDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        fromCategoryId={moveFromCategoryId}
        categories={budget.categories}
        onMove={(fromCategoryId, toCategoryId, amount) =>
          moveMoney(monthKey, fromCategoryId, toCategoryId, amount)
        }
      />

      <SetCategoryGoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        categoryName={activeCategory?.name}
        initialTarget={activeGoal?.targetAmount}
        initialTargetDate={activeGoal?.targetDate}
        onSave={(targetAmount, targetDate) => {
          if (!goalCategoryId) return;
          setCategoryGoal({
            categoryId: goalCategoryId,
            targetAmount,
            targetDate,
          });
        }}
        onRemove={
          activeGoal && goalCategoryId
            ? () => {
                removeCategoryGoal(goalCategoryId);
                setGoalOpen(false);
              }
            : undefined
        }
      />

      <EditCategoryGroupDialog
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
        group={editingGroup ?? null}
        onSave={(name) => {
          if (editGroupId) updateCategoryGroup(editGroupId, name);
        }}
      />

      <DeleteCategoryGroupDialog
        open={deleteGroupOpen}
        onOpenChange={setDeleteGroupOpen}
        group={deletingGroup ?? null}
        categoryCount={deleteGroupCategoryCount}
        otherGroups={otherGroupsForDelete}
        onDeleteEmpty={() => {
          if (deleteGroupId) {
            deleteCategoryGroup(deleteGroupId, { type: "delete-categories" });
          }
        }}
        onMoveCategories={(targetGroupId) => {
          if (deleteGroupId) {
            deleteCategoryGroup(deleteGroupId, {
              type: "move",
              targetGroupId,
            });
          }
        }}
        onDeleteWithCategories={() => {
          if (deleteGroupId) {
            deleteCategoryGroup(deleteGroupId, { type: "delete-categories" });
          }
        }}
      />

      <EditCategoryDialog
        open={editCategoryOpen}
        onOpenChange={setEditCategoryOpen}
        category={editingCategory ?? null}
        categoryGroups={budget.categoryGroups}
        onSave={(name, groupId) => {
          if (editCategoryId) updateCategory(editCategoryId, { name, groupId });
        }}
      />

      <DeleteCategoryDialog
        open={deleteCategoryOpen}
        onOpenChange={setDeleteCategoryOpen}
        category={deletingCategory ?? null}
        onConfirm={() => {
          if (deleteCategoryId) deleteCategory(deleteCategoryId);
        }}
      />
    </div>
  );
}
