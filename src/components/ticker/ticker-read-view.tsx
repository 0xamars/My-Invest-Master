import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TickerLookup } from "@/components/ticker/ticker-lookup";
import { TickerHealthSection } from "@/components/ticker/ticker-health-section";
import { TickerPastSection } from "@/components/ticker/ticker-past-section";
import { TickerScoreGraphic } from "@/components/ticker/ticker-score";
import { Button } from "@/components/ui/button";
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
import { SCORE_NOT_A_BUY } from "@/lib/ticker/score";
import type { TickerField, TickerSnapshot } from "@/lib/ticker/types";
import { INVEST_PATH } from "@/lib/chrome/nav";
import { profitLossClass } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";

export function TickerReadView({ snapshot }: { snapshot: TickerSnapshot }) {
  const { profile, quote } = snapshot;
  const change = quote.changePercent;
  const name = profile.name ?? TICKER_UNKNOWN;

  return (
    <div className="flex flex-1 flex-col gap-5" data-ticker-read="1">
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
        description={`${snapshot.symbol}${profile.exchange ? ` · ${profile.exchange}` : ""}`}
      />

      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
        <p className="mt-2 text-sm text-muted-foreground">
          Market cap {formatTickerMarketCap(quote.marketCap)}
          {profile.currency ? ` · ${profile.currency}` : ""}
        </p>
        <CacheLine snapshot={snapshot} />
      </section>

      {!snapshot.found ? (
        <RetirePanel className="px-5 py-5">
          <p className="text-sm font-medium">Ticker unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial Modeling Prep has no profile or price for {snapshot.symbol}.
            Missing figures stay {TICKER_UNKNOWN}.
          </p>
        </RetirePanel>
      ) : null}

      <RetirePanel className="px-5 py-4">
        <h2 className="text-sm font-semibold">Score</h2>
        <p className="mt-1 text-sm text-muted-foreground">{SCORE_NOT_A_BUY}</p>
        <div className="mt-4">
          <TickerScoreGraphic score={snapshot.score} />
        </div>
      </RetirePanel>

      <TickerPastSection snapshot={snapshot} />
      <TickerHealthSection snapshot={snapshot} />

      <Section title="Profile">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {profile.description ?? TICKER_UNKNOWN}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="CEO" value={profile.ceo} />
          <Fact label="Country" value={profile.country} />
          <Fact
            label="Employees"
            value={
              profile.employees != null
                ? profile.employees.toLocaleString("en-US")
                : null
            }
          />
          <Fact label="IPO" value={profile.ipoDate} />
        </div>
      </Section>

      <FieldGrid title="Key metrics" fields={snapshot.keyMetrics} />
      <FieldGrid title="Income" fields={snapshot.income} />
      <FieldGrid title="Cash flow" fields={snapshot.cashflow} />
      <FieldGrid title="Balance sheet" fields={snapshot.balance} />
      <FieldGrid title="Growth" fields={snapshot.growth} />
      <FieldGrid title="Margins" fields={snapshot.margins} />
      <FieldGrid title="Shares & dilution" fields={snapshot.shares} />
      <FieldGrid title="Estimates" fields={snapshot.estimates} />

      {snapshot.years.length > 0 ? (
        <Section title="Annual highlights">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Year</th>
                  <th className="py-2 pr-3 font-medium">Revenue</th>
                  <th className="py-2 pr-3 font-medium">Net income</th>
                  <th className="py-2 pr-3 font-medium">FCF</th>
                  <th className="py-2 pr-3 font-medium">Shares</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.years.map((year) => (
                  <tr
                    key={year.fiscalYear ?? "unknown"}
                    className="border-t border-border/50"
                  >
                    <td className="py-2 pr-3 tabular-nums">
                      {year.fiscalYear ?? TICKER_UNKNOWN}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMaybe("money", year.revenue)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMaybe("money", year.netIncome)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMaybe("money", year.freeCashFlow)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMaybe("shares", year.sharesOut)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Figures from Financial Modeling Prep only. If FMP does not have a number,
        it is {TICKER_UNKNOWN}. Not investment advice.
      </p>
    </div>
  );
}

function formatMaybe(kind: TickerField["kind"], value: number | null): string {
  return formatTickerField({ label: "", value, kind });
}

function FieldGrid({ title, fields }: { title: string; fields: TickerField[] }) {
  return (
    <Section title={title}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((item) => (
          <div key={item.label}>
            <p className="budget-metric-label">{item.label}</p>
            <p className="mt-1 text-base font-medium tabular-nums tracking-tight">
              {formatTickerField(item)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <RetirePanel className="px-5 py-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </RetirePanel>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm">{value ?? TICKER_UNKNOWN}</p>
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
    <p className="mt-3 text-xs text-muted-foreground" data-ticker-cache={status}>
      Cached {formatTickerCacheAge(snapshot.fetchedAt)} · {label}
      {snapshot.cache.fromCache ? " · first paint from cache" : ""}
    </p>
  );
}
