"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  canCreateCustomSector,
  CUSTOM_SECTOR_VALUE,
  filterSectorOptions,
  getSectorSelectOptions,
  resolveSectorChoice,
} from "@/lib/portfolio/sectors";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";

interface SectorSelectProps {
  assetType: AssetType;
  sectorChoice: string;
  customSector: string;
  onSectorChoiceChange: (value: string) => void;
  onCustomSectorChange: (value: string) => void;
  idPrefix?: string;
  className?: string;
}

export function SectorSelect({
  assetType,
  sectorChoice,
  customSector,
  onSectorChoiceChange,
  onCustomSectorChange,
  idPrefix = "sector",
  className,
}: SectorSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const options = getSectorSelectOptions(assetType);
  const resolvedSector = resolveSectorChoice(sectorChoice, customSector);
  const displayLabel =
    sectorChoice === CUSTOM_SECTOR_VALUE
      ? customSector.trim() || "Custom sector"
      : sectorChoice;

  const filteredOptions = useMemo(
    () => filterSectorOptions(options, search),
    [options, search],
  );

  const showCreateCustom = canCreateCustomSector(options, search);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const closePicker = () => {
    setOpen(false);
    setSearch("");
  };

  const selectSector = (sector: string) => {
    onSectorChoiceChange(sector);
    onCustomSectorChange("");
    closePicker();
  };

  const selectCustomSector = (value: string) => {
    onSectorChoiceChange(CUSTOM_SECTOR_VALUE);
    onCustomSectorChange(value.trim());
    closePicker();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        selectSector(filteredOptions[0]);
        return;
      }
      if (showCreateCustom) {
        selectCustomSector(search.trim());
      }
    }
  };

  if (assetType === "cash") {
    return (
      <div className={className}>
        <Label htmlFor={`${idPrefix}-display`}>Sector</Label>
        <div
          id={`${idPrefix}-display`}
          className="mt-2 flex h-9 w-full items-center rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground"
        >
          {options[0]}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative space-y-2", className)}>
      <Label htmlFor={`${idPrefix}-trigger`}>Sector</Label>
      <button
        id={`${idPrefix}-trigger`}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !resolvedSector && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">
          {displayLabel || "Search or select sector"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search sectors or type a custom one…"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Search sectors"
            />
          </div>

          <ScrollArea className="max-h-56">
            <div className="p-1" role="listbox">
              {filteredOptions.length === 0 && !showCreateCustom && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matching sectors
                </p>
              )}

              {filteredOptions.map((sector) => {
                const isSelected =
                  sectorChoice === sector ||
                  (sectorChoice === CUSTOM_SECTOR_VALUE &&
                    customSector.trim().toLowerCase() === sector.toLowerCase());

                return (
                  <button
                    key={sector}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectSector(sector)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/70",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{sector}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {showCreateCustom && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => selectCustomSector(search.trim())}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-sm text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="size-4 shrink-0" />
                <span>
                  Use <span className="font-medium">&ldquo;{search.trim()}&rdquo;</span>{" "}
                  as custom sector
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
