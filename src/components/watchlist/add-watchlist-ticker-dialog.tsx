"use client";

import { useEffect, useState } from "react";
import { Bitcoin, Loader2, Search, TrendingUp } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetSearch } from "@/hooks/use-asset-search";
import type { AddWatchlistTickerInput } from "@/hooks/use-watchlist-plans-storage";
import type { AssetCatalogItem } from "@/types/portfolio";
import type { WatchlistAssetType } from "@/types/watchlist";
import { isWatchlistAssetType } from "@/types/watchlist";

interface AddWatchlistTickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddWatchlistTickerInput) => void;
  existingKeys: string[];
}

function assetKey(symbol: string, type: string) {
  return `${symbol.toUpperCase()}:${type}`;
}

export function AddWatchlistTickerDialog({
  open,
  onOpenChange,
  onAdd,
  existingKeys,
}: AddWatchlistTickerDialogProps) {
  const [mode, setMode] = useState<WatchlistAssetType>("stock");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [showResults, setShowResults] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { results, isSearching, error: searchError } = useAssetSearch(
    query,
    mode,
    open,
  );

  useEffect(() => {
    if (!open) return;
    setMode("stock");
    setQuery("");
    setSelectedAsset(null);
    setShowResults(false);
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    setSelectedAsset(null);
    setQuery("");
    setShowResults(false);
    setSubmitError(null);
  }, [mode]);

  function handleSelectAsset(asset: AssetCatalogItem) {
    if (!isWatchlistAssetType(asset.type)) return;
    setSelectedAsset(asset);
    setQuery(asset.symbol);
    setShowResults(false);
    setSubmitError(null);
  }

  function handleSubmit() {
    setSubmitError(null);

    if (!selectedAsset || !isWatchlistAssetType(selectedAsset.type)) {
      setSubmitError("Select a stock or crypto ticker.");
      return;
    }

    const key = assetKey(selectedAsset.symbol, selectedAsset.type);
    if (existingKeys.includes(key)) {
      setSubmitError("This ticker is already on the watchlist.");
      return;
    }

    onAdd({
      symbol: selectedAsset.symbol,
      name: selectedAsset.name,
      type: selectedAsset.type,
      priceId: selectedAsset.priceId,
      logoUrl: selectedAsset.logoUrl,
    });
    onOpenChange(false);
  }

  const canSubmit = Boolean(selectedAsset) && !isSearching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add ticker</DialogTitle>
          <DialogDescription>
            Search stocks or crypto to stage on this watchlist. This does not
            add a holding to your portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (isWatchlistAssetType(value)) setMode(value);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stock" className="gap-1.5">
                <TrendingUp className="size-3.5" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-1.5">
                <Bitcoin className="size-3.5" />
                Crypto
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative space-y-1.5">
            <Label htmlFor="watchlist-ticker-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="watchlist-ticker-search"
                className="pl-9"
                placeholder={
                  mode === "stock" ? "Search AAPL, NVDA…" : "Search BTC, ETH…"
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedAsset(null);
                  setShowResults(true);
                  if (submitError) setSubmitError(null);
                }}
                onFocus={() => setShowResults(true)}
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {showResults && query.trim().length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
                {results.length === 0 && !isSearching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {searchError ?? "No matches found."}
                  </p>
                ) : (
                  results.map((asset) => {
                    const alreadyAdded = existingKeys.includes(
                      assetKey(asset.symbol, asset.type),
                    );
                    return (
                      <button
                        key={`${asset.symbol}-${asset.type}`}
                        type="button"
                        disabled={alreadyAdded}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleSelectAsset(asset)}
                      >
                        <AssetLogo
                          symbol={asset.symbol}
                          name={asset.name}
                          type={asset.type}
                          logoUrl={asset.logoUrl}
                          priceId={asset.priceId}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {asset.symbol}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {asset.name}
                            {alreadyAdded ? " · Already added" : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {selectedAsset && (
            <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
              <AssetLogo
                symbol={selectedAsset.symbol}
                name={selectedAsset.name}
                type={selectedAsset.type}
                logoUrl={selectedAsset.logoUrl}
                priceId={selectedAsset.priceId}
                size="sm"
              />
              <div className="min-w-0">
                <p className="font-medium">{selectedAsset.symbol}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedAsset.name}
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2"
          >
            Add to watchlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
