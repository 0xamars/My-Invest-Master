"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDataAsOf,
  peerBasisShort,
  pillarTakeaway,
  simplifyNote,
  topMetrics,
} from "@/lib/analysis/fundamental-copy";
import type { AnalysisNarrativeBundle } from "@/lib/analysis/narrative/types";
import type {
  FundamentalResult,
  PillarScore,
} from "@/lib/analysis/rating/types";
import { formatScore10 } from "@/lib/analysis/rating/score-display";
import { scoreHeatTextClass, scoreTextStyle } from "@/lib/analysis/rating/tech-palette";
import { ScoreBar } from "@/components/analysis/score-bar";
import { cn } from "@/lib/utils";

function MetricScoreValue({
  display,
  score,
}: {
  display: string | null;
  score: number | null;
}) {
  return (
    <span className="tabular-nums text-foreground/90">
      {display ?? "—"}
      {score != null ? (
        <span
          className={cn("ml-2", scoreHeatTextClass(score))}
          style={scoreTextStyle(score)}
        >
          {formatScore10(score)}
        </span>
      ) : null}
    </span>
  );
}

function pillarAiLine(
  pillar: PillarScore,
  narrative: AnalysisNarrativeBundle | null | undefined,
): string | null {
  if (!narrative) return null;
  switch (pillar.id) {
    case "financial_strength":
      return narrative.pillars.financialStrength || null;
    case "profitability":
      return narrative.pillars.profitability || null;
    case "growth":
      return narrative.pillars.growth || null;
    case "valuation":
      return narrative.pillars.valuation || null;
    default:
      return null;
  }
}

function PillarCard({
  pillar,
  fundamental,
  narrative,
  narrativeLoading,
}: {
  pillar: PillarScore;
  fundamental: FundamentalResult;
  narrative?: AnalysisNarrativeBundle | null;
  narrativeLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = topMetrics(pillar, 3);
  const rest = pillar.metrics.filter(
    (m) => !m.skipped && !visible.some((v) => v.id === m.id),
  );
  const aiLine = pillarAiLine(pillar, narrative);
  const takeaway = aiLine ?? pillarTakeaway(pillar, fundamental);
  const score = pillar.score;
  const hasDetails = rest.length > 0 || visible.length > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{pillar.label}</p>
          <p className="text-sm leading-snug text-muted-foreground">
            {narrativeLoading && !aiLine ? "…" : takeaway}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-2xl font-semibold tabular-nums tracking-tight",
            scoreHeatTextClass(score),
          )}
          style={scoreTextStyle(score)}
        >
          {formatScore10(score)}
        </p>
      </div>

      <ScoreBar score={score} className="mt-3" />

      {hasDetails && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {expanded ? "Hide details" : "Show details"}
          </Button>

          {expanded && (
            <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
              {[...visible, ...rest].map((m) => {
                const plain = simplifyNote(m.note);
                return (
                  <div key={`detail-${m.id}`} className="space-y-0.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{m.label}</span>
                      <MetricScoreValue display={m.display} score={m.score} />
                    </div>
                    {plain ? (
                      <p className="text-[11px] text-muted-foreground/90">
                        {plain}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalysisFundamentalPanel({
  fundamental,
  narrative,
  narrativeLoading,
}: {
  fundamental: FundamentalResult;
  narrative?: AnalysisNarrativeBundle | null;
  narrativeLoading?: boolean;
}) {
  if (!fundamental.available) {
    const vehicle = fundamental.nonOperatingVehicle;
    return (
      <Card className="surface-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fundamental Assessment</CardTitle>
          {vehicle ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Fund / ETF vehicle — company fundamentals do not apply
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {narrativeLoading ? (
            <p className="text-sm text-muted-foreground">Loading overview…</p>
          ) : narrative?.fundamentalOverview ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {narrative.fundamentalOverview}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {vehicle
              ? vehicle.message
              : "Fundamentals aren’t applied for this asset. The Technical score drives the rating."}
          </p>
          {vehicle ? (
            <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/85">
                {vehicle.label.toUpperCase()}
                {vehicle.meta.name ? ` · ${vehicle.meta.name}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {vehicle.meta.category ? (
                  <span>
                    <span className="text-muted-foreground/80">Category </span>
                    <span className="text-foreground/85">
                      {vehicle.meta.category}
                    </span>
                  </span>
                ) : null}
                {vehicle.meta.provider ? (
                  <span>
                    <span className="text-muted-foreground/80">Provider </span>
                    <span className="text-foreground/85">
                      {vehicle.meta.provider}
                    </span>
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground/90">
                Technical detail may still show price location. That is not a
                company-quality score.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card shadow-none">
      <CardHeader className="space-y-3 pb-2">
        <div>
          <CardTitle className="text-base">Fundamental Assessment</CardTitle>
        </div>
        {narrativeLoading && !narrative?.fundamentalOverview ? (
          <div className="space-y-2">
            <div className="h-3 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {narrative?.fundamentalOverview ||
              "Overview unavailable. Pillar scores below are unchanged."}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="text-muted-foreground/80">Period </span>
            <span className="text-foreground/85">
              {fundamental.classification.fundamentalPeriod
                ? fundamental.classification.fundamentalPeriod.toUpperCase()
                : "—"}
            </span>
          </span>
          <span className="hidden text-border sm:inline">·</span>
          <span>
            <span className="text-muted-foreground/80">Profile </span>
            <span className="text-foreground/85">
              {fundamental.classification.growthProfileLabel}
            </span>
          </span>
          <span className="hidden text-border sm:inline">·</span>
          <span>
            <span className="text-muted-foreground/80">Industry </span>
            <span className="text-foreground/85">
              {fundamental.classification.industry ?? "—"}
            </span>
          </span>
          <span className="hidden text-border sm:inline">·</span>
          <span>
            <span className="text-muted-foreground/80">Peers </span>
            <span className="text-foreground/85">
              {peerBasisShort(fundamental)}
            </span>
          </span>
          <span className="hidden text-border sm:inline">·</span>
          <span>
            <span className="text-muted-foreground/80">As of </span>
            <span className="tabular-nums text-foreground/85">
              {formatDataAsOf(fundamental.dataAsOf)}
            </span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-2">
        {fundamental.pillars.map((pillar) => (
          <PillarCard
            key={pillar.id}
            pillar={pillar}
            fundamental={fundamental}
            narrative={narrative}
            narrativeLoading={narrativeLoading}
          />
        ))}
      </CardContent>
    </Card>
  );
}
