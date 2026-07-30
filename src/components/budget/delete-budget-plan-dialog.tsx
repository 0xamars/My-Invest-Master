"use client";

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
import { formatBudgetMoney } from "@/lib/budget/format";
import { computeMonthSummary } from "@/lib/budget/calculations";
import { getMonthKey, type BudgetPlan } from "@/types/budget";

interface DeleteBudgetPlanDialogProps {
  plan: BudgetPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}

export function DeleteBudgetPlanDialog({
  plan,
  open,
  onOpenChange,
  onConfirm,
}: DeleteBudgetPlanDialogProps) {
  if (!plan) return null;

  const summary = computeMonthSummary(plan, getMonthKey());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Budget Plan</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{plan.name}&rdquo; and all its
            categories, transactions, and reports. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-semibold">{plan.name}</p>
          <p className="text-sm text-muted-foreground">
            {plan.categories.length} categories · {plan.transactions.length}{" "}
            transactions · {formatBudgetMoney(summary.availableToBudget)} available
            this month
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => {
              onConfirm(plan.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="size-4" />
            Delete plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
