import {
  FUNDAMENTAL_WEIGHT,
  TECHNICAL_WEIGHT,
} from "@/lib/analysis/rating/bands";
import { clamp, round1 } from "@/lib/analysis/rating/math";
import type {
  FundamentalResult,
  InvestSalsaRating,
  RatingConfidence,
  RatingLabel,
  TechnicalResult,
} from "@/lib/analysis/rating/types";

export function ratingLabel(score: number): RatingLabel {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Favorable";
  if (score >= 45) return "Neutral";
  if (score >= 30) return "Cautious";
  return "Weak";
}

function completenessRatio(
  fundamental: FundamentalResult,
  technical: TechnicalResult,
): number {
  const fundRatio = fundamental.available
    ? fundamental.metricsExpected > 0
      ? fundamental.metricsUsed / fundamental.metricsExpected
      : 0
    : 0;

  let techParts = 0;
  let techHave = 0;
  techParts += 1;
  if (technical.fib.score != null) techHave += 1;
  techParts += 1;
  if (technical.h4.available) techHave += 1;
  techParts += 1;
  if (technical.daily.available) techHave += 1;
  techParts += 1;
  if (technical.weekly.available) techHave += 1;
  const techRatio = techParts > 0 ? techHave / techParts : 0;

  if (!fundamental.available) {
    return techRatio * 0.75;
  }

  return fundRatio * 0.6 + techRatio * 0.4;
}

/**
 * High = broad metric coverage + granular peer context
 * Medium = partial coverage and/or industry/sector fallback peers
 * Low = sparse coverage, weak classification, or no peers
 */
export function resolveConfidence(
  fundamental: FundamentalResult,
  technical: TechnicalResult,
): RatingConfidence {
  if (!fundamental.available) {
    if (
      technical.h4.available &&
      technical.daily.available &&
      technical.weekly.available &&
      technical.fib.score != null
    ) {
      return "Medium";
    }
    return "Low";
  }

  const ratio = completenessRatio(fundamental, technical);
  const basis = fundamental.peerContext.basis;
  const classified = Boolean(fundamental.classification.industryKey);
  const sparseMissing = fundamental.missingMetrics.length >= 8;
  const manipulationRisk = fundamental.notes.some((n) =>
    n.toLowerCase().includes("manipulation risk"),
  );
  const criticalFlags =
    fundamental.classification.criticalFlags.length > 0;
  const quarterPeriod =
    fundamental.classification.fundamentalPeriod === "quarter";
  const thinStrength = fundamental.notes.some((n) =>
    n.toLowerCase().includes("financial strength coverage is thin"),
  );
  const thinProfitability = fundamental.notes.some((n) =>
    n.toLowerCase().includes("profitability coverage is thin"),
  );
  const thinValuation = fundamental.notes.some((n) =>
    n.toLowerCase().includes("valuation coverage is thin"),
  );

  if (manipulationRisk || criticalFlags) {
    return "Low";
  }

  if (quarterPeriod) {
    // Last-resort period — cap confidence at Medium
    if (ratio >= 0.55 && (basis === "sub_industry" || basis === "industry")) {
      return "Medium";
    }
    return "Low";
  }

  if (
    ratio >= 0.7 &&
    technical.h4.available &&
    basis === "sub_industry" &&
    classified &&
    !sparseMissing &&
    !thinStrength &&
    !thinProfitability &&
    !thinValuation
  ) {
    return "High";
  }

  if (
    ratio >= 0.45 &&
    (basis === "sub_industry" ||
      basis === "industry" ||
      (basis === "sector" && ratio >= 0.55))
  ) {
    return "Medium";
  }

  if (basis === "none" || !classified || sparseMissing || ratio < 0.4) {
    return "Low";
  }

  if (!technical.h4.available && ratio >= 0.55) {
    return "Medium";
  }

  return ratio >= 0.4 ? "Medium" : "Low";
}

export function combineInvestSalsaRating(
  fundamental: FundamentalResult,
  technical: TechnicalResult,
): InvestSalsaRating {
  const notes = [...fundamental.notes, ...technical.notes];
  let score: number | null = null;
  let weights = {
    fundamental: FUNDAMENTAL_WEIGHT,
    technical: TECHNICAL_WEIGHT,
  };

  if (fundamental.score != null && technical.score != null) {
    score = round1(
      clamp(
        FUNDAMENTAL_WEIGHT * fundamental.score +
          TECHNICAL_WEIGHT * technical.score,
      ),
    );
  } else if (technical.score != null && !fundamental.available) {
    score = round1(clamp(technical.score));
    weights = { fundamental: 0, technical: 1 };
    notes.push(
      "InvestSalsa Rating uses Technical only — fundamentals not applicable.",
    );
  } else if (fundamental.score != null && technical.score == null) {
    score = round1(clamp(fundamental.score));
    weights = { fundamental: 1, technical: 0 };
    notes.push(
      "InvestSalsa Rating uses Fundamental only — technicals unavailable.",
    );
  } else {
    notes.push("Unable to compute InvestSalsa Rating — insufficient data.");
  }

  const pillar = (id: string) =>
    fundamental.pillars.find((p) => p.id === id)?.score ?? null;

  const momentumParts = [
    technical.h4.score,
    technical.daily.score,
    technical.weekly.score,
  ].filter((s): s is number => s != null);
  const momentum =
    momentumParts.length > 0
      ? round1(
          momentumParts.reduce((a, b) => a + b, 0) / momentumParts.length,
        )
      : null;

  return {
    score,
    label: score != null ? ratingLabel(score) : null,
    confidence: resolveConfidence(fundamental, technical),
    weights,
    fundamental,
    technical,
    radar: [
      {
        key: "financial_strength",
        label: "Financial Strength",
        value: pillar("financial_strength"),
      },
      {
        key: "profitability",
        label: "Profitability",
        value: pillar("profitability"),
      },
      { key: "growth", label: "Growth", value: pillar("growth") },
      { key: "valuation", label: "Valuation", value: pillar("valuation") },
      {
        key: "fib",
        label: "Price structure",
        value: technical.fib.score,
      },
      {
        key: "momentum",
        label: "Momentum Condition",
        value: momentum,
      },
    ],
    notes,
    fairValue: {
      available: false,
      version: "v1",
      label: null,
      takeaway: null,
      confidence: "Low",
      price: null,
      scenarios: { base: null, upside: null, disruptive: null },
      range: { low: null, mid: null, high: null },
      bands: {
        plus30: null,
        plus10: null,
        fairLow: null,
        fairHigh: null,
        minus10: null,
        minus30: null,
      },
      upsidePctVsBase: null,
      downsidePctVsBase: null,
      upsidePctVsMid: null,
      optionality: {
        score: null,
        label: null,
        reasons: [],
        reasonCodes: [],
      },
      inputsUsed: [],
      missingInputs: [],
      notes: ["Fair Value Assessment is disabled in Analysis UI."],
      disruptiveEnabled: false,
      disruptiveDisabledReason: "Fair Value removed from product surface.",
    },
  };
}
