"use client";

import { useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  AddOptionsTransactionButton,
  OptionsTransactionDialog,
} from "@/components/options/add-options-transaction-dialog";
import { DeleteOptionsDialog } from "@/components/options/delete-options-dialog";
import { OptionsTable } from "@/components/options/options-table";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useOptionsPrices } from "@/hooks/use-options-prices";
import { useOptionsStorage } from "@/hooks/use-options-storage";
import {
  enrichOptionsPositions,
  finalizeOptionsSummary,
  getOptionsSummary,
} from "@/lib/portfolio/options-calculations";
import {
  formatDisplayMoney,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { OptionStatus, OptionsPositionWithMetrics } from "@/types/options";

export function OptionsContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingPosition, setDeletingPosition] =
    useState<OptionsPositionWithMetrics | null>(null);

  const { positions, addPosition, updatePosition, removePosition, isLoaded } =
    useOptionsStorage();
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
  } = useOptionsPrices(positions);

  const enrichedPositions = useMemo(
    () => enrichOptionsPositions(positions, prices, loadingSymbols),
    [positions, prices, loadingSymbols],
  );

  const activePositions = useMemo(
    () =>
      enrichedPositions.filter((position) => position.displayStatus === "active"),
    [enrichedPositions],
  );

  const historyPositions = useMemo(
    () =>
      enrichedPositions.filter((position) => position.displayStatus !== "active"),
    [enrichedPositions],
  );

  const summary = useMemo(
    () => finalizeOptionsSummary(getOptionsSummary(enrichedPositions)),
    [enrichedPositions],
  );

  const editingPosition = editingId
    ? (positions.find((position) => position.id === editingId) ?? null)
    : null;

  const handleStatusChange = (id: string, status: OptionStatus) => {
    if (status === "expired") return;

    const position = enrichedPositions.find((item) => item.id === id);
    updatePosition(id, {
      status,
      realizedPl:
        status === "closed" || status === "exercised"
          ? (position?.unrealizedPl ?? undefined)
          : null,
    });
  };

  const openAddDialog = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (position: OptionsPositionWithMetrics) => {
    setEditingId(position.id);
    setDialogOpen(true);
  };

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
          <h1 className="page-title">Options</h1>
          <p className="page-description">
            {isLoading
              ? "Fetching live stock prices…"
              : lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · refreshing" : ""}`
                : "Track calls, puts, premiums, and days to expiration."}
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
            disabled={isLoading || positions.length === 0}
            title="Refresh prices"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </Button>
          <AddOptionsTransactionButton onClick={openAddDialog} />
        </div>
      </div>

      {(error || fxError) && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error ?? fxError}
        </div>
      )}

      {enrichedPositions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label={`Total premium paid · ${currency}`}
            value={formatDisplayMoney(summary.premiumPaid, currency, rates)}
            valueClassName="text-muted-foreground"
          />
          <StatCard
            label={`Total premium received · ${currency}`}
            value={formatDisplayMoney(summary.premiumReceived, currency, rates)}
            valueClassName="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label={`Net premium · ${currency}`}
            value={`${summary.netPremium >= 0 ? "+" : ""}${formatDisplayMoney(summary.netPremium, currency, rates)}`}
            valueClassName={profitLossClass(summary.netPremium)}
          />
        </div>
      )}

      <div className="flex flex-col gap-6">
        <OptionsTable
          variant="active"
          title="Active Positions"
          positions={activePositions}
          isLoading={isLoading}
          currency={currency}
          rates={rates}
          defaultSort={{ column: "dte", direction: "asc" }}
          onEdit={openEditDialog}
          onStatusChange={handleStatusChange}
          onDelete={setDeletingPosition}
        />

        {historyPositions.length > 0 && (
          <OptionsTable
            variant="history"
            title="Closed & Expired"
            positions={historyPositions}
            currency={currency}
            rates={rates}
            defaultSort={{ column: "expiryDate", direction: "desc" }}
            onEdit={openEditDialog}
            onStatusChange={handleStatusChange}
            onDelete={setDeletingPosition}
          />
        )}
      </div>

      <OptionsTransactionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
        editingPosition={editingPosition}
        onAdd={addPosition}
        onUpdate={updatePosition}
      />

      <DeleteOptionsDialog
        position={deletingPosition}
        open={deletingPosition !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPosition(null);
        }}
        onConfirm={(id) => removePosition(id)}
      />
    </div>
  );
}
