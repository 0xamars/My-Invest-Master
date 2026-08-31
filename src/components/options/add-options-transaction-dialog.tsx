"use client";

import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import {
  TickerSearch,
  toAssetCatalogItem,
} from "@/components/ticker/ticker-search";
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
import { getTodayDateString } from "@/lib/portfolio/transactions";
import { cn } from "@/lib/utils";
import {
  calculateOptionsCost,
  OPTION_TYPE_LABELS,
  type AddOptionsTransactionInput,
  type OptionType,
  type OptionsPosition,
  type UpdateOptionsPositionInput,
} from "@/types/options";
import type { AssetCatalogItem } from "@/types/portfolio";
import { formatCurrency } from "@/lib/portfolio/format";

interface OptionsTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPosition?: OptionsPosition | null;
  onAdd: (input: AddOptionsTransactionInput) => void;
  onUpdate: (id: string, input: UpdateOptionsPositionInput) => void;
}

const OPTION_TYPES: OptionType[] = [
  "buy_call",
  "sell_call",
  "buy_put",
  "sell_put",
];

export function OptionsTransactionDialog({
  open,
  onOpenChange,
  editingPosition = null,
  onAdd,
  onUpdate,
}: OptionsTransactionDialogProps) {
  const isEditing = editingPosition !== null;

  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [optionType, setOptionType] = useState<OptionType>("buy_call");
  const [txDate, setTxDate] = useState(getTodayDateString);
  const [expiryDate, setExpiryDate] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [contracts, setContracts] = useState("");
  const [premiumPerContract, setPremiumPerContract] = useState("");

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (editingPosition) {
      setSelectedAsset({
        symbol: editingPosition.ticker,
        name: editingPosition.name,
        type: "stock",
        category: "Stock",
        subCategory: "Equity",
        logoUrl: editingPosition.logoUrl,
      });
      setOptionType(editingPosition.optionType);
      setTxDate(editingPosition.txDate);
      setExpiryDate(editingPosition.expiryDate);
      setStrikePrice(editingPosition.strikePrice.toString());
      setContracts(editingPosition.contracts.toString());
      setPremiumPerContract(editingPosition.premiumPerContract.toString());
    }
  }, [open, editingPosition]);

  function resetForm() {
    setSelectedAsset(null);
    setOptionType("buy_call");
    setTxDate(getTodayDateString());
    setExpiryDate("");
    setStrikePrice("");
    setContracts("");
    setPremiumPerContract("");
  }

  const handleSelectAsset = (asset: AssetCatalogItem) => {
    setSelectedAsset(asset);
  };

  const parsedContracts = parseFloat(contracts);
  const parsedPremium = parseFloat(premiumPerContract);
  const parsedStrike = parseFloat(strikePrice);
  const totalCost =
    parsedContracts > 0 && parsedPremium > 0
      ? calculateOptionsCost(parsedContracts, parsedPremium)
      : null;

  const isValid =
    selectedAsset &&
    parsedStrike > 0 &&
    parsedContracts > 0 &&
    parsedPremium > 0 &&
    txDate &&
    expiryDate &&
    expiryDate >= txDate;

  const handleSubmit = () => {
    if (!selectedAsset || !isValid) return;

    const payload = {
      ticker: selectedAsset.symbol,
      name: selectedAsset.name,
      logoUrl: selectedAsset.logoUrl,
      optionType,
      txDate,
      expiryDate,
      strikePrice: parsedStrike,
      contracts: parsedContracts,
      premiumPerContract: parsedPremium,
      cost: calculateOptionsCost(parsedContracts, parsedPremium),
    };

    if (isEditing && editingPosition) {
      onUpdate(editingPosition.id, payload);
    } else {
      onAdd(payload);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Options Transaction" : "Add Options Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update trade details. Total cost recalculates automatically."
              : "Record an options trade. Total cost is contracts × premium × 100."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="options-ticker">Ticker</Label>
            <TickerSearch
              key={`${open}-${isEditing ? editingPosition?.id ?? "edit" : "new"}`}
              id="options-ticker"
              assetType="stock"
              disabled={isEditing}
              defaultQuery={isEditing ? (editingPosition?.ticker ?? "") : ""}
              placeholder="Search stock ticker, e.g. AAPL, TSLA"
              onSelect={(hit) => handleSelectAsset(toAssetCatalogItem(hit))}
              onClear={() => {
                if (!isEditing) setSelectedAsset(null);
              }}
            />
          </div>

          {selectedAsset && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <AssetLogo
                symbol={selectedAsset.symbol}
                name={selectedAsset.name}
                type="stock"
                logoUrl={selectedAsset.logoUrl}
                size="sm"
              />
              <div className="min-w-0">
                <p className="font-semibold">{selectedAsset.symbol}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedAsset.name}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="option-type">Type</Label>
            <Select
              value={optionType}
              onValueChange={(value) => {
                if (value) setOptionType(value as OptionType);
              }}
            >
              <SelectTrigger id="option-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {OPTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {OPTION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Transaction Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                min={txDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="strike-price">Strike Price</Label>
              <Input
                id="strike-price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contracts">Contracts</Label>
              <Input
                id="contracts"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={contracts}
                onChange={(e) => setContracts(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="premium">Premium per Contract</Label>
            <Input
              id="premium"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={premiumPerContract}
              onChange={(e) => setPremiumPerContract(e.target.value)}
            />
          </div>

          {totalCost !== null && (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total{" "}
                {optionType.startsWith("sell") ? "Premium Received" : "Cost"}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCurrency(totalCost)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {parsedContracts} × {formatCurrency(parsedPremium)} × 100
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="gap-2">
            {isEditing ? (
              <>
                <Save className="size-4" />
                Save Changes
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add Transaction
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use OptionsTransactionDialog */
export const AddOptionsTransactionDialog = OptionsTransactionDialog;

interface AddOptionsTransactionButtonProps {
  onClick: () => void;
  className?: string;
}

export function AddOptionsTransactionButton({
  onClick,
  className,
}: AddOptionsTransactionButtonProps) {
  return (
    <Button onClick={onClick} className={cn("premium-cta", className)}>
      <Plus className="size-4" strokeWidth={2.25} />
      Add Options Transaction
    </Button>
  );
}
