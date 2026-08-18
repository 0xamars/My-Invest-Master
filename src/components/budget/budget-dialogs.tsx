"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatBudgetMoney } from "@/lib/budget/format";
import { GOAL_TYPE_LABELS } from "@/lib/budget/goals";
import { READY_TO_ASSIGN_ID, type BudgetCategory, type CategoryGoalType } from "@/types/budget";

interface MoveMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromCategoryId: string | null;
  categories: BudgetCategory[];
  available?: number;
  currency?: string;
  onMove: (fromCategoryId: string, toCategoryId: string, amount: number) => void;
}

export function MoveMoneyDialog({
  open,
  onOpenChange,
  fromCategoryId,
  categories,
  available,
  currency,
  onMove,
}: MoveMoneyDialogProps) {
  const [toCategoryId, setToCategoryId] = useState(READY_TO_ASSIGN_ID);
  const [amount, setAmount] = useState("");

  const fromCategory = categories.find((category) => category.id === fromCategoryId);

  const destinationOptions = useMemo(
    () => categories.filter((category) => category.id !== fromCategoryId),
    [categories, fromCategoryId],
  );

  useEffect(() => {
    if (open) {
      setToCategoryId(READY_TO_ASSIGN_ID);
      setAmount(available && available > 0 ? String(available) : "");
    }
  }, [open, available]);

  function handleSubmit() {
    if (!fromCategoryId || !toCategoryId) return;
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    onMove(fromCategoryId, toCategoryId, parsed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Money</DialogTitle>
          <DialogDescription>
            Move leftover Available — including money assigned in earlier months —
            to another category or back to Ready to Assign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
            From{" "}
            <span className="font-semibold text-foreground">
              {fromCategory?.name ?? "Category"}
            </span>
            {available != null ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Available {formatBudgetMoney(available, currency)}
              </span>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>To</Label>
            <Select
              value={toCategoryId}
              onValueChange={(value) => setToCategoryId(value ?? READY_TO_ASSIGN_ID)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={READY_TO_ASSIGN_ID}>Ready to Assign</SelectItem>
                {destinationOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="move-amount">Amount</Label>
            <Input
              id="move-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Move Money
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CoverOverspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName?: string;
  overspend: number;
  overspendKind: "cash" | "credit" | null;
  readyToAssign: number;
  sources: Array<{ id: string; name: string; available: number }>;
  currency?: string;
  onCover: (
    source: { type: "rta" } | { type: "category"; categoryId: string },
    amount: number,
  ) => void;
}

export function CoverOverspendDialog({
  open,
  onOpenChange,
  categoryName,
  overspend,
  overspendKind,
  readyToAssign,
  sources,
  currency,
  onCover,
}: CoverOverspendDialogProps) {
  const [sourceId, setSourceId] = useState<"rta" | string>("rta");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      const defaultSource =
        readyToAssign > 0 ? "rta" : (sources[0]?.id ?? "rta");
      setSourceId(defaultSource);
      setAmount(overspend > 0 ? String(overspend) : "");
    }
  }, [open, overspend, readyToAssign, sources]);

  function handleSubmit() {
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    if (sourceId === "rta") {
      onCover({ type: "rta" }, parsed);
    } else {
      onCover({ type: "category", categoryId: sourceId }, parsed);
    }
    onOpenChange(false);
  }

  const kindLabel =
    overspendKind === "credit" ? "credit (orange)" : "cash (red)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cover overspending</DialogTitle>
          <DialogDescription>
            {categoryName
              ? `Cover ${kindLabel} overspending in ${categoryName}.`
              : `Cover ${kindLabel} overspending.`}{" "}
            Cash left uncovered reduces next-month Ready to Assign. Credit
            overspend underfunds the card payment category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
            Overspent{" "}
            <span className="font-semibold tabular-nums">
              {formatBudgetMoney(overspend, currency)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Cover from</Label>
            <Select
              value={sourceId}
              onValueChange={(value) => setSourceId(value ?? "rta")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rta">
                  Ready to Assign ({formatBudgetMoney(Math.max(0, readyToAssign), currency)})
                </SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name} ({formatBudgetMoney(source.available, currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover-amount">Amount</Label>
            <Input
              id="cover-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const GOAL_TYPES: CategoryGoalType[] = [
  "monthly-funding",
  "needed-for-spending",
  "target-balance",
];

interface SetCategoryGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName?: string;
  initialType?: CategoryGoalType;
  initialTarget?: number;
  initialTargetDate?: string;
  onSave: (
    type: CategoryGoalType,
    targetAmount: number,
    targetDate?: string,
  ) => void;
  onRemove?: () => void;
}

export function SetCategoryGoalDialog({
  open,
  onOpenChange,
  categoryName,
  initialType,
  initialTarget,
  initialTargetDate,
  onSave,
  onRemove,
}: SetCategoryGoalDialogProps) {
  const [type, setType] = useState<CategoryGoalType>("monthly-funding");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (open) {
      setType(initialType ?? "monthly-funding");
      setTargetAmount(initialTarget ? String(initialTarget) : "");
      setTargetDate(initialTargetDate ?? "");
    }
  }, [open, initialType, initialTarget, initialTargetDate]);

  const needsDate = type === "needed-for-spending";
  const showsDate = type !== "monthly-funding";

  function handleSubmit() {
    const parsed = Number.parseFloat(targetAmount);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    if (needsDate && !targetDate) return;
    onSave(type, parsed, showsDate ? targetDate || undefined : undefined);
    onOpenChange(false);
  }

  const amountLabel =
    type === "monthly-funding"
      ? "Assign this amount every month"
      : type === "needed-for-spending"
        ? "Amount needed"
        : "Target balance";

  const description = categoryName
    ? `Set a funding goal for ${categoryName}.`
    : "Choose a goal type. Needed this month drives underfunded vs on-track.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Category Goal</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Goal type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as CategoryGoalType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((goalType) => (
                  <SelectItem key={goalType} value={goalType}>
                    {GOAL_TYPE_LABELS[goalType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === "monthly-funding"
                ? "Assign this amount every month."
                : type === "needed-for-spending"
                  ? "Remaining amount divided by months left is this month’s needed."
                  : "Reach this available balance, optionally by a date."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-amount">{amountLabel}</Label>
            <Input
              id="goal-amount"
              type="number"
              min={0}
              step="1"
              placeholder="500"
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
            />
          </div>
          {showsDate ? (
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">
                {needsDate ? "Needed by" : "Target date (optional)"}
              </Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onRemove ? (
            <Button type="button" variant="ghost" onClick={onRemove}>
              Remove Goal
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={needsDate && !targetDate}
            >
              Save Goal
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
