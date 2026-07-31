"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalysisFundamentalPanel } from "@/components/analysis/analysis-fundamental-panel";
import { AnalysisRatingRadar } from "@/components/analysis/analysis-rating-radar";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import { cn } from "@/lib/utils";

function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-primary";
  if (score >= 45) return "text-foreground";
  if (score >= 30) return "text-amber-400";
  return "text-orange-400";
}

function zoneColor(zone: string | null | undefined): string {
  switch (zone) {
    case "dark_green":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "green":
      return "bg-primary/15 text-primary border-primary/35";
    case "grey":
      return "bg-muted text-muted-foreground border-border";
    case "yellow":
      return "bg-amber-500/15 text-amber-300 border-amber-500/35";
    case "orange":
      return "bg-orange-500/15 text-orange-300 border-orange-500/35";
    case "red":
      return "bg-red-500/15 text-red-300 border-red-500/35";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
}

function SignalBadge({
  signal,
  status,
}: {
  signal: string | null | undefined;
  status: string | null | undefined;
}) {
  if (!signal && !status) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {signal && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-wide",
            signal === "Buy" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
            signal === "Sell" &&
              "border-red-500/40 bg-red-500/10 text-red-300",
            signal === "None" && "text-muted-foreground",
          )}
        >
          {signal}
        </Badge>
      )}
      {status && status !== "Neutral" && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-wide",
            status === "Green" &&
              "border-primary/40 bg-primary/10 text-primary",
            status === "Red" && "border-red-500/40 bg-red-500/10 text-red-300",
          )}
        >
          {status}
        </Badge>
      )}
    </div>
  );
}

export function AnalysisRatingSection({
  rating,
  isLoading,
}: {
  rating: InvestSalsaRating | null;
  isLoading?: boolean;
}) {
  if (isLoading && !rating) {
    return (
      <Card className="surface-card border-primary/20 shadow-none">
        <CardContent className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
          Computing InvestSalsa Rating…
        </CardContent>
      </Card>
    );
  }

  if (!rating) {
    return (
      <Card className="surface-card shadow-none">
        <CardContent className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          Rating unavailable for this ticker.
        </CardContent>
      </Card>
    );
  }

  const { fundamental, technical } = rating;

  return (
    <div className="space-y-4">
      <Card className="surface-card overflow-visible border-primary/25 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">InvestSalsa Rating</CardTitle>
              <CardDescription>
                Rules-based v1.1 · 60% Fundamental · 40% Technical
                {rating.weights.fundamental === 0
                  ? " (technical-only for this asset)"
                  : rating.fundamental.peerContext.basis !== "none"
                    ? ` · peers: ${rating.fundamental.peerContext.basis.replace("_", " ")}`
                    : " · absolute fundamentals"}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-border/70 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
            >
              Confidence {rating.confidence}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 overflow-visible lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div
              className={cn(
                "flex size-36 flex-col items-center justify-center rounded-full border-2 border-primary/35 bg-primary/5",
                scoreTone(rating.score),
              )}
            >
              <span className="text-4xl font-semibold tabular-nums tracking-tight">
                {rating.score != null ? Math.round(rating.score) : "—"}
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {rating.label ?? "N/A"}
              </span>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Fundamental
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums",
                    scoreTone(fundamental.score),
                  )}
                >
                  {fundamental.score != null
                    ? Math.round(fundamental.score)
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Technical
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums",
                    scoreTone(technical.score),
                  )}
                >
                  {technical.score != null
                    ? Math.round(technical.score)
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-visible">
            <AnalysisRatingRadar axes={rating.radar} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysisFundamentalPanel fundamental={fundamental} />

        <Card className="surface-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technical detail</CardTitle>
            <CardDescription>
              Fib structure + Price/MACD confluence (4H · 1D)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Fibonacci zone
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {technical.fib.zoneLabel ?? "Unavailable"}
                  {technical.fib.level != null
                    ? ` · ${technical.fib.level.toFixed(3)}`
                    : ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("border", zoneColor(technical.fib.zone))}
              >
                {technical.fib.score != null
                  ? `Score ${technical.fib.score}`
                  : "N/A"}
              </Badge>
            </div>

            {(["h4", "daily"] as const).map((key) => {
              const tf = technical[key];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border/60 px-3 py-2.5"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{tf.timeframe}</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        scoreTone(tf.score),
                      )}
                    >
                      {tf.score != null ? Math.round(tf.score) : "—"}
                    </p>
                  </div>
                  {!tf.available ? (
                    <p className="text-xs text-muted-foreground">
                      Insufficient bars for confluence.
                    </p>
                  ) : (
                    <div className="grid gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>Signal / status</span>
                        <SignalBadge signal={tf.signal} status={tf.status} />
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>price_z</span>
                        <span className="tabular-nums text-foreground/90">
                          {tf.priceZ?.toFixed(2) ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>macd_z</span>
                        <span className="tabular-nums text-foreground/90">
                          {tf.macdZ?.toFixed(2) ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
