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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { useAssetPrice } from "@/hooks/use-asset-price";
import { useAssetSearch } from "@/hooks/use-asset-search";
import {
  DEFAULT_CAGR_BY_TYPE,
  type RetirementPlanAsset,
} from "@/types/retirement";
import type { AssetCatalogItem, AssetType } from "@/types/portfolio";

type DialogMode = AssetType;

interface AddRetirementAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (asset: RetirementPlanAsset) => void;
  existingSymbols: string[];
}

export function AddRetirementAssetDialog({
  open,
  onOpenChange,
  onAdd,
  existingSymbols,
}: AddRetirementAssetDialogProps) {
  const [mode, setMode] = useState<DialogMode>("stock");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [expectedCagr, setExpectedCagr] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");

  const isSearchMode = mode === "stock" || mode === "crypto";
  const { results, isSearching } = useAssetSearch(query, mode, isSearchMode);

  const { price: livePrice, isLoading: isPriceLoading } =
    useAssetPrice(selectedAsset);

  useEffect(() => {
    if (!open) return;
    setMode("stock");
    setQuery("");
    setSelectedAsset(null);
    setQuantity("");
    setUnitPrice("");
    setExpectedCagr(String(DEFAULT_CAGR_BY_TYPE.stock));
    setShowResults(false);
    setPriceTouched(false);
    setSubmitError(null);
    setCustomSymbol("");
    setCustomName("");
  }, [open]);

  useEffect(() => {
    if (priceTouched || !livePrice) return;
    setUnitPrice(livePrice.toFixed(2));
  }, [livePrice, priceTouched]);

  useEffect(() => {
    setExpectedCagr(String(DEFAULT_CAGR_BY_TYPE[mode]));
    setSelectedAsset(null);
    setQuery("");
    setUnitPrice("");
    setPriceTouched(false);
  }, [mode]);

  function handleSelectAsset(asset: AssetCatalogItem) {
    setSelectedAsset(asset);
    setQuery(asset.symbol);
    setShowResults(false);
    setPriceTouched(false);
  }

  function handleSubmit() {
    setSubmitError(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setSubmitError("Enter a valid quantity.");
      return;
    }

    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      setSubmitError("Enter a valid price.");
      return;
    }

    const cagr = Number(expectedCagr);
    if (!Number.isFinite(cagr)) {
      setSubmitError("Enter a valid CAGR.");
      return;
    }

    let asset: RetirementPlanAsset;

    if (mode === "cash") {
      asset = {
        id: crypto.randomUUID(),
        symbol: "CASH",
        name: "Cash (USD)",
        type: "cash",
        unitPrice: 1,
        quantity: qty,
        expectedCagr: cagr,
      };
    } else if (mode === "custom") {
      const symbol = customSymbol.trim().toUpperCase();
      const name = customName.trim();
      if (!symbol || !name) {
        setSubmitError("Symbol and name are required.");
        return;
      }
      if (existingSymbols.includes(symbol)) {
        setSubmitError("This asset is already in the plan.");
        return;
      }
      asset = {
        id: crypto.randomUUID(),
        symbol,
        name,
        type: "custom",
        unitPrice: price,
        quantity: qty,
        expectedCagr: cagr,
      };
    } else {
      if (!selectedAsset) {
        setSubmitError("Select an asset.");
        return;
      }
      if (existingSymbols.includes(selectedAsset.symbol)) {
        setSubmitError("This asset is already in the plan.");
        return;
      }
      asset = {
        id: crypto.randomUUID(),
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        type: mode,
        priceId: selectedAsset.priceId,
        logoUrl: selectedAsset.logoUrl,
        unitPrice: price,
        quantity: qty,
        expectedCagr: cagr,
      };
    }

    onAdd(asset);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Asset to Plan</DialogTitle>
          <DialogDescription>
            Add an investment to your retirement projection model.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as DialogMode)}
        >
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
            <TabsTrigger value="stock" className="gap-1.5 text-xs">
              <TrendingUp className="size-3.5" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="crypto" className="gap-1.5 text-xs">
              <Bitcoin className="size-3.5" />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1.5 text-xs">
              <PenLine className="size-3.5" />
              Custom
            </TabsTrigger>
            <TabsTrigger value="cash" className="gap-1.5 text-xs">
              <Banknote className="size-3.5" />
              Cash
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4 pt-2">
          {isSearchMode && (
            <div className="space-y-2">
              <Label>Search asset</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedAsset(null);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search ticker or name…"
                  className="pl-9"
                />
                {showResults && query.length >= 1 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {isSearching ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Searching…
                      </div>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No results found.
                      </p>
                    ) : (
                      results.map((asset) => (
                        <button
                          key={`${asset.symbol}-${asset.priceId ?? ""}`}
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
                          onClick={() => handleSelectAsset(asset)}
                        >
                          <AssetLogo
                            symbol={asset.symbol}
                            name={asset.name}
                            type={mode}
                            logoUrl={asset.logoUrl}
                            priceId={asset.priceId}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{asset.symbol}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {asset.name}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedAsset && (
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <AssetLogo
                    symbol={selectedAsset.symbol}
                    name={selectedAsset.name}
                    type={mode}
                    logoUrl={selectedAsset.logoUrl}
                    priceId={selectedAsset.priceId}
                    size="md"
                  />
                  <div>
                    <p className="font-semibold">{selectedAsset.symbol}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAsset.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="custom-symbol">Symbol</Label>
                <Input
                  id="custom-symbol"
                  value={customSymbol}
                  onChange={(event) => setCustomSymbol(event.target.value)}
                  placeholder="e.g. REIT-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-name">Name</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="e.g. Rental Property"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity held</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
            </div>

            {mode !== "cash" && (
              <div className="space-y-2">
                <Label htmlFor="unit-price">
                  Asset price (USD)
                  {isPriceLoading && (
                    <Loader2 className="ml-1 inline size-3 animate-spin" />
                  )}
                </Label>
                <Input
                  id="unit-price"
                  type="number"
                  min="0"
                  step="any"
                  value={unitPrice}
                  onChange={(event) => {
                    setUnitPrice(event.target.value);
                    setPriceTouched(true);
                  }}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cagr">Expected CAGR %</Label>
              <Input
                id="cagr"
                type="number"
                step="0.1"
                value={expectedCagr}
                onChange={(event) => setExpectedCagr(event.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <Plus className="size-4" />
            Add asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddRetirementAssetButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} className="gap-2">
      <Plus className="size-4" />
      Add New Asset
    </Button>
  );
}
