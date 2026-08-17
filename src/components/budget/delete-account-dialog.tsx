"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_LABELS } from "@/lib/budget/accounts";
import type { BudgetAccount } from "@/types/budget";

interface DeleteAccountDialogProps {
  account: BudgetAccount | null;
  otherAccounts: BudgetAccount[];
  transactionCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    strategy:
      | { type: "move"; targetAccountId: string }
      | { type: "delete-transactions" },
  ) => void;
}

export function DeleteAccountDialog({
  account,
  otherAccounts,
  transactionCount,
  open,
  onOpenChange,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [strategy, setStrategy] = useState<"move" | "delete-transactions">(
    "move",
  );
  const [targetAccountId, setTargetAccountId] = useState("");

  useEffect(() => {
    if (!open) return;
    setStrategy("move");
    setTargetAccountId(otherAccounts[0]?.id ?? "");
  }, [open, otherAccounts]);

  if (!account) return null;

  function handleConfirm() {
    if (strategy === "move") {
      if (!targetAccountId) return;
      onConfirm({ type: "move", targetAccountId });
    } else {
      onConfirm({ type: "delete-transactions" });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This will remove &ldquo;{account.name}&rdquo; from your budget plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-semibold">{account.name}</p>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]} · {transactionCount}{" "}
              transaction{transactionCount === 1 ? "" : "s"}
            </p>
          </div>

          {transactionCount > 0 && (
            <div className="space-y-3">
              <Label>What should happen to these transactions?</Label>
              <Select
                value={strategy}
                onValueChange={(value) =>
                  setStrategy(value as "move" | "delete-transactions")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="move">Move to another account</SelectItem>
                  <SelectItem value="delete-transactions">
                    Delete all transactions
                  </SelectItem>
                </SelectContent>
              </Select>

              {strategy === "move" && otherAccounts.length > 0 && (
                <Select
                  value={targetAccountId}
                  onValueChange={(value) => setTargetAccountId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherAccounts.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleConfirm}
            disabled={strategy === "move" && !targetAccountId}
          >
            <Trash2 className="size-4" />
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
