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

function firstSentence(text: string, max = 240): string {
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
    summaryBullets: [],
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
    summaryBullets: reason ? [reason] : [],
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

function splitSummarySentences(summary: string): string[] {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[.!?]/g, "").trim().length > 12)
    .slice(0, 6);
}

export function coerceSummaryBullets(
  raw: unknown,
  summary: string,
): string[] {
  const fromArr = asBullets(raw, 6, 280);
  if (fromArr.length >= 4) return fromArr;
  const fromText = splitSummarySentences(summary);
  if (fromText.length >= 4) return fromText;
  return fromArr.length ? fromArr : fromText;
}

export function isSummaryShallow(bundle: AnalysisNarrativeBundle): boolean {
  const bullets =
    bundle.summaryBullets.length >= 4
      ? bundle.summaryBullets
      : splitSummarySentences(bundle.summary);
  if (bullets.length < 4) return true;
  if (!LOCATION_RE.test(bullets.join(" "))) return true;
  return false;
}

export function inventsUnlistedEvents(
  bundle: AnalysisNarrativeBundle,
  events: Array<{ type?: string; summary?: string }>,
): boolean {
  if (events.length > 0) return false;
  const blob = [
    bundle.summary,
    ...bundle.summaryBullets,
    ...bundle.futureOutlook.opportunities,
    ...bundle.futureOutlook.risks,
  ].join(" ");
  return FILING_CONTEXT_RE.test(blob);
}

const GENERIC_OPENER_RE =
  /\b(paints a mixed picture|the picture is mixed|looks mixed:|overall the picture is mixed|looks shaky overall|shaky overall as|mixed: sturdy|mixed: the business is sturdy)\b/i;

const GENERIC_WATCH_RE =
  /\b(whether (sales|growth) stabilize|whether growth (picks up|stabilizes)|keep (up )?with the big bets)\b/i;

const GENERIC_OPP_RE =
  /\b(may expand if (markets|demand) cooperate|demand could improve if conditions hold|if the economy stays healthy|if more firms move|if (markets|conditions) (hold|cooperate|improve))\b/i;

export const FILING_CONTEXT_RE =
  /\b(net insider|insiders?\b[\s\S]{0,48}\b(buying|selling|sellers|buyers|purchases|sales)|open-market (purchases?|sales?|selling|buying)|agreed to acquire|was named as a target|merger with)\b/i;

export function isFilingContextBullet(text: string): boolean {
  return FILING_CONTEXT_RE.test(text);
}

export function limitFilingBullets(bullets: string[]): string[] {
  let seen = false;
  return bullets.filter((b) => {
    if (!isFilingContextBullet(b)) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
}

export function stripFilingEchoes(items: string[]): string[] {
  return items.filter((item) => !isFilingContextBullet(item));
}

const WIKI_LEAD_RE =
  /\b(makes|designs|manufactures|develops, manufactures|operates in|headquartered|graphics and|chips across|sells electric vehicles across)\b/i;

const SCORE_VOICE_RE =
  /\b(balance sheet|margins?|profits?|growth|expensive|cheap|rich|full price|valuation|cash|weak|strong|fortress|elite|thin)\b/i;

const FORWARD_PRECISION_RE =
  /\b(fair value|fairly valued|priced for (expected|forward) (growth|earnings)|forward (pe|p\/e|earnings|growth) (is )?already|implied forecast)\b/i;

export function isWikiOverview(text: string): boolean {
  if (!text.trim()) return true;
  const first =
    text
      .split(/(?<=[.!?])\s+/)
      .find((s) => s.replace(/[.!?]/g, "").trim().length > 12) ?? text;
  if (WIKI_LEAD_RE.test(first)) return true;
  if (!SCORE_VOICE_RE.test(text) && text.length > 40) return true;
  return false;
}

export function hasInaccurateValuationLanguage(
  bundle: AnalysisNarrativeBundle,
  basis: "current" | "includes_forward" | undefined,
): boolean {
  if (basis === "includes_forward") return false;
  const blob = [
    bundle.fundamentalOverview,
    bundle.summary,
    ...bundle.summaryBullets,
    bundle.pillars.valuation,
    ...bundle.futureOutlook.opportunities,
    ...bundle.futureOutlook.risks,
  ].join(" ");
  return FORWARD_PRECISION_RE.test(blob);
}

export function isOutlookShallow(
  bundle: AnalysisNarrativeBundle,
  ctx: {
    industry?: string | null;
    description?: string | null;
  },
): boolean {
  const opps = bundle.futureOutlook.opportunities;
  const risks = bundle.futureOutlook.risks;
  if (opps.length < 3) return true;
  const oppBlob = opps.join(" ");
  const riskBlob = risks.join(" ");
  const genericHits = (oppBlob.match(GENERIC_OPP_RE) ?? []).length;
  if (genericHits >= 2) return true;
  if (opps.filter((o) => GENERIC_OPP_RE.test(o)).length >= 2) return true;

  const industry = (ctx.industry ?? "").toLowerCase();
  const themes = (ctx.description ?? "").toLowerCase();
  const blob = `${oppBlob} ${riskBlob}`.toLowerCase();
  const isAuto = /auto|vehicle|\bev\b|electric vehicle/.test(industry);
  const integratedEvEnergy = isAuto && /\benergy\b/.test(themes);
  if (integratedEvEnergy) {
    if (!/energy|storage|solar|generation/.test(oppBlob)) return true;
    if (!/autonom|robotaxi|self-driv/.test(oppBlob)) return true;
    if (!/humanoid|optimus|robot/.test(oppBlob)) return true;
    if (
      !/price|rival|compet|china|demand|valuat|autonom|robot|execut/.test(
        riskBlob,
      )
    ) {
      return true;
    }
  }
  const isSoft = /software|cloud|information technology|internet/.test(industry);
  if (isSoft && !/cloud|ai|azure|productivity|workplace|enterprise/.test(blob)) {
    return true;
  }
  const isSemi = /semiconductor|chip|\bgpu\b/.test(`${industry} ${themes}`);
  if (isSemi) {
    const hasAccelerator =
      /gpu|data[- ]center|ai (chip|gpu|accelerator)|accelerator/.test(blob);
    const hasSecondLever =
      /network|infiniband|nvlink|geforce|gaming|architecture|roadmap|cuda|software platform|cluster/.test(
        blob,
      );
    if (!hasAccelerator || !hasSecondLever) return true;
    if (
      !/rival|compet|export|china|customer|concentrat|valuat|optimism/.test(
        riskBlob,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function isGenericTemplate(
  bundle: AnalysisNarrativeBundle,
  identity: { name?: string | null; industry?: string | null; symbol?: string | null },
): boolean {
  const summary = bundle.summary;
  if (GENERIC_OPENER_RE.test(summary)) return true;
  if (GENERIC_WATCH_RE.test(summary) && !/\b(deliver|autonom|energy|cloud|premium|insur|runway|funding)\b/i.test(summary)) {
    return true;
  }
  const tokens = [
    identity.symbol,
    ...(identity.name ?? "").split(/\s+/),
    ...(identity.industry ?? "").split(/[\s\-\/&,]+/),
  ]
    .map((t) => (t ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3 && !/^(the|and|inc|ltd|plc|corp|group|financial|services|general)$/.test(t));
  const hay = summary.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const hit = tokens.some((t) => hay.includes(t));
  if (tokens.length >= 2 && !hit) return true;
  if (
    bundle.futureOutlook.opportunities.filter((o) => GENERIC_OPP_RE.test(o))
      .length >= 2
  ) {
    return true;
  }
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
  const summaryBullets = limitFilingBullets(bundle.summaryBullets.slice(0, 6));
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
      opportunities: stripFilingEchoes(
        filterForwardOpportunities(bundle.futureOutlook.opportunities),
      ),
      risks: stripFilingEchoes(bundle.futureOutlook.risks),
    },
    summaryBullets,
    summary: summaryBullets.length > 0 ? summaryBullets.join(" ") : bundle.summary,
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
  const summaryBullets = coerceSummaryBullets(o.summaryBullets, summary);
  const fundamentalOverview = asText(o.fundamentalOverview, 800);
  const technicalOverview = asText(o.technicalOverview, 800);

  if (!summary && summaryBullets.length === 0 && !fundamentalOverview && !technicalOverview) {
    return null;
  }

  return polishNarrativeBundle({
    fundamentalOverview,
    pillars,
    technicalOverview,
    technical,
    futureOutlook,
    summaryBullets,
    summary:
      summary ||
      summaryBullets.join(" ") ||
      "Scores are shown as computed. Narrative text was incomplete.",
  });
}
