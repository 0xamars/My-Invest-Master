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
import { ScoreBar } from "@/components/analysis/score-bar";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import {
  extensionLocationHint,
  priceZoneLocationHint,
  scoreChipStyle,
  scoreHeatTextClass,
  scoreTextStyle,
  TECH_BLOOD_CHIP_CLASS,
} from "@/lib/analysis/rating/tech-palette";
import { cn } from "@/lib/utils";

/** Shared chip style for Price zone + Price mean extension. */
const TECH_CHIP_CLASS =
  "max-w-full border text-left text-xs font-medium uppercase tracking-wide whitespace-normal";

function ZoneChip({
  zone,
  label,
  score,
}: {
  zone: string | null | undefined;
  label: string | null | undefined;
  score: number | null | undefined;
}) {
  // BLOOD IN THE STREETS! — forced red chip regardless of numeric score band.
  if (zone === "grey") {
    return (
      <Badge
        variant="outline"
        className={cn(TECH_CHIP_CLASS, TECH_BLOOD_CHIP_CLASS)}
      >
        {label ?? "Unavailable"}
      </Badge>
    );
  }

  const chipStyle = scoreChipStyle(score);
  return (
    <Badge
      variant="outline"
      className={cn(
        TECH_CHIP_CLASS,
        !chipStyle && "border-border bg-muted/40 text-muted-foreground",
      )}
      style={chipStyle}
    >
      {label ?? "Unavailable"}
    </Badge>
  );
}

function ExtensionChip({
  label,
  score,
}: {
  label: string | null | undefined;
  score: number | null | undefined;
}) {
  if (!label) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const chipStyle = scoreChipStyle(score);
  return (
    <Badge
      variant="outline"
      className={cn(
        TECH_CHIP_CLASS,
        !chipStyle && "border-border bg-muted/40 text-muted-foreground",
      )}
      style={chipStyle}
    >
      {label}
    </Badge>
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
  const zoneHint = priceZoneLocationHint(technical.fib.zone);

  return (
    <div className="space-y-4">
      <Card className="surface-card overflow-visible border-primary/25 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">InvestSalsa Rating</CardTitle>
              <CardDescription>
                Rules-based v1.2 · 60% Fundamental · 40% Technical
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
                scoreHeatTextClass(rating.score),
              )}
              style={scoreTextStyle(rating.score)}
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
                    scoreHeatTextClass(fundamental.score),
                  )}
                  style={scoreTextStyle(fundamental.score)}
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
                    scoreHeatTextClass(technical.score),
                  )}
                  style={scoreTextStyle(technical.score)}
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
              Price location now — pulled back vs extended (not a trade order).
              Structure + mean extension (NEAR · MEDIUM · LONG TERM)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Price zone
                  </p>
                  <div className="mt-1.5">
                    <ZoneChip
                      zone={technical.fib.zone}
                      label={technical.fib.zoneLabel}
                      score={technical.fib.score}
                    />
                  </div>
                  {zoneHint ? (
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                      {zoneHint}
                    </p>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    scoreHeatTextClass(technical.fib.score),
                  )}
                  style={scoreTextStyle(technical.fib.score)}
                >
                  {technical.fib.score != null
                    ? Math.round(technical.fib.score)
                    : "—"}
                </p>
              </div>
              <ScoreBar score={technical.fib.score} className="mt-2" />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Price mean extension
              </p>
              <div className="divide-y divide-border/50">
                {(
                  [
                    { key: "h4" as const },
                    { key: "daily" as const },
                    { key: "weekly" as const },
                  ] as const
                ).map(({ key }) => {
                  const tf = technical[key];
                  const locationHint = extensionLocationHint(tf.heat);
                  return (
                    <div
                      key={key}
                      className="py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium tracking-wide">
                            {tf.label}
                          </p>
                          <div className="mt-1.5">
                            {!tf.available ? (
                              <p className="text-xs text-muted-foreground">
                                Not enough history
                              </p>
                            ) : (
                              <>
                                <ExtensionChip
                                  label={tf.heatLabel}
                                  score={tf.score}
                                />
                                {locationHint ? (
                                  <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                                    {locationHint}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            scoreHeatTextClass(tf.score),
                          )}
                          style={scoreTextStyle(tf.score)}
                        >
                          {tf.score != null ? Math.round(tf.score) : "—"}
                        </p>
                      </div>
                      <ScoreBar
                        score={tf.score}
                        available={tf.available}
                        className="mt-2"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
