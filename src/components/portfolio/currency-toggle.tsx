"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  canConvertCurrency,
  getFxRateLabel,
  hasLiveFxRates,
} from "@/lib/portfolio/prices/fx";
import { cn } from "@/lib/utils";
import {
  FEATURED_DISPLAY_CURRENCIES,
  getCurrencyMeta,
  getCurrencySymbol,
  listDisplayCurrencies,
  type DisplayCurrency,
  type FxRates,
} from "@/types/currency";

interface CurrencyToggleProps {
  currency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
  rates: FxRates;
  isLoading?: boolean;
  error?: string | null;
  compact?: boolean;
}

function matchesQuery(
  code: DisplayCurrency,
  name: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    code.toLowerCase().includes(q) ||
    name.toLowerCase().includes(q) ||
    getCurrencySymbol(code).toLowerCase().includes(q)
  );
}

export function CurrencyToggle({
  currency,
  onChange,
  rates,
  isLoading,
  error,
  compact = false,
}: CurrencyToggleProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = getCurrencyMeta(currency);
  const symbol = getCurrencySymbol(currency);
  const rateLabel = getFxRateLabel(currency, rates);
  const canConvert = canConvertCurrency(currency, rates);
  const usingFallback = !isLoading && !hasLiveFxRates(rates) && currency !== "USD";

  const featuredSet = useMemo(
    () => new Set<string>(FEATURED_DISPLAY_CURRENCIES),
    [],
  );

  const filtered = useMemo(() => {
    const all = listDisplayCurrencies().filter((item) =>
      matchesQuery(item.code, item.name, query),
    );
    const featured = all.filter((item) => featuredSet.has(item.code));
    const rest = all
      .filter((item) => !featuredSet.has(item.code))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Keep featured order when not searching; when searching, sort all by code.
    if (query.trim()) {
      return [...all].sort((a, b) => a.code.localeCompare(b.code));
    }
    return [...featured, ...rest];
  }, [query, featuredSet]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  function selectCurrency(code: DisplayCurrency) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        compact ? "items-start" : "items-end",
      )}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "justify-between gap-2 border-border bg-muted px-2.5 text-xs font-medium",
                compact
                  ? "h-8 min-w-[5.5rem] rounded-md px-2"
                  : "h-10 min-w-[7.5rem] rounded-[var(--radius)] px-3",
              )}
              aria-label={`Display currency ${currency}`}
            />
          }
        >
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{symbol}</span>
            <span className="font-semibold tracking-wide">{currency}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={6}>
            <Popover.Popup
              className={cn(
                "z-50 w-[min(100vw-2rem,18rem)] origin-(--transform-origin) rounded-xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg outline-none",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              )}
            >
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search currency…"
                  className="h-9 pl-8 text-sm"
                  aria-label="Search currencies"
                />
              </div>

              <ScrollArea className="h-64 pr-2">
                <ul className="space-y-0.5" role="listbox">
                  {filtered.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No currencies match “{query.trim()}”.
                    </li>
                  ) : (
                    filtered.map((item) => {
                      const selected = item.code === currency;
                      const itemSymbol = getCurrencySymbol(item.code);
                      return (
                        <li key={item.code}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                              "hover:bg-muted/70",
                              selected && "bg-muted",
                            )}
                            onClick={() => selectCurrency(item.code)}
                          >
                            <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                              {itemSymbol}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold tracking-wide">
                                {item.code}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.name}
                              </span>
                            </span>
                            {selected && (
                              <Check className="size-4 shrink-0 text-primary" />
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </ScrollArea>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {!compact && currency !== "USD" && (
        <p className="max-w-[14rem] text-right text-[11px] text-muted-foreground">
          {isLoading
            ? "Loading FX…"
            : !canConvert
              ? `Unable to convert to ${currency}`
              : usingFallback || error
                ? `${rateLabel} · using fallback rates`
                : rateLabel}
        </p>
      )}
      {!compact && error && currency === "USD" && (
        <p className="max-w-[14rem] text-right text-[11px] text-amber-600 dark:text-amber-400">
          FX unavailable — showing USD
        </p>
      )}
    </div>
  );
}
