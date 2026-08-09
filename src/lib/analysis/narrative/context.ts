import type { InvestSalsaRating, PillarScore } from "@/lib/analysis/rating/types";
import { formatScore10 } from "@/lib/analysis/rating/score-display";
import type {
  NarrativeContext,
  NarrativeMetricSnap,
} from "@/lib/analysis/narrative/types";

function pillarOf(
  rating: InvestSalsaRating,
  id: PillarScore["id"],
): PillarScore | undefined {
  return rating.fundamental.pillars.find((p) => p.id === id);
}

function metricsOf(pillar: PillarScore | undefined, limit = 2): NarrativeMetricSnap[] {
  if (!pillar) return [];
  return pillar.metrics
    .filter((m) => !m.skipped && (m.display || m.score != null))
    .slice(0, limit)
    .map((m) => ({ label: m.label, display: m.display }));
}

export function buildNarrativeContext(input: {
  symbol: string;
  name?: string | null;
  rating: InvestSalsaRating;
}): NarrativeContext {
  const { rating } = input;
  const f = rating.fundamental;
  const t = rating.technical;
  const fs = pillarOf(rating, "financial_strength");
  const pr = pillarOf(rating, "profitability");
  const gr = pillarOf(rating, "growth");
  const va = pillarOf(rating, "valuation");
  const vehicle = f.nonOperatingVehicle
    ? `${f.nonOperatingVehicle.label} (${f.nonOperatingVehicle.kind})`
    : null;
  const path = [
    f.classification.businessModelLabel,
    f.classification.growthProfileLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    symbol: input.symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, ""),
    name: input.name ?? null,
    sector: f.classification.sector,
    industry: f.classification.industry,
    path: path || null,
    vehicle,
    period: f.classification.fundamentalPeriod,
    confidence: rating.confidence,
    scores: {
      overall: rating.score,
      fundamental: f.score,
      technical: t.score,
      financialStrength: fs?.score ?? null,
      profitability: pr?.score ?? null,
      growth: gr?.score ?? null,
      valuation: va?.score ?? null,
    },
    display10: {
      overall: formatScore10(rating.score),
      fundamental: formatScore10(f.score),
      technical: formatScore10(t.score),
      financialStrength: formatScore10(fs?.score),
      profitability: formatScore10(pr?.score),
      growth: formatScore10(gr?.score),
      valuation: formatScore10(va?.score),
    },
    pillarMetrics: {
      financialStrength: metricsOf(fs),
      profitability: metricsOf(pr),
      growth: metricsOf(gr),
      valuation: metricsOf(va),
    },
    technical: {
      zone: t.fib.zone,
      zoneLabel: t.fib.zoneLabel,
      relativeLabel: t.fib.relative.statusLabel,
      nearLabel: t.h4.available ? t.h4.heatLabel : null,
      mediumLabel: t.daily.available ? t.daily.heatLabel : null,
      longLabel: t.weekly.available ? t.weekly.heatLabel : null,
    },
    notes: [...f.notes, ...t.notes].filter(Boolean).slice(0, 8),
  };
}

/** Slim snapshot for the model — enough to ground, not a ratio dump. */
export function toNarrativePromptSnapshot(ctx: NarrativeContext) {
  return {
    symbol: ctx.symbol,
    name: ctx.name,
    sector: ctx.sector,
    industry: ctx.industry,
    path: ctx.path,
    vehicle: ctx.vehicle,
    period: ctx.period,
    confidence: ctx.confidence,
    overallDisplay10: ctx.display10.overall,
    displayHints: {
      fundamental: ctx.display10.fundamental,
      technical: ctx.display10.technical,
      balanceSheet: ctx.display10.financialStrength,
      profits: ctx.display10.profitability,
      growth: ctx.display10.growth,
      valuation: ctx.display10.valuation,
    },
    supportFacts: {
      financialStrength: ctx.pillarMetrics.financialStrength.slice(0, 1),
      profitability: ctx.pillarMetrics.profitability.slice(0, 1),
      growth: ctx.pillarMetrics.growth.slice(0, 1),
      valuation: ctx.pillarMetrics.valuation.slice(0, 1),
    },
    technical: ctx.technical,
    marketLocation: describeMarketLocation(ctx.technical),
    notes: ctx.notes,
  };
}

/** Retail location language from zone + stretch labels — not a trade order. */
export function describeMarketLocation(t: NarrativeContext["technical"]): {
  zonePhrase: string;
  stretchPhrase: string | null;
  summaryHint: string;
} {
  const zonePhrase = zoneToLocationPhrase(t.zone);
  const stretchSource = t.mediumLabel ?? t.nearLabel ?? t.longLabel;
  const stretchPhrase = stretchToLocationPhrase(stretchSource);
  const summaryHint = stretchPhrase
    ? `${zonePhrase}; vs recent average: ${stretchPhrase}`
    : zonePhrase;
  return { zonePhrase, stretchPhrase, summaryHint };
}

function zoneToLocationPhrase(zone: string | null): string {
  switch (zone) {
    case "grey":
    case "dark_green":
      return "oversold / washed out";
    case "green":
      return "cooled off / pulled back";
    case "yellow":
      return "near fair";
    case "orange":
      return "stretched / getting overbought";
    case "red":
      return "overbought / stretched";
    default:
      return "near fair";
  }
}

function stretchToLocationPhrase(label: string | null): string | null {
  if (!label) return null;
  const key = label.trim().toUpperCase();
  switch (key) {
    case "FAR BELOW":
      return "washed out vs its recent average";
    case "BELOW":
      return "cooled off vs its recent average";
    case "SLIGHTLY BELOW":
      return "near fair, a bit below its recent average";
    case "SLIGHTLY ABOVE":
      return "near fair, a bit above its recent average";
    case "ABOVE":
      return "stretched vs its recent average";
    case "FAR ABOVE":
      return "overbought vs its recent average";
    default:
      return null;
  }
}
