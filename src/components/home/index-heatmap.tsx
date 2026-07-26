"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildHeatmapLayout, getTileLabelStyle } from "@/lib/market/heatmap-treemap";
import { INDEX_CONFIG } from "@/lib/market/index-config";
import {
  formatHeatmapChange,
  formatMarketCap,
  formatNewsTime,
  heatmapChangeClass,
} from "@/lib/market/format";
import type { HeatmapResponse, HeatmapStock, MarketIndex } from "@/types/market";
import { cn } from "@/lib/utils";

const REFRESH_MS = 5 * 60 * 1000;
const INDEX_OPTIONS: MarketIndex[] = ["sp500", "nasdaq100"];

function getHeatmapHeight(width: number): number {
  return Math.round(Math.max(440, Math.min(680, width * 0.58)));
}

function formatChangePercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function HeatmapTooltip({
  stock,
  x,
  y,
  containerWidth,
  containerHeight,
}: {
  stock: HeatmapStock;
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
}) {
  const tooltipWidth = 260;
  const tooltipHeight = 148;
  const offset = 14;

  let left = x + offset;
  let top = y + offset;

  if (left + tooltipWidth > containerWidth - 8) {
    left = x - tooltipWidth - offset;
  }
  if (top + tooltipHeight > containerHeight - 8) {
    top = y - tooltipHeight - offset;
  }

  left = Math.max(8, Math.min(left, containerWidth - tooltipWidth - 8));
  top = Math.max(8, Math.min(top, containerHeight - tooltipHeight - 8));

  const changeLabel = formatHeatmapChange(stock.change, stock.changePercent);
  const pctLabel = formatChangePercent(stock.changePercent);

  return (
    <div
      className="heatmap-tooltip pointer-events-none absolute z-40"
      style={{ left, top, width: tooltipWidth }}
      role="tooltip"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">
        {stock.sector}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{stock.name}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-wide text-white">
          {stock.symbol}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            stock.changePercent >= 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {pctLabel}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-white/75">
        <p className="tabular-nums">
          Price <span className="font-medium text-white">${stock.price.toFixed(2)}</span>
          {" · "}
          {changeLabel}
        </p>
        <p>Market cap {formatMarketCap(stock.marketCap)}</p>
      </div>
    </div>
  );
}

function HeatmapTreemap({
  stocks,
  hoveredSymbol,
  onHover,
  tooltipPos,
  onTooltipMove,
}: {
  stocks: HeatmapStock[];
  hoveredSymbol: string | null;
  onHover: (symbol: string | null) => void;
  tooltipPos: { x: number; y: number } | null;
  onTooltipMove: (pos: { x: number; y: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const height = getHeatmapHeight(width);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry.contentRect.width);
      if (nextWidth > 0) setWidth(nextWidth);
    });

    observer.observe(node);
    setWidth(Math.floor(node.getBoundingClientRect().width) || 960);

    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => buildHeatmapLayout(stocks, width, height),
    [stocks, width, height],
  );

  const hoveredStock =
    stocks.find((stock) => stock.symbol === hoveredSymbol) ?? null;

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      onTooltipMove({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    [onTooltipMove],
  );

  return (
    <div
      ref={containerRef}
      className="heatmap-shell"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className="heatmap-canvas relative"
        style={{ width: layout.width, height: layout.height }}
      >
        {layout.sectors.map((sector) => (
          <div
            key={sector.name}
            className="heatmap-sector-frame pointer-events-none absolute z-0"
            style={{
              left: sector.x,
              top: sector.y,
              width: sector.width,
              height: sector.height,
            }}
          >
            <span className="heatmap-sector-label">{sector.name}</span>
          </div>
        ))}

        {layout.stocks.map((tile) => {
          const { stock } = tile;
          const changeLabel = formatChangePercent(stock.changePercent);
          const labelStyle = getTileLabelStyle(tile.width, tile.height);
          const isHovered = hoveredSymbol === stock.symbol;

          return (
            <button
              key={stock.symbol}
              type="button"
              className={cn(
                "heatmap-tile absolute z-10 overflow-hidden border border-black/80 text-center transition-[filter,box-shadow] duration-100",
                heatmapChangeClass(stock.changePercent),
                isHovered && "heatmap-tile--hover z-30",
              )}
              style={{
                left: tile.x,
                top: tile.y,
                width: tile.width,
                height: tile.height,
              }}
              onMouseEnter={() => onHover(stock.symbol)}
              onFocus={() => onHover(stock.symbol)}
              onBlur={() => onHover(null)}
              aria-label={`${stock.name} ${stock.symbol} ${changeLabel}`}
            >
              {labelStyle.layout === "hidden" ? (
                <span className="sr-only">{stock.symbol}</span>
              ) : (
                <span
                  className={cn(
                    "heatmap-tile-content",
                    labelStyle.layout === "full" && "heatmap-tile-content--full",
                  )}
                >
                  <span
                    className="heatmap-tile-symbol"
                    style={{ fontSize: labelStyle.symbolSize }}
                  >
                    {stock.symbol}
                  </span>
                  {labelStyle.layout === "full" && (
                    <span
                      className="heatmap-tile-change"
                      style={{ fontSize: labelStyle.changeSize }}
                    >
                      {changeLabel}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}

        {hoveredStock && tooltipPos && (
          <HeatmapTooltip
            stock={hoveredStock}
            x={tooltipPos.x}
            y={tooltipPos.y}
            containerWidth={layout.width}
            containerHeight={layout.height}
          />
        )}
      </div>
    </div>
  );
}

function MoverRow({
  rank,
  stock,
  variant,
}: {
  rank: number;
  stock: HeatmapStock;
  variant: "gain" | "loss";
}) {
  const isGain = variant === "gain";

  return (
    <div className="heatmap-mover-row">
      <span className="heatmap-mover-rank">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-wide">{stock.symbol}</p>
        <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">${stock.price.toFixed(2)}</p>
        <p
          className={cn(
            "flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums",
            isGain ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {isGain ? (
            <ArrowUpRight className="size-3.5 shrink-0" />
          ) : (
            <ArrowDownRight className="size-3.5 shrink-0" />
          )}
          {formatChangePercent(stock.changePercent)}
        </p>
      </div>
    </div>
  );
}

function IndexMovers({
  gainers,
  losers,
  indexLabel,
}: {
  gainers: HeatmapStock[];
  losers: HeatmapStock[];
  indexLabel: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="heatmap-movers-panel">
        <div className="heatmap-movers-header">
          <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold">Top Gainers</h3>
          <span className="text-xs text-muted-foreground">{indexLabel}</span>
        </div>
        <div className="divide-y divide-border/60">
          {gainers.map((stock, index) => (
            <MoverRow key={stock.symbol} rank={index + 1} stock={stock} variant="gain" />
          ))}
        </div>
      </div>

      <div className="heatmap-movers-panel">
        <div className="heatmap-movers-header">
          <ArrowDownRight className="size-4 text-rose-600 dark:text-rose-400" />
          <h3 className="text-sm font-semibold">Top Losers</h3>
          <span className="text-xs text-muted-foreground">{indexLabel}</span>
        </div>
        <div className="divide-y divide-border/60">
          {losers.map((stock, index) => (
            <MoverRow key={stock.symbol} rank={index + 1} stock={stock} variant="loss" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IndexHeatmap() {
  const [index, setIndex] = useState<MarketIndex>("sp500");
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const indexConfig = INDEX_CONFIG[index];

  const loadHeatmap = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const response = await fetch(`/api/market/heatmap?index=${index}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to load heatmap");
        const json = (await response.json()) as HeatmapResponse;
        setData(json);
        setError(null);
      } catch {
        setError(`Could not load ${indexConfig.label} heatmap.`);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [index, indexConfig.label],
  );

  useEffect(() => {
    void loadHeatmap();
    const interval = window.setInterval(() => void loadHeatmap(true), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadHeatmap]);

  const legend = useMemo(
    () => [
      { label: "Strong gain (≥3%)", className: heatmapChangeClass(3.5) },
      { label: "Small gain", className: heatmapChangeClass(0.6) },
      { label: "Flat", className: heatmapChangeClass(0) },
      { label: "Small loss", className: heatmapChangeClass(-0.6) },
      { label: "Strong loss (≤-3%)", className: heatmapChangeClass(-4) },
    ],
    [],
  );

  const footerLabel =
    index === "sp500"
      ? `Top ${data?.displayedCount ?? 0} of ${data?.totalConstituents ?? 0} ${indexConfig.shortLabel} · ranked by market cap`
      : `${data?.displayedCount ?? 0} ${indexConfig.shortLabel} companies · sized by market cap`;

  return (
    <Card className="overflow-hidden border-border/80 shadow-lg">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-muted/20 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <CardTitle className="text-xl">Market Heatmap</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-relaxed">
              {indexConfig.description}
              {data?.fetchedAt ? (
                <span className="text-foreground/70">
                  {" "}
                  Updated {formatNewsTime(data.fetchedAt)}.
                </span>
              ) : null}
            </CardDescription>
          </div>

          <Tabs
            value={index}
            onValueChange={(value) => setIndex(value as MarketIndex)}
          >
            <TabsList className="h-10 rounded-xl border border-border/70 bg-card p-1 shadow-sm">
              {INDEX_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option}
                  value={option}
                  className="rounded-lg px-4 text-xs font-medium sm:text-sm"
                >
                  {INDEX_CONFIG[option].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 self-start rounded-xl"
          onClick={() => void loadHeatmap(true)}
          disabled={isLoading || isRefreshing}
          title="Refresh heatmap"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6">
        {isLoading ? (
          <div className="flex min-h-[440px] items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 size-4 animate-spin" />
            Loading {indexConfig.label} data…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <HeatmapTreemap
              stocks={data?.stocks ?? []}
              hoveredSymbol={hoveredSymbol}
              onHover={setHoveredSymbol}
              tooltipPos={tooltipPos}
              onTooltipMove={setTooltipPos}
            />

            <IndexMovers
              gainers={data?.gainers ?? []}
              losers={data?.losers ?? []}
              indexLabel={indexConfig.shortLabel}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                {legend.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn("heatmap-legend-swatch", item.className)}
                    />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {footerLabel} · refreshes every 5 min
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** @deprecated Use IndexHeatmap */
export const Sp500Heatmap = IndexHeatmap;
