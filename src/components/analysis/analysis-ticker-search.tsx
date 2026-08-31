"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bitcoin, TrendingUp } from "lucide-react";
import { TickerSearch } from "@/components/ticker/ticker-search";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildAnalysisHref,
  type AnalysisAssetType,
} from "@/lib/analysis/types";
import { cn } from "@/lib/utils";
import { isWatchlistAssetType } from "@/types/watchlist";

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
  const [mode, setMode] = useState<AnalysisAssetType>(defaultType);

  useEffect(() => {
    setMode(defaultType);
  }, [defaultType]);

  return (
    <div className={cn("relative z-30 w-full max-w-md", className)}>
      <div className="flex items-center gap-2">
        <Tabs
          value={mode}
          onValueChange={(value) => {
            if (value === "stock" || value === "crypto") {
              setMode(value);
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

        <TickerSearch
          key={`${mode}-${currentSymbol ?? ""}-${currentType ?? ""}`}
          assetType={mode}
          size="sm"
          className="min-w-0 flex-1"
          clearOnSelect
          placeholder={mode === "stock" ? "Switch ticker…" : "Switch crypto…"}
          onSelect={(hit) => {
            if (!isWatchlistAssetType(hit.type)) return;
            const same =
              hit.symbol.toUpperCase() === currentSymbol?.toUpperCase() &&
              hit.type === (currentType ?? defaultType);
            if (same) return;
            router.push(buildAnalysisHref(hit.symbol, hit.type, hit.priceId));
          }}
        />
      </div>
    </div>
  );
}
