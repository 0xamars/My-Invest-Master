"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Plus } from "lucide-react";
import {
  BudgetKindBadge,
  BudgetMoney,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
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
  AutoAssignUnderfundedDialog,
  CoverOverspendDialog,
  MoveMoneyDialog,
  ResetAvailableDialog,
  SetCategoryGoalDialog,
} from "@/components/budget/budget-dialogs";
import { BudgetMonthNav } from "@/components/budget/budget-month-nav";
import { BudgetSummaryStats } from "@/components/budget/budget-summary-stats";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/contexts/budget-context";
import { computeAgeOfMoney } from "@/lib/budget/age-of-money";
import {
  buildCategoryRows,
  computeMonthSummary,
  getCurrentMonthKey,
  getSortedTransactions,
} from "@/lib/budget/calculations";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { getTransactionDisplay } from "@/lib/budget/transactions";

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
    coverOverspend,
    autoAssignUnderfunded,
    resetAvailable,
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
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverCategoryId, setCoverCategoryId] = useState<string | null>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [resetAvailableOpen, setResetAvailableOpen] = useState(false);
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

  const ageOfMoney = useMemo(
    () => computeAgeOfMoney(budget.transactions, budget.accounts),
    [budget.transactions, budget.accounts],
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

  function accountName(accountId: string): string {
    return (
      budget.accounts.find((account) => account.id === accountId)?.name ??
      "Unknown"
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="This month"
        description="Give every dollar a job. Leftover Ready to Assign and category available carry forward."
        action={
          <>
            <BudgetMonthNav monthKey={monthKey} onMonthChange={setMonthKey} />
            <Button type="button" onClick={openAddTransaction}>
              <Plus className="size-4" />
              Add
            </Button>
          </>
        }
      />

      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/10 px-4 py-3 text-sm text-[var(--brand-red)]">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      <BudgetSummaryStats
        summary={summary}
        ageOfMoney={ageOfMoney}
        currency={budget.currency}
        isLoading={!isLoaded}
      />

      <BudgetCategoryList
        groups={categoryRows}
        currency={budget.currency}
        readyToAssign={summary.readyToAssign}
        onAssign={(categoryId, amount) =>
          assignToCategory(monthKey, categoryId, amount)
        }
        onMoveMoney={(categoryId) => {
          setMoveFromCategoryId(categoryId);
          setMoveOpen(true);
        }}
        onCoverOverspend={(categoryId) => {
          setCoverCategoryId(categoryId);
          setCoverOpen(true);
        }}
        onAutoAssignUnderfunded={() => setAutoAssignOpen(true)}
        onResetAvailable={() => setResetAvailableOpen(true)}
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

      <BudgetPanel>
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Recent</h2>
            <p className="text-xs text-muted-foreground">This month on the register</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            render={<Link href={`/budget/plans/${planId}/transactions`} />}
          >
            Register
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-4 pb-6 text-sm text-muted-foreground sm:px-5">
            No activity this month yet.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {recentTransactions.map((tx) => {
              const display = getTransactionDisplay(
                tx,
                budget.accounts,
                budget.categories,
              );
              const accountLabel =
                tx.type === "transfer" && tx.transferAccountId
                  ? `${accountName(tx.accountId)} → ${accountName(tx.transferAccountId)}`
                  : accountName(tx.accountId);

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{display.payee}</p>
                      {display.isTransfer ? <BudgetKindBadge kind="transfer" /> : null}
                      {display.isSplit ? <BudgetKindBadge kind="split" /> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBudgetDate(tx.date)} · {accountLabel} ·{" "}
                      {display.categoryLabel}
                    </p>
                  </div>
                  <BudgetMoney
                    className="shrink-0 text-sm font-semibold"
                    value={formatBudgetMoney(tx.amount, budget.currency)}
                    prefix={display.amountPrefix || (display.isTransfer ? "↔ " : "")}
                    tone={
                      display.isTransfer
                        ? "neutral"
                        : display.isInflowLike
                          ? "in"
                          : "out"
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </BudgetPanel>

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
        available={
          moveFromCategoryId
            ? categoryRows
                .flatMap((entry) => entry.categories)
                .find((row) => row.category.id === moveFromCategoryId)?.available
            : undefined
        }
        currency={budget.currency}
        onMove={(fromCategoryId, toCategoryId, amount) =>
          moveMoney(monthKey, fromCategoryId, toCategoryId, amount)
        }
      />

      <CoverOverspendDialog
        open={coverOpen}
        onOpenChange={setCoverOpen}
        categoryName={
          budget.categories.find((category) => category.id === coverCategoryId)
            ?.name
        }
        overspend={Math.max(
          0,
          -(
            categoryRows
              .flatMap((entry) => entry.categories)
              .find((row) => row.category.id === coverCategoryId)?.available ?? 0
          ),
        )}
        overspendKind={
          categoryRows
            .flatMap((entry) => entry.categories)
            .find((row) => row.category.id === coverCategoryId)?.overspendKind ??
          null
        }
        readyToAssign={summary.readyToAssign}
        sources={categoryRows
          .flatMap((entry) => entry.categories)
          .filter(
            (row) =>
              row.category.id !== coverCategoryId && row.available > 0,
          )
          .map((row) => ({
            id: row.category.id,
            name: row.category.name,
            available: row.available,
          }))}
        currency={budget.currency}
        onCover={(source, amount) => {
          if (!coverCategoryId) return;
          coverOverspend(monthKey, coverCategoryId, source, amount);
        }}
      />

      <AutoAssignUnderfundedDialog
        open={autoAssignOpen}
        onOpenChange={setAutoAssignOpen}
        budget={budget}
        monthKey={monthKey}
        currency={budget.currency}
        onConfirm={() => autoAssignUnderfunded(monthKey)}
      />

      <ResetAvailableDialog
        open={resetAvailableOpen}
        onOpenChange={setResetAvailableOpen}
        budget={budget}
        monthKey={monthKey}
        currency={budget.currency}
        onConfirm={(options) => resetAvailable(monthKey, options)}
      />

      <SetCategoryGoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        categoryName={activeCategory?.name}
        initialType={activeGoal?.type}
        initialTarget={activeGoal?.targetAmount}
        initialTargetDate={activeGoal?.targetDate}
        onSave={(type, targetAmount, targetDate) => {
          if (!goalCategoryId) return;
          setCategoryGoal({
            categoryId: goalCategoryId,
            type,
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
