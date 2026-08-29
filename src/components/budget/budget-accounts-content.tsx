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
  isOnBudgetAccount,
  sortedAccounts,
} from "@/lib/budget/accounts";
import { isUnclearedState } from "@/lib/budget/cleared";
import { formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import type { BudgetAccount, BudgetTransaction } from "@/types/budget";

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
    cycleTransactionCleared,
    finishAccountReconciliation,
  } = useBudget();

  const accounts = useMemo(
    () => sortedAccounts(budget.accounts),
    [budget.accounts],
  );
  const onBudgetAccounts = useMemo(
    () => accounts.filter((account) => isOnBudgetAccount(account)),
    [accounts],
  );
  const trackingAccounts = useMemo(
    () => accounts.filter((account) => !isOnBudgetAccount(account)),
    [accounts],
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
        description="One spending account is enough. Add income and spend against envelopes. Not a bank link."
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
            title="No spending account yet"
            description="Add a spending account, then record income and spend against envelopes."
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
          <div className="hidden grid-cols-[minmax(0,1.4fr)_8rem_7rem_minmax(6rem,1fr)_minmax(6rem,1fr)_auto] gap-3 border-b border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground md:grid sm:px-5">
            <span>Account</span>
            <span>Type</span>
            <span>Budget</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Cleared</span>
            <span />
          </div>
          <AccountSection
            title="On-budget"
            empty="No on-budget accounts."
            accounts={onBudgetAccounts}
            allAccounts={accounts}
            transactions={budget.transactions}
            currency={budget.currency}
            onReconcile={setReconcilingAccount}
            onEdit={setEditingAccount}
            onDelete={setDeletingAccount}
          />
          <AccountSection
            title="Tracking"
            empty="No tracking accounts yet. Add a brokerage, mortgage, or convert an account."
            accounts={trackingAccounts}
            allAccounts={accounts}
            transactions={budget.transactions}
            currency={budget.currency}
            onReconcile={setReconcilingAccount}
            onEdit={setEditingAccount}
            onDelete={setDeletingAccount}
          />
        </BudgetPanel>
      )}

      <AccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(name, type, onBudget) => addAccount(name, type, onBudget)}
      />

      <AccountDialog
        open={Boolean(editingAccount)}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount}
        onSave={(name, type, onBudget) => {
          if (editingAccount) {
            updateAccount(editingAccount.id, { name, type, onBudget });
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
        onToggleCleared={cycleTransactionCleared}
        onFinish={finishAccountReconciliation}
      />
    </div>
  );
}

function AccountSection({
  title,
  empty,
  accounts,
  allAccounts,
  transactions,
  currency,
  onReconcile,
  onEdit,
  onDelete,
}: {
  title: string;
  empty: string;
  accounts: BudgetAccount[];
  allAccounts: BudgetAccount[];
  transactions: BudgetTransaction[];
  currency?: string;
  onReconcile: (account: BudgetAccount) => void;
  onEdit: (account: BudgetAccount) => void;
  onDelete: (account: BudgetAccount) => void;
}) {
  return (
    <div>
      <div className="bg-muted/25 px-4 py-2 sm:px-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h3>
      </div>
      {accounts.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">{empty}</p>
      ) : (
        <div className="divide-y divide-border/40">
          {accounts.map((account) => {
            const balance = getAccountBalance(account, transactions);
            const clearedBalance = getAccountBalance(account, transactions, {
              clearedOnly: true,
            });
            const unclearedCount = getAccountTransactions(
              account.id,
              transactions,
            ).filter((tx) => isUnclearedState(tx.cleared)).length;
            const lastReconciled = formatReconciledDate(account.lastReconciledAt);
            const liability = isLiabilityAccount(account.type);
            const onBudget = isOnBudgetAccount(account);

            return (
              <div
                key={account.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_8rem_7rem_minmax(6rem,1fr)_minmax(6rem,1fr)_auto] md:items-center md:gap-3 sm:px-5"
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
                <p className="text-xs text-muted-foreground">
                  {onBudget ? "On-budget" : "Tracking"}
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
                    {formatBudgetMoney(balance, currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between md:block md:text-right">
                  <span className="text-[11px] text-muted-foreground md:hidden">
                    Cleared
                  </span>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatBudgetMoney(clearedBalance, currency)}
                  </p>
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReconcile(account)}
                  >
                    <Scale className="size-3.5" />
                    Reconcile
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(account)}
                    aria-label={`Edit ${account.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(account)}
                    disabled={allAccounts.length <= 1}
                    aria-label={`Delete ${account.name}`}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
