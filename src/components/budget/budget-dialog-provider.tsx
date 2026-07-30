"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BudgetTransactionDialog } from "@/components/budget/budget-transaction-dialog";
import { useBudget } from "@/contexts/budget-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";

interface BudgetDialogContextValue {
  openAddTransaction: () => void;
  openEditTransaction: (transactionId: string) => void;
}

const BudgetDialogContext = createContext<BudgetDialogContextValue | null>(null);

export function BudgetDialogProvider({ children }: { children: ReactNode }) {
  const { budget, addTransaction, updateTransaction } = useBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingTransaction = useMemo(
    () =>
      editingId != null
        ? budget.transactions.find((tx) => tx.id === editingId) ?? null
        : null,
    [budget.transactions, editingId],
  );

  const openAddTransaction = useCallback(() => {
    setEditingId(null);
    setDialogOpen(true);
  }, []);

  const openEditTransaction = useCallback((transactionId: string) => {
    setEditingId(transactionId);
    setDialogOpen(true);
  }, []);

  return (
    <BudgetDialogContext.Provider
      value={{ openAddTransaction, openEditTransaction }}
    >
      {children}
      <BudgetTransactionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
        onSave={(input) => {
          if (editingId) {
            updateTransaction(editingId, input);
          } else {
            addTransaction(input);
          }
        }}
        accounts={budget.accounts}
        categories={budget.categories}
        categoryGroups={budget.categoryGroups}
        defaultMonthKey={getCurrentMonthKey()}
        defaultAccountId={budget.accounts[0]?.id}
        transaction={editingTransaction}
      />
    </BudgetDialogContext.Provider>
  );
}

export function useBudgetDialog() {
  const context = useContext(BudgetDialogContext);
  if (!context) {
    throw new Error("useBudgetDialog must be used within BudgetDialogProvider");
  }
  return context;
}
