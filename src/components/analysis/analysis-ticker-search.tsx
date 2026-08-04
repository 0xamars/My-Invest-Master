"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bitcoin, Loader2, Search, TrendingUp } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetSearch } from "@/hooks/use-asset-search";
import {
  buildAnalysisHref,
  type AnalysisAssetType,
} from "@/lib/analysis/types";
import { cn } from "@/lib/utils";
import { isWatchlistAssetType } from "@/types/watchlist";
import type { AssetCatalogItem } from "@/types/portfolio";

type AnalysisTickerSearchProps = {
  /** Prefill search mode from the current page asset type. */
  defaultType?: AnalysisAssetType;
  /** Current symbol — selecting the same ticker just closes the menu. */
  currentSymbol?: string;
  currentType?: AnalysisAssetType;
  className?: string;
};

export function AnalysisTickerSearch({
  defaultType = "stock",
  currentSymbol,
  currentType,
  className,
}: AnalysisTickerSearchProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<AnalysisAssetType>(defaultType);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { results, isSearching, error } = useAssetSearch(query, mode, true);

  useEffect(() => {
    setMode(defaultType);
  }, [defaultType]);

  useEffect(() => {
    setQuery("");
    setShowResults(false);
  }, [currentSymbol, currentType]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function openTicker(asset: AssetCatalogItem) {
    if (!isWatchlistAssetType(asset.type)) return;
    const same =
      asset.symbol.toUpperCase() === currentSymbol?.toUpperCase() &&
      asset.type === (currentType ?? defaultType);
    setQuery("");
    setShowResults(false);
    if (same) return;
    router.push(buildAnalysisHref(asset.symbol, asset.type, asset.priceId));
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative z-30 w-full max-w-md", className)}
    >
      <div className="flex items-center gap-2">
        <Tabs
          value={mode}
          onValueChange={(value) => {
            if (value === "stock" || value === "crypto") {
              setMode(value);
              setQuery("");
              setShowResults(false);
            }
          }}
        >
          <TabsList className="h-9 shrink-0">
            <TabsTrigger value="stock" className="gap-1 px-2.5 text-xs">
              <TrendingUp className="size-3.5" />
              <span className="hidden sm:inline">Stock</span>
            </TabsTrigger>
            <TabsTrigger value="crypto" className="gap-1 px-2.5 text-xs">
              <Bitcoin className="size-3.5" />
              <span className="hidden sm:inline">Crypto</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder={
              mode === "stock" ? "Switch ticker…" : "Switch crypto…"
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            aria-label="Search another ticker to analyze"
          />
          {isSearching && (
            <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {showResults && query.trim().length > 0 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {results.length === 0 && !isSearching ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {error ?? "No matches found."}
            </p>
          ) : (
            results.map((asset) => (
              <button
                key={`${asset.symbol}-${asset.type}-${asset.priceId ?? ""}`}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => openTicker(asset)}
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
                  <span className="block font-semibold tracking-wide">
                    {asset.symbol}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {asset.name}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
