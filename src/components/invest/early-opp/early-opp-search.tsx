"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Input } from "@/components/ui/input";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { buildEarlyOppHref } from "@/lib/analysis/early-opp/paths";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";
import { cn } from "@/lib/utils";
import { isWatchlistAssetType } from "@/types/watchlist";
import type { AssetCatalogItem } from "@/types/portfolio";

export function EarlyOppSearch({
  currentSymbol,
  className,
  size = "lg",
  placeholder = "Name or ticker",
}: {
  currentSymbol?: string;
  className?: string;
  size?: "sm" | "lg";
  placeholder?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, isSearching, error: searchError } = useAssetSearch(
    query,
    "stock",
    true,
  );

  useEffect(() => {
    setQuery("");
    setShowResults(false);
    setError(null);
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
    if (!isWatchlistAssetType(asset.type) || asset.type !== "stock") return;
    const same = asset.symbol.toUpperCase() === currentSymbol?.toUpperCase();
    setQuery("");
    setShowResults(false);
    if (same) return;
    router.push(buildEarlyOppHref(asset.symbol));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const raw = query.trim();
    if (!raw) {
      setError("Enter a name or ticker.");
      return;
    }
    const exact = results.find(
      (item) => item.symbol === normalizeTickerSymbol(raw),
    );
    const symbol = exact?.symbol ?? results[0]?.symbol ?? normalizeTickerSymbol(raw);
    if (!symbol) {
      setError("Enter a public name or ticker.");
      return;
    }
    setShowResults(false);
    router.push(buildEarlyOppHref(symbol));
  }

  const tall = size === "lg";

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <form onSubmit={onSubmit}>
        <Search
          className={cn(
            "pointer-events-none absolute left-3 -translate-y-1/2 text-muted-foreground",
            tall ? "top-1/2 size-4" : "top-[18px] size-3.5 left-2.5",
          )}
        />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowResults(true);
            if (error) setError(null);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          aria-label="Search a public stock for the 16-step framework"
          className={cn(tall ? "h-11 pl-10 text-sm" : "h-9 pl-8 text-sm")}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        {isSearching ? (
          <Loader2
            className={cn(
              "absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-muted-foreground",
              tall ? "size-4" : "size-3.5",
            )}
          />
        ) : null}
      </form>
      {error || searchError ? (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          {error ?? searchError}
        </p>
      ) : null}
      {showResults && query.trim().length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {results.length === 0 && !isSearching ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {searchError ?? "No matches found."}
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
