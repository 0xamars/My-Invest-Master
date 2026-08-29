"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";
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
import { BudgetEmptyState } from "@/components/budget/budget-ui";
import { previewAutoAssignUnderfunded } from "@/lib/budget/auto-assign";
import { formatBudgetMoney } from "@/lib/budget/format";
import { previewResetAvailable } from "@/lib/budget/reset-available";
import { GOAL_TYPE_LABELS } from "@/lib/budget/goals";
import {
  READY_TO_ASSIGN_ID,
  type BudgetCategory,
  type BudgetData,
  type CategoryGoalType,
} from "@/types/budget";

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
  const parsedAmount = Number.parseFloat(amount);
  const canSubmit =
    Boolean(fromCategoryId && toCategoryId) &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0;

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
            Move leftover Available. Assigned this month can go negative.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
            From{" "}
            <span className="font-semibold text-foreground">
              {fromCategory?.name ?? "Envelope"}
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
                <SelectItem value={READY_TO_ASSIGN_ID}>Leftover</SelectItem>
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
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {canSubmit
              ? `Move ${formatBudgetMoney(parsedAmount, currency)}`
              : "Move"}
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

  const kindLabel = overspendKind === "credit" ? "credit" : "cash";
  const parsedAmount = Number.parseFloat(amount);
  const canCoverFrom =
    (sourceId === "rta" && readyToAssign > 0) ||
    sources.some((source) => source.id === sourceId);
  const canSubmit =
    !Number.isNaN(parsedAmount) && parsedAmount > 0 && canCoverFrom;
  const nothingToCoverWith = readyToAssign <= 0 && sources.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cover Overspend</DialogTitle>
          <DialogDescription>
            Cover {formatBudgetMoney(overspend, currency)} of {kindLabel} overspend
            {categoryName ? ` in ${categoryName}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {nothingToCoverWith ? (
          <BudgetEmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Nothing to cover with"
            description="Assign leftover to another envelope, or add income, then cover this overspend."
          />
        ) : (
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
                    Leftover ({formatBudgetMoney(Math.max(0, readyToAssign), currency)})
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
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {nothingToCoverWith ? null : (
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {canSubmit
                ? `Cover ${formatBudgetMoney(parsedAmount, currency)}`
                : "Cover"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AutoAssignUnderfundedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetData;
  monthKey: string;
  currency?: string;
  onConfirm: () => void;
}

export function AutoAssignUnderfundedDialog({
  open,
  onOpenChange,
  budget,
  monthKey,
  currency,
  onConfirm,
}: AutoAssignUnderfundedDialogProps) {
  const preview = useMemo(
    () => previewAutoAssignUnderfunded(budget, monthKey),
    [budget, monthKey],
  );

  const names = useMemo(
    () => new Map(budget.categories.map((category) => [category.id, category.name])),
    [budget.categories],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-Assign Underfunded</DialogTitle>
          <DialogDescription>
            Put leftover on underfunded envelopes. Payment envelopes first,
            then the rest of the list.
          </DialogDescription>
        </DialogHeader>

        {preview.assigned <= 0 ? (
          <BudgetEmptyState
            icon={<Sparkles className="size-5" />}
            title="Nothing underfunded"
            description="When leftover is waiting and a goal or card payment still needs money, Auto-Assign will fill it here."
          />
        ) : (
          <div className="space-y-3 py-1">
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {preview.lines.map((line) => (
                <li
                  key={line.categoryId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">
                    {names.get(line.categoryId) ?? "Envelope"}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--brand-green)]">
                    {formatBudgetMoney(line.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
            {preview.leftover > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatBudgetMoney(preview.leftover, currency)} stays as leftover.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview.assigned <= 0 ? null : (
            <Button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              Auto-assign {formatBudgetMoney(preview.assigned, currency)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResetAvailableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetData;
  monthKey: string;
  currency?: string;
  onConfirm: (options: { coverOverspend: boolean }) => void;
}

export function ResetAvailableDialog({
  open,
  onOpenChange,
  budget,
  monthKey,
  currency,
  onConfirm,
}: ResetAvailableDialogProps) {
  const [coverOverspend, setCoverOverspend] = useState(false);

  useEffect(() => {
    if (open) setCoverOverspend(false);
  }, [open]);

  const leftoverPreview = useMemo(
    () => previewResetAvailable(budget, monthKey),
    [budget, monthKey],
  );
  const coverPreview = useMemo(
    () => previewResetAvailable(budget, monthKey, { coverOverspend: true }),
    [budget, monthKey],
  );
  const preview = coverOverspend ? coverPreview : leftoverPreview;
  const names = useMemo(
    () => new Map(budget.categories.map((category) => [category.id, category.name])),
    [budget.categories],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Available</DialogTitle>
          <DialogDescription>
            Move leftover Available back to leftover so this month starts
            clean. Payment envelopes stay put.
          </DialogDescription>
        </DialogHeader>

        {preview.leftover <= 0 && preview.coverLines.length === 0 ? (
          <BudgetEmptyState
            icon={<Sparkles className="size-5" />}
            title="Nothing to reset"
            description="Positive leftover Available will show up here. Overspent rows stay unless you include Cover."
          />
        ) : (
          <div className="space-y-3 py-1">
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {preview.leftoverLines.map((line) => (
                <li
                  key={line.categoryId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">
                    {names.get(line.categoryId) ?? line.categoryName}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--brand-green)]">
                    {formatBudgetMoney(line.amount, currency)}
                  </span>
                </li>
              ))}
              {coverOverspend
                ? preview.coverLines.map((line) => (
                    <li
                      key={`cover-${line.categoryId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand-orange)]/25 bg-[var(--brand-orange)]/8 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium">
                        Cover {names.get(line.categoryId) ?? line.categoryName}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--brand-orange)]">
                        {formatBudgetMoney(line.amount, currency)}
                      </span>
                    </li>
                  ))
                : null}
            </ul>
            {coverPreview.coverLines.length > 0 ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="budget-check mt-0.5"
                  checked={coverOverspend}
                  onChange={(event) => setCoverOverspend(event.target.checked)}
                />
                <span>
                  Also cover overspend from leftover
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Overspent rows stay negative unless this is on.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview.leftover <= 0 && !coverOverspend ? null : (
            <Button
              type="button"
              onClick={() => {
                onConfirm({ coverOverspend });
                onOpenChange(false);
              }}
            >
              Reset {formatBudgetMoney(preview.leftover, currency)}
            </Button>
          )}
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
          <DialogTitle>Set Envelope Goal</DialogTitle>
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

interface AssignLeftoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leftover: number;
  envelopes: Array<{ id: string; name: string }>;
  currency?: string;
  onAssign: (allocations: Array<{ categoryId: string; amount: number }>) => void;
}

export function AssignLeftoverDialog({
  open,
  onOpenChange,
  leftover,
  envelopes,
  currency,
  onAssign,
}: AssignLeftoverDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDrafts({});
  }, [open]);

  const allocations = envelopes.map((envelope) => {
    const parsed = Number.parseFloat(drafts[envelope.id] ?? "");
    return {
      categoryId: envelope.id,
      amount: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
    };
  });
  const used = allocations.reduce((sum, line) => sum + line.amount, 0);
  const remaining = leftover - used;
  const canSubmit = used > 0 && remaining >= -0.0001;

  function handleSubmit() {
    if (!canSubmit) return;
    onAssign(allocations.filter((line) => line.amount > 0));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign leftover</DialogTitle>
          <DialogDescription>
            Put unassigned money into envelopes. Leftover you leave here stays
            unassigned until you close the month.
          </DialogDescription>
        </DialogHeader>

        {leftover <= 0 ? (
          <BudgetEmptyState
            icon={<Sparkles className="size-5" />}
            title="No leftover"
            description="Income that is not assigned yet will show up here."
          />
        ) : (
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
              Leftover{" "}
              <span className="font-semibold tabular-nums">
                {formatBudgetMoney(leftover, currency)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Remaining {formatBudgetMoney(Math.max(0, remaining), currency)}
                {remaining < 0 ? " · over leftover" : ""}
              </span>
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {envelopes.map((envelope) => (
                <li
                  key={envelope.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Label
                    htmlFor={`assign-${envelope.id}`}
                    className="min-w-0 truncate text-sm font-medium"
                  >
                    {envelope.name}
                  </Label>
                  <Input
                    id={`assign-${envelope.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={drafts[envelope.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [envelope.id]: event.target.value,
                      }))
                    }
                    className="h-8 w-24 text-right tabular-nums"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {leftover <= 0 ? null : (
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              Assign {formatBudgetMoney(used, currency)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CloseMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthLabel: string;
  leftover: number;
  cashOverspend: number;
  envelopes: Array<{ id: string; name: string; available: number }>;
  canClose: boolean;
  reason?: string;
  currency?: string;
  onClose: () => void;
}

export function CloseMonthDialog({
  open,
  onOpenChange,
  monthLabel,
  leftover,
  cashOverspend,
  envelopes,
  canClose,
  reason,
  currency,
  onClose,
}: CloseMonthDialogProps) {
  const carrying = envelopes.filter((line) => line.available !== 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close {monthLabel}</DialogTitle>
          <DialogDescription>
            Lock this month. Leftover and envelope balances become the opening
            of the next month.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
            Leftover that carries{" "}
            <span className="font-semibold tabular-nums">
              {formatBudgetMoney(leftover, currency)}
            </span>
            {cashOverspend > 0 ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {formatBudgetMoney(cashOverspend, currency)} cash overspend
                will be absorbed from leftover.
              </span>
            ) : null}
          </div>
          {carrying.length > 0 ? (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {carrying.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{line.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatBudgetMoney(line.available, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Envelope balances are zero. Next month starts clean except leftover.
            </p>
          )}
          {reason ? (
            <p className="text-sm text-[var(--brand-red)]">{reason}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              onOpenChange(false);
            }}
            disabled={!canClose}
          >
            Close month
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
