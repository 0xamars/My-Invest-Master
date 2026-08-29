"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { removeAccountFromBudget } from "@/lib/budget/account-mutations";
import { applyAssignLeftover } from "@/lib/budget/assign-leftover";
import { applyAutoAssignUnderfunded } from "@/lib/budget/auto-assign";
import {
  applyBulkApprove,
  applyBulkCategorize,
  applyBulkDelete,
  applyBulkToggleCleared,
} from "@/lib/budget/bulk-transactions";
import {
  removeCategoryFromBudget,
  sortedCategoryGroups,
} from "@/lib/budget/category-mutations";
import {
  isClearedForBalance,
  normalizeClearedState,
  toggleClearedState,
} from "@/lib/budget/cleared";
import {
  ensureCreditCardPaymentCategories,
  isCreditCardPaymentsGroup,
  isPaymentCategory,
} from "@/lib/budget/credit-card-payments";
import { isMonthClosed } from "@/lib/budget/closed-months";
import { applyCoverOverspend, applyMoveMoney } from "@/lib/budget/move-money";
import { applyMonthClose } from "@/lib/budget/month-close";
import { applyResetAvailable } from "@/lib/budget/reset-available";
import { enterScheduledNow, materializeDueSchedules } from "@/lib/budget/scheduled";
import { defaultOnBudgetForType } from "@/lib/budget/accounts";
import { transactionTouchesAccount } from "@/lib/budget/transactions";
import type {
  BudgetAccountType,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetClearedState,
  BudgetCurrency,
  BudgetPlan,
  BudgetScheduledTransaction,
  BudgetTransaction,
  BudgetTransactionType,
  CategoryGoal,
  CategoryGoalType,
  RecurringFrequency,
} from "@/types/budget";

const UNDO_LIMIT = 20;

export interface AddBudgetTransactionSplitInput {
  id?: string;
  categoryId: string | null;
  amount: number;
  memo?: string;
}

export interface AddBudgetTransactionInput {
  date: string;
  payee: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  memo?: string;
  cleared?: BudgetClearedState | boolean;
  transferAccountId?: string;
  splits?: AddBudgetTransactionSplitInput[];
  scheduledTransactionId?: string;
  approved?: boolean;
  importId?: string;
  matchedTransactionId?: string;
}

export interface AddBudgetScheduledTransactionInput {
  nextDate: string;
  frequency: RecurringFrequency;
  payee: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  memo?: string;
  transferAccountId?: string;
  splits?: AddBudgetTransactionSplitInput[];
  endDate?: string;
  remainingCount?: number;
}

function toStoredTransaction(
  input: AddBudgetTransactionInput,
  existing?: BudgetTransaction,
): BudgetTransaction {
  const type = input.type;
  const splits =
    type === "outflow" && input.splits && input.splits.length > 0
      ? input.splits.map((line, index) => ({
          id: line.id ?? existing?.splits?.[index]?.id ?? crypto.randomUUID(),
          categoryId: line.categoryId,
          amount: Math.abs(line.amount),
          memo: line.memo?.trim() || undefined,
        }))
      : undefined;

  return {
    id: existing?.id ?? crypto.randomUUID(),
    date: input.date,
    payee: input.payee.trim(),
    accountId: input.accountId,
    categoryId:
      type === "inflow" || type === "transfer" || splits
        ? null
        : input.categoryId,
    amount: Math.abs(input.amount),
    type,
    cleared: normalizeClearedState(input.cleared ?? existing?.cleared),
    memo: input.memo?.trim() || undefined,
    transferAccountId:
      type === "transfer" && input.transferAccountId
        ? input.transferAccountId
        : undefined,
    splits,
    scheduledTransactionId: input.scheduledTransactionId ?? existing?.scheduledTransactionId,
    approved: input.approved ?? existing?.approved ?? true,
    importId: input.importId ?? existing?.importId,
    matchedTransactionId: input.matchedTransactionId ?? existing?.matchedTransactionId,
  };
}

function toStoredSchedule(
  input: AddBudgetScheduledTransactionInput,
  existing?: BudgetScheduledTransaction,
): BudgetScheduledTransaction {
  const type = input.type;
  const splits =
    type === "outflow" && input.splits && input.splits.length > 0
      ? input.splits.map((line, index) => ({
          id: line.id ?? existing?.splits?.[index]?.id ?? crypto.randomUUID(),
          categoryId: line.categoryId,
          amount: Math.abs(line.amount),
          memo: line.memo?.trim() || undefined,
        }))
      : undefined;

  const remainingCount =
    typeof input.remainingCount === "number" && Number.isFinite(input.remainingCount)
      ? Math.max(0, Math.floor(input.remainingCount))
      : undefined;

  return {
    id: existing?.id ?? crypto.randomUUID(),
    nextDate: input.nextDate,
    frequency: input.frequency,
    payee: input.payee.trim(),
    accountId: input.accountId,
    categoryId:
      type === "inflow" || type === "transfer" || splits
        ? null
        : input.categoryId,
    amount: Math.abs(input.amount),
    type,
    memo: input.memo?.trim() || undefined,
    transferAccountId:
      type === "transfer" && input.transferAccountId
        ? input.transferAccountId
        : undefined,
    splits,
    endDate: input.endDate || undefined,
    remainingCount,
    active: existing?.active === false ? false : true,
  };
}

export function useBudgetPlanMutations(planId: string) {
  const { getPlan, updatePlan, isLoaded, syncError, isCloudSynced } =
    useBudgetPlans();
  const plan = getPlan(planId);
  const [undoStack, setUndoStack] = useState<BudgetPlan[]>([]);
  const [lastMutationLabel, setLastMutationLabel] = useState<string | null>(null);
  const undoCaptureRef = useRef<{ snapshot: BudgetPlan; label: string } | null>(
    null,
  );

  const commitPlan = useCallback(
    (
      updater: (current: BudgetPlan) => BudgetPlan,
      options?: { undoable?: boolean; label?: string },
    ) => {
      updatePlan(planId, (current) => {
        const next = updater(current);
        if (next !== current && options?.undoable !== false) {
          undoCaptureRef.current = {
            snapshot: current,
            label: options?.label ?? "Undo",
          };
        }
        return next;
      });
      const captured = undoCaptureRef.current;
      if (captured) {
        undoCaptureRef.current = null;
        setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), captured.snapshot]);
        setLastMutationLabel(captured.label);
      }
    },
    [planId, updatePlan],
  );

  const undoLastMutation = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const snapshot = stack[stack.length - 1];
      updatePlan(planId, () => snapshot);
      setLastMutationLabel(null);
      return stack.slice(0, -1);
    });
  }, [planId, updatePlan]);

  useEffect(() => {
    if (!plan) return;
    const next = materializeDueSchedules(plan);
    if (next !== plan) {
      updatePlan(planId, () => next);
    }
  }, [plan, planId, updatePlan]);

  const addTransaction = useCallback(
    (input: AddBudgetTransactionInput) => {
      commitPlan(
        (current) => ({
          ...current,
          transactions: [...current.transactions, toStoredTransaction(input)],
        }),
        { label: "Undo transaction" },
      );
    },
    [commitPlan],
  );

  const importTransactions = useCallback(
    (inputs: AddBudgetTransactionInput[]) => {
      if (inputs.length === 0) return;
      commitPlan(
        (current) => ({
          ...current,
          transactions: [
            ...current.transactions,
            ...inputs.map((input) =>
              toStoredTransaction({
                ...input,
                approved: input.approved ?? false,
              }),
            ),
          ],
        }),
        { label: "Undo import" },
      );
    },
    [commitPlan],
  );

  const importFromCsv = useCallback(
    (
      inputs: AddBudgetTransactionInput[],
      matches: Array<{ transactionId: string; importId: string }>,
    ) => {
      if (inputs.length === 0 && matches.length === 0) return;
      commitPlan(
        (current) => {
          const matchById = new Map(
            matches.map((match) => [match.transactionId, match.importId]),
          );
          return {
            ...current,
            transactions: [
              ...current.transactions.map((tx) => {
                const importId = matchById.get(tx.id);
                if (!importId) return tx;
                return { ...tx, importId, matchedTransactionId: importId };
              }),
              ...inputs.map((input) =>
                toStoredTransaction({
                  ...input,
                  approved: false,
                }),
              ),
            ],
          };
        },
        { label: "Undo import" },
      );
    },
    [commitPlan],
  );

  const setTransactionApproved = useCallback(
    (transactionId: string, approved: boolean) => {
      commitPlan(
        (current) => ({
          ...current,
          transactions: current.transactions.map((tx) =>
            tx.id === transactionId ? { ...tx, approved } : tx,
          ),
        }),
        { label: approved ? "Undo approve" : "Undo" },
      );
    },
    [commitPlan],
  );

  const deleteTransaction = useCallback(
    (transactionId: string) => {
      commitPlan((current) => ({
        ...current,
        transactions: current.transactions.filter((tx) => tx.id !== transactionId),
      }));
    },
    [commitPlan],
  );

  const updateTransaction = useCallback(
    (transactionId: string, input: AddBudgetTransactionInput) => {
      commitPlan((current) => ({
        ...current,
        transactions: current.transactions.map((tx) =>
          tx.id === transactionId ? toStoredTransaction(input, tx) : tx,
        ),
      }));
    },
    [commitPlan],
  );

  const addCategoryGroup = useCallback(
    (name: string) => {
      commitPlan((current) => {
        const sortOrder = current.categoryGroups.length;
        return {
          ...current,
          categoryGroups: [
            ...current.categoryGroups,
            { id: crypto.randomUUID(), name: name.trim(), sortOrder },
          ],
        };
      });
    },
    [commitPlan],
  );

  const addCategory = useCallback(
    (groupId: string, name: string) => {
      commitPlan((current) => {
        const groupCategories = current.categories.filter(
          (category) => category.groupId === groupId,
        );
        return {
          ...current,
          categories: [
            ...current.categories,
            {
              id: crypto.randomUUID(),
              groupId,
              name: name.trim(),
              sortOrder: groupCategories.length,
            },
          ],
        };
      });
    },
    [commitPlan],
  );

  const updateCategoryGroup = useCallback(
    (groupId: string, name: string) => {
      commitPlan((current) => ({
        ...current,
        categoryGroups: current.categoryGroups.map((group) =>
          group.id === groupId ? { ...group, name: name.trim() } : group,
        ),
      }));
    },
    [commitPlan],
  );

  const moveCategoryGroup = useCallback(
    (groupId: string, direction: "up" | "down") => {
      commitPlan((current) => {
        const ordered = sortedCategoryGroups(current);
        const index = ordered.findIndex((group) => group.id === groupId);
        if (index < 0) return current;

        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= ordered.length) return current;

        const reordered = [...ordered];
        [reordered[index], reordered[swapIndex]] = [
          reordered[swapIndex],
          reordered[index],
        ];

        return {
          ...current,
          categoryGroups: reordered.map((group, sortOrder) => ({
            ...group,
            sortOrder,
          })),
        };
      });
    },
    [commitPlan],
  );

  const deleteCategoryGroup = useCallback(
    (
      groupId: string,
      strategy:
        | { type: "move"; targetGroupId: string }
        | { type: "delete-categories" },
    ) => {
      commitPlan((current) => {
        const group = current.categoryGroups.find((entry) => entry.id === groupId);
        if (group && isCreditCardPaymentsGroup(group)) return current;

        const groupCategories = current.categories.filter(
          (category) => category.groupId === groupId,
        );

        let next = current;

        if (strategy.type === "move") {
          let nextSort = current.categories.filter(
            (category) => category.groupId === strategy.targetGroupId,
          ).length;

          next = {
            ...next,
            categories: next.categories.map((category) => {
              if (category.groupId !== groupId) return category;
              const updated = {
                ...category,
                groupId: strategy.targetGroupId,
                sortOrder: nextSort,
              };
              nextSort += 1;
              return updated;
            }),
          };
        } else {
          for (const category of groupCategories) {
            next = removeCategoryFromBudget(next, category.id) as BudgetPlan;
          }
        }

        return {
          ...next,
          categoryGroups: next.categoryGroups.filter(
            (group) => group.id !== groupId,
          ),
        };
      });
    },
    [commitPlan],
  );

  const updateCategory = useCallback(
    (
      categoryId: string,
      updates: { name?: string; groupId?: string },
    ) => {
      commitPlan((current) => {
        const category = current.categories.find((entry) => entry.id === categoryId);
        if (!category) return current;
        if (isPaymentCategory(category)) return current;

        const nextName = updates.name?.trim() || category.name;
        const nextGroupId = updates.groupId ?? category.groupId;

        if (nextGroupId === category.groupId) {
          return {
            ...current,
            categories: current.categories.map((entry) =>
              entry.id === categoryId ? { ...entry, name: nextName } : entry,
            ),
          };
        }

        const targetCount = current.categories.filter(
          (entry) => entry.groupId === nextGroupId && entry.id !== categoryId,
        ).length;

        return {
          ...current,
          categories: current.categories.map((entry) =>
            entry.id === categoryId
              ? {
                  ...entry,
                  name: nextName,
                  groupId: nextGroupId,
                  sortOrder: targetCount,
                }
              : entry,
          ),
        };
      });
    },
    [commitPlan],
  );

  const deleteCategory = useCallback(
    (categoryId: string) => {
      commitPlan((current) => {
        const category = current.categories.find((entry) => entry.id === categoryId);
        if (category && isPaymentCategory(category)) return current;
        return removeCategoryFromBudget(current, categoryId) as BudgetPlan;
      });
    },
    [commitPlan],
  );

  const assignToCategory = useCallback(
    (monthKey: string, categoryId: string, amount: number) => {
      commitPlan(
        (current) => {
          if (isMonthClosed(current, monthKey)) return current;
          const monthBudget = current.monthBudgets[monthKey] ?? { assignments: {} };
          return {
            ...current,
            monthBudgets: {
              ...current.monthBudgets,
              [monthKey]: {
                ...monthBudget,
                assignments: {
                  ...monthBudget.assignments,
                  [categoryId]: Math.max(0, amount),
                },
              },
            },
          };
        },
        { label: "Undo assign" },
      );
    },
    [commitPlan],
  );

  const adjustCategoryAssignment = useCallback(
    (monthKey: string, categoryId: string, delta: number) => {
      commitPlan((current) => {
        if (isMonthClosed(current, monthKey)) return current;
        const monthBudget = current.monthBudgets[monthKey] ?? { assignments: {} };
        const currentAmount = monthBudget.assignments[categoryId] ?? 0;
        return {
          ...current,
          monthBudgets: {
            ...current.monthBudgets,
            [monthKey]: {
              ...monthBudget,
              assignments: {
                ...monthBudget.assignments,
                [categoryId]: Math.max(0, currentAmount + delta),
              },
            },
          },
        };
      });
    },
    [commitPlan],
  );

  const assignLeftover = useCallback(
    (monthKey: string, allocations: Array<{ categoryId: string; amount: number }>) => {
      commitPlan(
        (current) => applyAssignLeftover(current, monthKey, allocations),
        { label: "Undo assign leftover" },
      );
    },
    [commitPlan],
  );

  const closeMonth = useCallback(
    (monthKey: string) => {
      commitPlan(
        (current) => applyMonthClose(current, monthKey),
        { label: "Undo close month" },
      );
    },
    [commitPlan],
  );

  const moveMoney = useCallback(
    (
      monthKey: string,
      fromCategoryId: string,
      toCategoryId: string,
      amount: number,
    ) => {
      commitPlan(
        (current) => applyMoveMoney(current, monthKey, fromCategoryId, toCategoryId, amount),
        { label: "Undo move" },
      );
    },
    [commitPlan],
  );

  const coverOverspend = useCallback(
    (
      monthKey: string,
      categoryId: string,
      source: { type: "rta" } | { type: "category"; categoryId: string },
      amount: number,
    ) => {
      commitPlan(
        (current) => applyCoverOverspend(current, monthKey, categoryId, source, amount),
        { label: "Undo cover" },
      );
    },
    [commitPlan],
  );

  const autoAssignUnderfunded = useCallback(
    (monthKey: string) => {
      commitPlan(
        (current) => applyAutoAssignUnderfunded(current, monthKey),
        { label: "Undo auto-assign" },
      );
    },
    [commitPlan],
  );

  const resetAvailable = useCallback(
    (monthKey: string, options?: { coverOverspend?: boolean }) => {
      commitPlan(
        (current) => applyResetAvailable(current, monthKey, options),
        { label: "Undo reset available" },
      );
    },
    [commitPlan],
  );

  const bulkCategorizeTransactions = useCallback(
    (transactionIds: string[], categoryId: string | null) => {
      commitPlan(
        (current) => applyBulkCategorize(current, transactionIds, categoryId),
        { label: "Undo categorize" },
      );
    },
    [commitPlan],
  );

  const bulkApproveTransactions = useCallback(
    (transactionIds: string[]) => {
      commitPlan(
        (current) => applyBulkApprove(current, transactionIds, true),
        { label: "Undo approve" },
      );
    },
    [commitPlan],
  );

  const bulkDeleteTransactions = useCallback(
    (transactionIds: string[]) => {
      commitPlan(
        (current) => applyBulkDelete(current, transactionIds),
        { label: "Undo delete" },
      );
    },
    [commitPlan],
  );

  const bulkToggleClearedTransactions = useCallback(
    (transactionIds: string[]) => {
      commitPlan(
        (current) => applyBulkToggleCleared(current, transactionIds),
        { label: "Undo cleared" },
      );
    },
    [commitPlan],
  );

  const enterScheduledTransactionNow = useCallback(
    (scheduleId: string) => {
      commitPlan(
        (current) => enterScheduledNow(current, scheduleId),
        { label: "Undo enter now" },
      );
    },
    [commitPlan],
  );

  const setPlanCurrency = useCallback(
    (currency: BudgetCurrency) => {
      commitPlan(
        (current) => ({ ...current, currency }),
        { label: "Undo currency" },
      );
    },
    [commitPlan],
  );

  const setCategoryGoal = useCallback(
    (
      goal: Omit<CategoryGoal, "id" | "type"> & {
        id?: string;
        type?: CategoryGoalType;
      },
    ) => {
      commitPlan((current) => {
        const existing = current.goals.find(
          (entry) => entry.categoryId === goal.categoryId,
        );
        const type: CategoryGoalType = goal.type ?? existing?.type ?? "target-balance";
        const nextGoal: CategoryGoal = {
          id: goal.id ?? existing?.id ?? crypto.randomUUID(),
          categoryId: goal.categoryId,
          type,
          targetAmount: Math.max(0, goal.targetAmount),
          targetDate:
            type === "monthly-funding"
              ? undefined
              : goal.targetDate || undefined,
          label: goal.label?.trim() || undefined,
        };

        return {
          ...current,
          goals: existing
            ? current.goals.map((entry) =>
                entry.categoryId === goal.categoryId ? nextGoal : entry,
              )
            : [...current.goals, nextGoal],
        };
      });
    },
    [commitPlan],
  );

  const removeCategoryGoal = useCallback(
    (categoryId: string) => {
      commitPlan((current) => ({
        ...current,
        goals: current.goals.filter((goal) => goal.categoryId !== categoryId),
      }));
    },
    [commitPlan],
  );

  const addAccount = useCallback(
    (name: string, type: BudgetAccountType, onBudget?: boolean) => {
      commitPlan((current) =>
        ensureCreditCardPaymentCategories({
          ...current,
          accounts: [
            ...current.accounts,
            {
              id: crypto.randomUUID(),
              name: name.trim(),
              type,
              onBudget: onBudget ?? defaultOnBudgetForType(type),
              sortOrder: current.accounts.length,
            },
          ],
        }),
      );
    },
    [commitPlan],
  );

  const updateAccount = useCallback(
    (
      accountId: string,
      updates: {
        name?: string;
        type?: BudgetAccountType;
        onBudget?: boolean;
      },
    ) => {
      commitPlan((current) =>
        ensureCreditCardPaymentCategories({
          ...current,
          accounts: current.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  name: updates.name?.trim() || account.name,
                  type: updates.type ?? account.type,
                  onBudget: updates.onBudget ?? account.onBudget,
                }
              : account,
          ),
        }),
      );
    },
    [commitPlan],
  );

  const deleteAccount = useCallback(
    (
      accountId: string,
      strategy:
        | { type: "move"; targetAccountId: string }
        | { type: "delete-transactions" },
    ) => {
      commitPlan((current) => {
        if (current.accounts.length <= 1) return current;
        return removeAccountFromBudget(current, accountId, strategy);
      });
    },
    [commitPlan],
  );

  const setTransactionCleared = useCallback(
    (transactionId: string, cleared: BudgetClearedState) => {
      commitPlan(
        (current) => ({
          ...current,
          transactions: current.transactions.map((tx) => {
            if (tx.id !== transactionId) return tx;
            if (tx.cleared === "reconciled") return tx;
            return { ...tx, cleared };
          }),
        }),
        { label: "Undo cleared" },
      );
    },
    [commitPlan],
  );

  const cycleTransactionCleared = useCallback(
    (transactionId: string) => {
      commitPlan(
        (current) => ({
          ...current,
          transactions: current.transactions.map((tx) => {
            if (tx.id !== transactionId) return tx;
            return { ...tx, cleared: toggleClearedState(tx.cleared) };
          }),
        }),
        { label: "Undo cleared" },
      );
    },
    [commitPlan],
  );

  const addScheduledTransaction = useCallback(
    (input: AddBudgetScheduledTransactionInput) => {
      commitPlan((current) =>
        materializeDueSchedules({
          ...current,
          scheduledTransactions: [
            ...(current.scheduledTransactions ?? []),
            toStoredSchedule(input),
          ],
        }),
      );
    },
    [commitPlan],
  );

  const updateScheduledTransaction = useCallback(
    (scheduleId: string, input: AddBudgetScheduledTransactionInput) => {
      commitPlan((current) =>
        materializeDueSchedules({
          ...current,
          scheduledTransactions: (current.scheduledTransactions ?? []).map(
            (schedule) =>
              schedule.id === scheduleId
                ? toStoredSchedule(input, { ...schedule, active: true })
                : schedule,
          ),
        }),
      );
    },
    [commitPlan],
  );

  const deleteScheduledTransaction = useCallback(
    (scheduleId: string) => {
      commitPlan((current) => ({
        ...current,
        scheduledTransactions: (current.scheduledTransactions ?? []).filter(
          (schedule) => schedule.id !== scheduleId,
        ),
      }));
    },
    [commitPlan],
  );

  const finishAccountReconciliation = useCallback(
    (accountId: string) => {
      commitPlan(
        (current) => ({
          ...current,
          accounts: current.accounts.map((account) =>
            account.id === accountId
              ? { ...account, lastReconciledAt: new Date().toISOString() }
              : account,
          ),
          transactions: current.transactions.map((tx) => {
            if (!transactionTouchesAccount(tx, accountId)) return tx;
            if (!isClearedForBalance(tx.cleared) || tx.cleared === "reconciled") {
              return tx;
            }
            return { ...tx, cleared: "reconciled" as const };
          }),
        }),
        { label: "Undo reconcile" },
      );
    },
    [commitPlan],
  );

  return useMemo(
    () => ({
      plan,
      budget: plan,
      planId,
      isLoaded,
      syncError,
      isCloudSynced,
      addTransaction,
      importTransactions,
      importFromCsv,
      setTransactionApproved,
      updateTransaction,
      deleteTransaction,
      addCategoryGroup,
      addCategory,
      updateCategoryGroup,
      moveCategoryGroup,
      deleteCategoryGroup,
      updateCategory,
      deleteCategory,
      assignToCategory,
      adjustCategoryAssignment,
      assignLeftover,
      closeMonth,
      moveMoney,
      coverOverspend,
      autoAssignUnderfunded,
      resetAvailable,
      bulkCategorizeTransactions,
      bulkApproveTransactions,
      bulkDeleteTransactions,
      bulkToggleClearedTransactions,
      enterScheduledTransactionNow,
      setPlanCurrency,
      setCategoryGoal,
      removeCategoryGoal,
      addAccount,
      updateAccount,
      deleteAccount,
      setTransactionCleared,
      cycleTransactionCleared,
      finishAccountReconciliation,
      addScheduledTransaction,
      updateScheduledTransaction,
      deleteScheduledTransaction,
      undoLastMutation,
      canUndo: undoStack.length > 0,
      lastMutationLabel,
    }),
    [
      plan,
      planId,
      isLoaded,
      syncError,
      isCloudSynced,
      addTransaction,
      importTransactions,
      importFromCsv,
      setTransactionApproved,
      updateTransaction,
      deleteTransaction,
      addCategoryGroup,
      addCategory,
      updateCategoryGroup,
      moveCategoryGroup,
      deleteCategoryGroup,
      updateCategory,
      deleteCategory,
      assignToCategory,
      adjustCategoryAssignment,
      assignLeftover,
      closeMonth,
      moveMoney,
      coverOverspend,
      autoAssignUnderfunded,
      resetAvailable,
      bulkCategorizeTransactions,
      bulkApproveTransactions,
      bulkDeleteTransactions,
      bulkToggleClearedTransactions,
      enterScheduledTransactionNow,
      setPlanCurrency,
      setCategoryGoal,
      removeCategoryGoal,
      addAccount,
      updateAccount,
      deleteAccount,
      setTransactionCleared,
      cycleTransactionCleared,
      finishAccountReconciliation,
      addScheduledTransaction,
      updateScheduledTransaction,
      deleteScheduledTransaction,
      undoLastMutation,
      undoStack.length,
      lastMutationLabel,
    ],
  );
}

export type { BudgetCategory, BudgetCategoryGroup, BudgetTransaction };
