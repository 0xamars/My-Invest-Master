"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useBudgetPlanMutations,
  type AddBudgetScheduledTransactionInput,
  type AddBudgetTransactionInput,
} from "@/hooks/use-budget-plan-mutations";
import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetClearedState,
  BudgetCurrency,
  BudgetPlan,
  BudgetTransaction,
  CategoryGoalType,
} from "@/types/budget";

interface BudgetContextValue {
  plan: BudgetPlan | undefined;
  budget: BudgetPlan | undefined;
  planId: string;
  isLoaded: boolean;
  syncError: string | null;
  isCloudSynced: boolean;
  addTransaction: (input: AddBudgetTransactionInput) => void;
  importTransactions: (inputs: AddBudgetTransactionInput[]) => void;
  importFromCsv: (
    inputs: AddBudgetTransactionInput[],
    matches: Array<{ transactionId: string; importId: string }>,
  ) => void;
  setTransactionApproved: (transactionId: string, approved: boolean) => void;
  updateTransaction: (
    transactionId: string,
    input: AddBudgetTransactionInput,
  ) => void;
  deleteTransaction: (transactionId: string) => void;
  addCategoryGroup: (name: string) => void;
  addCategory: (groupId: string, name: string) => void;
  updateCategoryGroup: (groupId: string, name: string) => void;
  moveCategoryGroup: (groupId: string, direction: "up" | "down") => void;
  deleteCategoryGroup: (
    groupId: string,
    strategy:
      | { type: "move"; targetGroupId: string }
      | { type: "delete-categories" },
  ) => void;
  updateCategory: (
    categoryId: string,
    updates: { name?: string; groupId?: string },
  ) => void;
  deleteCategory: (categoryId: string) => void;
  assignToCategory: (monthKey: string, categoryId: string, amount: number) => void;
  adjustCategoryAssignment: (
    monthKey: string,
    categoryId: string,
    delta: number,
  ) => void;
  moveMoney: (
    monthKey: string,
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
  ) => void;
  coverOverspend: (
    monthKey: string,
    categoryId: string,
    source: { type: "rta" } | { type: "category"; categoryId: string },
    amount: number,
  ) => void;
  autoAssignUnderfunded: (monthKey: string) => void;
  resetAvailable: (
    monthKey: string,
    options?: { coverOverspend?: boolean },
  ) => void;
  bulkCategorizeTransactions: (
    transactionIds: string[],
    categoryId: string | null,
  ) => void;
  bulkApproveTransactions: (transactionIds: string[]) => void;
  bulkDeleteTransactions: (transactionIds: string[]) => void;
  bulkToggleClearedTransactions: (transactionIds: string[]) => void;
  enterScheduledTransactionNow: (scheduleId: string) => void;
  setPlanCurrency: (currency: BudgetCurrency) => void;
  setCategoryGoal: (goal: {
    id?: string;
    categoryId: string;
    type?: CategoryGoalType;
    targetAmount: number;
    targetDate?: string;
    label?: string;
  }) => void;
  removeCategoryGoal: (categoryId: string) => void;
  addAccount: (
    name: string,
    type: BudgetAccountType,
    onBudget?: boolean,
  ) => void;
  updateAccount: (
    accountId: string,
    updates: { name?: string; type?: BudgetAccountType; onBudget?: boolean },
  ) => void;
  deleteAccount: (
    accountId: string,
    strategy:
      | { type: "move"; targetAccountId: string }
      | { type: "delete-transactions" },
  ) => void;
  setTransactionCleared: (
    transactionId: string,
    cleared: BudgetClearedState,
  ) => void;
  cycleTransactionCleared: (transactionId: string) => void;
  finishAccountReconciliation: (accountId: string) => void;
  undoLastMutation: () => void;
  canUndo: boolean;
  lastMutationLabel: string | null;
  addScheduledTransaction: (input: AddBudgetScheduledTransactionInput) => void;
  updateScheduledTransaction: (
    scheduleId: string,
    input: AddBudgetScheduledTransactionInput,
  ) => void;
  deleteScheduledTransaction: (scheduleId: string) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetPlanProvider({
  planId,
  children,
}: {
  planId: string;
  children: ReactNode;
}) {
  const value = useBudgetPlanMutations(planId);
  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error("useBudget must be used within BudgetPlanProvider");
  }
  if (!context.budget) {
    throw new Error("Budget plan not found");
  }
  return context as BudgetContextValue & { budget: BudgetPlan; plan: BudgetPlan };
}

export type { BudgetTransaction, BudgetCategory, BudgetCategoryGroup };
