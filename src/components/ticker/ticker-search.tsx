"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Input } from "@/components/ui/input";
import { useAssetSearch } from "@/hooks/use-asset-search";
import type { SearchableAssetType } from "@/lib/portfolio/asset-search-client";
import { cn } from "@/lib/utils";
import type { AssetCatalogItem } from "@/types/portfolio";

export type TickerSearchHit = {
  symbol: string;
  name: string;
  type: SearchableAssetType;
  priceId?: string;
  logoUrl?: string;
  category?: string;
  subCategory?: string;
};

export function toAssetCatalogItem(hit: TickerSearchHit): AssetCatalogItem {
  const type = hit.type === "crypto" ? "crypto" : "stock";
  return {
    symbol: hit.symbol,
    name: hit.name,
    type,
    category: hit.category ?? (type === "crypto" ? "Crypto" : "Equity"),
    subCategory:
      hit.subCategory ?? (type === "crypto" ? "Cryptocurrency" : "Stock"),
    priceId: hit.priceId,
    logoUrl: hit.logoUrl,
  };
}

function asSearchHit(item: AssetCatalogItem): TickerSearchHit | null {
  if (item.type !== "stock" && item.type !== "crypto") return null;
  return {
    symbol: item.symbol,
    name: item.name,
    type: item.type,
    priceId: item.priceId,
    logoUrl: item.logoUrl,
    category: item.category,
    subCategory: item.subCategory,
  };
}

function typeLabel(type: SearchableAssetType) {
  return type === "crypto" ? "Crypto" : "Stock";
}

const SIZE_CLASS = {
  sm: "h-9 text-sm",
  md: "h-10 text-sm",
  lg: "h-11 text-sm",
} as const;

export function TickerSearch({
  assetType,
  onSelect,
  onClear,
  placeholder = "Search name or ticker",
  id,
  disabled = false,
  autoFocus = false,
  className,
  inputClassName,
  clearOnSelect = false,
  isDisabled,
  disabledReason = "Already added",
  size = "md",
  defaultQuery = "",
}: {
  assetType: SearchableAssetType;
  onSelect: (hit: TickerSearchHit) => void;
  onClear?: () => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  clearOnSelect?: boolean;
  isDisabled?: (hit: TickerSearchHit) => boolean;
  disabledReason?: string;
  size?: keyof typeof SIZE_CLASS;
  defaultQuery?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const trimmed = query.trim();
  const { results, isSearching, error } = useAssetSearch(
    trimmed,
    assetType,
    !disabled && trimmed.length > 0,
  );

  const hits = useMemo(
    () =>
      results
        .map(asSearchHit)
        .filter((hit): hit is TickerSearchHit => hit !== null)
        .slice(0, 8),
    [results],
  );

  const showMenu = open && !disabled && trimmed.length > 0;

  useEffect(() => {
    setQuery(defaultQuery);
    setOpen(false);
    setHighlight(0);
  }, [assetType, defaultQuery]);

  useEffect(() => {
    setHighlight(0);
  }, [trimmed, assetType]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const enabledIndexes = hits
    .map((hit, index) => ({ hit, index }))
    .filter(({ hit }) => !isDisabled?.(hit))
    .map(({ index }) => index);

  const activeHighlight = enabledIndexes.includes(highlight)
    ? highlight
    : (enabledIndexes[0] ?? 0);

  function moveHighlight(direction: 1 | -1) {
    if (enabledIndexes.length === 0) return;
    const currentPos = enabledIndexes.indexOf(activeHighlight);
    const nextPos =
      currentPos === -1
        ? direction === 1
          ? 0
          : enabledIndexes.length - 1
        : (currentPos + direction + enabledIndexes.length) %
          enabledIndexes.length;
    setHighlight(enabledIndexes[nextPos] ?? 0);
  }

  function pick(hit: TickerSearchHit) {
    if (isDisabled?.(hit)) return;
    onSelect(hit);
    setQuery(clearOnSelect ? "" : hit.symbol);
    setOpen(false);
  }

  function onQueryChange(next: string) {
    setQuery(next);
    setOpen(true);
    onClear?.();
  }

  const activeId =
    showMenu && hits[activeHighlight]
      ? `${listId}-opt-${activeHighlight}`
      : undefined;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={() => {
          if (trimmed.length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!showMenu) {
              setOpen(true);
              return;
            }
            moveHighlight(1);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!showMenu) {
              setOpen(true);
              return;
            }
            moveHighlight(-1);
            return;
          }
          if (event.key === "Enter" && showMenu) {
            const hit = hits[activeHighlight];
            if (hit && !isDisabled?.(hit)) {
              event.preventDefault();
              pick(hit);
            }
          }
        }}
        className={cn("pl-9 pr-9", SIZE_CLASS[size], inputClassName)}
      />
      {isSearching ? (
        <Loader2 className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {showMenu ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius)] border border-border bg-popover py-1 text-popover-foreground"
        >
          {isSearching && hits.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              {error ?? `No matches for “${trimmed}”.`}
            </li>
          ) : (
            hits.map((hit, index) => {
              const blocked = Boolean(isDisabled?.(hit));
              const active = index === activeHighlight;
              return (
                <li
                  key={`${hit.symbol}-${hit.type}-${hit.priceId ?? ""}`}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  aria-disabled={blocked}
                >
                  <button
                    type="button"
                    disabled={blocked}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      active && !blocked && "bg-muted",
                      blocked
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-muted",
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(hit)}
                  >
                    <AssetLogo
                      symbol={hit.symbol}
                      name={hit.name}
                      type={hit.type}
                      logoUrl={hit.logoUrl}
                      priceId={hit.priceId}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tracking-wide">
                        {hit.symbol}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.name}
                        {blocked ? ` · ${disabledReason}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {typeLabel(hit.type)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
