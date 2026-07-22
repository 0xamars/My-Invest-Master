"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { heatmapChangeClass } from "@/lib/market/format";
import type { HeatmapResponse, HeatmapStock } from "@/types/market";
import { cn } from "@/lib/utils";

function HeatmapTile({ stock }: { stock: HeatmapStock }) {
  const changeLabel = `${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex min-h-16 flex-col items-center justify-center rounded-lg px-2 py-3 text-center ring-1 ring-foreground/5 transition-transform hover:scale-[1.02]",
              heatmapChangeClass(stock.changePercent),
            )}
            style={{ flexGrow: stock.marketCap, flexBasis: "4rem" }}
          >
            <span className="text-xs font-semibold tracking-wide">{stock.symbol}</span>
            <span className="mt-1 text-[11px] font-medium opacity-90">{changeLabel}</span>
          </div>
        }
      />
      <TooltipContent side="top">
        <p className="font-medium">{stock.name}</p>
        <p className="text-muted-foreground">
          ${stock.price.toFixed(2)} · {changeLabel}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function Sp500Heatmap() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadHeatmap(isRefresh = false) {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch("/api/market/heatmap");
      if (!response.ok) throw new Error("Failed to load heatmap");
      const json = (await response.json()) as HeatmapResponse;
      setData(json);
      setError(null);
    } catch {
      setError("Could not load S&P 500 heatmap.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadHeatmap();
  }, []);

  const legend = useMemo(
    () => [
      { label: "≥ +3%", className: heatmapChangeClass(3) },
      { label: "+1 to +3%", className: heatmapChangeClass(2) },
      { label: "Flat", className: heatmapChangeClass(0) },
      { label: "-1 to -3%", className: heatmapChangeClass(-2) },
      { label: "≤ -3%", className: heatmapChangeClass(-4) },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>S&P 500 heatmap</CardTitle>
          <CardDescription>
            Top constituents sized by market cap, colored by daily change.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          onClick={() => void loadHeatmap(true)}
          disabled={isLoading || isRefreshing}
          title="Refresh heatmap"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 size-4 animate-spin" />
            Loading heatmap…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {data?.stocks.map((stock) => (
                <HeatmapTile key={stock.symbol} stock={stock} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("size-3 rounded-sm ring-1 ring-foreground/10", item.className)}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
