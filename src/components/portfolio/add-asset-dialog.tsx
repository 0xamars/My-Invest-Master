"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Bitcoin,
  Loader2,
  PenLine,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetPrice } from "@/hooks/use-asset-price";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { formatPrice } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency } from "@/types/currency";
import { DISPLAY_CURRENCIES } from "@/types/currency";
import type { AddAssetInput, AssetCatalogItem, AssetType } from "@/types/portfolio";

type DialogMode = AssetType;

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddAssetInput) => void;
}

export function AddAssetDialog({ open, onOpenChange, onAdd }: AddAssetDialogProps) {
  const [mode, setMode] = useState<DialogMode>("stock");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(null);
  const [costPrice, setCostPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [costPriceTouched, setCostPriceTouched] = useState(false);

  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCurrentPrice, setCustomCurrentPrice] = useState("");
  const [customCostPrice, setCustomCostPrice] = useState("");
  const [customQuantity, setCustomQuantity] = useState("");

  const [cashAmount, setCashAmount] = useState("");
  const [cashCurrency, setCashCurrency] = useState<DisplayCurrency>("USD");

  const isSearchMode = mode === "stock" || mode === "crypto";

  const { results, isSearching, error: searchError } = useAssetSearch(
    query,
    mode === "stock" || mode === "crypto" ? mode : "stock",
    isSearchMode && showResults && !selectedAsset && query.trim().length > 0,
  );

  const { price: livePrice, isLoading: isPriceLoading, error: priceError } =
    useAssetPrice(isSearchMode ? selectedAsset : null);

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  useEffect(() => {
    resetSearchFields();
  }, [mode]);

  useEffect(() => {
    if (livePrice !== null && !costPriceTouched && isSearchMode) {
      setCostPrice(livePrice.toString());
    }
  }, [livePrice, costPriceTouched, isSearchMode]);

  function resetSearchFields() {
    setQuery("");
    setSelectedAsset(null);
    setCostPrice("");
    setQuantity("");
    setShowResults(false);
    setCostPriceTouched(false);
    setCustomSymbol("");
    setCustomName("");
    setCustomCurrentPrice("");
    setCustomCostPrice("");
    setCustomQuantity("");
    setCashAmount("");
    setCashCurrency("USD");
  }

  function resetForm() {
    setMode("stock");
    resetSearchFields();
  }

  const handleSelectAsset = (asset: AssetCatalogItem) => {
    setSelectedAsset(asset);
    setQuery(asset.symbol);
    setShowResults(false);
    setCostPrice("");
    setCostPriceTouched(false);
  };

  const handleSubmitSearchAsset = () => {
    if (!selectedAsset) return;
    const parsedCost = parseFloat(costPrice);
    const parsedQty = parseFloat(quantity);
    if (!parsedCost || parsedCost <= 0 || !parsedQty || parsedQty <= 0) return;

    onAdd({ asset: selectedAsset, costPrice: parsedCost, quantity: parsedQty });
    onOpenChange(false);
  };

  const handleSubmitCustom = () => {
    const symbol = customSymbol.trim().toUpperCase();
    const parsedCurrent = parseFloat(customCurrentPrice);
    const parsedCost = parseFloat(customCostPrice);
    const parsedQty = parseFloat(customQuantity);

    if (!symbol || !parsedCurrent || parsedCurrent <= 0) return;
    if (!parsedCost || parsedCost <= 0 || !parsedQty || parsedQty <= 0) return;

    onAdd({
      asset: {
        symbol,
        name: customName.trim() || symbol,
        type: "custom",
        category: "Custom",
        subCategory: "Manual",
      },
      costPrice: parsedCost,
      quantity: parsedQty,
      manualCurrentPrice: parsedCurrent,
    });
    onOpenChange(false);
  };

  const handleSubmitCash = () => {
    const parsedAmount = parseFloat(cashAmount);
    if (!parsedAmount || parsedAmount <= 0) return;

    onAdd({
      asset: {
        symbol: "CASH",
        name: `Cash (${cashCurrency})`,
        type: "cash",
        category: "Cash",
        subCategory: "Liquidity",
      },
      costPrice: 1,
      quantity: parsedAmount,
      manualCurrentPrice: 1,
      cashCurrency,
    });
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (mode === "custom") return handleSubmitCustom();
    if (mode === "cash") return handleSubmitCash();
    return handleSubmitSearchAsset();
  };

  const isSearchValid =
    selectedAsset &&
    parseFloat(costPrice) > 0 &&
    parseFloat(quantity) > 0 &&
    !isPriceLoading;

  const isCustomValid =
    customSymbol.trim().length > 0 &&
    parseFloat(customCurrentPrice) > 0 &&
    parseFloat(customCostPrice) > 0 &&
    parseFloat(customQuantity) > 0;

  const isCashValid = parseFloat(cashAmount) > 0;

  const isValid =
    mode === "custom"
      ? isCustomValid
      : mode === "cash"
        ? isCashValid
        : isSearchValid;

  const showDropdown =
    isSearchMode && showResults && !selectedAsset && query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Asset to Portfolio</DialogTitle>
          <DialogDescription>
            Search live assets, add custom holdings with manual prices, or track
            cash balances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as DialogMode)}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="stock" className="gap-1.5 px-2">
                <TrendingUp className="size-3.5" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-1.5 px-2">
                <Bitcoin className="size-3.5" />
                Crypto
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1.5 px-2">
                <PenLine className="size-3.5" />
                Custom
              </TabsTrigger>
              <TabsTrigger value="cash" className="gap-1.5 px-2">
                <Banknote className="size-3.5" />
                Cash
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isSearchMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="asset-search">Search Ticker / Symbol</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="asset-search"
                    placeholder={
                      mode === "stock"
                        ? "e.g. MSTR, TSLA, AAPL"
                        : "e.g. BTC, ETH, SOL"
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value.toUpperCase());
                      setSelectedAsset(null);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results[0] && !selectedAsset) {
                        e.preventDefault();
                        handleSelectAsset(results[0]);
                      }
                    }}
                    className="pl-9"
                    autoComplete="off"
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
                            key={`${asset.symbol}-${asset.priceId ?? asset.type}`}
                            type="button"
                            onClick={() => handleSelectAsset(asset)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <AssetLogo
                              symbol={asset.symbol}
                              name={asset.name}
                              type={asset.type}
                              logoUrl={asset.logoUrl}
                              priceId={asset.priceId}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{asset.symbol}</span>
                                <span className="truncate text-muted-foreground">
                                  {asset.name}
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {asset.subCategory}
                            </span>
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
                <AssetFormFields
                  asset={selectedAsset}
                  costPrice={costPrice}
                  quantity={quantity}
                  isPriceLoading={isPriceLoading}
                  priceError={priceError}
                  livePrice={livePrice}
                  onCostPriceChange={(value) => {
                    setCostPrice(value);
                    setCostPriceTouched(true);
                  }}
                  onQuantityChange={setQuantity}
                />
              )}
            </>
          )}

          {mode === "custom" && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="custom-symbol">Ticker / Symbol</Label>
                  <Input
                    id="custom-symbol"
                    placeholder="e.g. GOLD, REIT"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Name (optional)</Label>
                  <Input
                    id="custom-name"
                    placeholder="Asset name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-current-price">Current Price (USD)</Label>
                <Input
                  id="custom-current-price"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={customCurrentPrice}
                  onChange={(e) => setCustomCurrentPrice(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="custom-cost-price">Average Cost Price</Label>
                  <Input
                    id="custom-cost-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={customCostPrice}
                    onChange={(e) => setCustomCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-quantity">Quantity</Label>
                  <Input
                    id="custom-quantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "cash" && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Banknote className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">Cash Balance</p>
                  <p className="text-sm text-muted-foreground">
                    Add cash in USD, CAD, or INR. Values convert using live FX
                    rates in the portfolio view.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-currency">Currency</Label>
                  <Select
                    value={cashCurrency}
                    onValueChange={(value) =>
                      setCashCurrency(value as DisplayCurrency)
                    }
                  >
                    <SelectTrigger id="cash-currency" className="w-full">
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
                  <Label htmlFor="cash-amount">Amount</Label>
                  <Input
                    id="cash-amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
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
          <Button onClick={handleSubmit} disabled={!isValid} className="gap-2">
            {isSearchMode && isPriceLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add to Portfolio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetFormFields({
  asset,
  costPrice,
  quantity,
  isPriceLoading,
  priceError,
  livePrice,
  onCostPriceChange,
  onQuantityChange,
}: {
  asset: AssetCatalogItem;
  costPrice: string;
  quantity: string;
  isPriceLoading: boolean;
  priceError: string | null;
  livePrice: number | null;
  onCostPriceChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AssetLogo
            symbol={asset.symbol}
            name={asset.name}
            type={asset.type}
            logoUrl={asset.logoUrl}
            priceId={asset.priceId}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-semibold">{asset.symbol}</p>
            <p className="truncate text-sm text-muted-foreground">{asset.name}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
          {asset.category} · {asset.subCategory}
        </span>
      </div>

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
            {formatPrice(livePrice, asset.type)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cost-price">Average Cost Price</Label>
          <div className="relative">
            <Input
              id="cost-price"
              type="number"
              min="0"
              step="any"
              placeholder={isPriceLoading ? "Loading…" : "0.00"}
              value={costPrice}
              onChange={(e) => onCostPriceChange(e.target.value)}
              disabled={isPriceLoading}
            />
            {isPriceLoading && (
              <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

interface AddAssetButtonProps {
  onClick: () => void;
  className?: string;
}

export function AddAssetButton({ onClick, className }: AddAssetButtonProps) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      className={cn("gap-2 px-6 shadow-sm", className)}
    >
      <Plus className="size-5" />
      Add Asset
    </Button>
  );
}
