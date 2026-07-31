"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatPercent,
  formatPrice,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { WatchlistItemWithPrices } from "@/types/watchlist";

interface WatchlistTableProps {
  items: WatchlistItemWithPrices[];
  isLoading?: boolean;
  onRemove: (item: WatchlistItemWithPrices) => void;
}

const CELL = "px-4 py-3.5";
const NUMERIC = cn(CELL, "text-right text-sm tabular-nums");

function typeLabel(type: "stock" | "crypto") {
  return type === "stock" ? "Stock" : "Crypto";
}

export function WatchlistTable({
  items,
  isLoading = false,
  onRemove,
}: WatchlistTableProps) {
  if (!isLoading && items.length === 0) {
    return null;
  }

  return (
    <div className="surface-card overflow-hidden rounded-xl border border-border/80">
      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(CELL, "pl-5")}>Ticker</TableHead>
              <TableHead className={CELL}>Type</TableHead>
              <TableHead className={NUMERIC}>Price</TableHead>
              <TableHead className={NUMERIC}>Change</TableHead>
              <TableHead className={NUMERIC}>Change %</TableHead>
              <TableHead className={cn(CELL, "w-12 pr-5 text-right")}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && items.length === 0
              ? Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell className={cn(CELL, "pl-5")}>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-7 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={CELL}>
                      <Skeleton className="h-5 w-14" />
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      <Skeleton className="ml-auto h-4 w-14" />
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      <Skeleton className="ml-auto h-4 w-14" />
                    </TableCell>
                    <TableCell className={cn(CELL, "pr-5")} />
                  </TableRow>
                ))
              : items.map((item) => {
                  const changeClass =
                    item.changePercent == null
                      ? "text-muted-foreground"
                      : profitLossClass(item.changePercent);

                  return (
                    <TableRow key={item.id} className="group">
                      <TableCell className={cn(CELL, "pl-5")}>
                        <div className="flex min-w-[10rem] items-center gap-3">
                          <AssetLogo
                            symbol={item.symbol}
                            name={item.name}
                            type={item.type}
                            logoUrl={item.logoUrl}
                            priceId={item.priceId}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium tracking-tight">
                              {item.symbol}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={CELL}>
                        <Badge variant="secondary" className="font-normal">
                          {typeLabel(item.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={NUMERIC}>
                        {item.isPriceLoading && item.currentPrice == null ? (
                          <Skeleton className="ml-auto h-4 w-16" />
                        ) : item.currentPrice == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatPrice(item.currentPrice, item.type)
                        )}
                      </TableCell>
                      <TableCell className={cn(NUMERIC, changeClass)}>
                        {item.isPriceLoading && item.change == null ? (
                          <Skeleton className="ml-auto h-4 w-14" />
                        ) : item.change == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatCurrency(item.change)
                        )}
                      </TableCell>
                      <TableCell className={cn(NUMERIC, changeClass)}>
                        {item.isPriceLoading && item.changePercent == null ? (
                          <Skeleton className="ml-auto h-4 w-14" />
                        ) : item.changePercent == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatPercent(item.changePercent)
                        )}
                      </TableCell>
                      <TableCell className={cn(CELL, "pr-5 text-right")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg text-muted-foreground opacity-100 transition-all duration-150 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-muted hover:text-foreground data-popup-open:opacity-100"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">
                                  Open actions for {item.symbol}
                                </span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onRemove(item)}
                              className="gap-2"
                            >
                              <Trash2 className="size-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
