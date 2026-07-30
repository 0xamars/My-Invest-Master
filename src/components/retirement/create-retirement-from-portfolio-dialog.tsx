"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
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
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import {
  portfolioHoldingToPlanAsset,
  resolveHoldingUnitPrice,
} from "@/lib/retirement/portfolio-import";
import type { UserPortfolio } from "@/types/portfolio";
import type { RetirementPlanAsset } from "@/types/retirement";

interface CreateRetirementFromPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolios: UserPortfolio[];
  defaultPortfolioId?: string | null;
  isSubmitting?: boolean;
  onConfirm: (input: {
    portfolioId: string;
    portfolioName: string;
    assets: RetirementPlanAsset[];
  }) => void | Promise<void>;
}

export function CreateRetirementFromPortfolioDialog({
  open,
  onOpenChange,
  portfolios,
  defaultPortfolioId,
  isSubmitting = false,
  onConfirm,
}: CreateRetirementFromPortfolioDialogProps) {
  const initialId =
    defaultPortfolioId &&
    portfolios.some((portfolio) => portfolio.id === defaultPortfolioId)
      ? defaultPortfolioId
      : portfolios.find((portfolio) => portfolio.isPrimary)?.id ??
        portfolios[0]?.id ??
        "";

  const [selectedId, setSelectedId] = useState(initialId);

  useEffect(() => {
    if (open) {
      setSelectedId(initialId);
    }
  }, [open, initialId]);

  const selectedPortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedId) ?? null;

  const visibleHoldings = useMemo(
    () => (selectedPortfolio?.holdings ?? []).filter(isHoldingVisible),
    [selectedPortfolio],
  );

  const { prices, isLoading: isPricesLoading } =
    usePortfolioPrices(visibleHoldings);

  const holdingCount = visibleHoldings.length;
  const canSubmit =
    Boolean(selectedPortfolio) && holdingCount > 0 && !isSubmitting;

  async function handleConfirm() {
    if (!selectedPortfolio || holdingCount === 0) return;

    const assets = visibleHoldings.map((holding) =>
      portfolioHoldingToPlanAsset(
        holding,
        resolveHoldingUnitPrice(holding, prices),
      ),
    );

    await onConfirm({
      portfolioId: selectedPortfolio.id,
      portfolioName: selectedPortfolio.name,
      assets,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create plan from portfolio</DialogTitle>
          <DialogDescription>
            Choose which portfolio to import holdings from. Primary portfolios
            are marked with a star.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label htmlFor="retirement-portfolio">Portfolio</Label>
          <Select
            value={selectedId || undefined}
            onValueChange={(value) => value && setSelectedId(value)}
          >
            <SelectTrigger id="retirement-portfolio" className="w-full">
              <SelectValue placeholder="Select a portfolio" />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((portfolio) => (
                <SelectItem key={portfolio.id} value={portfolio.id}>
                  <span className="flex items-center gap-1.5">
                    {portfolio.isPrimary && (
                      <Star className="size-3.5 fill-primary text-primary" />
                    )}
                    <span>{portfolio.name}</span>
                    {portfolio.isPrimary && (
                      <span className="text-xs text-muted-foreground">
                        Primary
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedPortfolio
              ? isPricesLoading
                ? "Loading live prices…"
                : `${holdingCount} holding${holdingCount === 1 ? "" : "s"} will be imported`
              : "Select a portfolio to continue."}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
