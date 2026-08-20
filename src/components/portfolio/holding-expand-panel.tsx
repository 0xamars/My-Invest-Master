"use client";

import { Loader2 } from "lucide-react";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useHoldingExpand } from "@/hooks/use-holding-expand";
import {
  formatCompactMoney,
  formatDisplayMoney,
  formatPercent,
  profitLossClass,
} from "@/lib/portfolio/format";
import { firstBoughtDate } from "@/lib/invest/closed-fills";
import { vsSpyFactLine } from "@/lib/invest/vs-spy";
import {
  optionsOnUnderlying,
  whyMovedFactLine,
  type HoldingExpandFacts,
  type HoldingExpandOption,
} from "@/lib/portfolio/holding-expand";
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
    boughtAt: firstBoughtDate(holding),
    returnPercent: holding.profitLossPercent,
  });
  const { enrichedPositions } = useInvestSummary();
  const overlay = optionsOnUnderlying(
    enrichedPositions,
    holding.symbol,
    holding.currentPrice,
  );

  const money = (value: number) => formatDisplayMoney(value, currency, rates);
  const change = facts?.whyMoved.change ?? dayChange?.change ?? null;
  const changePercent =
    facts?.whyMoved.changePercent ?? dayChange?.changePercent ?? null;
  const extras = whyMovedFactLine({
    changePercent: null,
    volumeVsTypical: facts?.whyMoved.volumeVsTypical ?? null,
    headlineTitle: facts?.whyMoved.headline?.title ?? null,
  });
  const hasMove = change != null || changePercent != null;

  return (
    <div
      className="space-y-1.5 text-sm"
      data-holding-expand={holding.type}
      data-holding-expand-screen="1"
      data-rating-ui="off"
    >
      <p className="min-w-0 tabular-nums">
        {hasMove ? (
          <span
            className={profitLossClass(changePercent ?? change ?? 0)}
          >
            {change != null
              ? `${change >= 0 ? "+" : "−"}${money(Math.abs(change))}`
              : null}
            {change != null && changePercent != null ? " " : null}
            {changePercent != null ? formatPercent(changePercent) : null}
          </span>
        ) : extras ? null : (
          <span className="text-muted-foreground">—</span>
        )}
        {extras ? (
          <span className="text-muted-foreground">
            {hasMove ? " · " : ""}
            {extras}
          </span>
        ) : null}
      </p>

      <p className="tabular-nums">
        {holding.currentValue != null ? money(holding.currentValue) : "—"}
        {holding.profitLoss != null ? (
          <span className={cn("ml-2", profitLossClass(holding.profitLoss))}>
            {holding.profitLoss >= 0 ? "+" : "−"}
            {money(Math.abs(holding.profitLoss))}
          </span>
        ) : null}
        {holding.portfolioPercent != null ? (
          <span className="ml-2 text-muted-foreground">
            {holding.portfolioPercent.toFixed(1)}% of book
          </span>
        ) : null}
      </p>

      {facts?.vsSpy ? (
        <p className="tabular-nums text-muted-foreground">
          {vsSpyFactLine(facts.vsSpy)}
        </p>
      ) : null}

      {holding.type !== "stock" && holding.type !== "crypto" ? null : isLoading &&
        !facts ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading facts…
        </p>
      ) : error && !facts ? null : facts ? (
        <>
          {holding.type === "stock" ? <StockFactLine facts={facts} /> : null}
          {facts.thinking ? (
            <p
              className="text-sm leading-relaxed text-muted-foreground"
              data-holding-thinking="1"
            >
              {facts.thinking}
            </p>
          ) : null}
        </>
      ) : null}

      {overlay.map((option, index) => (
        <OptionFactLine
          key={`${option.strike}-${option.dte}-${index}`}
          option={option}
          money={money}
        />
      ))}
    </div>
  );
}

function StockFactLine({ facts }: { facts: HoldingExpandFacts }) {
  if (!facts.showScreens || !facts.screens) return null;

  const path = facts.screens.revenuePath;
  const cash = facts.screens.cashVsDebt;
  const parts: string[] = [];
  if (path) {
    parts.push(
      `${path.kind} ${path.years
        .map((year) => `${year.year} ${formatCompactMoney(year.revenue)}`)
        .join(" ")}`,
    );
  }
  if (cash) {
    const net =
      cash.netCash == null ? null : cash.netCash ? "net cash" : "net debt";
    const cashBit =
      cash.cashAndSti == null ? null : formatCompactMoney(cash.cashAndSti);
    const debtBit =
      cash.totalDebt == null ? null : formatCompactMoney(cash.totalDebt);
    const cashVs =
      cashBit || debtBit
        ? `cash+STI ${cashBit ?? "—"} vs debt ${debtBit ?? "—"}`
        : null;
    parts.push([net, cashVs].filter(Boolean).join(" "));
  }
  if (facts.nextEarningsDate) {
    parts.push(facts.nextEarningsDate);
  }
  if (parts.length === 0) return null;

  return <p className="tabular-nums text-muted-foreground">{parts.join(" · ")}</p>;
}

function OptionFactLine({
  option,
  money,
}: {
  option: HoldingExpandOption;
  money: (value: number) => string;
}) {
  const vs =
    option.spot != null
      ? `${formatCompactMoney(option.strike)} vs ${formatCompactMoney(option.spot)}`
      : formatCompactMoney(option.strike);
  const dte = option.dte != null ? `${option.dte} DTE` : null;
  const premium =
    option.premium >= 0
      ? `+${money(option.premium)}`
      : `−${money(Math.abs(option.premium))}`;

  return (
    <p className="tabular-nums text-muted-foreground">
      {[vs, dte, `${option.contracts} ct`, premium].filter(Boolean).join(" · ")}
    </p>
  );
}
