"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatProjectionMoney,
  formatProjectionSpending,
} from "@/lib/retirement/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { RetirementPlanAsset, YearProjection } from "@/types/retirement";

interface RetirementPlanProjectionsTableProps {
  projections: YearProjection[];
  assets: RetirementPlanAsset[];
  currency: DisplayCurrency;
  rates: FxRates;
  retirementYear: number;
}

const METRIC_ROWS: {
  key: keyof Pick<
    YearProjection,
    | "openingBalance"
    | "assetAppreciation"
    | "balanceAfterAppreciation"
    | "lifestyleSpending"
    | "closingBalance"
  >;
  label: string;
  className?: string;
}[] = [
  { key: "openingBalance", label: "Opening Balance" },
  {
    key: "assetAppreciation",
    label: "Asset Appreciation (Estimate)",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  { key: "balanceAfterAppreciation", label: "Balance after Appreciation" },
  {
    key: "lifestyleSpending",
    label: "Lifestyle Spending",
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "closingBalance",
    label: "Closing Balance",
    className: "font-semibold",
  },
];

const CELL = "px-3 py-3";
const LABEL_CELL = cn(
  CELL,
  "sticky left-0 z-10 min-w-[200px] bg-card pl-5 text-sm font-medium backdrop-blur-sm",
);
const NUMERIC = cn(CELL, "min-w-[112px] text-right text-sm tabular-nums");

function formatProjectionCell(
  key: (typeof METRIC_ROWS)[number]["key"],
  value: number,
  currency: DisplayCurrency,
  rates: FxRates,
): string {
  if (key === "lifestyleSpending") {
    return formatProjectionSpending(value, currency, rates);
  }

  return formatProjectionMoney(value, currency, rates);
}

export function RetirementPlanProjectionsTable({
  projections,
  assets,
  currency,
  rates,
  retirementYear,
}: RetirementPlanProjectionsTableProps) {
  const [showAssetBreakdown, setShowAssetBreakdown] = useState(false);

  if (projections.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center text-sm text-muted-foreground">
        Add assets to see year-by-year projections.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAssetBreakdown((open) => !open)}
        >
          {showAssetBreakdown ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {showAssetBreakdown ? "Hide" : "Show"} asset breakdown
        </Button>
      </div>

      <ScrollArea className="w-full rounded-xl border border-border/70">
        <div
          className="min-w-full"
          style={{
            minWidth: `${220 + projections.length * 120}px`,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={LABEL_CELL}>Metric</TableHead>
                {projections.map((projection) => {
                  const isRetirement = projection.year === retirementYear;

                  return (
                    <TableHead
                      key={projection.year}
                      className={cn(
                        NUMERIC,
                        "pr-4 text-xs font-semibold",
                        isRetirement && "bg-primary/10 text-primary",
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{projection.year}</span>
                        {isRetirement && (
                          <span className="rounded-md bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                            Retire
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRIC_ROWS.map((metric) => (
                <TableRow key={metric.key} className="group">
                  <TableCell
                    className={cn(
                      LABEL_CELL,
                      "group-hover:bg-muted/25",
                      metric.className,
                    )}
                  >
                    {metric.label}
                  </TableCell>
                  {projections.map((projection) => {
                    const isRetirement = projection.year === retirementYear;

                    return (
                      <TableCell
                        key={`${metric.key}-${projection.year}`}
                        className={cn(
                          NUMERIC,
                          "pr-4",
                          metric.className,
                          isRetirement && "bg-primary/5",
                        )}
                      >
                        {formatProjectionCell(
                          metric.key,
                          projection[metric.key],
                          currency,
                          rates,
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}

              {showAssetBreakdown &&
                assets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="bg-muted/10 hover:bg-muted/20"
                  >
                    <TableCell
                      className={cn(
                        LABEL_CELL,
                        "pl-8 text-sm text-muted-foreground",
                      )}
                    >
                      {asset.symbol}
                    </TableCell>
                    {projections.map((projection) => {
                      const isRetirement = projection.year === retirementYear;

                      return (
                        <TableCell
                          key={`${asset.id}-${projection.year}`}
                          className={cn(
                            NUMERIC,
                            "pr-4 text-sm text-muted-foreground",
                            isRetirement && "bg-primary/5",
                          )}
                        >
                          {formatProjectionMoney(
                            projection.assetBreakdown[asset.id] ?? 0,
                            currency,
                            rates,
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
