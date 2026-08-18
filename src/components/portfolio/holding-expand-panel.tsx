"use client";

import { Loader2 } from "lucide-react";
import { useHoldingExpand } from "@/hooks/use-holding-expand";
import {
  formatCompactMoney,
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import type { HoldingExpandFacts } from "@/lib/portfolio/holding-expand";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

export function HoldingExpandPanel({
  holding,
  currency,
  rates,
  dayChange,
}: {
  holding: PortfolioHoldingWithPrices;
  currency: DisplayCurrency;
  rates: FxRates;
  dayChange?: { change: number; changePercent: number } | null;
}) {
  const { facts, error, isLoading } = useHoldingExpand({
    symbol: holding.symbol,
    type: holding.type,
    priceId: holding.priceId,
    name: holding.name,
  });

  const money = (value: number) => formatDisplayMoney(value, currency, rates);
  const change = facts?.whyMoved.change ?? dayChange?.change ?? null;
  const changePercent =
    facts?.whyMoved.changePercent ?? dayChange?.changePercent ?? null;

  return (
    <div
      className="space-y-4 px-1 py-1"
      data-holding-expand={holding.type}
      data-rating-ui="off"
    >
      <section>
        <p className="budget-metric-label">Why it moved</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              change != null ? profitLossClass(change) : "text-muted-foreground",
            )}
          >
            {change == null
              ? "—"
              : `${change >= 0 ? "+" : "−"}${money(Math.abs(change))}`}
          </span>
          {changePercent != null ? (
            <span
              className={cn(
                "text-sm tabular-nums",
                profitLossClass(changePercent),
              )}
            >
              {formatPercent(changePercent)}
            </span>
          ) : null}
          {facts?.whyMoved.volumeVsTypical != null ? (
            <span className="text-xs text-muted-foreground">
              Volume {facts.whyMoved.volumeVsTypical.toFixed(1)}× typical
            </span>
          ) : null}
        </div>
        {facts?.whyMoved.headline ? (
          facts.whyMoved.headline.link ? (
            <a
              href={facts.whyMoved.headline.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-foreground hover:underline"
            >
              {facts.whyMoved.headline.title}
            </a>
          ) : (
            <p className="mt-1 text-sm">{facts.whyMoved.headline.title}</p>
          )
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Fact
          label="Size"
          value={
            holding.currentValue != null ? money(holding.currentValue) : "—"
          }
        />
        <Fact
          label="P/L"
          value={
            holding.profitLoss == null
              ? "—"
              : `${holding.profitLoss >= 0 ? "+" : "−"}${money(Math.abs(holding.profitLoss))}`
          }
          tone={
            holding.profitLoss == null
              ? undefined
              : profitLossClass(holding.profitLoss)
          }
        />
        <Fact
          label="% of book"
          value={
            holding.portfolioPercent != null
              ? `${holding.portfolioPercent.toFixed(1)}%`
              : "—"
          }
        />
      </section>

      {holding.type !== "stock" ? null : isLoading && !facts ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading facts…
        </p>
      ) : error && !facts ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : facts ? (
        <StockScreens facts={facts} />
      ) : null}
    </div>
  );
}

function StockScreens({ facts }: { facts: HoldingExpandFacts }) {
  if (!facts.showScreens || !facts.screens) return null;

  const path = facts.screens.revenuePath;
  const cash = facts.screens.cashVsDebt;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {path ? (
        <section>
          <p className="budget-metric-label">Revenue path</p>
          <p className="mt-1 text-sm font-medium capitalize">{path.kind}</p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {path.years
              .map((year) => `${year.year} ${formatCompactMoney(year.revenue)}`)
              .join(" · ")}
          </p>
        </section>
      ) : null}
      {cash ? (
        <section>
          <p className="budget-metric-label">Cash vs debt</p>
          <p className="mt-1 text-sm font-medium">
            {cash.netCash == null
              ? "—"
              : cash.netCash
                ? "Net cash"
                : "Net debt"}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            Cash+STI{" "}
            {cash.cashAndSti == null ? "—" : formatCompactMoney(cash.cashAndSti)}
            {" · "}
            Debt {cash.totalDebt == null ? "—" : formatCompactMoney(cash.totalDebt)}
          </p>
        </section>
      ) : null}
      {facts.nextEarningsDate ? (
        <section className="sm:col-span-2">
          <p className="budget-metric-label">Next earnings</p>
          <p className="mt-1 text-sm tabular-nums">{facts.nextEarningsDate}</p>
        </section>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className={cn("mt-1 text-sm font-medium tabular-nums", tone)}>{value}</p>
    </div>
  );
}
