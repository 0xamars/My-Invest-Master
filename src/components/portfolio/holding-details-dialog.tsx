"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Eye,
  Info,
  Loader2,
  Pencil,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { buildAnalysisHref } from "@/lib/analysis/types";
import {
  buildHoldingInsight,
  concentrationLevelLabel,
  type HoldingInsightNote,
} from "@/lib/portfolio/holding-insight";
import {
  formatCashAmount,
  formatDisplayMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  profitLossClass,
} from "@/lib/portfolio/format";
import { sortTransactions } from "@/lib/portfolio/transactions";
import { cn } from "@/lib/utils";
import { isWatchlistAssetType } from "@/types/watchlist";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

type HoldingInsightTab = "position" | "insight" | "history";

interface HoldingDetailsDialogProps {
  holding: PortfolioHoldingWithPrices | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: DisplayCurrency;
  rates: FxRates;
  /** All priced holdings in this portfolio — used for contribution / concentration. */
  portfolioHoldings?: PortfolioHoldingWithPrices[];
  /** Daily (or 24h) change from market data when available. */
  dayChange?: { change: number; changePercent: number } | null;
  onEdit: (holding: PortfolioHoldingWithPrices) => void;
  onDelete: (holding: PortfolioHoldingWithPrices) => void;
}

function DetailItem({
  label,
  value,
  valueClassName,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  loading?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <div className="flex h-6 items-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <p className={cn("text-sm font-medium tabular-nums", valueClassName)}>
          {value}
        </p>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: HoldingInsightNote }) {
  const icon =
    note.severity === "alert" ? (
      <ShieldAlert className="size-4 text-red-500 dark:text-red-400" />
    ) : note.severity === "watch" ? (
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
    ) : (
      <Info className="size-4 text-primary" />
    );

  return (
    <div
      className="flex gap-3 rounded-xl border border-border/70 bg-muted/15 px-3.5 py-3"
      data-insight-id={note.id}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{note.title}</p>
          {note.metric && (
            <span className="rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
              {note.metric}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {note.description}
        </p>
      </div>
    </div>
  );
}

function concentrationBadgeClass(level: "low" | "elevated" | "high"): string {
  if (level === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (level === "elevated") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
}

export function HoldingDetailsDialog({
  holding,
  open,
  onOpenChange,
  currency,
  rates,
  portfolioHoldings = [],
  dayChange = null,
  onEdit,
  onDelete,
}: HoldingDetailsDialogProps) {
  const [tab, setTab] = useState<HoldingInsightTab>("position");
  const [watchlistId, setWatchlistId] = useState<string>("");
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [watchlistAdded, setWatchlistAdded] = useState(false);

  const { lists, addTicker, isLoaded: watchlistsLoaded } = useWatchlistPlans();

  useEffect(() => {
    if (!open) return;
    setTab("position");
    setWatchlistMessage(null);
    setWatchlistAdded(false);
  }, [open, holding?.id]);

  useEffect(() => {
    if (!watchlistsLoaded) return;
    if (lists.length === 0) {
      setWatchlistId("");
      return;
    }
    if (!watchlistId || !lists.some((list) => list.id === watchlistId)) {
      setWatchlistId(lists[0].id);
    }
  }, [watchlistsLoaded, lists, watchlistId]);

  const insight = useMemo(() => {
    if (!holding) return null;
    const context =
      portfolioHoldings.length > 0 ? portfolioHoldings : [holding];
    return buildHoldingInsight(holding, context);
  }, [holding, portfolioHoldings]);

  const canAddToWatchlist =
    holding != null && isWatchlistAssetType(holding.type);

  const alreadyOnWatchlist = useMemo(() => {
    if (!holding || !watchlistId) return false;
    const list = lists.find((item) => item.id === watchlistId);
    if (!list) return false;
    return list.items.some(
      (item) =>
        item.symbol === holding.symbol.toUpperCase() &&
        item.type === holding.type,
    );
  }, [holding, lists, watchlistId]);

  if (!holding) return null;

  const loading = holding.isPriceLoading;
  const typeLabel =
    holding.type === "cash" ? getCashCurrency(holding) : holding.type;

  function handleAddToWatchlist() {
    if (!holding) return;
    if (!isWatchlistAssetType(holding.type)) return;

    if (lists.length === 0) {
      setWatchlistMessage(
        "Create a watchlist first under Invest → Watchlist.",
      );
      return;
    }

    if (!watchlistId) {
      setWatchlistMessage("Select a watchlist to continue.");
      return;
    }

    if (alreadyOnWatchlist) {
      setWatchlistMessage("Already on this watchlist.");
      setWatchlistAdded(true);
      return;
    }

    addTicker(watchlistId, {
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      priceId: holding.priceId,
      logoUrl: holding.logoUrl,
    });
    setWatchlistAdded(true);
    setWatchlistMessage("Added to watchlist.");
  }

  const sortedTx = [...sortTransactions(holding.transactions)].reverse();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="space-y-4 border-b border-border/60 px-6 pt-6 pb-5 text-left">
          <div className="flex items-start gap-4 pr-8">
            <AssetLogo
              symbol={holding.symbol}
              name={holding.name}
              type={holding.type}
              logoUrl={holding.logoUrl}
              priceId={holding.priceId}
              size="md"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  {holding.symbol}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                >
                  {typeLabel}
                </Badge>
              </div>
              <SheetDescription className="text-sm leading-relaxed">
                {holding.name}
              </SheetDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex w-fit items-center rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-medium ring-1 ring-border/50">
              <span className="text-muted-foreground">Sector · </span>
              <span className="ml-1 text-foreground">{holding.sector}</span>
            </div>
            {insight && (
              <div
                className={cn(
                  "inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-sm font-medium ring-1",
                  concentrationBadgeClass(insight.concentrationLevel),
                )}
              >
                Concentration · {concentrationLevelLabel(insight.concentrationLevel)}
              </div>
            )}
          </div>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (
              value === "position" ||
              value === "insight" ||
              value === "history"
            ) {
              setTab(value);
            }
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b border-border/60 px-6 pt-3">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="position" className="px-3">
                Position
              </TabsTrigger>
              <TabsTrigger value="insight" className="px-3">
                Insight
              </TabsTrigger>
              <TabsTrigger value="history" className="px-3">
                History
                {sortedTx.length > 0 ? (
                  <span className="ml-1 text-muted-foreground">
                    ({sortedTx.length})
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="position" className="space-y-6 px-6 py-5">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Position
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailItem
                    label="Current Price"
                    loading={loading}
                    value={
                      holding.currentPrice !== null
                        ? formatPrice(
                            holding.currentPrice,
                            holding.type,
                            currency,
                            rates,
                          )
                        : "—"
                    }
                  />
                  <DetailItem
                    label="Avg Cost"
                    value={formatPrice(
                      holding.costPrice,
                      holding.type,
                      currency,
                      rates,
                    )}
                  />
                  <DetailItem
                    label="Quantity"
                    value={
                      holding.type === "cash"
                        ? formatCashAmount(
                            holding.quantity,
                            getCashCurrency(holding),
                            currency,
                            rates,
                          )
                        : formatQuantity(holding.quantity, holding.type)
                    }
                  />
                  {(holding.type === "stock" || holding.type === "crypto") && (
                    <>
                      <DetailItem
                        label={
                          holding.type === "crypto" ? "24h Change" : "Day Change"
                        }
                        loading={loading && !dayChange}
                        value={
                          dayChange
                            ? `${dayChange.change >= 0 ? "+" : ""}${formatDisplayMoney(dayChange.change, currency, rates)}`
                            : "—"
                        }
                        valueClassName={
                          dayChange
                            ? profitLossClass(dayChange.change)
                            : undefined
                        }
                      />
                      <DetailItem
                        label={
                          holding.type === "crypto" ? "24h Change %" : "Day Change %"
                        }
                        loading={loading && !dayChange}
                        value={
                          dayChange
                            ? formatPercent(dayChange.changePercent)
                            : "—"
                        }
                        valueClassName={
                          dayChange
                            ? profitLossClass(dayChange.changePercent)
                            : undefined
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Performance
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailItem
                    label="Cost Value"
                    value={formatDisplayMoney(
                      holding.costValue,
                      currency,
                      rates,
                    )}
                    valueClassName="text-muted-foreground"
                  />
                  <DetailItem
                    label="Current Value"
                    loading={loading}
                    value={
                      holding.currentValue !== null
                        ? formatDisplayMoney(
                            holding.currentValue,
                            currency,
                            rates,
                          )
                        : "—"
                    }
                  />
                  <DetailItem
                    label="Profit / Loss"
                    loading={loading}
                    value={
                      holding.profitLoss !== null ? (
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
                      )
                    }
                    valueClassName={
                      holding.profitLoss !== null
                        ? profitLossClass(holding.profitLoss)
                        : undefined
                    }
                  />
                  <DetailItem
                    label="P/L %"
                    loading={loading}
                    value={
                      holding.profitLossPercent !== null
                        ? formatPercent(holding.profitLossPercent)
                        : "—"
                    }
                    valueClassName={
                      holding.profitLossPercent !== null
                        ? profitLossClass(holding.profitLossPercent)
                        : undefined
                    }
                  />
                  <DetailItem
                    label="Portfolio %"
                    loading={loading}
                    value={
                      holding.portfolioPercent !== null
                        ? `${holding.portfolioPercent.toFixed(2)}%`
                        : "—"
                    }
                  />
                  <DetailItem
                    label="Added"
                    value={new Date(holding.addedAt).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                    valueClassName="font-normal text-foreground"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="insight" className="space-y-5 px-6 py-5">
              {insight && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Weight
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {insight.weight != null
                          ? `${insight.weight.toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Rank
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {insight.rank != null
                          ? `#${insight.rank}`
                          : "—"}
                        {insight.holdingsCount > 0 && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            / {insight.holdingsCount}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Of |P/L|
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {insight.contributionPercent != null
                          ? `${insight.contributionPercent.toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Asset class
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {insight.assetTypeWeight != null
                          ? `${insight.assetTypeWeight.toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Portfolio contribution
                    </h3>
                    {insight.concentrationNote ? (
                      <NoteCard note={insight.concentrationNote} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not enough priced holdings yet to score concentration.
                      </p>
                    )}
                    {insight.sectorWeight != null && (
                      <p className="text-xs text-muted-foreground">
                        Sector sleeve ({holding.sector}):{" "}
                        <span className="font-medium text-foreground">
                          {insight.sectorWeight.toFixed(1)}%
                        </span>{" "}
                        of portfolio value.
                      </p>
                    )}
                  </div>

                  {insight.riskNotes.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Risk notes
                      </h3>
                      <div className="space-y-2">
                        {insight.riskNotes.map((note) => (
                          <NoteCard key={note.id} note={note} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Market snapshot
                    </h3>
                    {holding.type === "stock" || holding.type === "crypto" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <DetailItem
                          label="Last price"
                          loading={loading}
                          value={
                            holding.currentPrice != null
                              ? formatPrice(
                                  holding.currentPrice,
                                  holding.type,
                                  currency,
                                  rates,
                                )
                              : "—"
                          }
                        />
                        <DetailItem
                          label={
                            holding.type === "crypto"
                              ? "24h change %"
                              : "Day change %"
                          }
                          loading={loading && !dayChange}
                          value={
                            dayChange
                              ? formatPercent(dayChange.changePercent)
                              : "Unavailable"
                          }
                          valueClassName={
                            dayChange
                              ? profitLossClass(dayChange.changePercent)
                              : "text-muted-foreground"
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Live market change is available for stocks and crypto
                        with price feeds.
                      </p>
                    )}
                  </div>

                  <div
                    className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4"
                    data-extension="investsalsa-rating"
                  >
                    <div className="flex gap-3">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {insight.ratingPlaceholder.title}
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {insight.ratingPlaceholder.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-xl border border-border/70 bg-muted/15 px-4 py-4"
                    data-extension="ticker-analysis"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Ticker analysis
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Open the dedicated research page for quote context,
                      placeholders for fundamentals/technicals, and the future
                      InvestSalsa Rating.
                    </p>
                    {(holding.type === "stock" ||
                      holding.type === "crypto") && (
                      <Button
                        className="mt-3 gap-2"
                        size="sm"
                        render={
                          <Link
                            href={buildAnalysisHref(
                              holding.symbol,
                              holding.type,
                              holding.priceId,
                            )}
                          />
                        }
                      >
                        <Search className="size-3.5" />
                        View analysis
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 px-6 py-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Transaction history
              </h3>
              {sortedTx.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                  No transactions recorded for this holding yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTx.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {tx.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(`${tx.date}T12:00:00`).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </div>
                      <div className="text-right text-sm tabular-nums">
                        <p>
                          {formatQuantity(tx.quantity, holding.type)} @{" "}
                          {formatPrice(tx.pricePerUnit, holding.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayMoney(
                            tx.quantity * tx.pricePerUnit,
                            currency,
                            rates,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <SheetFooter className="border-t border-border/60 px-6 py-4">
          {canAddToWatchlist && (
            <div className="mb-1 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {lists.length > 1 && (
                  <Select
                    value={watchlistId || undefined}
                    onValueChange={(value) => {
                      if (value) {
                        setWatchlistId(value);
                        setWatchlistMessage(null);
                        setWatchlistAdded(false);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Watchlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleAddToWatchlist}
                  disabled={watchlistAdded && alreadyOnWatchlist}
                >
                  {watchlistAdded || alreadyOnWatchlist ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {alreadyOnWatchlist || watchlistAdded
                    ? "On watchlist"
                    : "Add to Watchlist"}
                </Button>
              </div>
              {watchlistMessage && (
                <p
                  className={cn(
                    "text-xs",
                    watchlistAdded || alreadyOnWatchlist
                      ? "text-primary"
                      : "text-amber-700 dark:text-amber-400",
                  )}
                >
                  {watchlistMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => onEdit(holding)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => onDelete(holding)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
