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
import type { RetirementPlan } from "@/types/retirement";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import { getPlanTotalValue } from "@/types/retirement";

interface DeleteRetirementPlanDialogProps {
  plan: RetirementPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
  currency: DisplayCurrency;
  rates: FxRates;
}

export function DeleteRetirementPlanDialog({
  plan,
  open,
  onOpenChange,
  onConfirm,
  currency,
  rates,
}: DeleteRetirementPlanDialogProps) {
  if (!plan) return null;

  const totalValue = getPlanTotalValue(plan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Freedom plan</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{plan.name}&rdquo; and all its
            projections. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-semibold">{plan.name}</p>
          <p className="text-sm text-muted-foreground">
            Target {plan.retirementYear} ·{" "}
            {formatDisplayMoney(totalValue, currency, rates)} ·{" "}
            {plan.assets.length} assets
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
