/**
 * Ticker lock for Future Outlook: this issuer’s business only.
 * Product names from other famous stocks are banned unless they appear in
 * this company’s profile (or the issuer is the matching industry family).
 */
import type {
  NarrativeContext,
  NarrativeFutureOutlook,
  NarrativeOutlookItem,
} from "@/lib/analysis/narrative/types";
import { outlookItemText } from "@/lib/analysis/narrative/types";

export type OutlookBusinessType =
  | "treasury_nav"
  | "insurer"
  | "semi"
  | "early_hardware"
  | "software"
  | "ev_energy"
  | "scaled_operator"
  | "grid_storage"
  | "generic";

type Identity = {
  symbol?: string | null;
  name?: string | null;
  industry?: string | null;
  sector?: string | null;
  description?: string | null;
  path?: string | null;
  capitalOverlay?: string | null;
  vehicle?: string | null;
};

function blobOf(ctx: Identity): string {
  return [
    ctx.symbol,
    ctx.name,
    ctx.industry,
    ctx.sector,
    ctx.description,
    ctx.path,
    ctx.capitalOverlay,
    ctx.vehicle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const AUTO_INDUSTRY_RE =
  /\b(auto manufacturers?|automobile manufacturers?|automobiles?|automotive|car manufacturers?|electric vehicles?|\bev\b)\b/i;

const TESLA_PRODUCT_RE =
  /\b(fsd|full self[- ]driving|robotaxi|cybercab|optimus|megapack|dojo|4680|gigafactory|cybertruck)\b/i;

const NVIDIA_PRODUCT_RE =
  /\b(cuda|geforce|infiniband|nvlink|hopper|blackwell)\b/i;

const MSFT_PRODUCT_RE = /\b(azure|copilot)\b/i;

export function inferOutlookBusinessType(ctx: Identity): OutlookBusinessType {
  const blob = blobOf(ctx);
  const industry = (ctx.industry ?? "").toLowerCase();
  const overlay = ctx.capitalOverlay ?? "";

  if (
    overlay === "treasury_holding" ||
    /\b(bitcoin treasury|btc treasury|digital[- ]asset treasury|bitcoin holding)\b/i.test(
      blob,
    )
  ) {
    return "treasury_nav";
  }
  if (
    overlay === "insurance_life" ||
    /\b(life insurance|insurance|annuit)/i.test(`${industry} ${overlay}`)
  ) {
    return "insurer";
  }
  if (AUTO_INDUSTRY_RE.test(industry) || AUTO_INDUSTRY_RE.test(blob)) {
    if (/\benergy\b/.test((ctx.description ?? "").toLowerCase())) {
      return "ev_energy";
    }
    return "scaled_operator";
  }
  if (
    /semiconductor|semiconductors|chip|asic|ethernet|optical|photonic/.test(
      `${industry} ${blob}`,
    )
  ) {
    return "semi";
  }
  if (
    overlay === "early_growth" ||
    /communication equipment|radio|drone|uav|wireless|iot\b|scientific (and|&) technical instruments/.test(
      blob,
    )
  ) {
    return "early_hardware";
  }
  if (
    /software|cloud|information technology|internet|system software/.test(
      industry,
    )
  ) {
    return "software";
  }
  if (
    /energy storage|battery storage|grid[- ]scale storage|storage products|battery energy storage/.test(
      blob,
    ) &&
    !AUTO_INDUSTRY_RE.test(industry)
  ) {
    return "grid_storage";
  }
  return "generic";
}

export function outlookPlaybook(type: OutlookBusinessType): string {
  const depth =
    "Variable depth: only material points (typically 2–5 per side; 1–2 if the story is simple or facts are thin). Never pad to a quota.";
  switch (type) {
    case "treasury_nav":
      return [
        "Treasury / NAV / leveraged asset vehicle. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: holdings scale (approx. BTC or “one of the largest corporate bitcoin treasuries” if that is public); operating software small vs treasury; funding that adds coins without wrecking NAV.",
        "Risks: ATM/converts as the funding tool if that is public; debt vs treasury/assets when known; premium/discount to NAV; operating line too small to carry the multiple.",
        "Keep scale on the bullets you write (holdings class, ATM/dilution, premium or debt). Do not add extra bullets just to place more numbers. Never invent a BTC count or leverage %.",
      ].join(" ");
    case "insurer":
      return [
        "Insurer / financial. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: named regional engines from the profile (Hong Kong, Japan, Canada, U.S. — not “Asia growth” alone); wealth/fee vs protection/spread; named product lines.",
        "Add scale only if known (e.g. Asia as a major earnings/NBV driver). Never fake %.",
        "Risks: rate/credit of the investment book; guarantees/capital; FX in named regions; slow premiums in a named home market.",
        "Not generic “insurance growth.” Drop extra regions that do not change the case. No sector-generic “insurance demand” lines.",
      ].join(" ");
    case "semi":
      return [
        "Semiconductor / infrastructure silicon. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: custom silicon, optics/optical, ethernet/switching, or this issuer’s actual product set from the profile — design-wins converting to production.",
        "Risks: customer concentration — name the buyer set when public and the dependency (majority of custom pipeline / handful of buyers / largest named account); cycle in AI/cloud spend; rival stacks (merchant silicon, in-house custom); design-win → revenue lag.",
        "Quantify concentration only if known. Not generic “AI chip demand.” No CUDA/GeForce unless in THIS profile. No “hyperscalers” or “a major customer” alone. No sector-generic “AI spend is rising” without this issuer’s sockets.",
      ].join(" ");
    case "early_hardware":
      return [
        "Early-stage / specialty hardware. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: radios, drones/UAV, private wireless, standards (e.g. IEEE), defense or industrial programs named in the profile; order conversions.",
        "Risks: cash burn, order lumpiness, named regulatory/spectrum gates (FCC/FAA-class when that fits), share dilution from the actual funding tool (ATM, raise, convert) if known.",
        "Name concentration (a few contracts / Class I rail) without fake %. Never use autonomy megacap narrative (FSD, robotaxi, Cybercab, Optimus, Megapack).",
      ].join(" ");
    case "software":
      return [
        "Software / cloud. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: this issuer’s cloud, workplace, or enterprise products from the profile; paid AI attach if that fits.",
        "Risks: IT budget fatigue, rivalry, concentration, regulation.",
        "Do not name Azure or Copilot unless they appear in THIS profile.",
      ].join(" ");
    case "ev_energy":
      return [
        "Integrated EV + energy (this profile mentions vehicles AND energy). 1–2 short sentences per bullet.",
        depth,
        "Opportunities: the material platforms only — FSD/software annuity; robotaxi/Cybercab if that is this issuer’s public line; energy storage; humanoid/Optimus as early option if it actually moves the case. Skip lesser adjacent lines.",
        "Optional scale when confident: fleet/attach, capex regime, latest-quarter FCF sign. Never dump TTM ratios. Energy-storage bullets must be THIS issuer’s energy line, not “renewables need storage.”",
        "Risks: capex/FCF regime; multiple on unproven autonomy cash; rivals, NHTSA/city permits (not bare “regulators”); thinner auto margins; dilution if it is a real break.",
      ].join(" ");
    case "scaled_operator":
      return [
        "Scaled operator. 1–2 short sentences per bullet.",
        depth,
        "Opportunities: this issuer’s product platforms, software attach if the profile supports it, cost curve, mix.",
        "Risks: capex regime, margin structure, competition, cycle.",
        "Do not import another OEM’s branded programs. No sector-generic demand lines.",
      ].join(" ");
    case "grid_storage":
      return [
        "Grid / battery energy storage systems (not an auto OEM). 1–2 short sentences per bullet.",
        depth,
        "Opportunities: THIS issuer’s integrated storage systems, software/controls/digital attach, services, backlog converting to commissioned projects.",
        "Risks: project/bid margins on THIS book, commissioning delays in the backlog, working capital and capital structure, named rivals without pasting another OEM’s branded products (no Megapack/FSD unless in THIS profile).",
        "Forbidden copy-paste: “renewables need storage,” “storage demand is growing,” “policy delays hurt the industry” unless the same bullet ties that force to this issuer’s backlog, margins, or funding.",
      ].join(" ");
    default:
      return [
        "Use profileThemes and industry only. Name this issuer’s products and regions.",
        depth,
        "Opportunities: this issuer’s actual product mix, attach, backlog, or reinvestment — only if they change the case.",
        "Risks: this issuer’s capital, named rivalry, execution path — not sector mood.",
        "Drop any bullet a peer could reuse unchanged.",
      ].join(" ");
  }
}

/** Famous-stock product tokens that must not leak across tickers. */
export function foreignProductHits(
  text: string,
  ctx: Identity,
): string[] {
  const identity = blobOf(ctx);
  const type = inferOutlookBusinessType(ctx);
  const hits: string[] = [];
  const allowTesla = type === "ev_energy" || TESLA_PRODUCT_RE.test(identity);
  const allowNvidia =
    /\bnvidia\b/.test(identity) || NVIDIA_PRODUCT_RE.test(identity);
  const allowMsft =
    /\bmicrosoft\b/.test(identity) || MSFT_PRODUCT_RE.test(identity);

  if (!allowTesla && TESLA_PRODUCT_RE.test(text)) hits.push("tesla-class product");
  if (!allowNvidia && NVIDIA_PRODUCT_RE.test(text)) hits.push("nvidia-class product");
  if (!allowMsft && MSFT_PRODUCT_RE.test(text)) hits.push("microsoft-class product");
  return hits;
}

export function itemHasForeignProduct(
  item: NarrativeOutlookItem,
  ctx: Identity,
): boolean {
  return foreignProductHits(outlookItemText(item), ctx).length > 0;
}

export function outlookHasForeignProducts(
  outlook: NarrativeFutureOutlook,
  ctx: Identity,
): boolean {
  const blob = [...outlook.opportunities, ...outlook.risks]
    .map(outlookItemText)
    .join(" ");
  return foreignProductHits(blob, ctx).length > 0;
}

export function stripForeignOutlookItems(
  outlook: NarrativeFutureOutlook,
  ctx: Identity,
): NarrativeFutureOutlook {
  return {
    opportunities: outlook.opportunities.filter(
      (i) => !itemHasForeignProduct(i, ctx),
    ),
    risks: outlook.risks.filter((i) => !itemHasForeignProduct(i, ctx)),
  };
}

export function issuerLockSnapshot(ctx: Identity & { symbol?: string }) {
  const businessType = inferOutlookBusinessType(ctx);
  return {
    symbol: ctx.symbol ?? null,
    name: ctx.name ?? null,
    industry: ctx.industry ?? null,
    sector: ctx.sector ?? null,
    businessType,
    rule: "Outlook is ONLY about this symbol. Use name, industry, and profileThemes. Do not mention products of other famous stocks.",
    bannedUnlessInThisProfile: [
      "FSD",
      "Full Self-Driving",
      "Robotaxi",
      "Cybercab",
      "Optimus",
      "Megapack",
      "Dojo",
      "CUDA",
      "GeForce",
      "Azure",
      "Copilot",
    ],
    outlookPlaybook: outlookPlaybook(businessType),
  };
}
