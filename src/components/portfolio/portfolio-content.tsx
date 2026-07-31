"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AddTransactionButton,
  AddTransactionDialog,
} from "@/components/portfolio/add-transaction-dialog";
import { DeleteHoldingDialog } from "@/components/portfolio/delete-holding-dialog";
import { EditHoldingDialog } from "@/components/portfolio/edit-holding-dialog";
import { HoldingDetailsDialog } from "@/components/portfolio/holding-details-dialog";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { PortfolioIntelligenceContent } from "@/components/portfolio/intelligence/portfolio-intelligence-content";
import { PortfolioTable } from "@/components/portfolio/portfolio-table";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  enrichHoldings,
  getPortfolioTotals,
} from "@/lib/portfolio/calculations";
import { canOpenPortfolioOnPlan } from "@/lib/plans/free-access";
import { isArchivedHolding, isHoldingVisible } from "@/lib/portfolio/transactions";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioHoldingWithPrices } from "@/types/portfolio";

type PortfolioTab = "holdings" | "intelligence";

export function PortfolioContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const portfolioId = params.id;

  const initialTab =
    searchParams.get("tab") === "intelligence" ? "intelligence" : "holdings";
  const [tab, setTab] = useState<PortfolioTab>(initialTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] =
    useState<PortfolioHolding | null>(null);
  const [viewingHolding, setViewingHolding] =
    useState<PortfolioHoldingWithPrices | null>(null);

  const {
    portfolios,
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    isLoaded,
    syncError,
    hasLegacyPortfolioBackup,
    reloadFromCloud,
    activePortfolio,
    setActivePortfolioId,
  } = usePortfolioPlans();
  const { plan, isLoaded: isPlanLoaded } = useUserPlan();

  const { currency, setCurrency, isLoaded: isCurrencyLoaded } =
    useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();
  const {
    prices,
    changes,
    isLoading,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error,
    refetch,
  } = usePortfolioPrices(holdings);

  const targetPortfolio = portfolios.find(
    (portfolio) => portfolio.id === portfolioId,
  );
  const canOpen =
    Boolean(targetPortfolio) &&
    canOpenPortfolioOnPlan(plan, targetPortfolio);

  useEffect(() => {
    if (!isLoaded || !portfolioId) return;

    const portfolio = portfolios.find((item) => item.id === portfolioId);
    if (!portfolio) {
      router.replace("/portfolio");
      return;
    }

    if (!isPlanLoaded) return;
    if (!canOpenPortfolioOnPlan(plan, portfolio)) return;

    setActivePortfolioId(portfolioId);
  }, [
    isLoaded,
    isPlanLoaded,
    plan,
    portfolioId,
    portfolios,
    router,
    setActivePortfolioId,
  ]);

  const visibleHoldings = useMemo(
    () => holdings.filter(isHoldingVisible),
    [holdings],
  );

  const archivedHoldings = useMemo(
    () => holdings.filter(isArchivedHolding),
    [holdings],
  );

  const enrichedHoldings = useMemo(
    () => enrichHoldings(visibleHoldings, prices, loadingSymbols, rates),
    [visibleHoldings, prices, loadingSymbols, rates],
  );

  const totals = useMemo(
    () => getPortfolioTotals(enrichedHoldings),
    [enrichedHoldings],
  );

  const enrichedArchived = useMemo(
    () => enrichHoldings(archivedHoldings, prices, loadingSymbols, rates),
    [archivedHoldings, prices, loadingSymbols, rates],
  );

  const showEmptyHint =
    isLoaded &&
    visibleHoldings.length === 0 &&
    archivedHoldings.length === 0 &&
    !hasLegacyPortfolioBackup;

  const showLegacyRestoreHint =
    isLoaded &&
    visibleHoldings.length === 0 &&
    archivedHoldings.length === 0 &&
    hasLegacyPortfolioBackup;

  const totalPlPercent =
    totals.costValue === 0 ? 0 : (totals.profitLoss / totals.costValue) * 100;

  const isActiveReady = activePortfolio?.id === portfolioId;
  const multiPortfolio = portfolios.length > 1;

  if (!isLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <FreeResourceOpenGuard
      resource="portfolio"
      isResourceLoaded={isLoaded && isPlanLoaded}
      canOpen={canOpen}
      listHref="/portfolio"
      listLabel="Back to Portfolios"
    >
      {!isCurrencyLoaded || !isActiveReady || !activePortfolio ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-8">
          <div className="page-header">
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1.5 text-muted-foreground"
                render={<Link href="/portfolio" />}
              >
                <ArrowLeft className="size-4" />
                All portfolios
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="page-title">{activePortfolio.name}</h1>
                  {activePortfolio.isPrimary && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
                      <Star className="size-3 fill-primary" />
                      Primary
                    </span>
                  )}
                </div>
                <p className="page-description">
                  {isLoading
                    ? "Fetching live prices…"
                    : lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · refreshing" : ""}`
                      : "Track stocks, crypto, custom assets, and cash."}
                  {activePortfolio.isPrimary
                    ? " · Primary (default for Invest, Analytics, and AI)"
                    : " · Currently viewing — Primary is used as the app default"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <CurrencyToggle
                currency={currency}
                onChange={setCurrency}
                rates={rates}
                isLoading={isFxLoading}
                error={fxError}
              />
              <Button
                variant="outline"
                size="icon"
                className="size-10 rounded-xl border-border/80 bg-card transition-colors hover:bg-muted/60"
                onClick={() => refetch()}
                disabled={isLoading || holdings.length === 0}
                title="Refresh prices"
              >
                <RefreshCw
                  className={cn("size-4", isRefreshing && "animate-spin")}
                />
              </Button>
              <AddTransactionButton onClick={() => setDialogOpen(true)} />
            </div>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === "holdings" || value === "intelligence") {
                setTab(value);
                const next = new URLSearchParams(searchParams.toString());
                if (value === "intelligence") {
                  next.set("tab", "intelligence");
                } else {
                  next.delete("tab");
                }
                const query = next.toString();
                router.replace(
                  query
                    ? `/portfolio/${portfolioId}?${query}`
                    : `/portfolio/${portfolioId}`,
                  { scroll: false },
                );
              }
            }}
            className="gap-6"
          >
            <TabsList variant="line" className="w-full justify-start sm:w-auto">
              <TabsTrigger value="holdings" className="px-3">
                Holdings
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="px-3">
                Intelligence
              </TabsTrigger>
            </TabsList>

            <TabsContent value="holdings" className="flex flex-col gap-10">
              {showLegacyRestoreHint && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p>
                      A browser backup of holdings was found and is not in this
                      portfolio yet. Restore uploads it into your cloud portfolios
                      (only when cloud holdings are empty).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void reloadFromCloud()}
                  >
                    Restore to cloud
                  </Button>
                </div>
              )}

              {showEmptyHint && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3.5 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>
                      No holdings in this portfolio yet. Use Add transaction to get
                      started — your data syncs to the cloud.
                    </p>
                  </div>
                  <AddTransactionButton onClick={() => setDialogOpen(true)} />
                </div>
              )}

              {(syncError || error || fxError) && (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm",
                    syncError || error
                      ? "border border-destructive/25 bg-destructive/5 text-destructive"
                      : "border border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200",
                  )}
                >
                  <AlertCircle className="size-4 shrink-0" />
                  {syncError ?? error ?? fxError}
                </div>
              )}

              {enrichedHoldings.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label={`Total value · ${currency}`}
                    value={
                      totals.hasLoadingPrices
                        ? "Loading…"
                        : formatDisplayMoney(totals.currentValue, currency, rates)
                    }
                    isLoading={totals.hasLoadingPrices}
                  />
                  <StatCard
                    label={`Total cost · ${currency}`}
                    value={formatDisplayMoney(totals.costValue, currency, rates)}
                  />
                  <StatCard
                    label={`Total P/L · ${currency}`}
                    value={
                      totals.hasLoadingPrices
                        ? "Loading…"
                        : `${totals.profitLoss >= 0 ? "+" : ""}${formatDisplayMoney(totals.profitLoss, currency, rates)}`
                    }
                    subValue={
                      totals.hasLoadingPrices
                        ? undefined
                        : formatPercent(totalPlPercent)
                    }
                    valueClassName={
                      totals.hasLoadingPrices
                        ? undefined
                        : profitLossClass(totals.profitLoss)
                    }
                    isLoading={totals.hasLoadingPrices}
                  />
                </div>
              )}

              <div className="flex flex-col gap-6">
                <PortfolioTable
                  holdings={enrichedHoldings}
                  isLoading={isLoading}
                  currency={currency}
                  rates={rates}
                  onRowClick={setViewingHolding}
                  onEdit={(holding) => setEditingHolding(holding)}
                  onDelete={(holding) => setDeletingHolding(holding)}
                />

                {enrichedArchived.length > 0 && (
                  <section className="space-y-4">
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Closed Positions (zero quantity)
                    </h2>
                    <PortfolioTable
                      holdings={enrichedArchived}
                      currency={currency}
                      rates={rates}
                      onRowClick={setViewingHolding}
                      onEdit={(holding) => setEditingHolding(holding)}
                      onDelete={(holding) => setDeletingHolding(holding)}
                    />
                  </section>
                )}
              </div>
            </TabsContent>

            <TabsContent value="intelligence" className="outline-none">
              {(syncError || error || fxError) && (
                <div
                  className={cn(
                    "mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm",
                    syncError || error
                      ? "border border-destructive/25 bg-destructive/5 text-destructive"
                      : "border border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200",
                  )}
                >
                  <AlertCircle className="size-4 shrink-0" />
                  {syncError ?? error ?? fxError}
                </div>
              )}
              <PortfolioIntelligenceContent
                holdings={enrichedHoldings}
                totals={totals}
                currency={currency}
                rates={rates}
                portfolioName={activePortfolio.name}
                isPrimary={activePortfolio.isPrimary}
                multiPortfolio={multiPortfolio}
                onAddHolding={() => setDialogOpen(true)}
              />
            </TabsContent>
          </Tabs>

          <AddTransactionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onAdd={addTransaction}
            holdings={holdings}
          />

          <HoldingDetailsDialog
            holding={viewingHolding}
            open={viewingHolding !== null}
            onOpenChange={(open) => {
              if (!open) setViewingHolding(null);
            }}
            currency={currency}
            rates={rates}
            portfolioHoldings={enrichedHoldings}
            dayChange={
              viewingHolding
                ? (changes[viewingHolding.symbol] ?? null)
                : null
            }
            onEdit={(holding) => {
              setViewingHolding(null);
              setEditingHolding(holding);
            }}
            onDelete={(holding) => {
              setViewingHolding(null);
              setDeletingHolding(holding);
            }}
          />

          <EditHoldingDialog
            holding={editingHolding}
            open={editingHolding !== null}
            onOpenChange={(open) => {
              if (!open) setEditingHolding(null);
            }}
            onSave={updateHolding}
          />

          <DeleteHoldingDialog
            holding={deletingHolding}
            open={deletingHolding !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingHolding(null);
            }}
            onConfirm={removeHolding}
          />
        </div>
      )}
    </FreeResourceOpenGuard>
  );
}
