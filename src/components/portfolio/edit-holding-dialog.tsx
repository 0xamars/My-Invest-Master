"use client";

import { useEffect, useState } from "react";
import { Banknote, Loader2, Save } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetPrice } from "@/hooks/use-asset-price";
import { formatPrice } from "@/lib/portfolio/format";
import type { DisplayCurrency } from "@/types/currency";
import { DISPLAY_CURRENCIES } from "@/types/currency";
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
  const [costPrice, setCostPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [manualCurrentPrice, setManualCurrentPrice] = useState("");
  const [customName, setCustomName] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashCurrency, setCashCurrency] = useState<DisplayCurrency>("USD");

  const liveAsset =
    holding && isLivePricedAsset(holding.type)
      ? {
          symbol: holding.symbol,
          name: holding.name,
          type: holding.type,
          category: holding.category,
          subCategory: holding.subCategory,
          priceId: holding.priceId,
          logoUrl: holding.logoUrl,
        }
      : null;

  const { price: livePrice, isLoading: isPriceLoading, error: priceError } =
    useAssetPrice(liveAsset);

  useEffect(() => {
    if (!holding || !open) return;

    setCostPrice(holding.costPrice.toString());
    setQuantity(holding.quantity.toString());
    setManualCurrentPrice(holding.manualCurrentPrice?.toString() ?? "");
    setCustomName(holding.name);
    setCashAmount(holding.quantity.toString());
    setCashCurrency(getCashCurrency(holding));
  }, [holding, open]);

  if (!holding) return null;

  const handleSave = () => {
    if (holding.type === "cash") {
      const parsedAmount = parseFloat(cashAmount);
      if (!parsedAmount || parsedAmount <= 0) return;

      onSave(holding.id, {
        quantity: parsedAmount,
        cashCurrency,
        costPrice: 1,
      });
      onOpenChange(false);
      return;
    }

    if (holding.type === "custom") {
      const parsedCurrent = parseFloat(manualCurrentPrice);
      const parsedCost = parseFloat(costPrice);
      const parsedQty = parseFloat(quantity);

      if (!parsedCurrent || parsedCurrent <= 0) return;
      if (!parsedCost || parsedCost <= 0 || !parsedQty || parsedQty <= 0) return;

      onSave(holding.id, {
        name: customName.trim() || holding.symbol,
        manualCurrentPrice: parsedCurrent,
        costPrice: parsedCost,
        quantity: parsedQty,
      });
      onOpenChange(false);
      return;
    }

    const parsedCost = parseFloat(costPrice);
    const parsedQty = parseFloat(quantity);
    if (!parsedCost || parsedCost <= 0 || !parsedQty || parsedQty <= 0) return;

    onSave(holding.id, {
      costPrice: parsedCost,
      quantity: parsedQty,
    });
    onOpenChange(false);
  };

  const isValid =
    holding.type === "cash"
      ? parseFloat(cashAmount) > 0
      : holding.type === "custom"
        ? parseFloat(manualCurrentPrice) > 0 &&
          parseFloat(costPrice) > 0 &&
          parseFloat(quantity) > 0
        : parseFloat(costPrice) > 0 && parseFloat(quantity) > 0 && !isPriceLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Holding</DialogTitle>
          <DialogDescription>
            Update quantity, cost basis, or manual prices for this entry.
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
                {holding.category} · {holding.subCategory}
              </p>
            </div>
          </div>

          {isLivePricedAsset(holding.type) && (
            <>
              <div className="rounded-md border bg-background px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Current Market Price
                </p>
                {isPriceLoading ? (
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Fetching live price…
                  </div>
                ) : priceError ? (
                  <p className="mt-1 text-sm text-destructive">{priceError}</p>
                ) : livePrice !== null ? (
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatPrice(livePrice, holding.type)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-cost-price">Average Cost Price</Label>
                  <Input
                    id="edit-cost-price"
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>
            </>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-custom-cost">Average Cost Price</Label>
                  <Input
                    id="edit-custom-cost"
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-custom-qty">Quantity</Label>
                  <Input
                    id="edit-custom-qty"
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
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
                  <p className="font-semibold">Cash Balance</p>
                  <p className="text-sm text-muted-foreground">
                    Update the amount or currency for this cash entry.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-cash-currency">Currency</Label>
                  <Select
                    value={cashCurrency}
                    onValueChange={(value) =>
                      setCashCurrency(value as DisplayCurrency)
                    }
                  >
                    <SelectTrigger id="edit-cash-currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPLAY_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cash-amount">Amount</Label>
                  <Input
                    id="edit-cash-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid} className="gap-2">
            {isLivePricedAsset(holding.type) && isPriceLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
