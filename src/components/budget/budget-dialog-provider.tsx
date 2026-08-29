"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AddCategoryDialog,
  AddCategoryGroupDialog,
} from "@/components/budget/add-category-dialog";
import { BudgetScheduledDialog } from "@/components/budget/budget-scheduled-dialog";
import { BudgetTransactionDialog } from "@/components/budget/budget-transaction-dialog";
import { useBudget } from "@/contexts/budget-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { isCreditCardPaymentsGroup } from "@/lib/budget/credit-card-payments";
import { derivePayees } from "@/lib/budget/payees";

interface BudgetDialogContextValue {
  openAddTransaction: () => void;
  openEditTransaction: (transactionId: string) => void;
  openAddScheduled: () => void;
  openEditScheduled: (scheduleId: string) => void;
  openAddGroup: () => void;
  openAddEnvelope: (groupId?: string) => void;
}

const BudgetDialogContext = createContext<BudgetDialogContextValue | null>(null);

export function BudgetDialogProvider({ children }: { children: ReactNode }) {
  const {
    budget,
    addTransaction,
    updateTransaction,
    addScheduledTransaction,
    updateScheduledTransaction,
    deleteScheduledTransaction,
    addCategoryGroup,
    addCategory,
  } = useBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [envelopeGroupId, setEnvelopeGroupId] = useState<string | null>(null);

  const editingTransaction = useMemo(
    () =>
      editingId != null
        ? budget.transactions.find((tx) => tx.id === editingId) ?? null
        : null,
    [budget.transactions, editingId],
  );

  const editingSchedule = useMemo(
    () =>
      editingScheduleId != null
        ? (budget.scheduledTransactions ?? []).find(
            (schedule) => schedule.id === editingScheduleId,
          ) ?? null
        : null,
    [budget.scheduledTransactions, editingScheduleId],
  );

  const envelopeGroups = useMemo(
    () =>
      budget.categoryGroups.filter((group) => !isCreditCardPaymentsGroup(group)),
    [budget.categoryGroups],
  );

  const activeGroup = envelopeGroups.find((group) => group.id === envelopeGroupId);

  const openAddTransaction = useCallback(() => {
    setEditingId(null);
    setDialogOpen(true);
  }, []);

  const openEditTransaction = useCallback((transactionId: string) => {
    setEditingId(transactionId);
    setDialogOpen(true);
  }, []);

  const openAddScheduled = useCallback(() => {
    setEditingScheduleId(null);
    setScheduledOpen(true);
  }, []);

  const openEditScheduled = useCallback((scheduleId: string) => {
    setEditingScheduleId(scheduleId);
    setScheduledOpen(true);
  }, []);

  const openAddGroup = useCallback(() => {
    setGroupOpen(true);
  }, []);

  const openAddEnvelope = useCallback((groupId?: string) => {
    setEnvelopeGroupId(groupId ?? envelopeGroups[0]?.id ?? null);
    setEnvelopeOpen(true);
  }, [envelopeGroups]);

  return (
    <BudgetDialogContext.Provider
      value={{
        openAddTransaction,
        openEditTransaction,
        openAddScheduled,
        openEditScheduled,
        openAddGroup,
        openAddEnvelope,
      }}
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
        payees={derivePayees(budget.transactions)}
        currency={budget.currency}
      />
      <BudgetScheduledDialog
        open={scheduledOpen}
        onOpenChange={(open) => {
          setScheduledOpen(open);
          if (!open) setEditingScheduleId(null);
        }}
        onSave={(input) => {
          if (editingScheduleId) {
            updateScheduledTransaction(editingScheduleId, input);
          } else {
            addScheduledTransaction(input);
          }
        }}
        onDelete={
          editingScheduleId
            ? () => deleteScheduledTransaction(editingScheduleId)
            : undefined
        }
        accounts={budget.accounts}
        categories={budget.categories}
        categoryGroups={budget.categoryGroups}
        defaultAccountId={budget.accounts[0]?.id}
        schedule={editingSchedule}
      />
      <AddCategoryGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        onAdd={addCategoryGroup}
      />
      <AddCategoryDialog
        open={envelopeOpen}
        onOpenChange={(open) => {
          setEnvelopeOpen(open);
          if (!open) setEnvelopeGroupId(null);
        }}
        groupName={activeGroup?.name}
        groups={envelopeGroups.map((group) => ({ id: group.id, name: group.name }))}
        defaultGroupId={envelopeGroupId}
        onAdd={(name, groupId) => {
          const target = groupId ?? envelopeGroupId ?? envelopeGroups[0]?.id;
          if (target) addCategory(target, name);
        }}
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
