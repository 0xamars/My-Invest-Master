"use client";

import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPremiumUpgradeCopy,
  type PremiumUpgradeReason,
} from "@/lib/plans/upgrade-copy";
import { PRICING_PATH } from "@/lib/plans/pricing";

type PremiumUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: PremiumUpgradeReason | null;
};

export function PremiumUpgradeDialog({
  open,
  onOpenChange,
  reason,
}: PremiumUpgradeDialogProps) {
  if (!reason) return null;

  const copy = getPremiumUpgradeCopy(reason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground">
          Your existing data stays put — Free limits only block creating more
          than your plan allows.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            className="gap-2"
            render={<Link href={PRICING_PATH} />}
            onClick={() => onOpenChange(false)}
          >
            <Crown className="size-4" />
            {copy.ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
