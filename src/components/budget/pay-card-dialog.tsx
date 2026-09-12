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
import { cardPaymentSnapshot } from "@/lib/budget/pay-card";
import { todayDateKey } from "@/lib/budget/scheduled";
import type { BudgetData } from "@/types/budget";

export function PayCardDialog({
  open,
  onOpenChange,
  budget,
  cardAccountId,
  monthKey,
  currency,
  onPay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetData;
  cardAccountId: string | null;
  monthKey: string;
  currency?: string;
  onPay: (input: { fromAccountId: string; amount: number; date: string }) => void;
}) {
  const snapshot = useMemo(
    () =>
      cardAccountId
        ? cardPaymentSnapshot(budget, cardAccountId, monthKey)
        : null,
    [budget, cardAccountId, monthKey],
  );
  const [fromAccountId, setFromAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateKey());

  useEffect(() => {
    if (!open || !snapshot) return;
    setFromAccountId(snapshot.sources[0]?.id ?? "");
    setAmount(
      snapshot.suggestedAmount > 0
        ? snapshot.suggestedAmount.toFixed(2)
        : "",
    );
    setDate(todayDateKey());
  }, [open, snapshot]);

  const parsedAmount = Number.parseFloat(amount);
  const canSubmit =
    Boolean(fromAccountId) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    snapshot != null &&
    snapshot.sources.length > 0;

  function handleSubmit() {
    if (!canSubmit || !snapshot) return;
    onPay({ fromAccountId, amount: parsedAmount, date });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Pay {snapshot?.card.name ?? "card"}
          </DialogTitle>
          <DialogDescription>
            Transfer from a spending account. This uses the card payment
            envelope. Leftover does not change.
          </DialogDescription>
        </DialogHeader>

        {snapshot && snapshot.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a chequing, savings, or cash account to pay this card.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Balance owed {formatBudgetMoney(snapshot?.balanceOwed ?? 0, currency)}
              {" · "}
              Available to pay{" "}
              {formatBudgetMoney(snapshot?.paymentAvailable ?? 0, currency)}
            </p>
            <div className="space-y-1.5">
              <Label>From account</Label>
              <Select
                value={fromAccountId}
                onValueChange={(value) => setFromAccountId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(snapshot?.sources ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pay-card-date">Date</Label>
                <Input
                  id="pay-card-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-card-amount">Amount</Label>
                <Input
                  id="pay-card-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Pay card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
