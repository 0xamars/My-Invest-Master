"use client";

import { useEffect, useState } from "react";
import { Banknote, Loader2, Save } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { SectorSelect } from "@/components/portfolio/sector-select";
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
import { formatPrice, formatQuantity } from "@/lib/portfolio/format";
import {
  resolveSectorChoice,
  toSectorChoiceValue,
} from "@/lib/portfolio/sectors";
import {
  DISPLAY_CURRENCIES,
  getCurrencyMeta,
  getCurrencySymbol,
  type DisplayCurrency,
} from "@/types/currency";
import type {
  PortfolioHolding,
  UpdateHoldingInput,
} from "@/types/portfolio";
import { getCashCurrency, isLivePricedAsset } from "@/types/portfolio";

interface EditHoldingDialogProps {
  holding: PortfolioHolding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, input: UpdateHoldingInput) => void;
}

export function EditHoldingDialog({
  holding,
  open,
  onOpenChange,
  onSave,
}: EditHoldingDialogProps) {
  const [manualCurrentPrice, setManualCurrentPrice] = useState("");
  const [customName, setCustomName] = useState("");
  const [cashCurrency, setCashCurrency] = useState<DisplayCurrency>("USD");
  const [sectorChoice, setSectorChoice] = useState("Other");
  const [customSector, setCustomSector] = useState("");

  const resolvedSector = resolveSectorChoice(sectorChoice, customSector);

  useEffect(() => {
    if (!holding || !open) return;

    setManualCurrentPrice(holding.manualCurrentPrice?.toString() ?? "");
    setCustomName(holding.name);
    setCashCurrency(getCashCurrency(holding));
    const sectorFields = toSectorChoiceValue(holding.sector);
    setSectorChoice(sectorFields.choice);
    setCustomSector(sectorFields.customValue);
  }, [holding, open]);

  if (!holding) return null;

  const handleSave = () => {
    if (holding.type === "cash") {
      onSave(holding.id, { cashCurrency });
      onOpenChange(false);
      return;
    }

    if (holding.type === "custom") {
      const parsedCurrent = parseFloat(manualCurrentPrice);
      if (!parsedCurrent || parsedCurrent <= 0) return;

      onSave(holding.id, {
        name: customName.trim() || holding.symbol,
        sector: resolvedSector ?? holding.sector,
        manualCurrentPrice: parsedCurrent,
      });
      onOpenChange(false);
      return;
    }

    onSave(holding.id, {
      sector: resolvedSector ?? holding.sector,
    });
    onOpenChange(false);
  };

  const isValid =
    holding.type === "cash"
      ? true
      : holding.type === "custom"
        ? parseFloat(manualCurrentPrice) > 0 && !!resolvedSector
        : !!resolvedSector;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Update sector or manual prices. Quantity and cost are managed via
            transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <AssetLogo
              symbol={holding.symbol}
              name={holding.name}
              type={holding.type}
              logoUrl={holding.logoUrl}
              priceId={holding.priceId}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{holding.symbol}</p>
              <p className="truncate text-sm text-muted-foreground">
                {holding.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatQuantity(holding.quantity, holding.type)} @{" "}
                {formatPrice(holding.costPrice, holding.type)} avg
              </p>
            </div>
          </div>

          {holding.type !== "cash" && (
            <SectorSelect
              assetType={holding.type}
              sectorChoice={sectorChoice}
              customSector={customSector}
              onSectorChoiceChange={setSectorChoice}
              onCustomSectorChange={setCustomSector}
              idPrefix="edit"
            />
          )}

          {holding.type === "custom" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-custom-name">Name</Label>
                <Input
                  id="edit-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-current-price">Current Price (USD)</Label>
                <Input
                  id="edit-current-price"
                  type="number"
                  min="0"
                  step="any"
                  value={manualCurrentPrice}
                  onChange={(e) => setManualCurrentPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {holding.type === "cash" && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Banknote className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">Cash Currency</p>
                  <p className="text-sm text-muted-foreground">
                    Use Add Transaction to deposit or withdraw cash.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cash-currency">Currency</Label>
                <Select
                  value={cashCurrency}
                  onValueChange={(value) => {
                    if (value) setCashCurrency(value as DisplayCurrency);
                  }}
                >
                  <SelectTrigger id="edit-cash-currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {getCurrencySymbol(code)}
                          </span>
                          <span className="font-medium">{code}</span>
                          <span className="text-muted-foreground">
                            {getCurrencyMeta(code).name}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isLivePricedAsset(holding.type) && (
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              To change quantity or average cost, use{" "}
              <span className="font-medium text-foreground">Add Transaction</span>{" "}
              with a buy or sell entry.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid} className="gap-2">
            <Save className="size-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
