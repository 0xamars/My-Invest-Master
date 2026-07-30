"use client";

import { Trash2 } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  formatDisplayMoney,
  formatPrice,
  formatQuantity,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { RetirementPlanAsset } from "@/types/retirement";
import { isLivePricedAsset } from "@/types/portfolio";

interface RetirementPlanAssetsTableProps {
  assets: RetirementPlanAsset[];
  currency: DisplayCurrency;
  rates: FxRates;
  loadingSymbols: Set<string>;
  onUpdateAsset: (
    id: string,
    patch: Partial<
      Pick<RetirementPlanAsset, "unitPrice" | "quantity" | "expectedCagr">
    >,
  ) => void;
  onDeleteAsset: (id: string) => void;
}

const CELL = "px-4 py-3.5";
const NUMERIC = cn(CELL, "text-right text-sm tabular-nums");

export function RetirementPlanAssetsTable({
  assets,
  currency,
  rates,
  loadingSymbols,
  onUpdateAsset,
  onDeleteAsset,
}: RetirementPlanAssetsTableProps) {
  if (assets.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
        No assets yet. Add holdings or import from your portfolio to begin
        projecting growth.
      </div>
    );
  }

  return (
    <ScrollArea className="w-full rounded-xl border border-border/70">
      <div className="min-w-[720px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(CELL, "pl-5")}>Asset / Ticker</TableHead>
              <TableHead className={NUMERIC}>Asset Price</TableHead>
              <TableHead className={NUMERIC}>Quantity Held</TableHead>
              <TableHead className={NUMERIC}>Expected CAGR %</TableHead>
              <TableHead className={cn(NUMERIC, "pr-5")}>Value</TableHead>
              <TableHead className="w-12 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => {
              const isLoading =
                isLivePricedAsset(asset.type) &&
                loadingSymbols.has(asset.symbol);
              const value = asset.unitPrice * asset.quantity;
              const canEditPrice =
                asset.type === "custom" || asset.type === "cash";

              return (
                <TableRow key={asset.id} className="group">
                  <TableCell className={cn(CELL, "pl-5")}>
                    <div className="flex items-center gap-3">
                      <AssetLogo
                        symbol={asset.symbol}
                        name={asset.name}
                        type={asset.type}
                        logoUrl={asset.logoUrl}
                        priceId={asset.priceId}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{asset.symbol}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {asset.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={NUMERIC}>
                    {isLoading ? (
                      <Skeleton className="ml-auto h-8 w-24" />
                    ) : canEditPrice || !isLivePricedAsset(asset.type) ? (
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="ml-auto h-8 w-28 text-right tabular-nums"
                        value={asset.unitPrice}
                        onChange={(event) =>
                          onUpdateAsset(asset.id, {
                            unitPrice: Number(event.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {formatPrice(
                          asset.unitPrice,
                          asset.type,
                          currency,
                          rates,
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={NUMERIC}>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="ml-auto h-8 w-24 text-right tabular-nums"
                      value={asset.quantity}
                      onChange={(event) =>
                        onUpdateAsset(asset.id, {
                          quantity: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className={NUMERIC}>
                    <Input
                      type="number"
                      step="0.1"
                      className="ml-auto h-8 w-20 text-right tabular-nums"
                      value={asset.expectedCagr}
                      onChange={(event) =>
                        onUpdateAsset(asset.id, {
                          expectedCagr: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell
                    className={cn(NUMERIC, "pr-5 font-medium tabular-nums")}
                  >
                    {formatDisplayMoney(value, currency, rates)}
                  </TableCell>
                  <TableCell className="px-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteAsset(asset.id)}
                      aria-label={`Delete ${asset.symbol}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
