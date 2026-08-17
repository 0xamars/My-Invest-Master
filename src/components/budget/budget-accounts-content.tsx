"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Landmark,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { AccountDialog } from "@/components/budget/account-dialog";
import { BudgetReconcileDialog } from "@/components/budget/budget-reconcile-dialog";
import { DeleteAccountDialog } from "@/components/budget/delete-account-dialog";
import {
  BudgetEmptyState,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/contexts/budget-context";
import {
  ACCOUNT_TYPE_LABELS,
  formatAccountBalanceLabel,
  getAccountBalance,
  getAccountTransactions,
  isLiabilityAccount,
  sortedAccounts,
} from "@/lib/budget/accounts";
import { formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import type { BudgetAccount } from "@/types/budget";

function formatReconciledDate(iso?: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function BudgetAccountsContent() {
  const {
    budget,
    addAccount,
    updateAccount,
    deleteAccount,
    setTransactionCleared,
    finishAccountReconciliation,
  } = useBudget();

  const accounts = useMemo(
    () => sortedAccounts(budget.accounts),
    [budget.accounts],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BudgetAccount | null>(
    null,
  );
  const [deletingAccount, setDeletingAccount] = useState<BudgetAccount | null>(
    null,
  );
  const [reconcilingAccount, setReconcilingAccount] =
    useState<BudgetAccount | null>(null);

  const deleteTransactionCount = deletingAccount
    ? getAccountTransactions(deletingAccount.id, budget.transactions).length
    : 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Accounts"
        description="On-budget balances. Reconcile against the statement when you are ready."
        action={
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <BudgetPanel>
          <BudgetEmptyState
            icon={<Landmark className="size-5" />}
            title="No accounts yet"
            description="Add chequing, savings, or a card to start tracking balances."
            actions={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add account
              </Button>
            }
          />
        </BudgetPanel>
      ) : (
        <BudgetPanel>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_8rem_minmax(6rem,1fr)_minmax(6rem,1fr)_auto] gap-3 border-b border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground md:grid sm:px-5">
            <span>Account</span>
            <span>Type</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Cleared</span>
            <span />
          </div>
          <div className="divide-y divide-border/40">
            {accounts.map((account) => {
              const balance = getAccountBalance(account, budget.transactions);
              const clearedBalance = getAccountBalance(account, budget.transactions, {
                clearedOnly: true,
              });
              const unclearedCount = getAccountTransactions(
                account.id,
                budget.transactions,
              ).filter((tx) => !tx.cleared).length;
              const lastReconciled = formatReconciledDate(account.lastReconciledAt);
              const liability = isLiabilityAccount(account.type);

              return (
                <div
                  key={account.id}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_8rem_minmax(6rem,1fr)_minmax(6rem,1fr)_auto] md:items-center md:gap-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {lastReconciled ? (
                        <span className="inline-flex items-center gap-1 text-[var(--brand-green)]">
                          <CheckCircle2 className="size-3" />
                          Reconciled {lastReconciled}
                        </span>
                      ) : (
                        "Not reconciled yet"
                      )}
                      {unclearedCount > 0
                        ? ` · ${unclearedCount} uncleared`
                        : ""}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </p>
                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[11px] text-muted-foreground md:hidden">
                      {formatAccountBalanceLabel(account.type)}
                    </span>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        liability && balance > 0 && "text-[var(--brand-orange)]",
                      )}
                    >
                      {formatBudgetMoney(balance)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[11px] text-muted-foreground md:hidden">
                      Cleared
                    </span>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatBudgetMoney(clearedBalance)}
                    </p>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReconcilingAccount(account)}
                    >
                      <Scale className="size-3.5" />
                      Reconcile
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingAccount(account)}
                      aria-label={`Edit ${account.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeletingAccount(account)}
                      disabled={accounts.length <= 1}
                      aria-label={`Delete ${account.name}`}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </BudgetPanel>
      )}

      <AccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(name, type) => addAccount(name, type)}
      />

      <AccountDialog
        open={Boolean(editingAccount)}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount}
        onSave={(name, type) => {
          if (editingAccount) {
            updateAccount(editingAccount.id, { name, type });
          }
        }}
      />

      <DeleteAccountDialog
        account={deletingAccount}
        otherAccounts={accounts.filter(
          (entry) => entry.id !== deletingAccount?.id,
        )}
        transactionCount={deleteTransactionCount}
        open={Boolean(deletingAccount)}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        onConfirm={(strategy) => {
          if (deletingAccount) {
            deleteAccount(deletingAccount.id, strategy);
          }
        }}
      />

      <BudgetReconcileDialog
        open={Boolean(reconcilingAccount)}
        onOpenChange={(open) => !open && setReconcilingAccount(null)}
        account={reconcilingAccount}
        budget={budget}
        onToggleCleared={setTransactionCleared}
        onFinish={finishAccountReconciliation}
      />
    </div>
  );
}
