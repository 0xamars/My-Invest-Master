"use client";

import { useEffect, useState } from "react";
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
  isOnBudgetAccount,
} from "@/lib/budget/accounts";
import type { BudgetAccount, BudgetAccountType } from "@/types/budget";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as BudgetAccountType[];

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BudgetAccount | null;
  onSave: (name: string, type: BudgetAccountType, onBudget: boolean) => void;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  onSave,
}: AccountDialogProps) {
  const isEdit = Boolean(account);
  const [name, setName] = useState("");
  const [type, setType] = useState<BudgetAccountType>("chequing");
  const [onBudget, setOnBudget] = useState(true);

  useEffect(() => {
    if (!open) return;
    const nextType = account?.type ?? "chequing";
    setName(account?.name ?? "");
    setType(nextType);
    setOnBudget(
      account ? isOnBudgetAccount(account) : defaultOnBudgetForType(nextType),
    );
  }, [open, account]);

  function handleTypeChange(nextType: BudgetAccountType) {
    setType(nextType);
    if (!isEdit) {
      setOnBudget(defaultOnBudgetForType(nextType));
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    onSave(name, type, onBudget);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the name, type, or convert between on-budget and tracking."
              : "A spending account is enough. Tracking accounts stay off-budget."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
            <Label>Budget</Label>
            <Tabs
              value={onBudget ? "on-budget" : "tracking"}
              onValueChange={(value) => setOnBudget(value === "on-budget")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="on-budget">
                  On-budget
                </TabsTrigger>
                <TabsTrigger value="tracking">
                  Tracking
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {onBudget
                ? "Inflows go to leftover. Spending hits envelope Activity."
                : "Off-budget. Activity does not change leftover or envelope Activity. Transfers in or out of the budget do."}
            </p>
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
