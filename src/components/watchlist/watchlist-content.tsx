"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import {
  RetireEmptyState,
  RetirePageHeader,
  RetirePanel,
} from "@/components/retirement/retire-ui";
import { AddWatchlistTickerDialog } from "@/components/watchlist/add-watchlist-ticker-dialog";
import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { Button } from "@/components/ui/button";
import { InlineTitle } from "@/components/ui/inline-title";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { useWatchlistPrices } from "@/hooks/use-watchlist-prices";
import { INVEST_PATH, INVEST_WATCHLIST_PATH, investWatchlistPath } from "@/lib/chrome/nav";
import { canOpenWatchlistOnPlan } from "@/lib/plans/free-access";
import type { WatchlistItemWithPrices } from "@/types/watchlist";

interface WatchlistContentProps {
  listId: string;
}

export function WatchlistContent({ listId }: WatchlistContentProps) {
  const router = useRouter();
  const {
    lists,
    getWatchlist,
    addTicker,
    removeTicker,
    renameWatchlist,
    isLoaded,
    syncError,
  } = useWatchlistPlans();
  const { primaryPortfolio } = usePortfolioPlans();
  const { plan: userPlan, prefsLoadSucceeded } = useUserPlan();
  const effectivePlan = prefsLoadSucceeded ? userPlan : "free";

  const watchlist = getWatchlist(listId);
  const canOpen = canOpenWatchlistOnPlan(effectivePlan, lists, listId);

  const [addOpen, setAddOpen] = useState(false);

  const items = watchlist?.items ?? [];
  const {
    prices,
    changes,
    isLoading,
    isRefreshing,
    error: priceError,
    loadingSymbols,
    refresh,
  } = useWatchlistPrices(items);

  const enrichedItems: WatchlistItemWithPrices[] = useMemo(
    () =>
      items.map((item) => {
        const quote = changes[item.symbol];
        return {
          ...item,
          currentPrice: prices[item.symbol] ?? null,
          change: quote?.change ?? null,
          changePercent: quote?.changePercent ?? null,
          isPriceLoading: loadingSymbols.has(item.symbol),
        };
      }),
    [items, prices, changes, loadingSymbols],
  );

  const existingKeys = useMemo(
    () => items.map((item) => `${item.symbol}:${item.type}`),
    [items],
  );

  const heldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const holding of primaryPortfolio?.holdings ?? []) {
      if (holding.quantity <= 0) continue;
      if (holding.type !== "stock" && holding.type !== "crypto") continue;
      keys.add(`${holding.symbol.toUpperCase()}:${holding.type}`);
    }
    return keys;
  }, [primaryPortfolio]);

  const openableLists = lists.filter((list) =>
    canOpenWatchlistOnPlan(effectivePlan, lists, list.id),
  );

  if (isLoaded && !watchlist) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-sm text-muted-foreground">
          This watchlist could not be found.
        </p>
        <Button variant="outline" render={<Link href={INVEST_PATH} />}>
          <ArrowLeft className="size-4" />
          Back to Invest
        </Button>
      </div>
    );
  }

  return (
    <FreeResourceOpenGuard
      resource="watchlist"
      isResourceLoaded={isLoaded}
      canOpen={canOpen}
      listHref={INVEST_PATH}
      listLabel="Back to Invest"
    >
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1.5 text-muted-foreground"
              render={<Link href={INVEST_PATH} />}
            >
              <ArrowLeft className="size-3.5" />
              Back to Invest
            </Button>
            <RetirePageHeader
              title={
                watchlist ? (
                  <InlineTitle
                    value={watchlist.name}
                    onCommit={(next) => renameWatchlist(listId, next)}
                    ariaLabel="Watchlist name"
                  />
                ) : (
                  "Watchlist"
                )
              }
              description="Queue only — symbol, last price, and whether the name is already in the book. Adding here does not unlock research."
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {openableLists.length > 1 && (
              <Select
                value={listId}
                onValueChange={(value) => {
                  if (value && value !== listId) {
                    router.push(investWatchlistPath(value));
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Switch watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {openableLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void refresh()}
              disabled={isRefreshing || items.length === 0}
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add ticker
            </Button>
          </div>
        </div>

        {syncError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {syncError}
          </div>
        )}

        {priceError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {priceError}
          </div>
        )}

        {!isLoaded || !watchlist ? (
          <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading watchlist…
          </div>
        ) : items.length === 0 ? (
          <RetirePanel>
            <RetireEmptyState
              icon={<Eye className="size-5" />}
              title="No tickers yet"
              description="Add stocks or crypto to the queue. This list is not the book and does not open research."
              actions={
                <Button className="gap-2" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" />
                  Add your first ticker
                </Button>
              }
            />
          </RetirePanel>
        ) : (
          <WatchlistTable
            items={enrichedItems}
            isLoading={isLoading}
            heldKeys={heldKeys}
            onRemove={(item) => removeTicker(listId, item.id)}
          />
        )}

        <AddWatchlistTickerDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          existingKeys={existingKeys}
          onAdd={(input) => {
            addTicker(listId, input);
          }}
        />
      </div>
    </FreeResourceOpenGuard>
  );
}
