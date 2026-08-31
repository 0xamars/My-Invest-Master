"use client";

import Link from "next/link";
import type { AnalysisQuote } from "@/lib/analysis/types";
import { formatTickerPrice } from "@/lib/ticker/format";
import { AssessTickerSearch } from "@/components/invest/assess/assess-ticker-search";

export function AssessTickerBar({
  quote,
  analysisHref,
}: {
  quote: AnalysisQuote;
  analysisHref: string;
}) {
  const change = quote.changePercent;
  const changeText =
    change != null && Number.isFinite(change)
      ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
      : null;

  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AssessTickerSearch currentSymbol={quote.symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {quote.name || quote.symbol}
          </p>
          <p className="text-xs text-muted-foreground">{quote.symbol}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold tabular-nums">
          {formatTickerPrice(quote.price)}
        </span>
        {changeText ? (
          <span
            className={
              change != null && change >= 0
                ? "text-[var(--brand-green)]"
                : "text-[var(--brand-orange)]"
            }
          >
            {changeText}
          </span>
        ) : null}
        <Link
          href={analysisHref}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Analysis
        </Link>
      </div>
    </div>
  );
}
