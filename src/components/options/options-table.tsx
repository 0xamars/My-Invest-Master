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
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { isPriceChangeFavorable } from "@/lib/portfolio/options-calculations";
import {
  formatCurrency,
  formatDisplayMoney,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import {
  OPTION_STATUS_LABELS,
  OPTION_TYPE_LABELS,
  type OptionStatus,
  type OptionsPositionWithMetrics,
} from "@/types/options";

type SortColumn =
  | "ticker"
  | "optionType"
  | "txDate"
  | "expiryDate"
  | "strikePrice"
  | "dte"
  | "status";

type SortState = { column: SortColumn; direction: "asc" | "desc" };

interface OptionsTableProps {
  positions: OptionsPositionWithMetrics[];
  variant?: "active" | "history";
  title?: string;
  isLoading?: boolean;
  currency: DisplayCurrency;
  rates: FxRates;
  defaultSort?: SortState;
  onEdit: (position: OptionsPositionWithMetrics) => void;
  onStatusChange: (id: string, status: OptionStatus) => void;
  onDelete: (position: OptionsPositionWithMetrics) => void;
}

const CELL = "px-4 py-3.5";
const NUMERIC = cn(CELL, "text-right text-sm tabular-nums");

const STATUS_VARIANT: Record<
  OptionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  closed: "secondary",
  expired: "outline",
  exercised: "secondary",
};

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
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
          "h-8 gap-1.5 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          align === "left" && "-ml-2",
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

function StaticHeader({
  label,
  align = "right",
  className,
}: {
  label: string;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <span
        className={cn(
          "inline-flex h-8 items-center px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
          align === "right" && "ml-auto",
        )}
      >
        {label}
      </span>
    </TableHead>
  );
}

function sortPositions(
  positions: OptionsPositionWithMetrics[],
  sort: SortState,
): OptionsPositionWithMetrics[] {
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...positions].sort((a, b) => {
    switch (sort.column) {
      case "ticker":
        return a.ticker.localeCompare(b.ticker) * dir;
      case "optionType":
        return a.optionType.localeCompare(b.optionType) * dir;
      case "txDate":
        return a.txDate.localeCompare(b.txDate) * dir;
      case "expiryDate":
        return a.expiryDate.localeCompare(b.expiryDate) * dir;
      case "strikePrice":
        return (a.strikePrice - b.strikePrice) * dir;
      case "dte":
        if (a.dte !== null && b.dte !== null) {
          return (a.dte - b.dte) * dir;
        }
        if (a.dte !== null) return -1 * dir;
        if (b.dte !== null) return 1 * dir;
        return a.expiryDate.localeCompare(b.expiryDate) * dir;
      case "status":
        return a.displayStatus.localeCompare(b.displayStatus) * dir;
      default:
        return 0;
    }
  });
}

export function OptionsTable({
  positions,
  variant = "active",
  title,
  isLoading,
  currency,
  rates,
  defaultSort,
  onEdit,
  onStatusChange,
  onDelete,
}: OptionsTableProps) {
  const [sort, setSort] = useState<SortState>(
    defaultSort ?? { column: "dte", direction: "asc" },
  );

  const sorted = useMemo(
    () => sortPositions(positions, sort),
    [positions, sort],
  );

  const handleSort = (column: SortColumn) => {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const isHistory = variant === "history";

  if (positions.length === 0) {
    if (variant === "history") return null;

    return (
      <div className="surface-card flex min-h-[360px] flex-col items-center justify-center px-8 py-20 text-center">
        <p className="text-lg font-semibold tracking-tight">No active options</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Add an options transaction to start tracking open positions.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {title && (
        <h2
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            isHistory ? "text-muted-foreground/80" : "text-muted-foreground",
          )}
        >
          {title}
        </h2>
      )}

      <div className="table-shell">
        {isLoading && !isHistory && (
          <div className="border-b border-border/60 px-6 py-3 text-xs text-muted-foreground">
            Updating stock prices…
          </div>
        )}
        <ScrollArea className="w-full">
          <Table className="min-w-[1180px] table-fixed">
            <colgroup>
              <col style={{ width: "minmax(148px, 1.3fr)" }} />
              <col style={{ width: "minmax(96px, 0.9fr)" }} />
              <col style={{ width: "minmax(88px, 0.8fr)" }} />
              <col style={{ width: "minmax(88px, 0.8fr)" }} />
              <col style={{ width: "minmax(88px, 0.8fr)" }} />
              <col style={{ width: "minmax(96px, 0.85fr)" }} />
              <col style={{ width: "minmax(96px, 0.85fr)" }} />
              <col style={{ width: "minmax(72px, 0.65fr)" }} />
              <col style={{ width: "minmax(88px, 0.8fr)" }} />
              <col style={{ width: "minmax(88px, 0.8fr)" }} />
              <col style={{ width: "minmax(64px, 0.55fr)" }} />
              <col style={{ width: "minmax(80px, 0.7fr)" }} />
              <col style={{ width: "52px" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <SortableHeader
                  label="Ticker"
                  column="ticker"
                  sort={sort}
                  onSort={handleSort}
                  className={cn(
                    CELL,
                    "sticky left-0 z-10 bg-card pl-5 backdrop-blur-sm",
                  )}
                />
                <SortableHeader
                  label="Type"
                  column="optionType"
                  sort={sort}
                  onSort={handleSort}
                  className={CELL}
                />
                <SortableHeader
                  label="Tx Date"
                  column="txDate"
                  sort={sort}
                  onSort={handleSort}
                  className={CELL}
                />
                <SortableHeader
                  label="Expiry"
                  column="expiryDate"
                  sort={sort}
                  onSort={handleSort}
                  className={CELL}
                />
                <StaticHeader label="Strike" className={NUMERIC} />
                <StaticHeader label="Stock" className={NUMERIC} />
                <StaticHeader label="Chg" className={NUMERIC} />
                <StaticHeader label="Cts" className={NUMERIC} />
                <StaticHeader label="Premium" className={NUMERIC} />
                <StaticHeader label="Cost" className={NUMERIC} />
                <SortableHeader
                  label="DTE"
                  column="dte"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                  className={NUMERIC}
                />
                <SortableHeader
                  label="Status"
                  column="status"
                  sort={sort}
                  onSort={handleSort}
                  className={CELL}
                />
                <TableHead
                  className={cn(
                    CELL,
                    "sticky right-0 z-10 w-[52px] bg-card pr-5 backdrop-blur-sm",
                  )}
                >
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((position) => {
                const favorable =
                  position.priceChange !== null &&
                  isPriceChangeFavorable(
                    position.optionType,
                    position.priceChange,
                  );

                return (
                  <TableRow
                    key={position.id}
                    className={cn(
                      "group border-border/50 transition-colors duration-150",
                      isHistory
                        ? "text-muted-foreground hover:bg-muted/20"
                        : "hover:bg-muted/30",
                    )}
                  >
                    <TableCell
                      className={cn(
                        CELL,
                        "sticky left-0 z-10 bg-card pl-5 font-medium backdrop-blur-sm",
                        isHistory
                          ? "group-hover:bg-muted/20"
                          : "group-hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <AssetLogo
                          symbol={position.ticker}
                          name={position.name}
                          type="stock"
                          logoUrl={position.logoUrl}
                          size="sm"
                        />
                        <span
                          className={cn(
                            "font-semibold tracking-tight",
                            isHistory && "text-muted-foreground",
                          )}
                        >
                          {position.ticker}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={CELL}>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide",
                          isHistory
                            ? "border-border/50 bg-muted/20 text-muted-foreground"
                            : position.optionType.startsWith("buy")
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {OPTION_TYPE_LABELS[position.optionType]}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(CELL, "text-sm tabular-nums")}>
                      {formatDate(position.txDate)}
                    </TableCell>
                    <TableCell className={cn(CELL, "text-sm tabular-nums")}>
                      {formatDate(position.expiryDate)}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {formatDisplayMoney(
                        position.strikePrice,
                        currency,
                        rates,
                      )}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {position.isPriceLoading && !isHistory ? (
                        <Skeleton className="ml-auto h-4 w-16" />
                      ) : position.currentStockPrice !== null ? (
                        formatDisplayMoney(
                          position.currentStockPrice,
                          currency,
                          rates,
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        NUMERIC,
                        !isHistory &&
                          position.priceChange !== null &&
                          (favorable
                            ? "text-emerald-600 dark:text-emerald-400"
                            : position.priceChange !== 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"),
                      )}
                    >
                      {position.priceChange !== null ? (
                        <>
                          {position.priceChange >= 0 ? "+" : ""}
                          {formatDisplayMoney(
                            position.priceChange,
                            currency,
                            rates,
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {position.contracts}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {formatCurrency(position.premiumPerContract)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        NUMERIC,
                        !isHistory &&
                          position.optionType.startsWith("sell") &&
                          "text-emerald-600 dark:text-emerald-400",
                        !isHistory &&
                          !position.optionType.startsWith("sell") &&
                          "text-muted-foreground",
                      )}
                    >
                      {position.optionType.startsWith("sell") ? "+" : "−"}
                      {formatDisplayMoney(position.cost, currency, rates)}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {position.dte !== null ? (
                        <span
                          className={cn(
                            !isHistory &&
                              position.dte <= 7 &&
                              position.dte >= 0 &&
                              "font-medium text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {position.dte}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={CELL}>
                      <Badge
                        variant={STATUS_VARIANT[position.displayStatus]}
                        className="border-border/70 bg-muted/30 px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                      >
                        {OPTION_STATUS_LABELS[position.displayStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        "sticky right-0 z-10 w-[52px] bg-card pr-5 backdrop-blur-sm",
                        isHistory
                          ? "group-hover:bg-muted/20"
                          : "group-hover:bg-muted/30",
                      )}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-lg text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-muted hover:text-foreground data-popup-open:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => onEdit(position)}
                            className="gap-2"
                          >
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {!isHistory && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  onStatusChange(position.id, "closed")
                                }
                              >
                                Mark Closed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  onStatusChange(position.id, "exercised")
                                }
                              >
                                Mark Exercised
                              </DropdownMenuItem>
                            </>
                          )}
                          {isHistory &&
                            position.displayStatus !== "expired" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onStatusChange(position.id, "active")
                                }
                              >
                                Reopen as Active
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(position)}
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
    </section>
  );
}
