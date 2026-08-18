"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPE_LABELS,
  getAccountBalance,
  getReconciliationDifference,
  getUnclearedTransactions,
} from "@/lib/budget/accounts";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { getTransactionDisplay } from "@/lib/budget/transactions";
import type { BudgetAccount, BudgetPlan } from "@/types/budget";
import { cn } from "@/lib/utils";

interface BudgetReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BudgetAccount | null;
  budget: BudgetPlan;
  onToggleCleared: (transactionId: string) => void;
  onFinish: (accountId: string) => void;
}

function formatReconciledDate(iso?: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function BudgetReconcileDialog({
  open,
  onOpenChange,
  account,
  budget,
  onToggleCleared,
  onFinish,
}: BudgetReconcileDialogProps) {
  const [statementBalance, setStatementBalance] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    if (!open || !account) return;
    const cleared = getAccountBalance(account, budget.transactions, {
      clearedOnly: true,
    });
    setStatementBalance(String(cleared));
  }, [open, account, budget.transactions]);

  const uncleared = useMemo(() => {
    if (!account) return [];
    return getUnclearedTransactions(account.id, budget.transactions);
  }, [account, budget.transactions]);

  const clearedBalance = useMemo(() => {
    if (!account) return 0;
    return getAccountBalance(account, budget.transactions, { clearedOnly: true });
  }, [account, budget.transactions]);

  const workingBalance = useMemo(() => {
    if (!account) return 0;
    return getAccountBalance(account, budget.transactions);
  }, [account, budget.transactions]);

  const parsedStatement = Number.parseFloat(statementBalance);
  const hasValidStatement = !Number.isNaN(parsedStatement);

  const difference = useMemo(() => {
    if (!account || !hasValidStatement) return null;
    return getReconciliationDifference(
      account,
      budget.transactions,
      parsedStatement,
    );
  }, [account, budget.transactions, hasValidStatement, parsedStatement]);

  const isBalanced = difference !== null && Math.abs(difference) < 0.005;

  if (!account) return null;

  async function handleFinish() {
    if (!account || !isBalanced) return;
    setIsFinishing(true);
    try {
      onFinish(account.id);
      onOpenChange(false);
    } finally {
      setIsFinishing(false);
    }
  }

  const lastReconciled = formatReconciledDate(account.lastReconciledAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reconcile {account.name}</DialogTitle>
          <DialogDescription>
            Enter your bank statement balance, then mark transactions as
            cleared until the difference is zero. Finishing locks those cleared
            rows as reconciled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto py-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Cleared balance</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatBudgetMoney(clearedBalance)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Working balance</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatBudgetMoney(workingBalance)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-3",
                isBalanced
                  ? "border-[var(--brand-green)]/30 bg-[var(--brand-green)]/5"
                  : "border-border/60 bg-muted/20",
              )}
            >
              <p className="text-xs text-muted-foreground">Difference</p>
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  isBalanced && "text-[var(--brand-green)]",
                )}
              >
                {difference === null
                  ? "—"
                  : formatBudgetMoney(Math.abs(difference))}
                {difference !== null && difference !== 0 && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {difference > 0 ? "to clear" : "over"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statement-balance">Statement balance</Label>
            <Input
              id="statement-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={statementBalance}
              onChange={(event) => setStatementBalance(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]} · Enter the ending balance from
              your statement
            </p>
          </div>

          {lastReconciled && (
            <p className="text-xs text-muted-foreground">
              Last reconciled {lastReconciled}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Uncleared transactions</h3>
              <span className="text-xs text-muted-foreground">
                {uncleared.length} pending
              </span>
            </div>

            {uncleared.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                All transactions are cleared. Adjust the statement balance or
                finish reconciliation.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10" />
                      <TableHead>Date</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uncleared.map((tx) => {
                      const display = getTransactionDisplay(
                        tx,
                        budget.accounts,
                        budget.categories,
                        account.id,
                      );
                      return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Button
                            type="button"
                            variant={tx.cleared !== "uncleared" ? "secondary" : "outline"}
                            size="icon-sm"
                            onClick={() => onToggleCleared(tx.id)}
                            aria-label={`Mark ${display.payee} as cleared`}
                            aria-pressed={tx.cleared !== "uncleared"}
                          >
                            <CheckCircle2
                              className={cn(
                                "size-3.5",
                                tx.cleared && "text-[var(--brand-green)]",
                              )}
                            />
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatBudgetDate(tx.date)}
                        </TableCell>
                        <TableCell className="font-medium">{display.payee}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            display.isTransfer
                              ? "text-foreground"
                              : display.isInflowLike
                                ? "text-[var(--brand-green)]"
                                : "text-[var(--brand-orange)]",
                          )}
                        >
                          {display.amountPrefix}
                          {formatBudgetMoney(tx.amount)}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleFinish()}
            disabled={!isBalanced || isFinishing}
            className="gap-2"
          >
            {isFinishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Finish reconciliation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
