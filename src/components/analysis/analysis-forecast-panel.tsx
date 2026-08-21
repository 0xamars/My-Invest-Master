"use client";

import {
  FORECAST_RATING_ORDER,
  normalizeForecast,
  targetVsPricePct,
  type AnalysisForecast,
  type ForecastRatingKey,
} from "@/lib/analysis/forecast";
import {
  formatEps,
  formatFiscalDate,
  formatGrowthRate,
  formatRevenueUsd,
} from "@/lib/analysis/street-outlook";
import { cn } from "@/lib/utils";

const RATING_BAR_CLASS: Record<ForecastRatingKey, string> = {
  strongBuy: "bg-emerald-500",
  buy: "bg-emerald-400/80",
  hold: "bg-amber-400",
  sell: "bg-orange-500",
  strongSell: "bg-rose-500",
};

function formatUsdPrice(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) {
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 10) return `${sign}$${abs.toFixed(1)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPct(value: number): string {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function PriceTargetRange({
  low,
  average,
  high,
  current,
}: {
  low: number;
  average: number;
  high: number;
  current: number | null;
}) {
  const min = Math.min(low, current ?? low);
  const max = Math.max(high, current ?? high);
  const span = max - min || 1;
  const pos = (v: number) => `${clamp01((v - min) / span) * 100}%`;

  return (
    <div className="space-y-2">
      <div className="relative h-8">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/50"
          style={{
            left: pos(low),
            width: `calc(${pos(high)} - ${pos(low)})`,
          }}
        />
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: pos(average) }}
          title={`Average ${formatUsdPrice(average)}`}
        />
        {current != null && current > 0 ? (
          <span
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#A3E635] bg-background"
            style={{ left: pos(current) }}
            title={`Current ${formatUsdPrice(current)}`}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>Low {formatUsdPrice(low)}</span>
        <span>Avg {formatUsdPrice(average)}</span>
        <span>High {formatUsdPrice(high)}</span>
      </div>
    </div>
  );
}

export function AnalysisForecastPanel({
  forecast,
  price,
}: {
  forecast: AnalysisForecast | null | undefined;
  price: number | null | undefined;
}) {
  const data = normalizeForecast(forecast);
  const current =
    price != null && Number.isFinite(price) && price > 0 ? price : null;
  const vs = targetVsPricePct(data.priceTarget?.average, current);
  const ratings = data.ratings;
  const target = data.priceTarget;
  const estimates = data.estimates;

  if (!data.available) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          No street consensus available for this symbol
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground/80">
          Street consensus is not part of the InvestSalsa score.
        </p>
      </div>
    );
  }

  const showSplit = target != null && ratings != null;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-4",
          showSplit ? "sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {target ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Price target
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatUsdPrice(target.average)}
            </p>
            <p className="text-sm text-muted-foreground">
              {current != null ? (
                <>
                  Current {formatUsdPrice(current)}
                  {vs != null ? (
                    <>
                      {" "}
                      · avg is{" "}
                      <span
                        className={cn(
                          "tabular-nums",
                          vs > 0.01
                            ? "text-emerald-400"
                            : vs < -0.01
                              ? "text-rose-400"
                              : "text-foreground",
                        )}
                      >
                        {formatPct(vs)}
                      </span>{" "}
                      vs price
                    </>
                  ) : null}
                </>
              ) : (
                "Average 1-year style target"
              )}
            </p>
            <PriceTargetRange
              low={target.low}
              average={target.average}
              high={target.high}
              current={current}
            />
            {target.analystsCount != null ? (
              <p className="text-[11px] text-muted-foreground">
                Based on {target.analystsCount} analyst
                {target.analystsCount === 1 ? "" : "s"}
                {target.asOf ? ` · as of ${target.asOf}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {ratings ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Analyst ratings
              </p>
              {ratings.consensus ? (
                <p className="text-sm font-semibold">{ratings.consensus}</p>
              ) : null}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {FORECAST_RATING_ORDER.map(({ key }) => {
                const n = ratings[key];
                if (n <= 0) return null;
                return (
                  <span
                    key={key}
                    className={cn("h-full", RATING_BAR_CLASS[key])}
                    style={{ width: `${(n / ratings.total) * 100}%` }}
                  />
                );
              })}
            </div>
            <ul className="space-y-1">
              {FORECAST_RATING_ORDER.map(({ key, label }) => {
                const n = ratings[key];
                const pct = ratings.total > 0 ? (n / ratings.total) * 100 : 0;
                return (
                  <li
                    key={key}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          RATING_BAR_CLASS[key],
                        )}
                      />
                      <span className="truncate text-muted-foreground">
                        {label}
                      </span>
                      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full", RATING_BAR_CLASS[key])}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {n}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Based on {ratings.total} analyst
              {ratings.total === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>

      {estimates ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {estimates.period === "quarter" ? "Next quarter" : "Next FY"} consensus
          {estimates.date ? ` (${formatFiscalDate(estimates.date)})` : ""}
          {estimates.epsAvg != null ? ` · EPS ${formatEps(estimates.epsAvg)}` : ""}
          {estimates.revenueAvg != null
            ? ` · revenue ${formatRevenueUsd(estimates.revenueAvg)}`
            : ""}
          {estimates.impliedRevenueGrowth != null
            ? ` · rev ${formatGrowthRate(estimates.impliedRevenueGrowth)}`
            : ""}
          {estimates.impliedEpsGrowth != null
            ? ` · EPS ${formatGrowthRate(estimates.impliedEpsGrowth)}`
            : ""}
        </p>
      ) : null}

      <p className="text-[11px] leading-snug text-muted-foreground/80">
        Street consensus is not part of the InvestSalsa score.
      </p>
    </div>
  );
}
