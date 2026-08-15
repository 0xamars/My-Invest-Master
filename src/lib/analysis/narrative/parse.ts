import type {
  AnalysisNarrativeBundle,
  NarrativeContext,
  NarrativeFutureOutlook,
  NarrativeOutlookItem,
  NarrativePillarBlurbs,
  NarrativeTechnicalBlurbs,
} from "@/lib/analysis/narrative/types";
import {
  outlookItemText,
  outlookListText,
} from "@/lib/analysis/narrative/types";
import { buildFallbackOutlook } from "@/lib/analysis/narrative/outlook-fallback";
import {
  inferOutlookBusinessType,
  outlookHasForeignProducts,
} from "@/lib/analysis/narrative/outlook-lock";

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

function asOutlookItem(value: unknown): NarrativeOutlookItem | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as { title?: unknown; body?: unknown; text?: unknown };
    const title = asText(o.title, 80);
    const body = asText(o.body ?? o.text, 640);
    if (title && body) return { title: trimTitle(title), body };
    if (!title && body) return splitTitleBody(body);
  }
  if (typeof value === "string") {
    const t = asText(value, 720);
    if (!t) return null;
    const md = t.match(/^\*\*(.+?)\*\*[.:]?\s+([\s\S]+)$/);
    if (md?.[1] && md[2]) {
      return { title: trimTitle(md[1]), body: md[2].trim() };
    }
    const colon = t.match(/^([^:]{3,56}):\s+([\s\S]+)$/);
    if (colon?.[1] && colon[2] && !/^\d/.test(colon[1])) {
      return { title: trimTitle(colon[1]), body: colon[2].trim() };
    }
    const dash = t.match(/^([^—–-]{3,56})\s*[—–-]\s+([\s\S]+)$/);
    if (dash?.[1] && dash[2]) {
      return { title: trimTitle(dash[1]), body: dash[2].trim() };
    }
    return splitTitleBody(t);
  }
  return null;
}

function trimTitle(raw: string): string {
  return raw.replace(/[.]+$/, "").replace(/\s+/g, " ").trim();
}

function splitTitleBody(text: string): NarrativeOutlookItem | null {
  const first = firstSentence(text, 80);
  const rest = text.slice(first.length).trim();
  const title = trimTitle(first.replace(/[.!?]+$/, ""));
  if (!title) return null;
  const body = rest || first;
  if (!body.trim()) return null;
  return { title, body };
}

function asOutlookItems(value: unknown, maxItems = 6): NarrativeOutlookItem[] {
  if (!Array.isArray(value)) return [];
  const out: NarrativeOutlookItem[] = [];
  for (const item of value) {
    const parsed = asOutlookItem(item);
    if (!parsed) continue;
    out.push(parsed);
    if (out.length >= maxItems) break;
  }
  return out;
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

export function fallbackNarrativeBundle(
  reason: string,
  ctx?: Partial<NarrativeContext>,
): AnalysisNarrativeBundle {
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
    futureOutlook: buildFallbackOutlook(ctx ?? {}),
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
    outlookListText(bundle.futureOutlook.opportunities),
    outlookListText(bundle.futureOutlook.risks),
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
    outlookListText(bundle.futureOutlook.opportunities),
    outlookListText(bundle.futureOutlook.risks),
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
    outlookListText(bundle.futureOutlook.opportunities),
    outlookListText(bundle.futureOutlook.risks),
  ].join(" ");
  return FILING_CONTEXT_RE.test(blob);
}

const GENERIC_OPENER_RE =
  /\b(paints a mixed picture|the picture is mixed|looks mixed:|overall the picture is mixed|looks shaky overall|shaky overall as|mixed: sturdy|mixed: the business is sturdy)\b/i;

const GENERIC_WATCH_RE =
  /\b(whether (sales|growth) stabilize|whether growth (picks up|stabilizes)|keep (up )?with the big bets)\b/i;

const GENERIC_OPP_RE =
  /\b(may expand if (markets|demand) cooperate|demand could improve if conditions hold|if the economy stays healthy|if more firms move|if (markets|conditions) (hold|cooperate|improve)|growth opportunities|competitive pressures|macro(economic)? headwinds|industry tailwinds|also consider)\b/i;

/** Mood / filler risk titles with no mechanism. */
const GENERIC_RISK_FILLER_RE =
  /\b(execution risk|competitive pressures|priced for perfection|macro(economic)? (risk|headwinds)|industry (headwinds|tailwinds)|a major customer)\b/i;

const NAMED_BUYER_RE =
  /\b(amazon|aws|google|microsoft|meta|oracle|alibaba|tencent|broadcom)\b/i;
const HONEST_SCALE_RE =
  /\b(handful|majority of custom|few large cloud|largest accounts?)\b/i;
const NAMED_REGULATOR_RE =
  /\b(fcc|faa|nhtsa|sec|epa|city permits?)\b/i;

/** Bare “hyperscalers” / “a major customer” / “regulators” when a public name or honest scale exists. */
function hasVagueNamedEntity(text: string): boolean {
  if (
    /\ba major customers?\b|\bmajor customers\b/i.test(text) &&
    !NAMED_BUYER_RE.test(text) &&
    !HONEST_SCALE_RE.test(text)
  ) {
    return true;
  }
  if (
    /\bhyperscalers?\b/i.test(text) &&
    !NAMED_BUYER_RE.test(text) &&
    !HONEST_SCALE_RE.test(text)
  ) {
    return true;
  }
  if (/\bregulators\b/i.test(text) && !NAMED_REGULATOR_RE.test(text)) {
    return true;
  }
  return false;
}

const SECTOR_GENERIC_RE =
  /\b(renewables? (need|needs|require) (more )?(storage|batteries)|storage demand|grid (needs|requires|wants) (more )?(storage|batteries)|policy delays? (hurt|hit|slow) (the )?(industry|sector|market)|(industry|sector)[- ](wide )?(tailwind|headwind|demand)|energy transition (drives|needs|requires)|utilities (are|will) (adding|need) (batteries|storage)|as more (wind|solar|renewables) come online|the industry (benefits|grows|stands to))\b/i;

const ISSUER_HOOK_RE =
  /\b(backlog|commission(?:ing)?|software|controls?|project margins?|working capital|integrated (system|stack|platform)|this (issuer|company|firm)|its (own|backlog|software|systems|fleet|treasury|radios)|vs\.? |versus |\bagainst\b|atm|at-the-market|convertible|\bnav\b|balance sheet|dilut|design[- ]win|attach)\b/i;

function mentionsIssuerName(
  text: string,
  ctx: { name?: string | null; symbol?: string | null },
): boolean {
  const raw = (ctx.name ?? "").trim();
  const name = raw
    .replace(/,?\s+(inc\.?|corp\.?|corporation|ltd\.?|plc)\s*$/i, "")
    .trim();
  const t = text.toLowerCase();
  if (name.length >= 4 && t.includes(name.toLowerCase())) return true;
  const first = name.split(/\s+/)[0] ?? "";
  if (first.length >= 4 && t.includes(first.toLowerCase())) return true;
  const symbol = (ctx.symbol ?? "").trim();
  if (symbol.length >= 3 && new RegExp(`\\b${symbol}\\b`, "i").test(text)) {
    return true;
  }
  return false;
}

function itemIsUnhookedSectorGeneric(
  item: { title: string; body: string },
  ctx: { name?: string | null; symbol?: string | null },
): boolean {
  const text = outlookItemText(item);
  if (!SECTOR_GENERIC_RE.test(text)) return false;
  if (ISSUER_HOOK_RE.test(text)) return false;
  if (mentionsIssuerName(text, ctx)) return false;
  return true;
}

export function stripUnhookedSectorGenericItems(
  outlook: NarrativeFutureOutlook,
  ctx: { name?: string | null; symbol?: string | null },
): NarrativeFutureOutlook {
  return {
    opportunities: outlook.opportunities.filter(
      (i) => !itemIsUnhookedSectorGeneric(i, ctx),
    ),
    risks: outlook.risks.filter((i) => !itemIsUnhookedSectorGeneric(i, ctx)),
  };
}

const OEM_INTERCHANGEABLE_RE =
  /\b(ev demand|vehicle demand|auto(motive)? (cycle|oem|maker)|price competition in (the )?ev|competitive ev market)\b/i;

const EV_DISTINCTIVE_RE =
  /energy storage|fsd|full self[- ]driv|robotaxi|cybercab|optimus|humanoid|4680|gigafactory|unsupervised/i;

const UNKNOWN_PKG_RE =
  /unknown in this package|not in this package|unknown in this snapshot/gi;

/** Count quantitative figures in Outlook copy (not years). */
export function outlookFigureCount(text: string): number {
  const tokens =
    text.match(
      /\$?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|x|bn?|billion|million|gwh|twh|mw))?/gi,
    ) ?? [];
  return tokens.filter((t) => {
    const n = t.replace(/[^\d.]/g, "");
    if (/^(19|20)\d{2}$/.test(n)) return false;
    return n.length > 0;
  }).length;
}

const OUTLOOK_FILLER_STEM_RE =
  /\b(that path works only if|the condition is|treat (this|them|it|current service) as|that only (happens|works|pays|matters|shows up) if)\b/i;

function isOutlookWordy(items: { title: string; body: string }[]): boolean {
  const long = items.filter((i) => sentenceCount(i.body) >= 3).length;
  const filler = items.filter((i) =>
    OUTLOOK_FILLER_STEM_RE.test(`${i.title} ${i.body}`),
  ).length;
  return long >= 4 || filler >= 3;
}

function treasuryScaleBearing(text: string): boolean {
  const t = text.toLowerCase();
  const holdings =
    /bitcoin|btc|holdings|treasury/.test(t) &&
    /largest|size of|stack|billion|million|\d[\d,]*\s*btc/.test(t);
  const funding = /atm|at-the-market|convertible|dilut/.test(t);
  const prem = /premium|discount|\bnav\b/.test(t);
  const debt = /\bdebt\b|leverage/.test(t);
  const sidecar = /software|operating/.test(t) && /small|sidecar|tiny|dwarf/.test(t);
  return holdings || funding || prem || debt || sidecar;
}

function isOutlookFigureDump(items: { title: string; body: string }[]): boolean {
  const counts = items.map((i) => outlookFigureCount(`${i.title} ${i.body}`));
  const multi = counts.filter((n) => n >= 2).length;
  const stacked = counts.filter((n) => n >= 3).length;
  return stacked >= 2 || multi >= 4;
}

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

export function stripFilingEchoes(
  items: NarrativeOutlookItem[],
): NarrativeOutlookItem[] {
  return items.filter((item) => !isFilingContextBullet(outlookItemText(item)));
}

const WIKI_LEAD_RE =
  /\b(makes|designs|manufactures|develops, manufactures|operates in|headquartered|graphics and|chips across|sells electric vehicles across)\b/i;

const SCORE_VOICE_RE =
  /\b(balance sheet|margins?|profits?|growth|expensive|cheap|rich|full price|valuation|cash|weak|strong|fortress|elite|unprofitable|operating losses?|cash-flow|cash conversion)\b/i;

const THICK_THIN_WORD_RE = /\b(thick|thin)\b/i;

const LOSS_NAMED_RE =
  /\b(unprofitable|operating losses?|not yet profitable|loss-making|still losing)\b/i;

const IMPLIED_ELITE_PROFITS_RE =
  /\b(elite profits?|strong profits?|highly profitable|thick profits?|elite margins?)\b/i;

function summaryAndOverviewBlob(bundle: AnalysisNarrativeBundle): string {
  return [
    bundle.fundamentalOverview,
    bundle.summary,
    ...(bundle.summaryBullets ?? []),
  ].join(" ");
}

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

/** Summary + Assessment header only — not Future Outlook. */
export function hasBannedProfitWording(
  bundle: AnalysisNarrativeBundle,
): boolean {
  return THICK_THIN_WORD_RE.test(summaryAndOverviewBlob(bundle));
}

/** Loss-makers must be named as unprofitable — not “margin pressure” or elite profits. */
export function hasSoftenedLosses(
  bundle: AnalysisNarrativeBundle,
  copy?: { earnings?: string } | null,
): boolean {
  if (copy?.earnings !== "unprofitable") return false;
  const blob = summaryAndOverviewBlob(bundle);
  if (IMPLIED_ELITE_PROFITS_RE.test(blob)) return true;
  if (/\bmargin pressure\b/i.test(blob) && !LOSS_NAMED_RE.test(blob)) return true;
  return !LOSS_NAMED_RE.test(blob);
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
    outlookListText(bundle.futureOutlook.opportunities),
    outlookListText(bundle.futureOutlook.risks),
  ].join(" ");
  return FORWARD_PRECISION_RE.test(blob);
}

export function isOutlookShallow(
  bundle: AnalysisNarrativeBundle,
  ctx: {
    industry?: string | null;
    description?: string | null;
    name?: string | null;
    symbol?: string | null;
    sector?: string | null;
    capitalOverlay?: string | null;
    packageFacts?: { display: string }[];
  },
): boolean {
  const rawOpps = bundle.futureOutlook.opportunities;
  const rawRisks = bundle.futureOutlook.risks;
  if (rawOpps.length === 0 && rawRisks.length === 0) return true;
  const kept = stripUnhookedSectorGenericItems(
    { opportunities: rawOpps, risks: rawRisks },
    ctx,
  );
  const opps = kept.opportunities;
  const risks = kept.risks;
  if (
    rawOpps.length + rawRisks.length > 0 &&
    opps.length + risks.length === 0
  ) {
    return true;
  }
  if (opps.length > 6 || risks.length > 6) return true;
  if ([...opps, ...risks].some((i) => i.title.trim().length < 3)) return true;
  if (outlookHasForeignProducts(bundle.futureOutlook, ctx)) return true;
  const oppBlob = outlookListText(opps);
  const riskBlob = outlookListText(risks);
  const genericHits = (oppBlob.match(GENERIC_OPP_RE) ?? []).length;
  if (genericHits >= 2) return true;
  if (opps.filter((o) => GENERIC_OPP_RE.test(outlookItemText(o))).length >= 2) {
    return true;
  }
  const fillerRisks = risks.filter((r) =>
    GENERIC_RISK_FILLER_RE.test(outlookItemText(r)),
  ).length;
  if (fillerRisks >= 2) return true;
  if (hasVagueNamedEntity(`${oppBlob} ${riskBlob}`)) return true;

  const outlookText = `${oppBlob} ${riskBlob}`;
  const unknownHits = outlookText.match(UNKNOWN_PKG_RE) ?? [];
  if (unknownHits.length >= 3) return true;
  if (isOutlookFigureDump([...opps, ...risks])) return true;
  if (isOutlookWordy([...opps, ...risks])) return true;

  const industry = (ctx.industry ?? "").toLowerCase();
  const oppLc = oppBlob.toLowerCase();
  const riskLc = riskBlob.toLowerCase();
  const blob = `${oppLc} ${riskLc}`;
  const biz = inferOutlookBusinessType(ctx);

  const isAuto = /auto manufacturers?|automobile|automotive|electric vehicle|\bev\b/.test(
    industry,
  );
  if (
    isAuto &&
    (outlookText.match(OEM_INTERCHANGEABLE_RE) ?? []).length >= 2 &&
    !EV_DISTINCTIVE_RE.test(outlookText)
  ) {
    return true;
  }
  if (biz === "ev_energy") {
    if (
      !/fsd|full self[- ]driv|robotaxi|cybercab|optimus|humanoid|energy|storage/.test(
        blob,
      )
    ) {
      return true;
    }
    if (
      oppLc.length > 0 &&
      !/fsd|full self[- ]driv|robotaxi|cybercab|energy|storage|optimus|humanoid/.test(
        oppLc,
      )
    ) {
      return true;
    }
    if (
      riskLc.length > 0 &&
      !/price|rival|compet|china|demand|valuat|autonom|robot|execut|capex|fcf|nhtsa|dilut/.test(
        riskLc,
      )
    ) {
      return true;
    }
  }
  if (biz === "insurer") {
    const nestedRegion =
      /hong kong|japan|china|singapore|canada|united states|john hancock|\bu\.s\.\b/.test(
        blob,
      );
    const product =
      /wealth|protection|fee|annuit|workplace|etf|investment book|guarantee/.test(
        blob,
      );
    if (!nestedRegion || !product) return true;
    if (/\basia\b/.test(blob) && !/hong kong|japan|china|singapore/.test(blob)) {
      return true;
    }
  }
  if (biz === "semi") {
    const distinctive =
      /custom|asic|optical|optics|ethernet|switch|dsp|networking|cloud|design[- ]win|foundry|chiplet|gpu|data[- ]center|accelerator/.test(
        blob,
      );
    if (!distinctive) return true;
    if (
      /ai (chip|demand)/i.test(blob) &&
      !/custom|optics|ethernet|gpu|networking|asic/.test(blob)
    ) {
      return true;
    }
    if (
      !/rival|compet|concentrat|customer|cycle|cloud|valuat/.test(riskBlob)
    ) {
      return true;
    }
    if (
      /concentrat|hyperscaler|cloud buyer/.test(riskLc) &&
      !/amazon|aws|google|microsoft|meta|oracle|alibaba|handful|majority of custom|few large cloud/.test(
        blob,
      )
    ) {
      return true;
    }
  }
  if (biz === "early_hardware") {
    if (
      !/radio|drone|uav|wireless|order|contract|spectrum|standard|defense|fcc|burn|dilut/.test(
        blob,
      )
    ) {
      return true;
    }
  }
  if (biz === "treasury_nav") {
    if (!/bitcoin|btc|nav|treasury|holdings|dilut|atm|premium|leverage|debt/.test(blob)) {
      return true;
    }
    const scaleItems = [...opps, ...risks].filter((i) =>
      treasuryScaleBearing(outlookItemText(i)),
    ).length;
    const total = opps.length + risks.length;
    if (total >= 3 && scaleItems < 2) return true;
    if (total < 3 && scaleItems < 1) return true;
  }
  if (biz === "software") {
    if (!/cloud|saas|enterprise|workplace|productivity|software|ai/.test(blob)) {
      return true;
    }
  }
  if (biz === "grid_storage") {
    if (
      !/software|control|backlog|commission|margin|integrated|working capital|balance sheet|capital/.test(
        blob,
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
    bundle.futureOutlook.opportunities.filter((o) =>
      GENERIC_OPP_RE.test(outlookItemText(o)),
    ).length >= 2
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

export function filterForwardOpportunities(
  items: NarrativeOutlookItem[],
): NarrativeOutlookItem[] {
  return items.filter((item) => !BALANCE_SHEET_OPP_RE.test(outlookItemText(item)));
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
    opportunities: asOutlookItems(futureRaw.opportunities),
    risks: asOutlookItems(futureRaw.risks),
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
