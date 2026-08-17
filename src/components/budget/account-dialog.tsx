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
import { ACCOUNT_TYPE_LABELS } from "@/lib/budget/accounts";
import type { BudgetAccount, BudgetAccountType } from "@/types/budget";

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as BudgetAccountType[];

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BudgetAccount | null;
  onSave: (name: string, type: BudgetAccountType) => void;
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

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "chequing");
  }, [open, account]);

  function handleSubmit() {
    if (!name.trim()) return;
    onSave(name, type);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the account name or type."
              : "Create an account to track balances and reconcile against your statements."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              placeholder="Main Chequing"
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
              onValueChange={(value) => setType(value as BudgetAccountType)}
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
