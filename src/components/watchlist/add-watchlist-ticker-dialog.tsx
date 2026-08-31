"use client";

import { useEffect, useState } from "react";
import { Bitcoin, TrendingUp } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("stock");
    setSelectedAsset(null);
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    setSelectedAsset(null);
    setSubmitError(null);
  }, [mode]);

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

  const canSubmit = Boolean(selectedAsset);

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

          <div className="space-y-1.5">
            <Label htmlFor="watchlist-ticker-search">Search</Label>
            <TickerSearch
              key={`${open}-${mode}`}
              id="watchlist-ticker-search"
              assetType={mode}
              autoFocus
              placeholder={
                mode === "stock" ? "Search AAPL, NVDA…" : "Search BTC, ETH…"
              }
              isDisabled={(hit) =>
                existingKeys.includes(assetKey(hit.symbol, hit.type))
              }
              onSelect={(hit) => {
                const asset = toAssetCatalogItem(hit);
                if (!isWatchlistAssetType(asset.type)) return;
                setSelectedAsset(asset);
                setSubmitError(null);
              }}
              onClear={() => setSelectedAsset(null)}
            />
          </div>

          {selectedAsset ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
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
          ) : null}

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
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
