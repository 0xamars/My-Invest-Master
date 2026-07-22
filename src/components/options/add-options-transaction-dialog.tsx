"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Search } from "lucide-react";
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
import { useAssetSearch } from "@/hooks/use-asset-search";
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

  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [showResults, setShowResults] = useState(false);
  const [optionType, setOptionType] = useState<OptionType>("buy_call");
  const [txDate, setTxDate] = useState(getTodayDateString);
  const [expiryDate, setExpiryDate] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [contracts, setContracts] = useState("");
  const [premiumPerContract, setPremiumPerContract] = useState("");

  const { results, isSearching, error: searchError } = useAssetSearch(
    query,
    "stock",
    !isEditing && showResults && !selectedAsset && query.trim().length > 0,
  );

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
      setQuery(editingPosition.ticker);
      setShowResults(false);
      setOptionType(editingPosition.optionType);
      setTxDate(editingPosition.txDate);
      setExpiryDate(editingPosition.expiryDate);
      setStrikePrice(editingPosition.strikePrice.toString());
      setContracts(editingPosition.contracts.toString());
      setPremiumPerContract(editingPosition.premiumPerContract.toString());
    }
  }, [open, editingPosition]);

  function resetForm() {
    setQuery("");
    setSelectedAsset(null);
    setShowResults(false);
    setOptionType("buy_call");
    setTxDate(getTodayDateString());
    setExpiryDate("");
    setStrikePrice("");
    setContracts("");
    setPremiumPerContract("");
  }

  const handleSelectAsset = (asset: AssetCatalogItem) => {
    setSelectedAsset(asset);
    setQuery(asset.symbol);
    setShowResults(false);
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

  const showDropdown =
    !isEditing && showResults && !selectedAsset && query.trim().length > 0;

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
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="options-ticker"
                placeholder="Search stock ticker, e.g. AAPL, TSLA"
                value={query}
                onChange={(e) => {
                  if (isEditing) return;
                  setQuery(e.target.value.toUpperCase());
                  setSelectedAsset(null);
                  setShowResults(true);
                }}
                onFocus={() => !isEditing && setShowResults(true)}
                onKeyDown={(e) => {
                  if (isEditing) return;
                  if (e.key === "Enter" && results[0] && !selectedAsset) {
                    e.preventDefault();
                    handleSelectAsset(results[0]);
                  }
                }}
                className="pl-9"
                autoComplete="off"
                readOnly={isEditing}
              />
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Searching…
                    </div>
                  ) : searchError ? (
                    <div className="px-3 py-3 text-sm text-destructive">
                      {searchError}
                    </div>
                  ) : results.length > 0 ? (
                    results.map((asset) => (
                      <button
                        key={asset.symbol}
                        type="button"
                        onClick={() => handleSelectAsset(asset)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <AssetLogo
                          symbol={asset.symbol}
                          name={asset.name}
                          type="stock"
                          logoUrl={asset.logoUrl}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold">{asset.symbol}</span>
                          <span className="ml-2 truncate text-muted-foreground">
                            {asset.name}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No results for &quot;{query.trim().toUpperCase()}&quot;.
                    </div>
                  )}
                </div>
              )}
            </div>
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
