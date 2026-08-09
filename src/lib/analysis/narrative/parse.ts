import type {
  AnalysisNarrativeBundle,
  NarrativeFutureOutlook,
  NarrativePillarBlurbs,
  NarrativeTechnicalBlurbs,
} from "@/lib/analysis/narrative/types";

const META_RE =
  /\b(investsalsa analysis provides insights|insights into companies like|this analysis provides)\b/i;
const ADVICE_RE =
  /\b(buy now|sell now|strong buy|strong sell|good time to buy|overweight|underweight)\b/i;

/** Trade-order diction — Summary/Outlook must stay descriptive only. */
const TRADE_ORDER_RE =
  /\b(buy now|sell now|strong buy|strong sell|good time to buy|overweight|underweight|accumulate|buy the (fear|dip)|time to (buy|sell|enter|exit))\b|\b(buy|sell) (this|the stock|shares|here|in)\b|\b(a hold|rated hold|hold rating)\b/i;

const LOCATION_RE =
  /oversold|overbought|near fair|stretched|cooled off|washed out|pulled back/i;

/** Current-state accounting facts — not forward optionality. */
const BALANCE_SHEET_OPP_RE =
  /\b(net[- ]cash|net debt|ttm fcf|trailing fcf|free cash flow|interest coverage|current ratio|quick ratio|ebitda of|cash.compounder books|healthy coverage|balance sheet)\b/i;

const PILLAR_WALK_RE =
  /financial strength at|growth at \d|valuation (score|at) \d|profitability at \d|fundamental \d+\.\d+ and technical \d+\.\d+/i;

const JARGON_RE =
  /cash[- ]compounder|\bfranchise\b|\bTTM\b|optionality|reacceleration|structural margins|earnings power|\bposture\b|screens as|air-pockets|embedded expectations|rich multiple|elevated multiples/i;

function asText(value: unknown, max = 700): string {
  if (typeof value !== "string") return "";
  const t = value.replace(/\s+/g, " ").trim();
  if (!t || META_RE.test(t) || ADVICE_RE.test(t)) return "";
  return t.slice(0, max);
}

function firstSentence(text: string, max = 200): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^(.+?[.!?])(?:\s|$)/);
  return (m?.[1] || t).slice(0, max).trim();
}

function sentenceCount(text: string): number {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.replace(/[.!?]/g, "").trim().length > 12).length;
}

function asBullets(value: unknown, maxItems = 5, maxLen = 300): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const t = asText(item, maxLen);
    if (!t) continue;
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function emptyNarrativeBundle(): AnalysisNarrativeBundle {
  return {
    fundamentalOverview: "",
    pillars: {
      financialStrength: "",
      profitability: "",
      growth: "",
      valuation: "",
    },
    technicalOverview: "",
    technical: { priceZone: "", meanExtension: "" },
    futureOutlook: { opportunities: [], risks: [] },
    summary: "",
  };
}

export function fallbackNarrativeBundle(reason: string): AnalysisNarrativeBundle {
  return {
    fundamentalOverview:
      "AI overview unavailable. Fundamental scores above are unchanged.",
    pillars: {
      financialStrength: "",
      profitability: "",
      growth: "",
      valuation: "",
    },
    technicalOverview:
      "AI overview unavailable. Technical scores above are unchanged.",
    technical: { priceZone: "", meanExtension: "" },
    futureOutlook: { opportunities: [], risks: [] },
    summary: reason,
  };
}

export function countNumericMentions(text: string): number {
  return (text.match(/\b\d+\.\d+\b/g) ?? []).length;
}

export function isJargonHeavy(bundle: AnalysisNarrativeBundle): boolean {
  const blob = [
    bundle.summary,
    bundle.fundamentalOverview,
    bundle.technicalOverview,
    bundle.pillars.financialStrength,
    bundle.pillars.profitability,
    bundle.pillars.growth,
    bundle.pillars.valuation,
    ...bundle.futureOutlook.opportunities,
    ...bundle.futureOutlook.risks,
  ].join(" ");
  return JARGON_RE.test(blob);
}

export function hasTradeAdvice(bundle: AnalysisNarrativeBundle): boolean {
  const blob = [
    bundle.summary,
    bundle.fundamentalOverview,
    bundle.technicalOverview,
    bundle.pillars.financialStrength,
    bundle.pillars.profitability,
    bundle.pillars.growth,
    bundle.pillars.valuation,
    bundle.technical.priceZone,
    bundle.technical.meanExtension,
    ...bundle.futureOutlook.opportunities,
    ...bundle.futureOutlook.risks,
  ].join(" ");
  return TRADE_ORDER_RE.test(blob);
}

export function isSummaryShallow(bundle: AnalysisNarrativeBundle): boolean {
  const summary = bundle.summary;
  if (!summary) return true;
  if (sentenceCount(summary) < 4) return true;
  if (!LOCATION_RE.test(summary)) return true;
  return false;
}

export function isRecitationHeavy(bundle: AnalysisNarrativeBundle): boolean {
  const summary = bundle.summary;
  if (countNumericMentions(summary) >= 3) return true;
  if (PILLAR_WALK_RE.test(summary)) return true;
  const pillars = [
    bundle.pillars.financialStrength,
    bundle.pillars.profitability,
    bundle.pillars.growth,
    bundle.pillars.valuation,
    bundle.fundamentalOverview,
  ].join(" ");
  const ratioHits = (
    pillars.match(
      /net debt\/|ev\/|p\/e|pe of|ttm |fcf yield|altman|piotroski|price to /gi,
    ) ?? []
  ).length;
  const scoreHits = (pillars.match(/\b\d+\.\d+\b/g) ?? []).length;
  if (ratioHits >= 3 || scoreHits >= 5) return true;
  return false;
}

export function filterForwardOpportunities(items: string[]): string[] {
  return items.filter((item) => !BALANCE_SHEET_OPP_RE.test(item));
}

export function polishNarrativeBundle(
  bundle: AnalysisNarrativeBundle,
): AnalysisNarrativeBundle {
  return {
    ...bundle,
    pillars: {
      financialStrength: firstSentence(bundle.pillars.financialStrength),
      profitability: firstSentence(bundle.pillars.profitability),
      growth: firstSentence(bundle.pillars.growth),
      valuation: firstSentence(bundle.pillars.valuation),
    },
    technical: {
      priceZone: firstSentence(bundle.technical.priceZone),
      meanExtension: firstSentence(bundle.technical.meanExtension),
    },
    futureOutlook: {
      ...bundle.futureOutlook,
      opportunities: filterForwardOpportunities(
        bundle.futureOutlook.opportunities,
      ),
    },
  };
}

export function parseNarrativeBundle(
  raw: string,
): AnalysisNarrativeBundle | null {
  const json = extractJsonObject(raw);
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const pillarsRaw =
    o.pillars && typeof o.pillars === "object"
      ? (o.pillars as Record<string, unknown>)
      : {};
  const techRaw =
    o.technical && typeof o.technical === "object"
      ? (o.technical as Record<string, unknown>)
      : {};
  const futureRaw =
    o.futureOutlook && typeof o.futureOutlook === "object"
      ? (o.futureOutlook as Record<string, unknown>)
      : {};

  const pillars: NarrativePillarBlurbs = {
    financialStrength: asText(pillarsRaw.financialStrength, 320),
    profitability: asText(pillarsRaw.profitability, 320),
    growth: asText(pillarsRaw.growth, 320),
    valuation: asText(pillarsRaw.valuation, 320),
  };
  const technical: NarrativeTechnicalBlurbs = {
    priceZone: asText(techRaw.priceZone, 320),
    meanExtension: asText(techRaw.meanExtension, 400),
  };
  const futureOutlook: NarrativeFutureOutlook = {
    opportunities: asBullets(futureRaw.opportunities),
    risks: asBullets(futureRaw.risks),
  };
  const summary = asText(o.summary, 1200);
  const fundamentalOverview = asText(o.fundamentalOverview, 800);
  const technicalOverview = asText(o.technicalOverview, 800);

  if (!summary && !fundamentalOverview && !technicalOverview) return null;

  return polishNarrativeBundle({
    fundamentalOverview,
    pillars,
    technicalOverview,
    technical,
    futureOutlook,
    summary:
      summary ||
      "Scores are shown as computed. Narrative text was incomplete.",
  });
}
