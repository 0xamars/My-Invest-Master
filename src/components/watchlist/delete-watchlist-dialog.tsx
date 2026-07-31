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
import type { UserWatchlist } from "@/types/watchlist";

interface DeleteWatchlistDialogProps {
  watchlist: UserWatchlist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void | Promise<void>;
}

export function DeleteWatchlistDialog({
  watchlist,
  open,
  onOpenChange,
  onConfirm,
}: DeleteWatchlistDialogProps) {
  if (!watchlist) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete watchlist</DialogTitle>
          <DialogDescription>
            This will permanently delete “{watchlist.name}” and its tickers.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-semibold">{watchlist.name}</p>
          <p className="text-sm text-muted-foreground">
            {watchlist.items.length} ticker
            {watchlist.items.length === 1 ? "" : "s"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => void onConfirm(watchlist.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
