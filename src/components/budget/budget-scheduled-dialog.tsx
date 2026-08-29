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
import {
  FREQUENCY_LABELS,
  RECURRING_FREQUENCIES,
  isScheduledSplit,
  todayDateKey,
} from "@/lib/budget/scheduled";
import { buildTransferPayee } from "@/lib/budget/transactions";
import { cn } from "@/lib/utils";
import type { AddBudgetScheduledTransactionInput } from "@/hooks/use-budget-plan-mutations";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetScheduledTransaction,
  BudgetTransactionType,
  RecurringFrequency,
} from "@/types/budget";

interface BudgetScheduledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: AddBudgetScheduledTransactionInput) => void;
  onDelete?: () => void;
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  categoryGroups: BudgetCategoryGroup[];
  defaultAccountId?: string;
  schedule?: BudgetScheduledTransaction | null;
}

interface SplitLineDraft {
  key: string;
  categoryId: string;
  amount: string;
}

type RepeatUntil = "forever" | "date" | "count";

function newSplitLine(amount = ""): SplitLineDraft {
  return { key: crypto.randomUUID(), categoryId: "none", amount };
}

export function BudgetScheduledDialog({
  open,
  onOpenChange,
  onSave,
  onDelete,
  accounts,
  categories,
  categoryGroups,
  defaultAccountId,
  schedule,
}: BudgetScheduledDialogProps) {
  const isEdit = Boolean(schedule);
  const orderedAccounts = sortedAccounts(accounts);
  const fallbackAccountId = defaultAccountId ?? orderedAccounts[0]?.id ?? "";
  const canTransfer = orderedAccounts.length >= 2;
  const assignable = userAssignableCategories(categories);

  const [type, setType] = useState<BudgetTransactionType>("outflow");
  const [nextDate, setNextDate] = useState("");
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
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [repeatUntil, setRepeatUntil] = useState<RepeatUntil>("forever");
  const [endDate, setEndDate] = useState("");
  const [remainingCount, setRemainingCount] = useState("12");

  useEffect(() => {
    if (!open) return;

    if (schedule) {
      setType(schedule.type);
      setNextDate(schedule.nextDate);
      setPayee(schedule.payee);
      setAmount(String(schedule.amount));
      setAccountId(schedule.accountId);
      setTransferAccountId(schedule.transferAccountId ?? "");
      setCategoryId(schedule.categoryId ?? "none");
      setMemo(schedule.memo ?? "");
      setFrequency(schedule.frequency);
      if (schedule.endDate) {
        setRepeatUntil("date");
        setEndDate(schedule.endDate);
        setRemainingCount("12");
      } else if (typeof schedule.remainingCount === "number") {
        setRepeatUntil("count");
        setRemainingCount(String(schedule.remainingCount));
        setEndDate("");
      } else {
        setRepeatUntil("forever");
        setEndDate("");
        setRemainingCount("12");
      }
      if (isScheduledSplit(schedule) && schedule.splits) {
        setSplitEnabled(true);
        setSplitLines(
          schedule.splits.map((line) => ({
            key: line.id,
            categoryId: line.categoryId ?? "none",
            amount: String(line.amount),
          })),
        );
      } else {
        setSplitEnabled(false);
        setSplitLines([
          newSplitLine(schedule.type === "outflow" ? String(schedule.amount) : ""),
          newSplitLine(),
        ]);
      }
      return;
    }

    const nextFrom = fallbackAccountId;
    const nextTo =
      orderedAccounts.find((account) => account.id !== nextFrom)?.id ?? "";

    setType("outflow");
    setNextDate(todayDateKey());
    setPayee("");
    setAmount("");
    setAccountId(nextFrom);
    setTransferAccountId(nextTo);
    setCategoryId("none");
    setSplitEnabled(false);
    setSplitLines([newSplitLine(), newSplitLine()]);
    setMemo("");
    setFrequency("monthly");
    setRepeatUntil("forever");
    setEndDate("");
    setRemainingCount("12");
  }, [open, schedule, fallbackAccountId, accounts]);

  const sortedGroups = [...categoryGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const parsedCount = Number.parseInt(remainingCount, 10);
  const hasValidCount = Number.isInteger(parsedCount) && parsedCount > 0;

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
  const selectedOnBudget = isOnBudgetAccount(
    orderedAccounts.find((account) => account.id === accountId),
  );

  function handleTypeChange(nextType: BudgetTransactionType) {
    if (nextType === "transfer" && !canTransfer) return;
    setType(nextType);
    if (nextType !== "outflow") setSplitEnabled(false);
    if (nextType === "transfer" && !transferAccountId) {
      setTransferAccountId(
        orderedAccounts.find((account) => account.id !== accountId)?.id ?? "",
      );
    }
  }

  function categoryOptions() {
    return sortedGroups.flatMap((group) => {
      const groupCategories = assignable
        .filter((category) => category.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return groupCategories.map((category) => (
        <SelectItem key={category.id} value={category.id}>
          {group.name} · {category.name}
        </SelectItem>
      ));
    });
  }

  function handleSubmit() {
    if (!accountId || !hasValidAmount || !nextDate) return;

    const end =
      repeatUntil === "date" && endDate
        ? { endDate }
        : repeatUntil === "count" && hasValidCount
          ? { remainingCount: parsedCount }
          : {};

    if (type === "transfer") {
      if (!transferAccountId || transferAccountId === accountId) return;
      const toName =
        orderedAccounts.find((account) => account.id === transferAccountId)
          ?.name ?? "account";
      onSave({
        nextDate,
        frequency,
        payee: buildTransferPayee(toName),
        accountId,
        transferAccountId,
        amount: parsedAmount,
        type: "transfer",
        categoryId: null,
        memo: memo.trim() || undefined,
        ...end,
      });
      onOpenChange(false);
      return;
    }

    if (type === "outflow" && splitEnabled && selectedOnBudget) {
      if (!payee.trim() || !splitsBalanced || !splitLinesValid) return;
      onSave({
        nextDate,
        frequency,
        payee,
        accountId,
        amount: parsedAmount,
        type: "outflow",
        categoryId: null,
        memo: memo.trim() || undefined,
        splits: splitLines.map((line) => ({
          id: line.key,
          categoryId: line.categoryId === "none" ? null : line.categoryId,
          amount: Number.parseFloat(line.amount),
        })),
        ...end,
      });
      onOpenChange(false);
      return;
    }

    if (!payee.trim()) return;

    onSave({
      nextDate,
      frequency,
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
      ...end,
    });
    onOpenChange(false);
  }

  const canSubmit = (() => {
    if (!accountId || !hasValidAmount || !nextDate) return false;
    if (repeatUntil === "date" && !endDate) return false;
    if (repeatUntil === "count" && !hasValidCount) return false;
    if (type === "transfer") {
      return Boolean(transferAccountId) && transferAccountId !== accountId;
    }
    if (!payee.trim()) return false;
    if (type === "outflow" && splitEnabled && selectedOnBudget) {
      return splitsBalanced && splitLinesValid;
    }
    return true;
  })();

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
            {isEdit ? "Edit scheduled transaction" : "Schedule a transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Updates apply to this and future dates. Posted copies on the register stay as they are."
              : "Repeats on a schedule. When the plan is opened on or after the due date, a normal transaction is posted."}
          </DialogDescription>
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
              <Label htmlFor="budget-sched-date">Next date</Label>
              <Input
                id="budget-sched-date"
                type="date"
                value={nextDate}
                onChange={(event) => setNextDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-sched-amount">Amount</Label>
              <Input
                id="budget-sched-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) =>
                  setFrequency((value ?? "monthly") as RecurringFrequency)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {FREQUENCY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Select
                value={repeatUntil}
                onValueChange={(value) =>
                  setRepeatUntil((value ?? "forever") as RepeatUntil)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forever">Does not end</SelectItem>
                  <SelectItem value="date">On a date</SelectItem>
                  <SelectItem value="count">After a number of times</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {repeatUntil === "date" && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-sched-end">End date</Label>
              <Input
                id="budget-sched-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          )}

          {repeatUntil === "count" && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-sched-count">Remaining times</Label>
              <Input
                id="budget-sched-count"
                type="number"
                min={1}
                step={1}
                value={remainingCount}
                onChange={(event) => setRemainingCount(event.target.value)}
              />
            </div>
          )}

          {type !== "transfer" && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-sched-payee">Payee</Label>
              <Input
                id="budget-sched-payee"
                placeholder="Who was this paid to or from?"
                value={payee}
                onChange={(event) => setPayee(event.target.value)}
              />
            </div>
          )}

          {type === "outflow" && selectedOnBudget && !splitEnabled && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Envelope</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setSplitEnabled(true);
                    setSplitLines([
                      {
                        key: crypto.randomUUID(),
                        categoryId,
                        amount: amount || "",
                      },
                      newSplitLine(),
                    ]);
                  }}
                >
                  Split
                </Button>
              </div>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select envelope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {categoryOptions()}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "outflow" && selectedOnBudget && splitEnabled && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Split envelopes</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    const first = splitLines[0];
                    setSplitEnabled(false);
                    if (first) setCategoryId(first.categoryId);
                  }}
                >
                  Single envelope
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
                    ? `${formatBudgetMoney(Math.abs(splitRemaining))} ${
                        splitRemaining > 0 ? "left to assign" : "over the total"
                      }. Lines must sum to ${formatBudgetMoney(parsedAmount)}.`
                    : "Enter a total amount, then assign each line."}
              </div>

              <div className="space-y-2">
                {splitLines.map((line, index) => (
                  <div key={line.key} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Envelope
                        </Label>
                      )}
                      <Select
                        value={line.categoryId}
                        onValueChange={(value) =>
                          setSplitLines((current) =>
                            current.map((entry) =>
                              entry.key === line.key
                                ? { ...entry, categoryId: value ?? "none" }
                                : entry,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Envelope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {categoryOptions()}
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
                          setSplitLines((current) =>
                            current.map((entry) =>
                              entry.key === line.key
                                ? { ...entry, amount: event.target.value }
                                : entry,
                            ),
                          )
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
                onClick={() =>
                  setSplitLines((current) => [...current, newSplitLine()])
                }
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="budget-sched-memo">Notes (optional)</Label>
            <Input
              id="budget-sched-memo"
              placeholder="Notes"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--brand-red)]"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Delete schedule
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {isEdit ? "Save schedule" : "Schedule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
