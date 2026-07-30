"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCOUNT_TYPE_LABELS, sortedAccounts } from "@/lib/budget/accounts";
import type { AddBudgetTransactionInput } from "@/hooks/use-budget-plan-mutations";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetTransaction,
} from "@/types/budget";

interface BudgetTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: AddBudgetTransactionInput) => void;
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  categoryGroups: BudgetCategoryGroup[];
  defaultMonthKey?: string;
  defaultAccountId?: string;
  transaction?: BudgetTransaction | null;
}

function todayInMonth(monthKey: string): string {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (monthKey === currentKey) {
    return now.toISOString().slice(0, 10);
  }
  return `${monthKey}-01`;
}

export function BudgetTransactionDialog({
  open,
  onOpenChange,
  onSave,
  accounts,
  categories,
  categoryGroups,
  defaultMonthKey,
  defaultAccountId,
  transaction,
}: BudgetTransactionDialogProps) {
  const isEdit = Boolean(transaction);
  const orderedAccounts = sortedAccounts(accounts);
  const fallbackAccountId = defaultAccountId ?? orderedAccounts[0]?.id ?? "";

  const [type, setType] = useState<"inflow" | "outflow">("outflow");
  const [date, setDate] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(fallbackAccountId);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;

    if (transaction) {
      setType(transaction.type);
      setDate(transaction.date);
      setPayee(transaction.payee);
      setAmount(String(transaction.amount));
      setAccountId(transaction.accountId);
      setCategoryId(transaction.categoryId ?? "none");
      setMemo(transaction.memo ?? "");
      return;
    }

    setType("outflow");
    setDate(todayInMonth(defaultMonthKey ?? todayInMonth(getCurrentMonthKey())));
    setPayee("");
    setAmount("");
    setAccountId(fallbackAccountId);
    setCategoryId("none");
    setMemo("");
  }, [open, transaction, defaultMonthKey, fallbackAccountId]);

  const sortedGroups = [...categoryGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  function handleSubmit() {
    const parsed = Number.parseFloat(amount);
    if (!payee.trim() || !accountId || Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    onSave({
      date,
      payee,
      accountId,
      amount: parsed,
      type,
      categoryId:
        type === "inflow" ? null : categoryId === "none" ? null : categoryId,
      memo: memo.trim() || undefined,
      cleared: transaction?.cleared ?? false,
    });
    onOpenChange(false);
  }

  const canSubmit =
    payee.trim().length > 0 &&
    accountId.length > 0 &&
    Number.parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>
            Record income or spending, linked to an account and category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <Tabs
            value={type}
            onValueChange={(value) => setType(value as "inflow" | "outflow")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inflow" className="gap-1.5">
                <ArrowDownLeft className="size-3.5 text-[var(--brand-green)]" />
                Inflow
              </TabsTrigger>
              <TabsTrigger value="outflow" className="gap-1.5">
                <ArrowUpRight className="size-3.5 text-[var(--brand-orange)]" />
                Outflow
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select
              value={accountId}
              onValueChange={(value) => setAccountId(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {orderedAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · {ACCOUNT_TYPE_LABELS[account.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="budget-tx-date">Date</Label>
              <Input
                id="budget-tx-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-tx-amount">Amount</Label>
              <Input
                id="budget-tx-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-tx-payee">Payee</Label>
            <Input
              id="budget-tx-payee"
              placeholder="Who was this paid to or from?"
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
            />
          </div>

          {type === "outflow" && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {sortedGroups.flatMap((group) => {
                    const groupCategories = categories
                      .filter((category) => category.groupId === group.id)
                      .sort((a, b) => a.sortOrder - b.sortOrder);

                    return groupCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {group.name} · {category.name}
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="budget-tx-memo">Notes (optional)</Label>
            <Input
              id="budget-tx-memo"
              placeholder="Notes"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isEdit ? "Save Changes" : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
