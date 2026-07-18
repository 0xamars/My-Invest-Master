"use client";

import { useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AddAssetButton,
  AddAssetDialog,
} from "@/components/portfolio/add-asset-dialog";
import { DeleteHoldingDialog } from "@/components/portfolio/delete-holding-dialog";
import { EditHoldingDialog } from "@/components/portfolio/edit-holding-dialog";
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
import {
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/types/portfolio";

export function PortfolioContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] =
    useState<PortfolioHolding | null>(null);
  const { holdings, addHolding, updateHolding, removeHolding, isLoaded } =
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

  const enrichedHoldings = useMemo(
    () => enrichHoldings(holdings, prices, loadingSymbols, rates),
    [holdings, prices, loadingSymbols, rates],
  );

  const totals = useMemo(
    () => getPortfolioTotals(enrichedHoldings),
    [enrichedHoldings],
  );

  const totalPlPercent =
    totals.costValue === 0 ? 0 : (totals.profitLoss / totals.costValue) * 100;

  if (!isLoaded || !isCurrencyLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title metallic-text">Portfolio</h1>
          <p className="page-description">
            {isLoading
              ? "Fetching live prices…"
              : lastUpdated
                ? `Live prices · Updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · Refreshing…" : ""}`
                : "Track stocks, crypto, custom assets, and cash"}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <CurrencyToggle
            currency={currency}
            onChange={setCurrency}
            rates={rates}
            isLoading={isFxLoading}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading || holdings.length === 0}
              title="Refresh prices"
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
            </Button>
            <AddAssetButton onClick={() => setDialogOpen(true)} />
          </div>
        </div>
      </div>

      {(error || fxError) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error ?? fxError}
        </div>
      )}

      {enrichedHoldings.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label={`Total Value (${currency})`}
            value={
              totals.hasLoadingPrices
                ? "Loading…"
                : formatDisplayMoney(
                    totals.currentValue,
                    currency,
                    rates,
                  )
            }
            isLoading={totals.hasLoadingPrices}
          />
          <SummaryCard
            label={`Total Cost (${currency})`}
            value={formatDisplayMoney(
              totals.costValue,
              currency,
              rates,
            )}
          />
          <SummaryCard
            label={`Total P/L (${currency})`}
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

      <PortfolioTable
        holdings={enrichedHoldings}
        isLoading={isLoading}
        currency={currency}
        rates={rates}
        onEdit={(holding) => setEditingHolding(holding)}
        onDelete={(holding) => setDeletingHolding(holding)}
      />

      <AddAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={addHolding}
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

function SummaryCard({
  label,
  value,
  subValue,
  valueClassName,
  isLoading,
}: {
  label: string;
  value: string;
  subValue?: string;
  valueClassName?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          isLoading && "animate-pulse text-muted-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className={cn("text-sm tabular-nums", valueClassName)}>{subValue}</p>
      )}
    </div>
  );
}
