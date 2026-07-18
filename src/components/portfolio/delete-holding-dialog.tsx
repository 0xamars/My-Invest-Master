"use client";

import { Trash2 } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PortfolioHolding } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

interface DeleteHoldingDialogProps {
  holding: PortfolioHolding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}

export function DeleteHoldingDialog({
  holding,
  open,
  onOpenChange,
  onConfirm,
}: DeleteHoldingDialogProps) {
  if (!holding) return null;

  const label =
    holding.type === "cash"
      ? `Cash (${getCashCurrency(holding)})`
      : holding.symbol;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Holding</DialogTitle>
          <DialogDescription>
            This will permanently remove the entry from your portfolio. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AssetLogo
            symbol={holding.symbol}
            name={holding.name}
            type={holding.type}
            logoUrl={holding.logoUrl}
            priceId={holding.priceId}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-semibold">{label}</p>
            <p className="truncate text-sm text-muted-foreground">
              {holding.name}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => {
              onConfirm(holding.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
