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
  shortOutlookLine,
  simplifyNote,
  topMetrics,
} from "@/lib/analysis/fundamental-copy";
import type {
  FundamentalResult,
  PillarScore,
} from "@/lib/analysis/rating/types";
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
          {Math.round(score)}
        </span>
      ) : null}
    </span>
  );
}

function PillarCard({
  pillar,
  fundamental,
}: {
  pillar: PillarScore;
  fundamental: FundamentalResult;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = topMetrics(pillar, 3);
  const rest = pillar.metrics.filter(
    (m) => !m.skipped && !visible.some((v) => v.id === m.id),
  );
  const takeaway = pillarTakeaway(pillar, fundamental);
  const score = pillar.score;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{pillar.label}</p>
          <p className="text-sm leading-snug text-muted-foreground">
            {takeaway}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-2xl font-semibold tabular-nums tracking-tight",
            scoreHeatTextClass(score),
          )}
          style={scoreTextStyle(score)}
        >
          {score != null ? Math.round(score) : "—"}
        </p>
      </div>

      <ScoreBar score={score} className="mt-3" />

      {visible.length > 0 && (
        <div className="mt-3 space-y-2">
          {visible.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground">{m.label}</span>
              <MetricScoreValue display={m.display} score={m.score} />
            </div>
          ))}
        </div>
      )}

      {(rest.length > 0 || visible.some((m) => m.note)) && (
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
}: {
  fundamental: FundamentalResult;
}) {
  const [showMethod, setShowMethod] = useState(false);

  if (!fundamental.available) {
    return (
      <Card className="surface-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fundamental detail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fundamentals aren’t applied for this asset. The Technical score
            drives the rating.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card shadow-none">
      <CardHeader className="space-y-3 pb-2">
        <div>
          <CardTitle className="text-base">Fundamental detail</CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Company quality for buy / hold / avoid — ownership-friendly vs
            deteriorating risk
          </p>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {shortOutlookLine(fundamental)}
        </p>
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
          />
        ))}

        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowMethod((v) => !v)}
          >
            {showMethod ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Methodology / details
          </Button>

          {showMethod && (
            <div className="mt-2 space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
              <p>
                <span className="text-foreground/80">Fundamental Period: </span>
                {fundamental.classification.fundamentalPeriod
                  ? fundamental.classification.fundamentalPeriod.toUpperCase()
                  : "—"}
                {fundamental.classification.periodSelectionReason
                  ? ` — ${fundamental.classification.periodSelectionReason}`
                  : " — all pillars score on this same period"}
              </p>
              {fundamental.classification.ttmSource && (
                <p>
                  <span className="text-foreground/80">TTM source: </span>
                  {fundamental.classification.ttmSource}
                  {fundamental.classification.constructedTtmFields.length > 0
                    ? ` · constructed ${fundamental.classification.constructedTtmFields.length} fields from quarters`
                    : ""}
                </p>
              )}
              {fundamental.classification.constructedTtmFields.length > 0 && (
                <p>
                  <span className="text-foreground/80">
                    Constructed TTM fields:{" "}
                  </span>
                  {fundamental.classification.constructedTtmFields
                    .slice(0, 16)
                    .join(", ")}
                  {fundamental.classification.constructedTtmFields.length > 16
                    ? "…"
                    : ""}
                </p>
              )}
              <p>
                <span className="text-foreground/80">Business profile: </span>
                {fundamental.classification.growthProfileLabel}
                {fundamental.classification.reinvestmentSoftWeighting
                  ? " · reinvestment soft-weighting on"
                  : ""}
              </p>
              {fundamental.classification.criticalFlags.length > 0 && (
                <p>
                  <span className="text-foreground/80">Critical flags: </span>
                  {fundamental.classification.criticalFlags.join("; ")}
                </p>
              )}
              <p>
                <span className="text-foreground/80">Assessment frame: </span>
                {fundamental.classification.businessModelLabel}
              </p>
              <p>
                <span className="text-foreground/80">Peer set: </span>
                {fundamental.peerContext.label}
              </p>
              {fundamental.outlook.reason && (
                <p>
                  <span className="text-foreground/80">Outlook detail: </span>
                  {fundamental.outlook.reason}
                </p>
              )}
              {fundamental.missingMetrics.length > 0 && (
                <p>
                  <span className="text-foreground/80">
                    Missing metrics ({fundamental.missingMetrics.length}):{" "}
                  </span>
                  {fundamental.missingMetrics.join(", ")}
                </p>
              )}
              <p>
                <span className="text-foreground/80">Fundamental model: </span>
                v{fundamental.version} (same-period · growth-aware · FS ·
                Profitability · Growth · Valuation)
              </p>
              {fundamental.notes.length > 0 && (
                <ul className="list-inside list-disc space-y-1">
                  {fundamental.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
