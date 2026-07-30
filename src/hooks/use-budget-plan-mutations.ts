"use client";

import { useCallback, useMemo } from "react";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { removeAccountFromBudget } from "@/lib/budget/account-mutations";
import {
  removeCategoryFromBudget,
  sortedCategoryGroups,
} from "@/lib/budget/category-mutations";
import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetPlan,
  BudgetTransaction,
  BudgetTransactionType,
  CategoryGoal,
} from "@/types/budget";

export interface AddBudgetTransactionInput {
  date: string;
  payee: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  memo?: string;
  cleared?: boolean;
}

export function useBudgetPlanMutations(planId: string) {
  const { getPlan, updatePlan, isLoaded, syncError, isCloudSynced } =
    useBudgetPlans();
  const plan = getPlan(planId);

  const commitPlan = useCallback(
    (updater: (current: BudgetPlan) => BudgetPlan) => {
      updatePlan(planId, updater);
    },
    [planId, updatePlan],
  );

  const addTransaction = useCallback(
    (input: AddBudgetTransactionInput) => {
      commitPlan((current) => ({
        ...current,
        transactions: [
          ...current.transactions,
          {
            id: crypto.randomUUID(),
            date: input.date,
            payee: input.payee.trim(),
            accountId: input.accountId,
            categoryId: input.categoryId,
            amount: Math.abs(input.amount),
            type: input.type,
            cleared: input.cleared ?? false,
            memo: input.memo?.trim() || undefined,
          },
        ],
      }));
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
          tx.id === transactionId
            ? {
                ...tx,
                date: input.date,
                payee: input.payee.trim(),
                accountId: input.accountId,
                categoryId: input.categoryId,
                amount: Math.abs(input.amount),
                type: input.type,
                cleared: input.cleared ?? tx.cleared,
                memo: input.memo?.trim() || undefined,
              }
            : tx,
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
      commitPlan((current) =>
        removeCategoryFromBudget(current, categoryId) as BudgetPlan,
      );
    },
    [commitPlan],
  );

  const assignToCategory = useCallback(
    (monthKey: string, categoryId: string, amount: number) => {
      commitPlan((current) => {
        const monthBudget = current.monthBudgets[monthKey] ?? { assignments: {} };
        return {
          ...current,
          monthBudgets: {
            ...current.monthBudgets,
            [monthKey]: {
              assignments: {
                ...monthBudget.assignments,
                [categoryId]: Math.max(0, amount),
              },
            },
          },
        };
      });
    },
    [commitPlan],
  );

  const adjustCategoryAssignment = useCallback(
    (monthKey: string, categoryId: string, delta: number) => {
      commitPlan((current) => {
        const monthBudget = current.monthBudgets[monthKey] ?? { assignments: {} };
        const currentAmount = monthBudget.assignments[categoryId] ?? 0;
        return {
          ...current,
          monthBudgets: {
            ...current.monthBudgets,
            [monthKey]: {
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

  const moveMoney = useCallback(
    (
      monthKey: string,
      fromCategoryId: string,
      toCategoryId: string,
      amount: number,
    ) => {
      const transfer = Math.max(0, amount);
      if (transfer === 0 || fromCategoryId === toCategoryId) return;

      commitPlan((current) => {
        const monthBudget = current.monthBudgets[monthKey] ?? { assignments: {} };
        const fromAmount = monthBudget.assignments[fromCategoryId] ?? 0;
        const toAmount = monthBudget.assignments[toCategoryId] ?? 0;
        const moved = Math.min(transfer, fromAmount);

        return {
          ...current,
          monthBudgets: {
            ...current.monthBudgets,
            [monthKey]: {
              assignments: {
                ...monthBudget.assignments,
                [fromCategoryId]: fromAmount - moved,
                [toCategoryId]: toAmount + moved,
              },
            },
          },
        };
      });
    },
    [commitPlan],
  );

  const setCategoryGoal = useCallback(
    (goal: Omit<CategoryGoal, "id"> & { id?: string }) => {
      commitPlan((current) => {
        const existing = current.goals.find(
          (entry) => entry.categoryId === goal.categoryId,
        );
        const nextGoal: CategoryGoal = {
          id: goal.id ?? existing?.id ?? crypto.randomUUID(),
          categoryId: goal.categoryId,
          targetAmount: Math.max(0, goal.targetAmount),
          targetDate: goal.targetDate,
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
    (name: string, type: BudgetAccountType) => {
      commitPlan((current) => ({
        ...current,
        accounts: [
          ...current.accounts,
          {
            id: crypto.randomUUID(),
            name: name.trim(),
            type,
            sortOrder: current.accounts.length,
          },
        ],
      }));
    },
    [commitPlan],
  );

  const updateAccount = useCallback(
    (
      accountId: string,
      updates: { name?: string; type?: BudgetAccountType },
    ) => {
      commitPlan((current) => ({
        ...current,
        accounts: current.accounts.map((account) =>
          account.id === accountId
            ? {
                ...account,
                name: updates.name?.trim() || account.name,
                type: updates.type ?? account.type,
              }
            : account,
        ),
      }));
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
    (transactionId: string, cleared: boolean) => {
      commitPlan((current) => ({
        ...current,
        transactions: current.transactions.map((tx) =>
          tx.id === transactionId ? { ...tx, cleared } : tx,
        ),
      }));
    },
    [commitPlan],
  );

  const finishAccountReconciliation = useCallback(
    (accountId: string) => {
      commitPlan((current) => ({
        ...current,
        accounts: current.accounts.map((account) =>
          account.id === accountId
            ? { ...account, lastReconciledAt: new Date().toISOString() }
            : account,
        ),
      }));
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
      moveMoney,
      setCategoryGoal,
      removeCategoryGoal,
      addAccount,
      updateAccount,
      deleteAccount,
      setTransactionCleared,
      finishAccountReconciliation,
    }),
    [
      plan,
      planId,
      isLoaded,
      syncError,
      isCloudSynced,
      addTransaction,
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
      moveMoney,
      setCategoryGoal,
      removeCategoryGoal,
      addAccount,
      updateAccount,
      deleteAccount,
      setTransactionCleared,
      finishAccountReconciliation,
    ],
  );
}

export type { BudgetCategory, BudgetCategoryGroup, BudgetTransaction };
