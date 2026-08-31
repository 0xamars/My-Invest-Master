"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Input } from "@/components/ui/input";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { buildAssessHref } from "@/lib/invest/assess/paths";
import { cn } from "@/lib/utils";
import { isWatchlistAssetType } from "@/types/watchlist";
import type { AssetCatalogItem } from "@/types/portfolio";

export function AssessTickerSearch({
  currentSymbol,
  className,
}: {
  currentSymbol?: string;
  className?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { results, isSearching, error } = useAssetSearch(query, "stock", true);

  useEffect(() => {
    setQuery("");
    setShowResults(false);
  }, [currentSymbol]);

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
    const same = asset.symbol.toUpperCase() === currentSymbol?.toUpperCase();
    setQuery("");
    setShowResults(false);
    if (same) return;
    router.push(buildAssessHref(asset.symbol, asset.type));
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 pl-8 text-sm"
        placeholder="Switch ticker…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        aria-label="Search another ticker to assess"
      />
      {isSearching ? (
        <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {showResults && query.trim().length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {results.length === 0 && !isSearching ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {error ?? "No matches found."}
            </p>
          ) : (
            results.map((asset) => (
              <button
                key={`${asset.symbol}-${asset.type}`}
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
      ) : null}
    </div>
  );
}
