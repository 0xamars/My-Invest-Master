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
import type { UserPortfolio } from "@/types/portfolio";

interface DeletePortfolioDialogProps {
  portfolio: UserPortfolio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void | Promise<void>;
  canDelete: boolean;
}

export function DeletePortfolioDialog({
  portfolio,
  open,
  onOpenChange,
  onConfirm,
  canDelete,
}: DeletePortfolioDialogProps) {
  if (!portfolio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete portfolio</DialogTitle>
          <DialogDescription>
            {canDelete
              ? `This will permanently delete “${portfolio.name}” and all of its holdings. This cannot be undone.`
              : "You must keep at least one portfolio."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-semibold">{portfolio.name}</p>
          <p className="text-sm text-muted-foreground">
            {portfolio.holdings.length} holding
            {portfolio.holdings.length === 1 ? "" : "s"}
            {portfolio.isPrimary ? " · Primary" : ""}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            disabled={!canDelete}
            onClick={() => void onConfirm(portfolio.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
