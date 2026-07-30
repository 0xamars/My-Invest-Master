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
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { DeleteAccountDialog } from "@/components/budget/delete-account-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBudget } from "@/contexts/budget-context";
import {
  ACCOUNT_TYPE_LABELS,
  formatAccountBalanceLabel,
  getAccountBalance,
  getAccountTransactions,
  sortedAccounts,
} from "@/lib/budget/accounts";
import { formatBudgetMoney } from "@/lib/budget/format";
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
    <div className="flex flex-1 flex-col gap-6">
      <CategoryPageHeader
        category="budget"
        title="Accounts"
        description="Track balances manually and reconcile against your bank statements."
        action={
          <Button type="button" onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Add Account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <Card className="surface-card border-dashed shadow-none">
          <CardHeader className="text-center">
            <CardTitle>No accounts yet</CardTitle>
            <CardDescription>
              Add a chequing, savings, or credit card account to start tracking
              balances and reconciling.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

            return (
              <Card
                key={account.id}
                className="surface-card gap-0 py-0 shadow-none transition-colors hover:border-border"
              >
                <CardHeader className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base font-semibold">
                        {account.name}
                      </CardTitle>
                      <CardDescription>
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </CardDescription>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Landmark className="size-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-4">
                  <div>
                    <p className="stat-label">
                      {formatAccountBalanceLabel(account.type)}
                    </p>
                    <p className="stat-value text-xl tabular-nums">
                      {formatBudgetMoney(balance)}
                    </p>
                    {unclearedCount > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {unclearedCount} uncleared · Cleared{" "}
                        {formatBudgetMoney(clearedBalance)}
                      </p>
                    )}
                  </div>

                  {lastReconciled ? (
                    <p className="flex items-center gap-1.5 text-xs text-[var(--brand-green)]">
                      <CheckCircle2 className="size-3.5" />
                      Reconciled {lastReconciled}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not yet reconciled
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => setReconcilingAccount(account)}
                    >
                      <Scale className="size-3.5" />
                      Reconcile
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setEditingAccount(account)}
                      aria-label={`Edit ${account.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setDeletingAccount(account)}
                      disabled={accounts.length <= 1}
                      aria-label={`Delete ${account.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
