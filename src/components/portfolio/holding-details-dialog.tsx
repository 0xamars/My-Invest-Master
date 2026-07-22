"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  formatCashAmount,
  formatDisplayMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import { sortTransactions } from "@/lib/portfolio/transactions";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

interface HoldingDetailsDialogProps {
  holding: PortfolioHoldingWithPrices | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: DisplayCurrency;
  rates: FxRates;
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

export function HoldingDetailsDialog({
  holding,
  open,
  onOpenChange,
  currency,
  rates,
  onEdit,
  onDelete,
}: HoldingDetailsDialogProps) {
  if (!holding) return null;

  const loading = holding.isPriceLoading;
  const typeLabel =
    holding.type === "cash" ? getCashCurrency(holding) : holding.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-4 px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
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
                <DialogTitle className="text-xl tracking-tight">
                  {holding.symbol}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                >
                  {typeLabel}
                </Badge>
              </div>
              <DialogDescription className="text-sm leading-relaxed">
                {holding.name}
              </DialogDescription>
            </div>
          </div>

          <div className="inline-flex w-fit items-center rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-medium ring-1 ring-border/50">
            <span className="text-muted-foreground">Sector · </span>
            <span className="ml-1 text-foreground">{holding.sector}</span>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-6 px-6 py-5">
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
                value={new Date(holding.addedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                valueClassName="font-normal text-foreground"
              />
            </div>
          </div>

          {holding.transactions.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Transaction History
              </h3>
              <div className="space-y-2">
                {[...sortTransactions(holding.transactions)]
                  .reverse()
                  .map((tx) => (
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
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
