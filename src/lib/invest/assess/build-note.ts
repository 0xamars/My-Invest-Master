import { ratingLabel } from "@/lib/analysis/rating/combine";
import { extensionLocationHint, priceZoneLocationHint } from "@/lib/analysis/rating/tech-palette";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import { classifyRevenuePath } from "@/lib/portfolio/holding-expand";
import { formatScore10 } from "@/lib/analysis/rating/score-display";
import type { AnalysisPackage } from "@/lib/market-data/warehouse/types";
import { buildTapeRead } from "@/lib/invest/assess/tape-read";
import type { TapeSeriesMeta } from "@/lib/invest/assess/tape-series";
import type { AssessNoteSection, CallVerdict } from "@/lib/invest/assess/types";

function pillarScore(
  rating: InvestSalsaRating,
  id: "financial_strength" | "profitability" | "growth" | "valuation",
): number | null {
  return rating.fundamental.pillars.find((p) => p.id === id)?.score ?? null;
}

function killSwitches(input: {
  tape: TapeSeriesMeta;
  rating: InvestSalsaRating;
  pkg: AnalysisPackage;
}): string[] {
  const { tape, rating, pkg } = input;
  const lines: string[] = [];
  const annual = tape.annual;

  if (!tape.vehicle.isOperatingTape) {
    lines.push(
      tape.vehicle.reason ??
        "This vehicle is not scored as an operating company.",
    );
    return lines;
  }

  const revenues = annual
    .map((p) => p.revenue)
    .filter((v): v is number => v != null);
  const revPath = classifyRevenuePath(revenues);
  if (revPath === "stall") {
    lines.push("Revenue path stalled over the fiscal years on tape.");
  } else if (revPath == null && revenues.length < 2) {
    lines.push("Revenue path is unknown — fewer than two fiscal years loaded.");
  }

  const latest = annual[annual.length - 1];
  if (latest) {
    const cash = latest.cashAndSti;
    const debt = latest.totalDebt;
    const fcf = latest.freeCashFlow;
    if (cash != null && debt != null && cash < debt && (fcf == null || fcf < 0)) {
      lines.push(
        "Cash plus short-term investments trail total debt while free cash flow is weak or negative.",
      );
    }

    const ni = latest.netIncome;
    const sbc = latest.stockBasedCompensation;
    if (ni != null && sbc != null && ni > 0 && sbc / ni > 0.35) {
      lines.push(
        "Stock-based compensation (SBC) is a large share of net income — earnings quality needs scrutiny.",
      );
    } else if (ni != null && ni < 0 && sbc != null && sbc > 0) {
      lines.push("The company is losing money while paying meaningful SBC.");
    }
  }

  const fs = pillarScore(rating, "financial_strength");
  if (fs != null && fs < 35) {
    lines.push("Financial strength pillar is weak on the InvestSalsa rating.");
  }

  const growth = pillarScore(rating, "growth");
  const valuation = pillarScore(rating, "valuation");
  if (growth != null && growth >= 70 && valuation != null && valuation < 40) {
    lines.push(
      "Growth looks strong but valuation is rich — the market may already price a lot of success.",
    );
  }

  const profile = pkg.profile;
  if (!profile?.exchange && !profile?.industry) {
    lines.push("Listing and research coverage look thin — treat estimates cautiously.");
  }

  if (rating.fundamental.classification.criticalFlags.length > 0) {
    lines.push(
      `Critical flags: ${rating.fundamental.classification.criticalFlags.join(", ")}.`,
    );
  }

  return lines;
}

function deriveCall(input: {
  rating: InvestSalsaRating;
  tape: TapeSeriesMeta;
  kills: string[];
}): { verdict: CallVerdict; why: string } {
  const { rating, tape, kills } = input;

  if (!tape.vehicle.isOperatingTape) {
    return {
      verdict: "Pass",
      why: "Fundamentals target operating companies — use tape and technicals only here.",
    };
  }

  if (kills.some((k) => k.includes("Critical flags"))) {
    return {
      verdict: "Pass",
      why: "Critical fundamental flags fail — wait for a cleaner setup.",
    };
  }

  if (kills.some((k) => k.includes("Revenue path stalled"))) {
    return {
      verdict: "Wait",
      why: "Revenue path stalled — need evidence growth re-accelerated.",
    };
  }

  const score = rating.score;
  const zone = rating.technical.fib.zoneLabel;
  const label = score != null ? ratingLabel(score) : null;

  if (score == null) {
    return {
      verdict: "Wait",
      why: "Rating is incomplete — wait for a fuller tape.",
    };
  }

  if (score >= 75 && (label === "Strong" || label === "Favorable")) {
    const stretched = rating.technical.fib.zone === "red" || rating.technical.fib.zone === "orange";
    if (stretched) {
      return {
        verdict: "Hold",
        why: "Quality score is strong but price sits in a stretched zone — patience on entry.",
      };
    }
    return {
      verdict: "Buy",
      why: `InvestSalsa rating is ${label?.toLowerCase() ?? "favorable"} with ${zone ?? "neutral"} price structure.`,
    };
  }

  if (score >= 55) {
    return {
      verdict: "Hold",
      why: `Balanced setup — ${label?.toLowerCase() ?? "neutral"} rating without a clear margin of safety.`,
    };
  }

  if (score >= 40) {
    return {
      verdict: "Wait",
      why: "Mixed fundamentals and technicals — not enough edge to add capital.",
    };
  }

  return {
    verdict: "Pass",
    why: "Weak combined rating — better opportunities likely exist.",
  };
}

function buildTrendRead(tape: TapeSeriesMeta): string {
  return buildTapeRead({
    name: tape.name,
    symbol: tape.symbol,
    annual: tape.annual,
    isOperatingTape: tape.vehicle.isOperatingTape,
  });
}

function buildTechnicals(rating: InvestSalsaRating): string {
  const zone = rating.technical.fib.zoneLabel;
  const zoneHint = priceZoneLocationHint(rating.technical.fib.zone);
  const extensions = [
    rating.technical.h4,
    rating.technical.daily,
    rating.technical.weekly,
  ]
    .filter((tf) => tf.available && tf.heatLabel)
    .map((tf) => {
      const hint = extensionLocationHint(tf.heat);
      return `${tf.label}: ${tf.heatLabel}${hint ? ` (${hint})` : ""}`;
    });

  const parts: string[] = [];
  if (zone) {
    parts.push(`Price zone is ${zone}${zoneHint ? ` — ${zoneHint}` : ""}.`);
  } else {
    parts.push("Price zone is unavailable.");
  }

  if (extensions.length > 0) {
    parts.push(`Mean extension: ${extensions.join("; ")}.`);
  }

  const rel = rating.technical.fib.relative;
  if (rel.available && rel.statusLabel) {
    parts.push(`Drawdown versus its own history: ${rel.statusLabel.toLowerCase()}.`);
  }

  return parts.join(" ");
}

function buildIndustryOutlook(pkg: AnalysisPackage): string {
  const outlook = pkg.estimateOutlook;
  const hasEstimates =
    outlook.available ||
    (pkg.estimates?.length ?? 0) > 0 ||
    (pkg.growth?.length ?? 0) > 0;

  const industry = pkg.profile?.industry ?? "this industry";
  const mustGoRight = `Over the next two to five years, ${industry} needs durable demand and the company must execute without blowing up the balance sheet.`;

  if (!hasEstimates) {
    return `${mustGoRight} Estimates incomplete in the warehouse — do not invent forward price-to-earnings (P/E).`;
  }

  const fy1Pe = outlook.forwardPe ?? null;
  const peLine =
    fy1Pe != null && fy1Pe > 0
      ? `Street FY1 forward P/E is about ${fy1Pe.toFixed(1)}× when estimates loaded.`
      : "Forward P/E is not available from loaded estimates.";

  return `${mustGoRight} ${peLine} What kills it: growth stalls, margins compress, or leverage rises while cash flow weakens.`;
}

function buildDissent(input: {
  call: CallVerdict;
  rating: InvestSalsaRating;
}): string {
  const growth = pillarScore(input.rating, "growth");
  const valuation = pillarScore(input.rating, "valuation");
  const fs = pillarScore(input.rating, "financial_strength");

  const conflicts: string[] = [];
  if (growth != null && valuation != null && growth >= 65 && valuation < 45) {
    conflicts.push("Growth pillar is strong while Valuation is rich.");
  }
  if (fs != null && fs < 40 && input.call === "Buy") {
    conflicts.push("Financial strength is weak despite an upbeat Call.");
  }
  if (
    input.rating.technical.fib.zone === "red" &&
    (input.call === "Buy" || input.call === "Add")
  ) {
    conflicts.push("Price sits in a hot zone while the Call is constructive.");
  }

  if (conflicts.length === 0) {
    return "Rating pillars and the Call line up — no major dissent.";
  }

  return `${conflicts.join(" ")} Recommendation stands: ${input.call}.`;
}

function buildDecision(call: CallVerdict, rating: InvestSalsaRating): string {
  const zone = rating.technical.fib.zone;
  if (call === "Buy" && (zone === "orange" || zone === "red")) {
    return "Add on a dip or wait for a better price zone?";
  }
  if (call === "Wait") {
    return "Wait for a fuller tape or move on?";
  }
  if (call === "Hold") {
    return "Hold the full position or trim into strength?";
  }
  return "No decision.";
}

function buildIndustryLine(pkg: AnalysisPackage, rating: InvestSalsaRating): string {
  const industry = pkg.profile?.industry ?? "Unknown industry";
  const outlook = rating.fundamental.outlook.industry;
  const quality =
    outlook === "Strong"
      ? "Above-average compounding potential if execution holds."
      : outlook === "Weak"
        ? "Headwinds or cyclicality limit long-horizon compounding."
        : "Mixed — selective winners, not a blanket tailwind.";
  return `${industry} — ${quality}`;
}

function buildAssetLine(pkg: AnalysisPackage, rating: InvestSalsaRating): string {
  const name = pkg.profile?.name ?? pkg.symbol;
  const model = rating.fundamental.classification.businessModelLabel;
  const note = rating.fundamental.classification.growthProfileLabel;
  return `${name} operates as ${model.toLowerCase()} — ${note}.`;
}

function buildGrowthLine(pkg: AnalysisPackage, rating: InvestSalsaRating): string {
  const growth = pillarScore(rating, "growth");
  const outlook = pkg.estimateOutlook;
  const revGrowth = outlook.impliedRevenueGrowth;
  const parts: string[] = [];

  if (growth != null) {
    parts.push(
      `Operating growth quality scores ${formatScore10(growth)}/10 on the rating engine.`,
    );
  }

  if (revGrowth != null && Number.isFinite(revGrowth)) {
    const pct = Math.abs(revGrowth) <= 1.5 ? revGrowth * 100 : revGrowth;
    parts.push(
      `Street revenue estimate (FY1) implies about ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% — label: estimate.`,
    );
  } else {
    parts.push("Street revenue estimate unavailable — do not invent growth.");
  }

  parts.push(
    "Shareholder return depends on free cash flow, buybacks, and dividends actually paid.",
  );

  return parts.join(" ");
}

export function buildAssessNote(input: {
  pkg: AnalysisPackage;
  rating: InvestSalsaRating;
  tape: TapeSeriesMeta;
}): AssessNoteSection {
  const kills = killSwitches(input);
  const call = deriveCall({ rating: input.rating, tape: input.tape, kills });

  return {
    call,
    industry: buildIndustryLine(input.pkg, input.rating),
    asset: buildAssetLine(input.pkg, input.rating),
    growth: buildGrowthLine(input.pkg, input.rating),
    fundamentals: {
      killSwitches: kills,
      trendRead: buildTrendRead(input.tape),
    },
    technicals: buildTechnicals(input.rating),
    industryOutlook: buildIndustryOutlook(input.pkg),
    dissent: buildDissent({ call: call.verdict, rating: input.rating }),
    decision: buildDecision(call.verdict, input.rating),
  };
}

export function buildMoveVerdict(input: {
  owned: boolean;
  call: CallVerdict;
  portfolioPercent: number | null;
}): string {
  if (!input.owned) {
    if (input.call === "Buy" || input.call === "Add") return "Buy";
    if (input.call === "Wait") return "Wait";
    return "Pass";
  }

  const concentrated =
    input.portfolioPercent != null && input.portfolioPercent >= 15;

  if (input.call === "Pass" || input.call === "Sell") return "Sell";
  if (input.call === "Trim") return "Trim";
  if (concentrated && (input.call === "Buy" || input.call === "Add")) {
    return "Hold";
  }
  if (input.call === "Buy") return "Add";
  if (input.call === "Hold" || input.call === "Wait") return "Hold";
  return "Hold";
}

export function buildBookAndPlan(input: {
  owned: boolean;
  portfolioPercent: number | null;
  positionValue: number | null;
  leftoverLine: string | null;
}): string {
  const parts: string[] = [];

  if (!input.owned) {
    parts.push("You do not hold this name in the Primary portfolio.");
  } else {
    const pct =
      input.portfolioPercent != null
        ? `${input.portfolioPercent.toFixed(1)}% of the book`
        : "unknown % of the book";
    const val =
      input.positionValue != null
        ? `position value loaded`
        : "position value unknown";
    parts.push(`Primary book: ${pct}, ${val}.`);
  }

  if (input.leftoverLine) {
    parts.push(input.leftoverLine);
  } else {
    parts.push("Budget leftover: unknown or none this month.");
  }

  return parts.join(" ");
}
