import type {
  FundamentalResult,
  MetricScore,
  PillarScore,
} from "@/lib/analysis/rating/types";

/** Preferred headline metrics for Financial Strength collapsed view. */
const FS_HEADLINE_IDS = [
  "net_debt_ebitda",
  "interest_coverage",
  "altman_z",
  "cash_to_debt",
  "current_ratio",
  "equity_to_assets",
  "roic_vs_wacc",
] as const;

/** Preferred headline metrics for Profitability collapsed view. */
const PROFIT_HEADLINE_IDS = [
  "operating_margin",
  "fcf_margin",
  "roic",
  "net_margin",
  "ocf_margin",
  "ebitda_margin",
  "roe",
] as const;

/** Preferred headline metrics for Valuation collapsed view. */
const VALUATION_HEADLINE_IDS = [
  "p_fcf",
  "pe_ttm",
  "ev_ebitda",
  "pe_forward",
  "ev_fcf",
  "p_ocf",
  "p_s",
  "ev_sales",
  "peg",
] as const;

function strengthWord(score: number | null): string {
  if (score == null) return "Unavailable";
  if (score >= 80) return "Strong";
  if (score >= 65) return "Solid";
  if (score >= 45) return "Mixed";
  if (score >= 30) return "Weak";
  return "Poor";
}

function simplifyNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const n = note.toLowerCase();

  if (n.includes("margins/ocf take priority") || n.includes("capital-intensive industry")) {
    return "Returns tempered for capital-intensive industry";
  }
  if (n.includes("fcf growth soft-weighted") || n.includes("revenue/eps dominate")) {
    return "FCF growth soft-weighted under reinvestment";
  }
  if (n.includes("reinvesting heavily") || n.includes("fcf soft-weighted")) {
    return "Reinvesting heavily; balance sheet remains solid";
  }
  if (n.includes("reinvestment soft-weighting")) {
    return "Reinvestment soft-weighting applied";
  }
  if (n.includes("growth quality is high")) {
    return "Expensive, but growth quality is high";
  }
  if (n.includes("value trap")) {
    return "Cheap on paper, but quality does not support a value bid";
  }
  if (n.includes("scale investment")) {
    return "Scale investment pressuring margins; growth quality still intact";
  }
  if (n.includes("de-emphasized") || n.includes("not primary risk")) {
    return "Leverage is less important for this business type";
  }
  if (n.includes("higher structural leverage") || n.includes("infra bands")) {
    return "Higher leverage is common for this industry";
  }
  if (n.includes("early-growth") || n.includes("liquidity over")) {
    return "Liquidity matters more than earnings here";
  }
  if (n.includes("liquidity emphasized")) {
    return "Liquidity emphasized for this business type";
  }
  if (n.includes("earnings leverage soft-weighted")) {
    return "Earnings leverage soft-weighted for growth businesses";
  }
  if (n.includes("regulatory capital") || n.includes("capital proxy")) {
    return "Using capital-efficiency proxies for this business type";
  }
  if (n.includes("safe zone")) return "Safe zone on Altman Z";
  if (n.includes("grey zone") || n.includes("gray zone")) {
    return "Grey zone on Altman Z";
  }
  if (n.includes("distress")) return "Distress zone on Altman Z";
  if (n.includes("manipulation risk")) {
    return "Elevated earnings-quality / manipulation risk";
  }
  if (n.includes("no elevated manipulation")) {
    return "No elevated manipulation flag";
  }
  if (n.includes("roic vs wacc")) return "ROIC compared with WACC";
  if (n.includes("roic vs peer")) return "ROIC compared with peer median";
  if (n.includes("industry hurdle")) return "ROIC compared with 8% hurdle";
  if (n.includes("multi-year fcf")) return "Multi-year FCF consistency";
  if (n.includes("roe limited")) {
    return "ROE limited because ROIC is weaker";
  }
  if (
    n.includes("capped — strong accrual") ||
    n.includes("distorted accrual") ||
    n.includes("cash losses dominate") ||
    n.includes("weak cash")
  ) {
    return "Strong accrual margins, weak cash conversion";
  }
  if (n.includes("less reliable for this business type") || n.includes("cash multiples skipped")) {
    return "Cash metrics less reliable for this business type";
  }
  if (n.includes("multi-year growth context")) {
    return "Multi-year growth supports a soft latest period";
  }
  if (n.includes("ev/ebit shown only when high-confidence")) {
    return "EV/EBIT gated — prefer EV/EBITDA & sales";
  }
  if (n.includes("gross margin alone")) {
    return "Gross margin alone is not enough";
  }
  if (n.includes("operating margin expansion")) {
    return "Operating margins expanding";
  }
  if (n.includes("operating margin compression")) {
    return "Operating margins compressing";
  }
  if (n.includes("roic declining")) return "ROIC declining over recent years";
  if (n.includes("roic improving")) return "ROIC improving";
  if (n.includes("strong fcf conversion")) return "Strong free-cash conversion";
  if (n.includes("weak fcf conversion")) return "Weak free-cash conversion";
  if (n.includes("primary return-on-capital") || n.includes("primary return metric")) {
    return null;
  }
  if (n.includes("secondary to roic")) return "ROE is secondary to ROIC";
  if (n.includes("multi-year roic persistence")) {
    return "Multi-year ROIC persistence";
  }
  if (n.includes("top quartile")) {
    return "Ahead of industry peers";
  }
  if (n.includes("bottom quartile")) {
    return "Behind industry peers";
  }
  if (n.includes("mid-pack")) {
    return "About average versus peers";
  }
  if (n.includes("growth softens expensive") || n.includes("softens expensive")) {
    return "Expensive vs peers, partly supported by growth";
  }
  if (n.includes("cheap multiple with weak")) {
    return "Looks cheap, but growth is weak";
  }
  if (n.includes("quality does not support")) {
    return "Cheap on paper, but quality does not support a value bid";
  }
  if (n.includes("premium moderated") || n.includes("premium valuation supported")) {
    return "Premium partly supported by growth and quality";
  }
  if (n.includes("hard penalty") || n.includes("expensive on both")) {
    return "Expensive on earnings and cash flow";
  }
  if (n.includes("hard premium on earnings")) {
    return "Expensive on earnings and cash flow, only partly justified by growth";
  }
  if (n.includes("limited cheapness")) {
    return "Cheapness limited by soft fundamentals";
  }
  if (n.includes("peer-relative valuation")) {
    return "Compared with industry peers";
  }
  if (n.includes("cheaper than own")) return "Cheaper than own history";
  if (n.includes("richer than own")) return "Richer than own history";
  if (n.includes("leverage differs")) {
    return "Peer leverage differs — prefer EV multiples";
  }
  if (n.includes("computed roic") || n.includes("roic unavailable")) {
    return null; // methodology — hide from takeaway
  }
  if (n.includes("scored vs") || n.includes("industry frame")) {
    return "Compared with industry peers";
  }
  return null;
}

function topMetrics(pillar: PillarScore, limit = 3): MetricScore[] {
  const scored = pillar.metrics.filter((m) => !m.skipped && m.score != null);

  const preferredIds =
    pillar.id === "financial_strength"
      ? FS_HEADLINE_IDS
      : pillar.id === "profitability"
        ? PROFIT_HEADLINE_IDS
        : pillar.id === "valuation"
          ? VALUATION_HEADLINE_IDS
          : null;

  if (preferredIds) {
    const preferred: MetricScore[] = [];
    for (const id of preferredIds) {
      const hit = scored.find((m) => m.id === id);
      if (hit) preferred.push(hit);
      if (preferred.length >= limit) return preferred.slice(0, limit);
    }
    const rest = scored
      .filter((m) => !preferred.some((p) => p.id === m.id))
      .sort(
        (a, b) =>
          Math.abs((b.score ?? 0) - 50) - Math.abs((a.score ?? 0) - 50),
      );
    return [...preferred, ...rest].slice(0, limit);
  }

  return scored
    .sort(
      (a, b) => Math.abs((b.score ?? 0) - 50) - Math.abs((a.score ?? 0) - 50),
    )
    .slice(0, limit);
}

function avgScore(metrics: MetricScore[]): number | null {
  const scores = metrics
    .filter((m) => m.score != null)
    .map((m) => m.score!);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** One plain-language takeaway per pillar for the executive summary. */
export function pillarTakeaway(
  pillar: PillarScore,
  fundamental: FundamentalResult,
): string {
  const score = pillar.score;
  if (score == null) return "Not enough data for this pillar";

  const industry =
    fundamental.classification.industry ??
    fundamental.classification.sector ??
    "this industry";
  const hasPeers = fundamental.peerContext.basis !== "none";
  const model = fundamental.classification.businessModel;
  const shown = topMetrics(pillar, 3);
  const noteHint = shown
    .map((m) => simplifyNote(m.note))
    .find((n): n is string => Boolean(n));

  switch (pillar.id) {
    case "financial_strength": {
      const altman = pillar.metrics.find((m) => m.id === "altman_z");
      const altmanNote = (altman?.note ?? "").toLowerCase();
      const beneish = pillar.metrics.find((m) => m.id === "beneish");
      const beneishRisk = (beneish?.note ?? "")
        .toLowerCase()
        .includes("manipulation");
      const growthProfile = fundamental.classification.growthProfile;
      const soft = fundamental.classification.reinvestmentSoftWeighting;
      const fcfLevel = pillar.metrics.find((m) => m.id === "fcf_level");
      const fcfNote = fcfLevel?.note?.toLowerCase();
      const fcfNegative =
        fcfLevel?.value != null && fcfLevel.value < 0;
      const conv = pillar.metrics.find((m) => m.id === "fcf_quality");
      const convNegativeNote = (conv?.note ?? "")
        .toLowerCase()
        .includes("both negative");

      if (altmanNote.includes("distress")) {
        return "Elevated distress risk on Altman Z — ownership risk rising";
      }
      if (beneishRisk) {
        return "Solvency mixed; earnings-quality risk elevated — caution on ownership";
      }
      if (fcfNegative || convNegativeNote) {
        if (score >= 55 && soft) {
          return "Cash generation is negative; solvency hinges on liquidity runway";
        }
        if (score < 45) {
          return "Weak cash generation — financial strength deteriorating";
        }
        return "Operating cash flow is negative; watch liquidity closely";
      }
      if (
        soft &&
        fcfNote?.includes("reinvesting") &&
        score >= 55
      ) {
        return "Reinvesting heavily; balance sheet remains solid";
      }
      if (growthProfile === "reinvesting_growth_compounder" && score >= 55) {
        return soft
          ? "Reinvesting heavily; balance sheet remains solid"
          : "Growth reinvestment with acceptable solvency";
      }
      if (growthProfile === "low_quality_fragile") {
        return score >= 45
          ? "Fragile profile — solvency needs close watching; ownership risk elevated"
          : "Financially weak — deteriorating risk signals argue against ownership";
      }
      if (model === "brokerage_capital_markets") {
        return score >= 65
          ? "Liquidity and cash look acceptable for a capital-markets business"
          : "Balance sheet needs watching for this business type";
      }
      if (model === "bank_insurance") {
        return score >= 65
          ? "Capital efficiency looks reasonable for a bank/insurer"
          : "Capital efficiency looks soft for a bank/insurer";
      }
      if (model === "reit_utilities") {
        return score >= 65
          ? "Coverage and cash flow look manageable for this industry"
          : "Leverage or cash flow looks stretched for this industry";
      }
      if (model === "early_growth") {
        return score >= 65
          ? "Liquidity looks adequate for a growth business"
          : "Liquidity looks tight for a growth business";
      }
      if (altmanNote.includes("safe")) {
        return hasPeers
          ? `Strong solvency versus ${industry} peers`
          : "Strong solvency profile";
      }
      if (noteHint && !noteHint.includes("Altman")) return noteHint;
      if (score >= 80) return `Strong balance sheet versus ${industry}`;
      if (score >= 65) {
        return hasPeers
          ? `Balance sheet looks solid among ${industry} peers`
          : "Balance sheet looks solid";
      }
      if (score >= 45) return "Balance sheet is mixed — ownership case is less clear";
      if (score >= 30) {
        return "Balance sheet looks weak — ownership risk elevated";
      }
      return "Balance sheet deteriorating — avoid / sell pressure rising";
    }
    case "profitability": {
      const fcf = pillar.metrics.find((m) => m.id === "fcf_margin");
      const ocf = pillar.metrics.find((m) => m.id === "ocf_margin");
      const roic = pillar.metrics.find((m) => m.id === "roic");
      const roe = pillar.metrics.find((m) => m.id === "roe");
      const op = pillar.metrics.find((m) => m.id === "operating_margin");
      const net = pillar.metrics.find((m) => m.id === "net_margin");
      const quality = pillar.metrics.find((m) => m.id === "quality_modifier");
      const qNote = (quality?.note ?? "").toLowerCase();
      const soft = fundamental.classification.reinvestmentSoftWeighting;
      const roicNote = (roic?.note ?? "").toLowerCase();
      const omVal = op?.value ?? null;
      const nmVal = net?.value ?? null;
      const fcfVal = fcf?.value ?? null;
      const accrualUnprofitable =
        (omVal != null && omVal < 0) || (nmVal != null && nmVal < 0);
      const fcfNegative = fcfVal != null && fcfVal < 0;
      const severeLoss =
        (omVal != null && omVal < -0.2) ||
        (nmVal != null && nmVal < -0.2) ||
        (fcfVal != null && fcfVal < -0.2);

      // Honesty first: never say "Profitable" when operating/net/FCF margins are negative
      if (accrualUnprofitable) {
        if (severeLoss) {
          return "Unprofitable; margins and cash generation are deteriorating";
        }
        if (
          (roic?.value != null && roic.value < 0) ||
          (roe?.value != null && roe.value < 0)
        ) {
          return "Operating losses continue; returns remain negative — ownership risk elevated";
        }
        return "Unprofitable; margins and cash generation are deteriorating";
      }
      if (fcfNegative) {
        // Accrual-profitable with negative FCF — do not call the business "Unprofitable"
        return soft
          ? "Operating profit intact; free cash flow pressured by reinvestment"
          : "Operating profit intact; free-cash conversion is weak";
      }

      const cashWeak =
        (fcf?.score != null && fcf.score <= 35) ||
        (ocf?.score != null && ocf.score <= 35);
      const cashStrong =
        (fcf?.score != null && fcf.score >= 70) ||
        (ocf?.score != null && ocf.score >= 70);
      const ocfSolid = ocf?.score != null && ocf.score >= 55;
      const marginsStrong = op?.score != null && op.score >= 65;
      const marginsSolid = op?.score != null && op.score >= 50;
      const roicWeak = roic?.score != null && roic.score <= 40;
      const roicModest =
        roic?.score != null && roic.score >= 40 && roic.score < 60;
      const roicStrong = roic?.score != null && roic.score >= 65;
      const roeStrong = roe?.score != null && roe.score >= 70;
      const returnsTemperedNote =
        roicNote.includes("capital-intensive") ||
        roicNote.includes("reinvestment profile") ||
        roicNote.includes("margins/ocf");

      if (
        soft &&
        qNote.includes("reinvestment") &&
        (qNote.includes("compression") || qNote.includes("conversion"))
      ) {
        return "Scale investment pressuring margins; growth quality still intact";
      }
      if (
        (returnsTemperedNote || soft) &&
        (marginsSolid || ocfSolid) &&
        (roicWeak || roicModest) &&
        score >= 50
      ) {
        return "Profitable with solid cash margins; returns on capital are modest";
      }
      if (qNote.includes("capped") || (marginsStrong && cashWeak && !soft)) {
        return "Solid operating profit, weak free-cash conversion";
      }
      if (marginsStrong && cashStrong) {
        return "High margins with strong cash conversion";
      }
      if (roeStrong && roicWeak) {
        return "Profitable but returns on capital lag peers";
      }
      if (roicStrong && cashStrong) {
        return hasPeers
          ? `Strong cash returns versus ${industry} peers`
          : "Strong cash returns on capital";
      }
      if (roicWeak && score < 50 && !returnsTemperedNote) {
        return hasPeers
          ? `Profitable but returns on capital lag ${industry} peers`
          : "Profitable but returns on capital look soft";
      }
      if (noteHint?.includes("compress") && !soft) {
        return "Margins under pressure";
      }
      if (noteHint?.includes("expand")) {
        return "Margins expanding with solid profitability";
      }
      if (
        noteHint?.includes("peers") ||
        noteHint?.includes("Ahead") ||
        noteHint?.includes("Behind") ||
        noteHint?.includes("average")
      ) {
        if (score >= 80) return "High profitability versus industry peers";
        if (score >= 65) return "Healthy profitability versus industry peers";
        if (score >= 45) return "Profitability about average versus peers";
        if (score >= 30) {
          return "Profitability lags industry peers — ownership less attractive";
        }
        return "Profitability lags peers and looks deteriorating";
      }
      if (score >= 80) return "High profitability";
      if (score >= 65) return "Solid profitability";
      if (score >= 45) return "Mixed profitability — ownership case less clear";
      if (score >= 30) {
        return "Weak profitability — ownership less attractive";
      }
      return "Profitability deteriorating — avoid pressure rising";
    }
    case "growth": {
      const soft = fundamental.classification.reinvestmentSoftWeighting;
      const rev = pillar.metrics.find((m) => m.id === "revenue_growth");
      const rev3y = pillar.metrics.find((m) => m.id === "revenue_growth_3y");
      const blend = pillar.metrics.find((m) => m.id === "growth_blend");
      const fcf = pillar.metrics.find((m) => m.id === "fcf_growth");
      const fcfSoftNote = (fcf?.note ?? "")
        .toLowerCase()
        .includes("soft-weighted");
      const blendNote = (blend?.note ?? "").toLowerCase();
      const limitedHistory =
        blendNote.includes("mainly on current") ||
        blendNote.includes("limited multi-year") ||
        rev3y?.score == null;
      const currentStrong = rev?.score != null && rev.score >= 70;
      const currentSoft = rev?.score != null && rev.score < 45;
      const multiStrong = rev3y?.score != null && rev3y.score >= 65;
      const multiSoft = rev3y?.score != null && rev3y.score < 45;

      if (soft && fcfSoftNote && currentStrong && score >= 55) {
        return multiStrong
          ? "Strong current growth; multi-year revenue supports the trend (FCF soft-weighted under reinvestment)"
          : "Strong revenue/operating growth; FCF growth soft-weighted under reinvestment";
      }
      if (limitedHistory) {
        if (currentStrong) {
          return "Growth based mainly on current period — limited multi-year history";
        }
        if (currentSoft) {
          return "Weak current growth; multi-year history too limited to offset";
        }
        return "Growth based mainly on current period — limited multi-year history";
      }
      if (currentSoft && multiStrong) {
        return "Near-term growth soft; multi-year revenue track still constructive";
      }
      if (currentStrong && multiStrong) {
        return "Strong current growth; multi-year revenue supports the trend";
      }
      if (currentStrong && multiSoft) {
        return "Strong current growth; multi-year revenue is softer";
      }
      if (currentSoft && multiSoft) {
        return "Weak current growth; multi-year revenue also soft";
      }
      if (score >= 80) {
        return hasPeers
          ? "Strong growth versus industry peers"
          : "Strong growth";
      }
      if (score >= 65) {
        return hasPeers
          ? "Solid growth, competitive among peers"
          : "Solid growth";
      }
      if (score >= 45) {
        return hasPeers
          ? "Moderate growth, mid-pack among peers"
          : "Moderate growth";
      }
      return "Growth looks soft";
    }
    case "valuation": {
      const ctx = pillar.metrics.find((m) => m.id === "valuation_context");
      const ctxNote = (ctx?.note ?? "").toLowerCase();
      const pe = pillar.metrics.find((m) => m.id === "pe_ttm");
      const pFcf = pillar.metrics.find((m) => m.id === "p_fcf");
      const expensiveEarnings = pe?.score != null && pe.score < 40;
      const expensiveCash = pFcf?.score != null && pFcf.score < 40;
      const cheapCash = pFcf?.score != null && pFcf.score >= 70;
      const soft = fundamental.classification.reinvestmentSoftWeighting;

      if (
        ctxNote.includes("quality does not support") ||
        ctxNote.includes("value trap")
      ) {
        return "Cheap on paper, but quality does not support a value bid";
      }
      if (
        ctxNote.includes("growth quality is high") ||
        (soft &&
          (expensiveEarnings || expensiveCash) &&
          score >= 45 &&
          score < 70)
      ) {
        return "Expensive, but growth quality is high";
      }
      if (
        ctxNote.includes("hard penalty") ||
        (expensiveEarnings && expensiveCash && !ctxNote.includes("partly") && !ctxNote.includes("growth quality"))
      ) {
        return "Expensive on earnings and cash flow";
      }
      if (
        ctxNote.includes("hard premium") ||
        ctxNote.includes("partly offset") ||
        ctxNote.includes("partly justified") ||
        (expensiveEarnings && expensiveCash && ctxNote.includes("growth"))
      ) {
        return "Expensive on earnings and cash flow, only partly justified by growth";
      }
      if (
        ctxNote.includes("premium valuation supported") ||
        (score >= 55 &&
          score < 70 &&
          (expensiveEarnings || expensiveCash) &&
          ctxNote.includes("growth"))
      ) {
        return "Premium valuation supported by strong growth and returns";
      }
      if (cheapCash && (noteHint?.includes("peers") || noteHint?.includes("Ahead"))) {
        return "Reasonable vs peers on cash-flow valuation";
      }
      if (ctxNote.includes("cheap multiple with weak") || noteHint?.includes("growth is weak")) {
        return "Looks cheap, but growth is weak";
      }
      if (score >= 80) return "Attractive valuation versus peers";
      if (score >= 65) {
        return hasPeers
          ? "Reasonable valuation versus peers"
          : "Reasonable valuation";
      }
      if (score >= 45) return "Valuation looks fair to full";
      if (score >= 30) return "Expensive versus peers";
      return "Very expensive versus peers";
    }
    default:
      return `${strengthWord(score)} overall`;
  }
}

/** Short plain-English outlook for the panel header. */
export function shortOutlookLine(fundamental: FundamentalResult): string {
  const { company, industry, adjustment } = fundamental.outlook;
  const adj =
    adjustment === 0
      ? "no score adjustment"
      : `${adjustment > 0 ? "+" : ""}${adjustment} to the score`;

  if (company === "Strong" && industry === "Strong") {
    return `Company and industry outlook are constructive (${adj})`;
  }
  if (company === "Strong" && industry === "Neutral") {
    return `Company outlook is constructive; industry is neutral (${adj})`;
  }
  if (company === "Strong" && industry === "Weak") {
    return `Company looks strong, but the industry outlook is soft (${adj})`;
  }
  if (company === "Weak" && industry === "Weak") {
    return `Company and industry outlook look soft (${adj})`;
  }
  if (company === "Weak") {
    return `Company outlook is cautious; industry is ${industry.toLowerCase()} (${adj})`;
  }
  if (industry === "Strong") {
    return `Industry outlook is constructive; company is neutral (${adj})`;
  }
  return `Outlook is neutral overall (${adj})`;
}

export function peerBasisShort(fundamental: FundamentalResult): string {
  const { basis, peerCount, industry } = fundamental.peerContext;
  const name = industry ?? fundamental.classification.industry ?? "Peers";
  switch (basis) {
    case "sub_industry":
      return `${name} · ${peerCount} peers`;
    case "industry":
      return `${name} group · ${peerCount} peers`;
    case "sector": {
      const sector =
        fundamental.classification.sector ??
        fundamental.peerContext.sector ??
        "Sector";
      return `${sector} (broad) · ${peerCount} peers`;
    }
    default:
      return "Absolute thresholds";
  }
}

export function formatDataAsOf(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export { topMetrics, simplifyNote, avgScore };
