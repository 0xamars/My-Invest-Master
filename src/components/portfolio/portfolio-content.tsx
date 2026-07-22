"use client";

import { useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  AddTransactionButton,
  AddTransactionDialog,
} from "@/components/portfolio/add-transaction-dialog";
import { DeleteHoldingDialog } from "@/components/portfolio/delete-holding-dialog";
import { EditHoldingDialog } from "@/components/portfolio/edit-holding-dialog";
import { HoldingDetailsDialog } from "@/components/portfolio/holding-details-dialog";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { PortfolioTable } from "@/components/portfolio/portfolio-table";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { usePortfolioStorage } from "@/hooks/use-portfolio-storage";
import {
  enrichHoldings,
  getPortfolioTotals,
} from "@/lib/portfolio/calculations";
import { isArchivedHolding, isHoldingVisible } from "@/lib/portfolio/transactions";
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { PortfolioHolding, PortfolioHoldingWithPrices } from "@/types/portfolio";

export function PortfolioContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] =
    useState<PortfolioHolding | null>(null);
  const [viewingHolding, setViewingHolding] =
    useState<PortfolioHoldingWithPrices | null>(null);
  const { holdings, addTransaction, updateHolding, removeHolding, isLoaded, syncError } =
    usePortfolioStorage();
  const { currency, setCurrency, isLoaded: isCurrencyLoaded } =
    useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();
  const {
    prices,
    isLoading,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error,
    refetch,
  } = usePortfolioPrices(holdings);

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

  const showEmptyHint = isLoaded && holdings.length === 0;

  const totalPlPercent =
    totals.costValue === 0 ? 0 : (totals.profitLoss / totals.costValue) * 100;

  if (!isLoaded || !isCurrencyLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-description">
            {isLoading
              ? "Fetching live prices…"
              : lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · refreshing" : ""}`
                : "Track stocks, crypto, custom assets, and cash in one place."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CurrencyToggle
            currency={currency}
            onChange={setCurrency}
            rates={rates}
            isLoading={isFxLoading}
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

      {showEmptyHint && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3.5 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              No holdings in your account yet. Add a transaction to get started —
              your portfolio is saved to the cloud and available on any browser
              or device.
            </p>
          </div>
        </div>
      )}

      {(syncError || error || fxError) && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
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
              totals.hasLoadingPrices ? undefined : formatPercent(totalPlPercent)
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
  );
}
