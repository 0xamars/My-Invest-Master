"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { investTickerPath } from "@/lib/chrome/nav";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { HoldingExpandPanel } from "@/components/portfolio/holding-expand-panel";
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
import { concentrationNoteForWeight } from "@/lib/portfolio/checkup";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";
import {
  RetireEmptyState,
} from "@/components/retirement/retire-ui";

interface PortfolioTableProps {
  holdings: PortfolioHoldingWithPrices[];
  isLoading?: boolean;
  currency: DisplayCurrency;
  rates: FxRates;
  expandedHoldingId?: string | null;
  dayChanges?: Record<string, { change: number; changePercent: number }>;
  onToggleExpand: (holding: PortfolioHoldingWithPrices) => void;
  onEdit: (holding: PortfolioHoldingWithPrices) => void;
  onDelete: (holding: PortfolioHoldingWithPrices) => void;
  onAdd?: () => void;
}

function rowToneClass(note: ReturnType<typeof concentrationNoteForWeight>) {
  if (note === "flag") {
    return "bg-[var(--brand-red)]/7 hover:bg-[var(--brand-red)]/12";
  }
  if (note === "note") {
    return "bg-[var(--brand-orange)]/7 hover:bg-[var(--brand-orange)]/12";
  }
  return "hover:bg-muted/30";
}

function stickyToneClass(note: ReturnType<typeof concentrationNoteForWeight>) {
  if (note === "flag") {
    return "bg-[var(--brand-red)]/7 group-hover:bg-[var(--brand-red)]/12";
  }
  if (note === "note") {
    return "bg-[var(--brand-orange)]/7 group-hover:bg-[var(--brand-orange)]/12";
  }
  return "bg-card group-hover:bg-muted/30";
}

const CELL = "px-4 py-3.5";
const NUMERIC = cn(CELL, "text-right text-sm tabular-nums");

const COLUMNS: {
  id: SortColumn;
  label: string;
  align?: "left" | "right";
  className?: string;
  width?: string;
}[] = [
  {
    id: "ticker",
    label: "Ticker",
    className: cn(
      CELL,
      "sticky left-0 z-10 bg-card pl-5 group-hover:bg-muted/25",
    ),
    width: "minmax(168px, 1.4fr)",
  },
  {
    id: "currentPrice",
    label: "Current Price",
    align: "right",
    className: NUMERIC,
    width: "minmax(112px, 1fr)",
  },
  {
    id: "costPrice",
    label: "Cost Price",
    align: "right",
    className: cn(NUMERIC, "text-muted-foreground"),
    width: "minmax(104px, 1fr)",
  },
  {
    id: "quantity",
    label: "Quantity",
    align: "right",
    className: NUMERIC,
    width: "minmax(96px, 0.9fr)",
  },
  {
    id: "costValue",
    label: "Cost Value",
    align: "right",
    className: cn(NUMERIC, "text-muted-foreground"),
    width: "minmax(112px, 1fr)",
  },
  {
    id: "currentValue",
    label: "Current Value",
    align: "right",
    className: cn(NUMERIC, "font-medium"),
    width: "minmax(112px, 1fr)",
  },
  {
    id: "profitLoss",
    label: "Profit/Loss",
    align: "right",
    className: NUMERIC,
    width: "minmax(112px, 1fr)",
  },
  {
    id: "profitLossPercent",
    label: "P/L %",
    align: "right",
    className: NUMERIC,
    width: "minmax(88px, 0.8fr)",
  },
  {
    id: "portfolioPercent",
    label: "Portfolio %",
    align: "right",
    className: cn(NUMERIC, "pr-5"),
    width: "minmax(96px, 0.85fr)",
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

export function PortfolioTable({
  holdings,
  isLoading,
  currency,
  rates,
  expandedHoldingId,
  dayChanges,
  onToggleExpand,
  onEdit,
  onDelete,
  onAdd,
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
      <RetireEmptyState
        icon={<Plus className="size-5" />}
        title="No assets yet"
        description="Add a holding to start tracking value, weight, and concentration on this book."
        actions={
          onAdd ? (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" />
              Add holding
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="table-shell">
      {isLoading && (
        <div className="border-b border-border/60 px-5 py-3 text-xs text-muted-foreground">
          Updating live prices…
        </div>
      )}
      <ScrollArea className="w-full">
        <Table className="min-w-[960px] table-fixed">
          <colgroup>
            {COLUMNS.map((col) => (
              <col key={col.id} style={{ width: col.width }} />
            ))}
            <col style={{ width: "52px" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
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
              <TableHead
                className={cn(
                  CELL,
                  "sticky right-0 z-10 w-[52px] bg-card pr-5",
                )}
              >
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding) => {
              const loading = holding.isPriceLoading;
              const note = concentrationNoteForWeight(
                holding.portfolioPercent ?? 0,
              );
              const expanded = expandedHoldingId === holding.id;

              return (
                <>
                <TableRow
                  key={holding.id}
                  onClick={() => onToggleExpand(holding)}
                  className={cn(
                    "group cursor-pointer border-border/50 transition-colors duration-150",
                    rowToneClass(note),
                    expanded && "bg-muted/20",
                  )}
                >
                  <TableCell
                    className={cn(
                      CELL,
                      "sticky left-0 z-10 pl-5 font-medium",
                      stickyToneClass(note),
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AssetLogo
                        symbol={holding.symbol}
                        name={holding.name}
                        type={holding.type}
                        logoUrl={holding.logoUrl}
                        priceId={holding.priceId}
                        size="sm"
                      />
                      <div className="flex min-w-0 items-center gap-2">
                        {holding.type === "stock" ? (
                          <Link
                            href={investTickerPath(holding.symbol)}
                            className="font-semibold tracking-tight hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {holding.symbol}
                          </Link>
                        ) : (
                          <span className="font-semibold tracking-tight">
                            {holding.symbol}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="border-border/70 bg-muted/30 px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                        >
                          {holding.type === "cash"
                            ? getCashCurrency(holding)
                            : holding.type}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <PriceCell loading={loading} className={NUMERIC}>
                    {holding.currentPrice !== null
                      ? formatPrice(
                          holding.currentPrice,
                          holding.type,
                          currency,
                          rates,
                        )
                      : "—"}
                  </PriceCell>
                  <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                    {formatPrice(
                      holding.costPrice,
                      holding.type,
                      currency,
                      rates,
                    )}
                  </TableCell>
                  <TableCell className={NUMERIC}>
                    {holding.type === "cash"
                      ? formatCashAmount(
                          holding.quantity,
                          getCashCurrency(holding),
                          currency,
                          rates,
                        )
                      : formatQuantity(holding.quantity, holding.type)}
                  </TableCell>
                  <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                    {formatDisplayMoney(holding.costValue, currency, rates)}
                  </TableCell>
                  <PriceCell loading={loading} className={cn(NUMERIC, "font-medium")}>
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
                      NUMERIC,
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
                      NUMERIC,
                      holding.profitLossPercent !== null &&
                        profitLossClass(holding.profitLossPercent),
                    )}
                  >
                    {holding.profitLossPercent !== null
                      ? formatPercent(holding.profitLossPercent)
                      : "—"}
                  </PriceCell>
                  <PriceCell loading={loading} className={cn(NUMERIC, "pr-5")}>
                    <span className="inline-flex items-center justify-end gap-2">
                      {note !== "none" ? (
                        <span
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-wide",
                            note === "flag"
                              ? "text-[var(--brand-red)]"
                              : "text-[var(--brand-orange)]",
                          )}
                        >
                          {note === "flag" ? "Flag" : "Note"}
                        </span>
                      ) : null}
                      {holding.portfolioPercent !== null
                        ? `${holding.portfolioPercent.toFixed(2)}%`
                        : "—"}
                    </span>
                  </PriceCell>
                  <TableCell
                    className={cn(
                      CELL,
                      "sticky right-0 z-10 w-[52px] pr-5",
                      stickyToneClass(note),
                    )}
                    onClick={(event) => event.stopPropagation()}
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
                            <span className="sr-only">Open actions</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
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
                {expanded ? (
                  <TableRow key={`${holding.id}-expand`} className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length + 1} className="bg-muted/15 px-5 py-4">
                      <HoldingExpandPanel
                        holding={holding}
                        currency={currency}
                        rates={rates}
                        dayChange={dayChanges?.[holding.symbol] ?? null}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
                </>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
