"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssetLogo } from "@/components/portfolio/asset-logo";
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
  formatCashAmount,
  formatDisplayMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  profitLossClass,
} from "@/lib/portfolio/format";
import {
  DEFAULT_SORT,
  getNextSortState,
  sortHoldings,
  type SortColumn,
  type SortState,
} from "@/lib/portfolio/sort-holdings";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

interface PortfolioTableProps {
  holdings: PortfolioHoldingWithPrices[];
  isLoading?: boolean;
  currency: DisplayCurrency;
  rates: FxRates;
  onEdit: (holding: PortfolioHoldingWithPrices) => void;
  onDelete: (holding: PortfolioHoldingWithPrices) => void;
}

const COLUMNS: {
  id: SortColumn;
  label: string;
  align?: "left" | "right";
  className?: string;
}[] = [
  {
    id: "ticker",
    label: "Ticker",
    className: "sticky left-0 z-10 min-w-[90px] bg-muted/40 pl-4",
  },
  { id: "category", label: "Category", className: "min-w-[100px]" },
  { id: "subCategory", label: "Sub Category", className: "min-w-[140px]" },
  {
    id: "currentPrice",
    label: "Current Price",
    align: "right",
    className: "min-w-[110px]",
  },
  {
    id: "costPrice",
    label: "Cost Price",
    align: "right",
    className: "min-w-[100px]",
  },
  {
    id: "quantity",
    label: "Quantity",
    align: "right",
    className: "min-w-[90px]",
  },
  {
    id: "costValue",
    label: "Cost Value",
    align: "right",
    className: "min-w-[110px]",
  },
  {
    id: "currentValue",
    label: "Current Value",
    align: "right",
    className: "min-w-[110px]",
  },
  {
    id: "profitLoss",
    label: "Profit/Loss",
    align: "right",
    className: "min-w-[110px]",
  },
  {
    id: "profitLossPercent",
    label: "Profit/Loss %",
    align: "right",
    className: "min-w-[100px]",
  },
  {
    id: "portfolioPercent",
    label: "Portfolio %",
    align: "right",
    className: "min-w-[90px] pr-4",
  },
];

function PriceCell({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (loading) {
    return (
      <TableCell className={className}>
        <Skeleton className="ml-auto h-4 w-16" />
      </TableCell>
    );
  }
  return <TableCell className={className}>{children}</TableCell>;
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = sort.column === column;
  const Icon = isActive
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(column)}
        className={cn(
          "-ml-2 h-8 gap-1 px-2 font-medium hover:bg-muted/60",
          align === "right" && "ml-auto -mr-2 flex-row-reverse",
          isActive && "text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            isActive ? "text-foreground" : "text-muted-foreground/70",
          )}
        />
      </Button>
    </TableHead>
  );
}

export function PortfolioTable({
  holdings,
  isLoading,
  currency,
  rates,
  onEdit,
  onDelete,
}: PortfolioTableProps) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const sortedHoldings = useMemo(
    () => sortHoldings(holdings, sort, rates),
    [holdings, sort, rates],
  );

  const handleSort = (column: SortColumn) => {
    setSort((current) => getNextSortState(current, column));
  };

  if (holdings.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-lg font-medium">No assets in your portfolio yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Click &quot;Add Asset&quot; to start tracking stocks, crypto, custom
          assets, or cash.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      {isLoading && (
        <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Loading live prices…
        </div>
      )}
      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {COLUMNS.map((col) => (
                <SortableHeader
                  key={col.id}
                  label={col.label}
                  column={col.id}
                  sort={sort}
                  onSort={handleSort}
                  align={col.align}
                  className={col.className}
                />
              ))}
              <TableHead className="sticky right-0 z-10 w-12 bg-muted/40 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding) => {
              const loading = holding.isPriceLoading;

              return (
                <TableRow key={holding.id} className="group">
                  <TableCell className="sticky left-0 z-10 bg-card pl-4 font-semibold group-hover:bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <AssetLogo
                        symbol={holding.symbol}
                        name={holding.name}
                        type={holding.type}
                        logoUrl={holding.logoUrl}
                        priceId={holding.priceId}
                        size="sm"
                      />
                      <div className="flex min-w-0 items-center gap-2">
                        {holding.symbol}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal uppercase"
                        >
                          {holding.type === "cash"
                            ? getCashCurrency(holding)
                            : holding.type}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {holding.category}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {holding.subCategory}
                  </TableCell>
                  <PriceCell
                    loading={loading}
                    className="text-right tabular-nums"
                  >
                    {holding.currentPrice !== null
                      ? formatPrice(
                          holding.currentPrice,
                          holding.type,
                          currency,
                          rates,
                        )
                      : "—"}
                  </PriceCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPrice(
                      holding.costPrice,
                      holding.type,
                      currency,
                      rates,
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {holding.type === "cash"
                      ? formatCashAmount(
                          holding.quantity,
                          getCashCurrency(holding),
                          currency,
                          rates,
                        )
                      : formatQuantity(holding.quantity, holding.type)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatDisplayMoney(
                      holding.costValue,
                      currency,
                      rates,
                    )}
                  </TableCell>
                  <PriceCell
                    loading={loading}
                    className="text-right tabular-nums font-medium"
                  >
                    {holding.currentValue !== null
                      ? formatDisplayMoney(
                          holding.currentValue,
                          currency,
                          rates,
                        )
                      : "—"}
                  </PriceCell>
                  <PriceCell
                    loading={loading}
                    className={cn(
                      "text-right tabular-nums",
                      holding.profitLoss !== null &&
                        profitLossClass(holding.profitLoss),
                    )}
                  >
                    {holding.profitLoss !== null ? (
                      <>
                        {holding.profitLoss >= 0 ? "+" : ""}
                        {formatDisplayMoney(
                          holding.profitLoss,
                          currency,
                          rates,
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </PriceCell>
                  <PriceCell
                    loading={loading}
                    className={cn(
                      "text-right tabular-nums",
                      holding.profitLossPercent !== null &&
                        profitLossClass(holding.profitLossPercent),
                    )}
                  >
                    {holding.profitLossPercent !== null
                      ? formatPercent(holding.profitLossPercent)
                      : "—"}
                  </PriceCell>
                  <PriceCell
                    loading={loading}
                    className="pr-4 text-right tabular-nums"
                  >
                    {holding.portfolioPercent !== null
                      ? `${holding.portfolioPercent.toFixed(2)}%`
                      : "—"}
                  </PriceCell>
                  <TableCell className="sticky right-0 z-10 bg-card pr-4 group-hover:bg-muted/50">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => onEdit(holding)}
                          className="gap-2"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(holding)}
                          className="gap-2"
                        >
                          <Trash2 className="size-4" />
                          Delete
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
