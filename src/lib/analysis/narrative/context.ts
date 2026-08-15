import type { InvestSalsaRating, PillarScore } from "@/lib/analysis/rating/types";
import { formatScore10 } from "@/lib/analysis/rating/score-display";
import { isHighEquityCompIndustry } from "@/lib/analysis/rating/industry-model";
import { sbcBurdenLabel } from "@/lib/analysis/rating/sbc";
import type {
  NarrativeContext,
  NarrativeCopyLanguage,
  NarrativeMetricSnap,
} from "@/lib/analysis/narrative/types";
import { extractPackageFacts } from "@/lib/analysis/narrative/outlook-facts";
import { issuerLockSnapshot } from "@/lib/analysis/narrative/outlook-lock";
import {
  streetTargetHint,
  type AnalysisForecast,
} from "@/lib/analysis/forecast";

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

function inferValuationBasis(
  va: PillarScore | undefined,
): "current" | "includes_forward" {
  const m = va?.metrics.find((x) => x.id === "pe_forward");
  if (!m || m.skipped || m.score == null) return "current";
  const blob = `${m.label ?? ""} ${m.note ?? ""}`;
  if (/unavailable|using TTM/i.test(blob)) return "current";
  return "includes_forward";
}

function clipProfileThemes(raw: string | null | undefined, max = 720): string | null {
  if (!raw?.trim()) return null;
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const cut = slice.lastIndexOf(". ");
  return (cut >= 120 ? slice.slice(0, cut + 1) : slice).trim();
}

function metricOf(
  pillar: PillarScore | undefined,
  id: string,
): { value: number | null; score: number | null } | null {
  const m = pillar?.metrics.find((x) => x.id === id && !x.skipped);
  if (!m) return null;
  return {
    value: typeof m.value === "number" && Number.isFinite(m.value) ? m.value : null,
    score: m.score,
  };
}

/** Copy-only tone from existing pillar metrics/scores. Not a new rating. */
export function inferCopyLanguage(input: {
  capitalOverlay?: string | null;
  financialStrength?: PillarScore;
  profitability?: PillarScore;
  growth?: PillarScore;
  valuation?: PillarScore;
}): NarrativeCopyLanguage {
  const overlay = input.capitalOverlay ?? "";
  const om = metricOf(input.profitability, "operating_margin");
  const nm = metricOf(input.profitability, "net_margin");
  const fcf = metricOf(input.profitability, "fcf_margin")
    ?? metricOf(input.financialStrength, "fcf_level");
  const pScore = input.profitability?.score ?? null;
  const gScore = input.growth?.score ?? null;
  const fsScore = input.financialStrength?.score ?? null;
  const vScore = input.valuation?.score ?? null;

  let earnings: NarrativeCopyLanguage["earnings"] = "unknown";
  if (overlay === "treasury_holding") {
    earnings = "treasury_marks";
  } else if (
    (om?.value != null && om.value < 0) ||
    (nm?.value != null && nm.value < 0)
  ) {
    earnings = "unprofitable";
  } else if (
    (om?.value != null && om.value > 0) ||
    (nm?.value != null && nm.value > 0)
  ) {
    earnings = "profitable";
  }

  let cash: NarrativeCopyLanguage["cash"] = "unknown";
  if (fcf?.value != null) {
    cash = fcf.value < 0 ? "burning" : "converting";
  }

  let margins: NarrativeCopyLanguage["margins"] = "unknown";
  if (earnings === "unprofitable") {
    margins = "compressed";
  } else if (om?.value != null && om.value >= 0.2) {
    margins = "strong";
  } else if (om?.score != null && om.score >= 75) {
    margins = "strong";
  } else if (om?.value != null && om.value >= 0 && om.value < 0.08) {
    margins = "compressed";
  } else if (pScore != null && pScore >= 75 && earnings === "profitable") {
    margins = "strong";
  }

  let growth: NarrativeCopyLanguage["growth"] = "unknown";
  if (gScore != null) {
    if (gScore >= 80) growth = "elite";
    else if (gScore >= 60) growth = "solid";
    else if (gScore < 40) growth = "slow";
  }

  let balanceSheet: NarrativeCopyLanguage["balanceSheet"] = "unknown";
  if (fsScore != null) {
    if (fsScore >= 80) balanceSheet = "fortress";
    else if (fsScore < 40) balanceSheet = "weak";
    else balanceSheet = "adequate";
  }

  let valuationConstraint: NarrativeCopyLanguage["valuationConstraint"] =
    "unknown";
  if (vScore != null) {
    if (vScore < 40) valuationConstraint = "expensive";
    else if (vScore < 55) valuationConstraint = "full";
    else if (vScore >= 70) valuationConstraint = "not_the_story";
  }

  return {
    earnings,
    cash,
    margins,
    growth,
    balanceSheet,
    valuationConstraint,
  };
}

export function buildNarrativeContext(input: {
  symbol: string;
  name?: string | null;
  description?: string | null;
  rating: InvestSalsaRating;
  recentEvents?: NarrativeContext["recentEvents"];
  forecast?: AnalysisForecast | null;
  price?: number | null;
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
    description: clipProfileThemes(input.description),
    path: path || null,
    capitalOverlay: f.classification.businessModel || null,
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
    packageFacts: extractPackageFacts(rating),
    technical: {
      zone: t.fib.zone,
      zoneLabel: t.fib.zoneLabel,
      relativeLabel: t.fib.relative.statusLabel,
      nearLabel: t.h4.available ? t.h4.heatLabel : null,
      mediumLabel: t.daily.available ? t.daily.heatLabel : null,
      longLabel: t.weekly.available ? t.weekly.heatLabel : null,
    },
    notes: [...f.notes, ...t.notes].filter(Boolean).slice(0, 8),
    recentEvents: (input.recentEvents ?? []).slice(0, 4),
    valuationLanguage: {
      basis: inferValuationBasis(va),
    },
    streetTarget: streetTargetHint(input.forecast, input.price),
    sbcBurden: sbcBurdenLabel(
      pillarOf(rating, "profitability")?.metrics.find((m) => m.id === "sbc_to_revenue")
        ?.value ?? null,
      isHighEquityCompIndustry({
        industry: f.classification.industry,
        industryKey: f.classification.industryKey,
        sector: f.classification.sector,
        sectorKey: f.classification.sectorKey,
      }),
    ),
    copyLanguage: inferCopyLanguage({
      capitalOverlay: f.classification.businessModel,
      financialStrength: fs,
      profitability: pr,
      growth: gr,
      valuation: va,
    }),
  };
}

/** Slim snapshot for the model — enough to ground, not a ratio dump. */
export function toNarrativePromptSnapshot(ctx: NarrativeContext) {
  return {
    symbol: ctx.symbol,
    name: ctx.name,
    sector: ctx.sector,
    industry: ctx.industry,
    profileThemes: ctx.description,
    path: ctx.path,
    capitalOverlay: ctx.capitalOverlay,
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
    fundamentalSnapshot: {
      note: "Optional supporting color for Outlook only. Do not recap these ratios in every bullet.",
      growth: ctx.pillarMetrics.growth[0] ?? null,
      profits: ctx.pillarMetrics.profitability[0] ?? null,
      cash: ctx.pillarMetrics.financialStrength[0] ?? null,
      valuation: ctx.pillarMetrics.valuation[0] ?? null,
    },
    issuerLock: issuerLockSnapshot(ctx),
    technical: ctx.technical,
    marketLocation: describeMarketLocation(ctx.technical),
    notes: ctx.notes,
    recentEvents: ctx.recentEvents,
    sbcBurden: ctx.sbcBurden,
    valuationLanguage: ctx.valuationLanguage,
    streetTarget: ctx.streetTarget,
    copyLanguage: ctx.copyLanguage,
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
