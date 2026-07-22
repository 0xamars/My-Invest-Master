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
import { OPTION_TYPE_LABELS, type OptionsPosition } from "@/types/options";

interface DeleteOptionsDialogProps {
  position: OptionsPosition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}

export function DeleteOptionsDialog({
  position,
  open,
  onOpenChange,
  onConfirm,
}: DeleteOptionsDialogProps) {
  if (!position) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Options Position</DialogTitle>
          <DialogDescription>
            This will permanently remove this options transaction from your
            records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AssetLogo
            symbol={position.ticker}
            name={position.name}
            type="stock"
            logoUrl={position.logoUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-semibold">{position.ticker}</p>
            <p className="text-sm text-muted-foreground">
              {OPTION_TYPE_LABELS[position.optionType]} · {position.contracts}{" "}
              contracts
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
              onConfirm(position.id);
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
