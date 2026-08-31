"use client";

import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import { formatScore10 } from "@/lib/analysis/rating/score-display";
import { priceZoneLocationHint } from "@/lib/analysis/rating/tech-palette";
import { Badge } from "@/components/ui/badge";
import { TapeChart } from "@/components/invest/assess/tape-chart";
import type { AssessNoteSection } from "@/lib/invest/assess/types";
import type { TapeSeriesMeta } from "@/lib/invest/assess/tape-series";
import { buildBookAndPlan, buildMoveVerdict } from "@/lib/invest/assess/build-note";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function RatingCompact({ rating }: { rating: InvestSalsaRating }) {
  const pillars = rating.fundamental.pillars;
  const fs = pillars.find((p) => p.id === "financial_strength");
  const prof = pillars.find((p) => p.id === "profitability");
  const growth = pillars.find((p) => p.id === "growth");
  const val = pillars.find((p) => p.id === "valuation");
  const zone = rating.technical.fib.zoneLabel;
  const zoneHint = priceZoneLocationHint(rating.technical.fib.zone);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <p className="font-medium">
        InvestSalsa rating: {rating.label ?? "—"}
        {rating.score != null ? ` (${formatScore10(rating.score)}/10)` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {fs ? (
          <Badge variant="outline">FS {formatScore10(fs.score)}</Badge>
        ) : null}
        {prof ? (
          <Badge variant="outline">Profitability {formatScore10(prof.score)}</Badge>
        ) : null}
        {growth ? (
          <Badge variant="outline">Growth {formatScore10(growth.score)}</Badge>
        ) : null}
        {val ? (
          <Badge variant="outline">Valuation {formatScore10(val.score)}</Badge>
        ) : null}
      </div>
      {zone ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Technical: {zone}
          {zoneHint ? ` — ${zoneHint}` : ""}
          {rating.technical.daily.heatLabel
            ? ` · ${rating.technical.daily.label}: ${rating.technical.daily.heatLabel}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

export function AssessNoteView({
  note,
  rating,
  tape,
  moveContext,
}: {
  note: AssessNoteSection;
  rating: InvestSalsaRating;
  tape: TapeSeriesMeta;
  moveContext: {
    owned: boolean;
    portfolioPercent: number | null;
    positionValue: number | null;
    leftoverLine: string | null;
  };
}) {
  const move = buildMoveVerdict({
    owned: moveContext.owned,
    call: note.call.verdict,
    portfolioPercent: moveContext.portfolioPercent,
  });

  const bookPlan = buildBookAndPlan({
    owned: moveContext.owned,
    portfolioPercent: moveContext.portfolioPercent,
    positionValue: moveContext.positionValue,
    leftoverLine: moveContext.leftoverLine,
  });

  return (
    <div className="space-y-6">
      <Section title="Call">
        <p>
          <span className="font-semibold">{note.call.verdict}</span> — {note.call.why}
        </p>
        <p className="text-xs text-muted-foreground">
          Product recommendation from rules — not a broker order.
        </p>
      </Section>

      <Section title="Industry">
        <p>{note.industry}</p>
      </Section>

      <Section title="Asset">
        <p>{note.asset}</p>
      </Section>

      <Section title="Growth">
        <p>{note.growth}</p>
      </Section>

      <Section title="Move">
        <p>
          <span className="font-semibold">{move}</span>
          {" — "}
          {moveContext.owned
            ? "Primary portfolio position."
            : "Not in the Primary portfolio."}
        </p>
      </Section>

      <Section title="Fundamentals">
        {note.fundamentals.killSwitches.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {note.fundamentals.killSwitches.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>No kill switches flagged on loaded data.</p>
        )}
        <p>{note.fundamentals.trendRead}</p>
        <RatingCompact rating={rating} />
        {tape.incomplete ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Incomplete tape — showing whatever fiscal years loaded.
          </p>
        ) : null}
        {!tape.vehicle.isOperatingTape && tape.vehicle.reason ? (
          <p className="text-xs text-muted-foreground">{tape.vehicle.reason}</p>
        ) : null}
        <TapeChart
          points={tape.annual}
          unit={tape.unit}
          unitLabel={tape.unitLabel}
          showDividends={tape.hasDividends}
        />
      </Section>

      <Section title="Technicals">
        <p>{note.technicals}</p>
      </Section>

      <Section title="Book and plan">
        <p>{bookPlan}</p>
      </Section>

      <Section title="Industry and outlook">
        <p>{note.industryOutlook}</p>
      </Section>

      <Section title="Dissent">
        <p>{note.dissent}</p>
      </Section>

      <Section title="Decision">
        <p>{note.decision}</p>
      </Section>

      <p className="text-xs text-muted-foreground">
        Not investment advice. Figures come from Financial Modeling Prep warehouse data when loaded.
      </p>
    </div>
  );
}
