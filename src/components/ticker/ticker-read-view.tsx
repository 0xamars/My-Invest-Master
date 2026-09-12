"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TickerLookup } from "@/components/ticker/ticker-lookup";
import { TickerFutureSection } from "@/components/ticker/ticker-future-section";
import { TickerNowSection } from "@/components/ticker/ticker-now-section";
import { TickerPastSection } from "@/components/ticker/ticker-past-section";
import { TickerScoreGraphic } from "@/components/ticker/ticker-score";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RetirePageHeader,
  RetirePanel,
} from "@/components/retirement/retire-ui";
import {
  formatTickerCacheAge,
  formatTickerField,
  formatTickerMarketCap,
  formatTickerPrice,
  TICKER_UNKNOWN,
} from "@/lib/ticker/format";
import { SHOW_THE_DETAILS_LABEL } from "@/lib/journey/first-run";
import { SCORE_NOT_A_BUY } from "@/lib/ticker/score";
import type { TickerSnapshot } from "@/lib/ticker/types";
import { INVEST_PATH } from "@/lib/chrome/nav";
import { profitLossClass } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";

export function TickerReadView({
  snapshot,
  density = "full",
  onShowDetails,
}: {
  snapshot: TickerSnapshot;
  density?: "summary" | "full";
  onShowDetails?: () => void;
}) {
  const { profile, quote } = snapshot;
  const change = quote.changePercent;
  const name = profile.name ?? TICKER_UNKNOWN;
  const collapsed = density === "summary";

  return (
    <div
      className="flex flex-1 flex-col gap-5"
      data-ticker-read="1"
      data-ticker-density={density}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-1.5 text-muted-foreground"
          render={<Link href={INVEST_PATH} />}
        >
          <ArrowLeft className="size-4" />
          Invest
        </Button>
        <TickerLookup className="sm:max-w-sm sm:flex-1" placeholder="Another name or ticker…" />
      </div>

      <RetirePageHeader
        title={name}
        description={`${snapshot.symbol}${profile.exchange ? ` · ${profile.exchange}` : ""}${
          profile.sector ? ` · ${profile.sector}` : ""
        }`}
      />

      <section className="budget-panel px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="budget-metric-label">Last</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="budget-hero-value">{formatTickerPrice(quote.price)}</p>
              {change != null ? (
                <p className={cn("text-sm font-medium tabular-nums", profitLossClass(change))}>
                  {quote.change != null
                    ? `${quote.change >= 0 ? "+" : ""}${formatTickerPrice(quote.change)}`
                    : null}
                  {quote.change != null ? " · " : null}
                  {formatTickerField({
                    label: "Day change",
                    value: change,
                    kind: "percent",
                  })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Day change · {TICKER_UNKNOWN}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="budget-metric-label">Market cap</p>
            <p className="mt-1.5 text-sm font-medium tabular-nums">
              {formatTickerMarketCap(quote.marketCap)}
              {profile.currency ? ` · ${profile.currency}` : ""}
            </p>
          </div>
        </div>
        <CacheLine snapshot={snapshot} />
      </section>

      {collapsed ? (
        <RetirePanel className="px-5 py-5">
          <p className="text-sm font-medium">Plain summary</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {profile.description ?? TICKER_UNKNOWN}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Missing figures stay {TICKER_UNKNOWN}. Score, Past, Now, and
            Future stay behind the details until you ask.
          </p>
          {onShowDetails ? (
            <Button
              type="button"
              className="mt-4"
              onClick={onShowDetails}
            >
              {SHOW_THE_DETAILS_LABEL}
            </Button>
          ) : null}
        </RetirePanel>
      ) : null}

      {collapsed ? null : !snapshot.found ? (
        <RetirePanel className="px-5 py-5">
          <p className="text-sm font-medium">Ticker unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial Modeling Prep has no profile or price for {snapshot.symbol}.
            Missing figures stay {TICKER_UNKNOWN}.
          </p>
        </RetirePanel>
      ) : null}

      {collapsed ? null : (
      <RetirePanel className="px-5 py-5">
        <h2 className="text-sm font-semibold">Score</h2>
        <p className="mt-1 text-sm text-muted-foreground">{SCORE_NOT_A_BUY}</p>
        <div className="mt-4">
          <TickerScoreGraphic score={snapshot.score} />
        </div>
      </RetirePanel>
      )}

      {collapsed ? null : (
        <Tabs defaultValue="past" className="gap-4" data-ticker-tabs="past-now-future">
          <TabsList className="segmented h-auto w-full bg-muted p-[0.2rem] sm:w-fit">
            <TabsTrigger value="past" className="rounded-md px-4 py-1.5">
              Past
            </TabsTrigger>
            <TabsTrigger value="now" className="rounded-md px-4 py-1.5">
              Now
            </TabsTrigger>
            <TabsTrigger value="future" className="rounded-md px-4 py-1.5">
              Future
            </TabsTrigger>
          </TabsList>
          <TabsContent value="past" className="mt-1">
            <TickerPastSection snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="now" className="mt-1">
            <TickerNowSection snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="future" className="mt-1">
            <TickerFutureSection snapshot={snapshot} />
          </TabsContent>
        </Tabs>
      )}

      {collapsed ? null : (
        <p className="text-xs text-muted-foreground">
          Figures from Financial Modeling Prep only. If FMP does not have a number,
          it is {TICKER_UNKNOWN}. Not investment advice.
        </p>
      )}
    </div>
  );
}

function CacheLine({ snapshot }: { snapshot: TickerSnapshot }) {
  const status = snapshot.cache.status;
  const label =
    status === "fresh"
      ? "Cache fresh"
      : status === "stale"
        ? "Cache stale · refreshing"
        : snapshot.cache.fmpHit
          ? "Loaded from FMP"
          : "Cache miss";
  return (
    <p className="mt-4 text-xs text-muted-foreground" data-ticker-cache={status}>
      Cached {formatTickerCacheAge(snapshot.fetchedAt)} · {label}
      {snapshot.cache.fromCache ? " · first paint from cache" : ""}
    </p>
  );
}
