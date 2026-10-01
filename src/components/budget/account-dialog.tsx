"use client";

import { useEffect, useRef, useState } from "react";
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
  defaultOnBudgetForType,
  isCreditCardPaymentAccount,
  isLiabilityAccount,
  isLoanAccount,
  isOnBudgetAccount,
} from "@/lib/budget/accounts";
import { formatBudgetDate } from "@/lib/budget/format";
import type { LoanTermsDraft } from "@/lib/budget/loans";
import { STARTING_BALANCE_PAYEE } from "@/lib/budget/starting-balance";
import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetInterestRate,
  BudgetTransaction,
} from "@/types/budget";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as BudgetAccountType[];
const EMPTY_TRANSACTIONS: BudgetTransaction[] = [];
const EMPTY_RATES: BudgetInterestRate[] = [];

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BudgetAccount | null;
  transactions?: BudgetTransaction[];
  onSave: (input: {
    name: string;
    type: BudgetAccountType;
    onBudget: boolean;
    startingBalance?: { amount: number; date: string };
    loan?: LoanTermsDraft;
  }) => void;
}

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value)}%`;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  transactions = EMPTY_TRANSACTIONS,
  onSave,
}: AccountDialogProps) {
  const isEdit = Boolean(account);
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const [name, setName] = useState("");
  const [type, setType] = useState<BudgetAccountType>("chequing");
  const [onBudget, setOnBudget] = useState(true);
  const [startingBalance, setStartingBalance] = useState("");
  const [startingDate, setStartingDate] = useState(todayKey);
  const [rates, setRates] = useState<BudgetInterestRate[]>(EMPTY_RATES);
  const [draftRate, setDraftRate] = useState("");
  const [draftRateDate, setDraftRateDate] = useState(todayKey);
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextType = account?.type ?? "chequing";
    const rows = transactionsRef.current;
    setName(account?.name ?? "");
    setType(nextType);
    setOnBudget(
      account ? isOnBudgetAccount(account) : defaultOnBudgetForType(nextType),
    );
    setRates(
      account?.interestRates && account.interestRates.length > 0
        ? account.interestRates
        : EMPTY_RATES,
    );
    setDraftRate("");
    setDraftRateDate(todayKey());
    setMinimumPayment(
      account?.minimumPayment != null ? String(account.minimumPayment) : "",
    );
    setDueDay(account?.paymentDueDay != null ? String(account.paymentDueDay) : "");
    setFormError(null);

    const startingTx = account
      ? rows.find(
          (tx) =>
            tx.accountId === account.id && tx.payee === STARTING_BALANCE_PAYEE,
        )
      : undefined;
    if (account?.openingBalance != null && account.openingBalance > 0) {
      setStartingBalance(String(account.openingBalance));
      setStartingDate(account.openingBalanceDate ?? startingTx?.date ?? todayKey());
    } else if (account && isLoanAccount(nextType) && startingTx) {
      setStartingBalance(String(startingTx.amount));
      setStartingDate(startingTx.date);
    } else {
      setStartingBalance("");
      setStartingDate(todayKey());
    }
  }, [open, account]);

  function handleTypeChange(nextType: BudgetAccountType) {
    setType(nextType);
    if (!isEdit) {
      setOnBudget(defaultOnBudgetForType(nextType));
    }
  }

  function mergeDraftRate(
    current: BudgetInterestRate[],
  ): { rates: BudgetInterestRate[]; error?: string } {
    if (!draftRate.trim()) return { rates: current };
    const parsed = Number.parseFloat(draftRate);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return {
        rates: current,
        error: "Enter an annual rate from 0 to 100, or leave it blank.",
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftRateDate)) {
      return { rates: current, error: "Enter the date this rate starts." };
    }
    const next = current.filter((rate) => rate.effectiveDate !== draftRateDate);
    next.push({ effectiveDate: draftRateDate, annualPercent: parsed });
    return { rates: next };
  }

  function handleAddRate() {
    const merged = mergeDraftRate(rates);
    if (merged.error) {
      setFormError(merged.error);
      return;
    }
    if (!draftRate.trim()) return;
    setRates(merged.rates);
    setDraftRate("");
    setFormError(null);
  }

  function handleRemoveRate(effectiveDate: string) {
    setRates((current) => {
      const next = current.filter((rate) => rate.effectiveDate !== effectiveDate);
      return next.length > 0 ? next : EMPTY_RATES;
    });
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const loanType = isLoanAccount(type);
    const parsedBalance = Number.parseFloat(startingBalance);
    const hasOpening = startingBalance.trim().length > 0;
    if (hasOpening && (!Number.isFinite(parsedBalance) || parsedBalance <= 0)) {
      setFormError("Enter an opening balance above zero, or leave it blank.");
      return;
    }
    if (hasOpening && !/^\d{4}-\d{2}-\d{2}$/.test(startingDate)) {
      setFormError("Enter the date of the opening balance.");
      return;
    }

    let minimum: number | null = null;
    if (loanType && minimumPayment.trim()) {
      const parsed = Number.parseFloat(minimumPayment);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setFormError("Enter a minimum payment above zero, or leave it blank.");
        return;
      }
      minimum = parsed;
    }

    let paymentDueDay: number | null = null;
    if (loanType && dueDay.trim()) {
      const parsed = Number.parseInt(dueDay, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
        setFormError("Payment due day is from 1 to 31, or leave it blank.");
        return;
      }
      paymentDueDay = parsed;
    }

    const merged = loanType ? mergeDraftRate(rates) : { rates };
    if (merged.error) {
      setFormError(merged.error);
      return;
    }

    const opening =
      hasOpening && Number.isFinite(parsedBalance) && parsedBalance > 0
        ? { amount: parsedBalance, date: startingDate }
        : undefined;

    onSave({
      name: name.trim(),
      type,
      onBudget,
      startingBalance: isEdit ? undefined : opening,
      loan: loanType
        ? {
            interestRates: merged.rates,
            minimumPayment: minimum,
            paymentDueDay,
            openingBalance: opening ?? null,
          }
        : undefined,
    });
    onOpenChange(false);
  }

  const loanType = isLoanAccount(type);
  const balanceLabel = loanType
    ? "Opening balance owed"
    : isLiabilityAccount(type)
      ? "Current balance owed"
      : "Current balance";
  const startingTransaction = account
    ? transactions.find(
        (tx) =>
          tx.accountId === account.id && tx.payee === STARTING_BALANCE_PAYEE,
      )
    : undefined;
  const startingReconciled = startingTransaction?.cleared === "reconciled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={loanType ? "budget-dialog sm:max-w-lg" : "budget-dialog sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the name, type, or convert between on-budget and tracking."
              : "A spending account is enough. Loans, mortgages, and lines of credit start off-budget."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              placeholder="Spending"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Account type</Label>
            <Select
              value={type}
              onValueChange={(value) =>
                handleTypeChange(value as BudgetAccountType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((accountType) => (
                  <SelectItem key={accountType} value={accountType}>
                    {ACCOUNT_TYPE_LABELS[accountType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Budget</Label>
            <Tabs
              value={onBudget ? "on-budget" : "tracking"}
              onValueChange={(value) => setOnBudget(value === "on-budget")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="on-budget">On-budget</TabsTrigger>
                <TabsTrigger value="tracking">Tracking</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {onBudget && isCreditCardPaymentAccount({ type, onBudget })
                ? "A payment envelope is created automatically. Card spend moves dollars there; paying the card uses that envelope."
                : onBudget
                  ? "Inflows go to Ready to Assign. Spending hits envelope Activity."
                  : isLiabilityAccount(type)
                    ? "Off-budget. A payment from an on-budget account needs an envelope. Ready to Assign stays the same, and the balance owed goes down."
                    : "Off-budget. Activity here does not change Ready to Assign or envelope Activity. A transfer from an on-budget account lowers Ready to Assign."}
            </p>
          </div>

          {!isEdit || loanType ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="account-starting-balance">{balanceLabel}</Label>
                <Input
                  id="account-starting-balance"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Leave blank if unknown"
                  value={startingBalance}
                  disabled={startingReconciled}
                  onChange={(event) => setStartingBalance(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-starting-date">As of</Label>
                <Input
                  id="account-starting-date"
                  type="date"
                  value={startingDate}
                  disabled={startingReconciled}
                  onChange={(event) => setStartingDate(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {startingReconciled
                  ? "This starting balance is reconciled, so it can’t be changed here."
                  : isCreditCardPaymentAccount({ type, onBudget })
                  ? "Existing debt is not funded. Assign money to the payment envelope when you are ready to pay it. Interest and fees are later transactions on this card."
                  : loanType
                    ? "Leave this blank if you do not know the balance owed yet. A saved balance does not change Ready to Assign."
                    : onBudget
                      ? "A positive balance is income in Ready to Assign, ready to give a job. Leave it blank to add none."
                      : "Tracking only. This balance does not change Ready to Assign. Leave it blank to add none."}
              </p>
            </div>
          ) : null}

          {loanType ? (
            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Loan terms</p>
                <p className="text-xs text-muted-foreground">
                  Leave a field blank when you do not have it. A new rate on a
                  later date keeps the earlier rate. The same date replaces
                  that day only.
                </p>
              </div>
              {rates.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {[...rates]
                    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
                    .map((rate) => (
                      <li
                        key={rate.effectiveDate}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>
                          {formatPercent(rate.annualPercent)} from{" "}
                          {formatBudgetDate(rate.effectiveDate)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          aria-label={`Remove rate from ${formatBudgetDate(rate.effectiveDate)}`}
                          onClick={() => handleRemoveRate(rate.effectiveDate)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No rate saved yet.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="account-rate">Annual rate (%)</Label>
                  <Input
                    id="account-rate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.001"
                    inputMode="decimal"
                    placeholder="Not set"
                    value={draftRate}
                    onChange={(event) => setDraftRate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-rate-date">Rate starts</Label>
                  <Input
                    id="account-rate-date"
                    type="date"
                    value={draftRateDate}
                    onChange={(event) => setDraftRateDate(event.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddRate}>
                  Add rate
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="account-minimum">Minimum payment</Label>
                  <Input
                    id="account-minimum"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Not set"
                    value={minimumPayment}
                    onChange={(event) => setMinimumPayment(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-due-day">Payment due day</Label>
                  <Input
                    id="account-due-day"
                    type="number"
                    min={1}
                    max={31}
                    step={1}
                    inputMode="numeric"
                    placeholder="Optional"
                    value={dueDay}
                    onChange={(event) => setDueDay(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {formError ? (
            <p className="text-xs text-[var(--brand-orange)]">{formError}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!name.trim()}>
            {isEdit ? "Save Changes" : "Add Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
