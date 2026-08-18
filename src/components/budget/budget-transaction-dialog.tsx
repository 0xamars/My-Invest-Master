"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus, Trash2 } from "lucide-react";
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
import {
  ACCOUNT_TYPE_LABELS,
  isOnBudgetAccount,
  sortedAccounts,
} from "@/lib/budget/accounts";
import { userAssignableCategories } from "@/lib/budget/credit-card-payments";
import { formatBudgetMoney } from "@/lib/budget/format";
import { suggestPayees, type DerivedPayee } from "@/lib/budget/payees";
import { buildTransferPayee, isSplitTransaction } from "@/lib/budget/transactions";
import { cn } from "@/lib/utils";
import type { AddBudgetTransactionInput } from "@/hooks/use-budget-plan-mutations";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetTransaction,
  BudgetTransactionType,
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
  payees?: DerivedPayee[];
  currency?: string;
}

interface SplitLineDraft {
  key: string;
  categoryId: string;
  amount: string;
}

function todayInMonth(monthKey: string): string {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (monthKey === currentKey) {
    return now.toISOString().slice(0, 10);
  }
  return `${monthKey}-01`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function newSplitLine(amount = ""): SplitLineDraft {
  return { key: crypto.randomUUID(), categoryId: "none", amount };
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
  payees = [],
  currency,
}: BudgetTransactionDialogProps) {
  const isEdit = Boolean(transaction);
  const orderedAccounts = sortedAccounts(accounts);
  const fallbackAccountId = defaultAccountId ?? orderedAccounts[0]?.id ?? "";
  const canTransfer = orderedAccounts.length >= 2;

  const [type, setType] = useState<BudgetTransactionType>("outflow");
  const [date, setDate] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(fallbackAccountId);
  const [transferAccountId, setTransferAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLineDraft[]>([
    newSplitLine(),
    newSplitLine(),
  ]);
  const [memo, setMemo] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [payeeSuggestionsOpen, setPayeeSuggestionsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (transaction) {
      setType(transaction.type);
      setDate(transaction.date);
      setPayee(transaction.payee);
      setAmount(String(transaction.amount));
      setAccountId(transaction.accountId);
      setTransferAccountId(transaction.transferAccountId ?? "");
      setCategoryId(transaction.categoryId ?? "none");
      setMemo(transaction.memo ?? "");
      setCategoryTouched(false);
      setPayeeSuggestionsOpen(false);
      if (isSplitTransaction(transaction) && transaction.splits) {
        setSplitEnabled(true);
        setSplitLines(
          transaction.splits.map((line) => ({
            key: line.id,
            categoryId: line.categoryId ?? "none",
            amount: String(line.amount),
          })),
        );
      } else {
        setSplitEnabled(false);
        setSplitLines([
          newSplitLine(
            transaction.type === "outflow" ? String(transaction.amount) : "",
          ),
          newSplitLine(),
        ]);
      }
      return;
    }

    const nextFrom = fallbackAccountId;
    const nextTo =
      orderedAccounts.find((account) => account.id !== nextFrom)?.id ?? "";

    setType("outflow");
    setDate(todayInMonth(defaultMonthKey ?? getCurrentMonthKey()));
    setPayee("");
    setAmount("");
    setAccountId(nextFrom);
    setTransferAccountId(nextTo);
    setCategoryId("none");
    setSplitEnabled(false);
    setSplitLines([newSplitLine(), newSplitLine()]);
    setMemo("");
    setCategoryTouched(false);
    setPayeeSuggestionsOpen(false);
  }, [open, transaction, defaultMonthKey, fallbackAccountId, accounts]);

  const payeeSuggestions = useMemo(
    () => suggestPayees(payees, payee),
    [payees, payee],
  );

  function applyPayee(next: DerivedPayee) {
    setPayee(next.name);
    setPayeeSuggestionsOpen(false);
    if (!categoryTouched && next.lastCategoryId) {
      setCategoryId(next.lastCategoryId);
    }
  }

  const assignableCategories = userAssignableCategories(categories);
  const sortedGroups = [...categoryGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = !Number.isNaN(parsedAmount) && parsedAmount > 0;

  const splitSum = useMemo(
    () =>
      splitLines.reduce((sum, line) => {
        const value = Number.parseFloat(line.amount);
        return sum + (Number.isNaN(value) ? 0 : value);
      }, 0),
    [splitLines],
  );
  const splitRemaining = (hasValidAmount ? parsedAmount : 0) - splitSum;
  const splitsBalanced = Math.abs(splitRemaining) < 0.005;
  const splitLinesValid =
    splitLines.length >= 2 &&
    splitLines.every((line) => {
      const value = Number.parseFloat(line.amount);
      return !Number.isNaN(value) && value > 0;
    });

  const destinationAccounts = orderedAccounts.filter(
    (account) => account.id !== accountId,
  );

  function handleTypeChange(nextType: BudgetTransactionType) {
    if (nextType === "transfer" && !canTransfer) return;
    setType(nextType);
    if (nextType !== "outflow") {
      setSplitEnabled(false);
    }
    if (nextType === "transfer" && !transferAccountId) {
      setTransferAccountId(
        orderedAccounts.find((account) => account.id !== accountId)?.id ?? "",
      );
    }
  }

  function enableSplit() {
    setSplitEnabled(true);
    setSplitLines([
      {
        key: crypto.randomUUID(),
        categoryId,
        amount: amount || "",
      },
      newSplitLine(),
    ]);
  }

  function disableSplit() {
    const first = splitLines[0];
    setSplitEnabled(false);
    if (first) {
      setCategoryId(first.categoryId);
    }
  }

  function updateSplitLine(key: string, updates: Partial<SplitLineDraft>) {
    setSplitLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...updates } : line)),
    );
  }

  function handleSubmit() {
    if (!accountId || !hasValidAmount) return;

    if (type === "transfer") {
      if (!transferAccountId || transferAccountId === accountId) return;
      const toName =
        orderedAccounts.find((account) => account.id === transferAccountId)
          ?.name ?? "account";
      onSave({
        date,
        payee: buildTransferPayee(toName),
        accountId,
        transferAccountId,
        amount: parsedAmount,
        type: "transfer",
        categoryId: null,
        memo: memo.trim() || undefined,
        cleared: transaction?.cleared ?? "uncleared",
      });
      onOpenChange(false);
      return;
    }

    if (type === "outflow" && splitEnabled && selectedOnBudget) {
      if (!payee.trim() || !splitsBalanced || !splitLinesValid) return;
      onSave({
        date,
        payee,
        accountId,
        amount: parsedAmount,
        type: "outflow",
        categoryId: null,
        memo: memo.trim() || undefined,
        cleared: transaction?.cleared ?? "uncleared",
        splits: splitLines.map((line) => ({
          id: line.key,
          categoryId: line.categoryId === "none" ? null : line.categoryId,
          amount: Number.parseFloat(line.amount),
        })),
      });
      onOpenChange(false);
      return;
    }

    if (!payee.trim()) return;

    onSave({
      date,
      payee,
      accountId,
      amount: parsedAmount,
      type,
      categoryId:
        type === "inflow" || !selectedOnBudget
          ? null
          : categoryId === "none"
            ? null
            : categoryId,
      memo: memo.trim() || undefined,
      cleared: transaction?.cleared ?? "uncleared",
    });
    onOpenChange(false);
  }

  const selectedAccount = orderedAccounts.find((account) => account.id === accountId);
  const transferAccount = orderedAccounts.find(
    (account) => account.id === transferAccountId,
  );
  const selectedOnBudget = isOnBudgetAccount(selectedAccount);
  const transferOnBudget = isOnBudgetAccount(transferAccount);
  const transferCrossesBudget =
    type === "transfer" &&
    Boolean(transferAccountId) &&
    selectedOnBudget !== transferOnBudget;

  const canSubmit = (() => {
    if (!accountId || !hasValidAmount) return false;
    if (type === "transfer") {
      return Boolean(transferAccountId) && transferAccountId !== accountId;
    }
    if (!payee.trim()) return false;
    if (type === "outflow" && splitEnabled && selectedOnBudget) {
      return splitsBalanced && splitLinesValid;
    }
    return true;
  })();

  const description =
    type === "transfer"
      ? transferCrossesBudget
        ? selectedOnBudget
          ? "This leaves the budget. Ready to Assign goes down by the transfer amount."
          : "This enters the budget. Ready to Assign goes up by the transfer amount."
        : "Move money between accounts. Transfers between the same budget side do not change Ready to Assign."
      : type === "inflow"
        ? selectedOnBudget
          ? "Record income. Inflows go to Ready to Assign."
          : "Tracking inflow. This changes the account balance only — not Ready to Assign."
        : !selectedOnBudget
          ? "Tracking outflow. This changes the account balance only — not Ready to Assign or category Activity."
          : splitEnabled
            ? "Split this outflow across categories. Lines must add up to the total."
            : "Record spending, linked to an account and category.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "budget-dialog sm:max-w-md",
          (type === "transfer" || splitEnabled) && "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
          <Tabs
            value={type}
            onValueChange={(value) =>
              handleTypeChange(value as BudgetTransactionType)
            }
          >
            <TabsList className="grid w-full grid-cols-3 rounded-full p-1">
              <TabsTrigger value="inflow" className="gap-1.5 rounded-full">
                <ArrowDownLeft className="size-3.5 text-[var(--brand-green)]" />
                Inflow
              </TabsTrigger>
              <TabsTrigger value="outflow" className="gap-1.5 rounded-full">
                <ArrowUpRight className="size-3.5 text-[var(--brand-orange)]" />
                Outflow
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="gap-1.5 rounded-full"
                disabled={!canTransfer}
              >
                <ArrowLeftRight className="size-3.5" />
                Transfer
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {!canTransfer && type !== "transfer" && (
            <p className="text-xs text-muted-foreground">
              Add a second account to record transfers.
            </p>
          )}

          {type === "transfer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From account</Label>
                <Select
                  value={accountId}
                  onValueChange={(value) => {
                    const next = value ?? "";
                    setAccountId(next);
                    if (transferAccountId === next) {
                      setTransferAccountId(
                        orderedAccounts.find((account) => account.id !== next)
                          ?.id ?? "",
                      );
                    }
                  }}
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
              <div className="space-y-1.5">
                <Label>To account</Label>
                <Select
                  value={transferAccountId}
                  onValueChange={(value) => setTransferAccountId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} · {ACCOUNT_TYPE_LABELS[account.type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
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
          )}

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

          {type !== "transfer" && (
            <div className="relative space-y-1.5">
              <Label htmlFor="budget-tx-payee">Payee</Label>
              <Input
                id="budget-tx-payee"
                placeholder="Who was this paid to or from?"
                value={payee}
                autoComplete="off"
                onChange={(event) => {
                  setPayee(event.target.value);
                  setPayeeSuggestionsOpen(true);
                }}
                onFocus={() => setPayeeSuggestionsOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setPayeeSuggestionsOpen(false), 120);
                }}
              />
              {payeeSuggestionsOpen && payeeSuggestions.length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border/70 bg-popover p-1 shadow-md">
                  {payeeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.name}
                      type="button"
                      className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyPayee(suggestion)}
                    >
                      <span className="font-medium">{suggestion.name}</span>
                      {suggestion.lastCategoryId ? (
                        <span className="text-[11px] text-muted-foreground">
                          Last used{" "}
                          {categories.find(
                            (category) => category.id === suggestion.lastCategoryId,
                          )?.name ?? "category"}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {type === "outflow" && selectedOnBudget && !splitEnabled && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Category</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={enableSplit}
                >
                  Split
                </Button>
              </div>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryTouched(true);
                  setCategoryId(value ?? "none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {sortedGroups.flatMap((group) => {
                    const groupCategories = assignableCategories
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

          {type === "outflow" && selectedOnBudget && splitEnabled && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Split categories</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={disableSplit}
                >
                  Single category
                </Button>
              </div>

              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  splitsBalanced
                    ? "border-[var(--brand-green)]/30 bg-[var(--brand-green)]/5 text-foreground"
                    : "border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 text-foreground",
                )}
              >
                {splitsBalanced
                  ? "Split lines add up to the total."
                  : hasValidAmount
                    ? `${formatBudgetMoney(Math.abs(splitRemaining), currency)} ${
                        splitRemaining > 0 ? "left to assign" : "over the total"
                      }. Lines must sum to ${formatBudgetMoney(parsedAmount, currency)}.`
                    : "Enter a total amount, then assign each line."}
              </div>

              <div className="space-y-2">
                {splitLines.map((line, index) => (
                  <div key={line.key} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Category
                        </Label>
                      )}
                      <Select
                        value={line.categoryId}
                        onValueChange={(value) =>
                          updateSplitLine(line.key, {
                            categoryId: value ?? "none",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Uncategorized</SelectItem>
                          {sortedGroups.flatMap((group) => {
                            const groupCategories = assignableCategories
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
                    <div className="w-28 space-y-1.5">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Amount
                        </Label>
                      )}
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(event) =>
                          updateSplitLine(line.key, {
                            amount: event.target.value,
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mb-0.5"
                      disabled={splitLines.length <= 2}
                      onClick={() =>
                        setSplitLines((current) =>
                          current.filter((entry) => entry.key !== line.key),
                        )
                      }
                      aria-label={`Remove split line ${index + 1}`}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSplitLines((current) => [...current, newSplitLine()])}
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
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
