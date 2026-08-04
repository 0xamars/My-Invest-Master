import {
  GROWTH_BANDS,
  OUTLOOK_POINTS,
  scoreAscending,
} from "@/lib/analysis/rating/bands";
import {
  fundamentalPillarWeights,
  resolveBusinessProfilePolicy,
} from "@/lib/analysis/rating/business-profile";
import { computeFinancialStrengthV12 } from "@/lib/analysis/rating/financial-strength";
import { computeProfitabilityV12 } from "@/lib/analysis/rating/profitability";
import { computeValuationV12 } from "@/lib/analysis/rating/valuation";
import {
  comparisonFrameLabel,
  classifyCapitalProfile,
} from "@/lib/analysis/rating/industry-model";
import {
  average,
  clamp,
  formatPercentDecimal,
  round1,
  weightedAverage,
} from "@/lib/analysis/rating/math";
import {
  blendAbsoluteAndPeer,
  percentileRank,
  peerValues,
  quartileNote,
} from "@/lib/analysis/rating/peer-stats";
import type {
  FundamentalInputs,
  FundamentalPeerContext,
  FundamentalResult,
  MetricScore,
  OutlookLevel,
  PeerMetricRow,
  PillarScore,
} from "@/lib/analysis/rating/types";
import {
  formatSubstitutionNotes,
  resolveFundamentalInputs,
} from "@/lib/analysis/rating/resolve-inputs";

function metric(
  id: string,
  label: string,
  value: number | null,
  display: string | null,
  score: number | null,
  note?: string | null,
): MetricScore {
  return {
    id,
    label,
    value,
    display,
    score,
    skipped: score == null,
    note: note ?? null,
  };
}

function pillarFromWeighted(
  id: PillarScore["id"],
  label: string,
  parts: Array<{ metric: MetricScore; weight: number }>,
): PillarScore {
  const scored = parts
    .filter((p) => p.metric.score != null)
    .map((p) => ({ weight: p.weight, value: p.metric.score! }));
  // Only surface metrics with a real value (or a scored context row)
  const metrics = parts
    .map((p) => p.metric)
    .filter((m) => m.value != null || (m.score != null && !m.skipped));
  return {
    id,
    label,
    score:
      scored.length > 0
        ? round1(clamp(weightedAverage(scored) ?? 0))
        : null,
    metrics,
    metricsUsed: scored.length,
    metricsAvailable: metrics.length,
  };
}

function emptyFundamental(
  notes: string[],
  peerContext?: FundamentalPeerContext,
): FundamentalResult {
  return {
    available: false,
    score: null,
    version: "v1.2",
    pillars: [],
    outlook: {
      company: "Neutral",
      industry: "Neutral",
      adjustment: 0,
      reason: "Fundamentals not applicable.",
    },
    classification: {
      businessModel: "industry_peer",
      businessModelLabel: comparisonFrameLabel({
        industry: null,
        sector: null,
        capitalProfile: "industry_peer",
        peerBasis: "none",
      }),
      industry: null,
      industryKey: null,
      sector: null,
      sectorKey: null,
      growthProfile: "cyclical_mixed",
      growthProfileLabel: "Cyclical / mixed",
      criticalFlags: [],
      reinvestmentSoftWeighting: false,
      fundamentalPeriod: null,
      periodSelectionReason: null,
      ttmSource: null,
      constructedTtmFields: [],
    },
    peerContext: peerContext ?? {
      basis: "none",
      label: "N/A",
      peerCount: 0,
      industryKey: null,
      industry: null,
      sectorKey: null,
      sector: null,
    },
    metricsUsed: 0,
    metricsExpected: 16,
    missingMetrics: [],
    dataAsOf: null,
    notes,
  };
}

function peerAwareScore(
  absolute: number | null,
  value: number | null,
  peers: number[],
  higherIsBetter: boolean,
  peerLabel: string,
  peerWeight = 0.35,
): { score: number | null; note: string | null } {
  if (absolute == null || value == null) {
    return { score: null, note: null };
  }
  const pct = percentileRank(value, peers, higherIsBetter);
  const note =
    peers.length >= 3 ? quartileNote(pct, peerLabel) : null;
  return {
    score: blendAbsoluteAndPeer(absolute, pct, peerWeight),
    note,
  };
}

function companyOutlook(inputs: FundamentalInputs): {
  level: OutlookLevel;
  reason: string;
} {
  const reasons: string[] = [];
  const rev = inputs.revenueGrowth;
  const eps = inputs.earningsGrowth;
  const revEst = inputs.revenueEstimateGrowth;
  const epsEst = inputs.earningsEstimateGrowth;

  const revStrong = rev != null && rev >= 0.1;
  const revWeak = rev != null && rev <= -0.05;
  const epsStrong = eps != null && eps >= 0.1;
  const epsWeak = eps != null && eps <= -0.05;
  const estPositive =
    (revEst != null && revEst >= 0.08) || (epsEst != null && epsEst >= 0.08);
  const estNegative =
    (revEst != null && revEst <= -0.05) || (epsEst != null && epsEst <= -0.05);

  if (revStrong) reasons.push("solid revenue growth");
  if (epsStrong) reasons.push("solid EPS growth");
  if (estPositive) reasons.push("constructive forward estimates");
  if (revWeak) reasons.push("contracting revenue");
  if (epsWeak) reasons.push("contracting EPS");
  if (estNegative) reasons.push("soft forward estimates");

  // Acceleration proxy: estimate growth above trailing growth
  if (
    rev != null &&
    revEst != null &&
    revEst > rev + 0.03 &&
    revEst > 0
  ) {
    reasons.push("accelerating revenue estimates");
  }
  if (
    eps != null &&
    epsEst != null &&
    epsEst > eps + 0.03 &&
    epsEst > 0
  ) {
    reasons.push("accelerating EPS estimates");
  }

  const bullish =
    (revStrong && epsStrong) ||
    (revStrong && estPositive) ||
    (epsStrong && estPositive) ||
    (reasons.some((r) => r.includes("accelerating")) &&
      (revStrong || epsStrong));
  const bearish =
    (revWeak && epsWeak) ||
    (revWeak && estNegative) ||
    (epsWeak && estNegative);

  if (bullish && !bearish) {
    return {
      level: "Strong",
      reason:
        reasons.length > 0
          ? `based on ${reasons.slice(0, 3).join(" and ")}`
          : "based on improving growth trends",
    };
  }
  if (bearish && !bullish) {
    return {
      level: "Weak",
      reason:
        reasons.length > 0
          ? `based on ${reasons.slice(0, 3).join(" and ")}`
          : "based on deteriorating growth trends",
    };
  }

  return {
    level: "Neutral",
    reason:
      reasons.length > 0
        ? `mixed signals (${reasons.slice(0, 2).join("; ")})`
        : "insufficient trend evidence — defaulted to Neutral",
  };
}

function industryOutlookFromPeers(
  peers: PeerMetricRow[],
): { level: OutlookLevel; reason: string } {
  if (peers.length < 5) {
    return {
      level: "Neutral",
      reason: "granular industry outlook unavailable — Neutral",
    };
  }
  const growths = peerValues(peers, "revenueGrowth");
  if (growths.length < 5) {
    return {
      level: "Neutral",
      reason: "peer growth sample too thin — Neutral",
    };
  }
  const median = [...growths].sort((a, b) => a - b)[
    Math.floor(growths.length / 2)
  ]!;
  if (median >= 0.1) {
    return {
      level: "Strong",
      reason: `peer median revenue growth ${(median * 100).toFixed(0)}%`,
    };
  }
  if (median <= -0.03) {
    return {
      level: "Weak",
      reason: `peer median revenue growth ${(median * 100).toFixed(0)}%`,
    };
  }
  return {
    level: "Neutral",
    reason: `peer median revenue growth ${(median * 100).toFixed(0)}%`,
  };
}

export function computeFundamentalScore(
  rawInputs: FundamentalInputs | null,
  options?: {
    applicable?: boolean;
    peers?: PeerMetricRow[];
    peerContext?: FundamentalPeerContext;
  },
): FundamentalResult {
  if (options?.applicable === false || !rawInputs) {
    return emptyFundamental([
      "Fundamental scoring is not applicable for this asset type.",
    ]);
  }

  const resolved = resolveFundamentalInputs(rawInputs);
  const inputs = resolved.inputs;
  const substitutionNotes = formatSubstitutionNotes(resolved);

  const peers = options?.peers ?? [];
  const peerContext = options?.peerContext ?? {
    basis: "none" as const,
    label: "No peer set (absolute thresholds)",
    peerCount: 0,
    industryKey: inputs.industryKey,
    industry: inputs.industry,
    sectorKey: inputs.sectorKey,
    sector: inputs.sector,
  };
  const peerLabel =
    peerContext.basis === "none"
      ? "peers"
      : peerContext.industry ?? peerContext.label;
  const usePeers =
    peerContext.basis !== "none" && peers.length >= 3;

  const model = classifyCapitalProfile({
    industryKey: inputs.industryKey,
    sectorKey: inputs.sectorKey,
    industry: inputs.industry,
    profitMargins: inputs.profitMargins,
    operatingMargins: inputs.operatingMargins,
    freeCashflow: inputs.freeCashflow,
    revenueGrowth: inputs.revenueGrowth,
  });
  const policy = resolveBusinessProfilePolicy(inputs);
  const frameLabel = comparisonFrameLabel({
    industry: inputs.industry,
    sector: inputs.sector,
    capitalProfile: model,
    peerBasis: peerContext.basis,
  });
  const strength = computeFinancialStrengthV12({
    fundamentals: inputs,
    capitalProfile: model,
    peers,
    peerContext,
    policy,
  });

  const profitability = computeProfitabilityV12({
    fundamentals: inputs,
    capitalProfile: model,
    peers,
    peerContext,
    policy,
  });

  // —— Growth (coverage-safe blend: current + true 3Y revenue CAGR; no forwards) ——
  const growthSoft =
    policy.reinvestmentSoftWeighting && !policy.hasCriticalFlags;
  const growthFragile =
    policy.hasCriticalFlags || policy.profile === "low_quality_fragile";

  /** Gate absurd YoY rates (e.g. tiny-base EPS explosions) from current sleeve. */
  const isUsableGrowthRate = (g: number | null | undefined): g is number =>
    g != null && Number.isFinite(g) && Math.abs(g) <= 2.5;

  const scoreGrowthRate = (g: number | null): number | null =>
    g != null ? scoreAscending(g, GROWTH_BANDS) : null;

  const revCurrent = isUsableGrowthRate(inputs.revenueGrowth)
    ? inputs.revenueGrowth
    : null;
  const opCurrent = isUsableGrowthRate(inputs.operatingIncomeGrowth)
    ? inputs.operatingIncomeGrowth
    : null;
  const epsCurrent = isUsableGrowthRate(inputs.earningsGrowth)
    ? inputs.earningsGrowth
    : null;
  const fcfCurrent =
    inputs.fcfGrowth != null && Number.isFinite(inputs.fcfGrowth)
      ? inputs.fcfGrowth
      : null;

  // Current sleeve — prefer revenue + operating income; EPS if not extreme; FCF soft-weighted
  const revAbs = scoreGrowthRate(revCurrent);
  const revRel = usePeers
    ? peerAwareScore(
        revAbs,
        revCurrent,
        peerValues(peers, "revenueGrowth"),
        true,
        peerLabel,
        0.3,
      )
    : { score: revAbs, note: null as string | null };
  let revScore = revRel.score;
  if (
    growthSoft &&
    revScore != null &&
    revCurrent != null &&
    revCurrent >= 0.2
  ) {
    revScore = round1(Math.min(100, revScore + 4));
  }

  const opScore = scoreGrowthRate(opCurrent);
  const epsAbs = scoreGrowthRate(epsCurrent);
  const epsRel = usePeers
    ? peerAwareScore(
        epsAbs,
        epsCurrent,
        peerValues(peers, "earningsGrowth"),
        true,
        peerLabel,
        0.3,
      )
    : { score: epsAbs, note: null as string | null };
  const epsExtreme =
    inputs.earningsGrowth != null &&
    Number.isFinite(inputs.earningsGrowth) &&
    !isUsableGrowthRate(inputs.earningsGrowth);

  let fcfScore: number | null = null;
  let fcfNote: string | null = null;
  if (fcfCurrent != null) {
    const raw = scoreAscending(fcfCurrent, GROWTH_BANDS);
    if (raw != null) {
      if (growthFragile) {
        fcfScore = raw;
      } else if (growthSoft) {
        const coreStrong =
          (revCurrent != null && revCurrent >= 0.1) ||
          (epsCurrent != null && epsCurrent >= 0.1) ||
          (opCurrent != null && opCurrent >= 0.1);
        if (coreStrong && raw < 55) {
          fcfScore = round1(raw * 0.25 + 58 * 0.75);
        } else {
          fcfScore = raw;
        }
        if (fcfCurrent < 0.05) {
          fcfNote =
            "FCF growth soft-weighted — reinvestment cycle; revenue/operating dominate Growth";
        }
      } else {
        fcfScore = raw;
      }
    }
  }

  const currentParts: Array<{ weight: number; value: number }> = [];
  if (revScore != null) currentParts.push({ weight: 0.4, value: revScore });
  if (opScore != null) currentParts.push({ weight: 0.3, value: opScore });
  if (epsRel.score != null && !epsExtreme) {
    currentParts.push({ weight: 0.2, value: epsRel.score });
  }
  if (fcfScore != null) {
    currentParts.push({
      weight: growthSoft ? 0.05 : growthFragile ? 0.25 : 0.1,
      value: fcfScore,
    });
  }
  const currentSleeveScore =
    currentParts.length > 0 ? weightedAverage(currentParts) : null;

  // 3Y sleeve — only true geometric CAGRs (revenue required to activate blend)
  const revCagr3y = isUsableGrowthRate(inputs.revenueGrowth3y)
    ? inputs.revenueGrowth3y
    : null;
  const epsCagr3y = isUsableGrowthRate(inputs.earningsGrowth3y)
    ? inputs.earningsGrowth3y
    : null;
  const opCagr3y = isUsableGrowthRate(inputs.operatingGrowth3y)
    ? inputs.operatingGrowth3y
    : null;
  const rev3yScore = scoreGrowthRate(revCagr3y);
  const eps3yScore = scoreGrowthRate(epsCagr3y);
  const op3yScore = scoreGrowthRate(opCagr3y);

  const historyParts: Array<{ weight: number; value: number }> = [];
  if (rev3yScore != null) historyParts.push({ weight: 0.7, value: rev3yScore });
  if (eps3yScore != null) historyParts.push({ weight: 0.15, value: eps3yScore });
  if (op3yScore != null) historyParts.push({ weight: 0.15, value: op3yScore });
  const historySleeveScore =
    rev3yScore != null && historyParts.length > 0
      ? weightedAverage(historyParts)
      : null;

  const useHistoryBlend = historySleeveScore != null;
  const growthBlendScore =
    currentSleeveScore == null
      ? historySleeveScore
      : useHistoryBlend
        ? round1(currentSleeveScore * 0.75 + historySleeveScore * 0.25)
        : round1(currentSleeveScore);

  const blendNote = useHistoryBlend
    ? "Blend 75% current period / 25% true 3Y revenue CAGR (no forward estimates)"
    : "Growth based mainly on current period — limited multi-year history";

  const growthMetrics: MetricScore[] = [
    metric(
      "revenue_growth",
      "Revenue growth",
      inputs.revenueGrowth,
      formatPercentDecimal(inputs.revenueGrowth),
      revScore,
      revRel.note ??
        (growthSoft ? "Primary growth opportunity signal" : null),
    ),
    metric(
      "operating_income_growth",
      "Operating income growth",
      inputs.operatingIncomeGrowth,
      formatPercentDecimal(inputs.operatingIncomeGrowth),
      opScore,
      opScore != null ? "Preferred with revenue in current growth sleeve" : null,
    ),
    metric(
      "eps_growth",
      "EPS growth",
      inputs.earningsGrowth,
      formatPercentDecimal(inputs.earningsGrowth),
      epsExtreme ? null : epsRel.score,
      epsExtreme
        ? "Excluded from scoring — extreme outlier rate"
        : epsRel.note,
    ),
    metric(
      "fcf_growth",
      "FCF growth",
      inputs.fcfGrowth,
      formatPercentDecimal(inputs.fcfGrowth),
      fcfScore,
      fcfNote,
    ),
    metric(
      "revenue_growth_3y",
      "Revenue CAGR (3Y)",
      inputs.revenueGrowth3y,
      formatPercentDecimal(inputs.revenueGrowth3y),
      rev3yScore,
      inputs.revenueGrowth3y != null && rev3yScore == null
        ? "3Y revenue CAGR excluded — extreme outlier rate"
        : rev3yScore != null
          ? "True geometric CAGR (≥4 annual points, positive ends)"
          : "3Y revenue CAGR unavailable — short history or non-positive ends",
    ),
    metric(
      "eps_growth_3y",
      "EPS CAGR (3Y)",
      inputs.earningsGrowth3y,
      formatPercentDecimal(inputs.earningsGrowth3y),
      eps3yScore,
      eps3yScore != null
        ? "Optional 3Y sleeve input — true CAGR only"
        : null,
    ),
    metric(
      "operating_growth_3y",
      "Operating income CAGR (3Y)",
      inputs.operatingGrowth3y,
      formatPercentDecimal(inputs.operatingGrowth3y),
      op3yScore,
      op3yScore != null
        ? "Optional 3Y sleeve input — true CAGR only"
        : null,
    ),
    metric(
      "growth_blend",
      "Growth blend",
      growthBlendScore,
      growthBlendScore != null ? `${Math.round(growthBlendScore)}` : null,
      growthBlendScore,
      blendNote,
    ),
  ].filter((m) => m.value != null || (m.score != null && !m.skipped));

  const growth: PillarScore = {
    id: "growth",
    label: "Growth",
    score:
      growthBlendScore != null
        ? round1(clamp(growthBlendScore))
        : null,
    metrics: growthMetrics,
    metricsUsed: growthMetrics.filter((m) => m.score != null).length,
    metricsAvailable: growthMetrics.length,
  };

  const valuation = computeValuationV12({
    fundamentals: inputs,
    capitalProfile: model,
    peers,
    peerContext,
    financialStrengthScore: strength.score,
    profitabilityScore: profitability.score,
    policy,
  });

  const pillars = [strength, profitability, growth, valuation];
  const pillarWeightMap = fundamentalPillarWeights(policy);
  const weightedParts = pillars
    .filter((p) => p.score != null)
    .map((p) => ({
      weight: pillarWeightMap[p.id],
      value: p.score!,
    }));
  const pillarScores = pillars
    .map((p) => p.score)
    .filter((s): s is number => s != null);

  const company = companyOutlook(inputs);
  const industry =
    peerContext.basis === "sub_industry" || peerContext.basis === "industry"
      ? industryOutlookFromPeers(peers)
      : {
          level: "Neutral" as OutlookLevel,
          reason: "Industry outlook Neutral without granular peer set",
        };

  const adjustment =
    OUTLOOK_POINTS[company.level] + OUTLOOK_POINTS[industry.level];

  const metricsUsed = pillars.reduce((sum, p) => sum + p.metricsUsed, 0);
  const metricsExpected = pillars.reduce(
    (sum, p) => sum + p.metricsAvailable,
    0,
  );

  const missingMetrics = pillars
    .flatMap((p) => p.metrics)
    .filter((m) => m.skipped)
    .map((m) => m.label);

  const notes: string[] = [...substitutionNotes];
  if (pillarScores.length === 0) {
    notes.push("Insufficient fundamental metrics to compute a score.");
  }
  if (peerContext.basis === "sector") {
    notes.push(
      "Peer comparison fell back to broad sector — confidence reduced.",
    );
  } else if (peerContext.basis === "none") {
    notes.push(
      "No peer set available — absolute thresholds only; confidence reduced.",
    );
  } else if (peerContext.basis === "industry") {
    notes.push(
      "Peer set uses industry group (sub-industry sample too thin).",
    );
  }
  if (!inputs.industryKey) {
    notes.push("Missing industry classification — default model rules applied.");
  }
  if (model === "brokerage_capital_markets") {
    notes.push(
      "Brokerage/capital-markets leverage overlay (D/E de-emphasized).",
    );
  }
  if (model === "bank_insurance") {
    notes.push(
      "Bank/insurance overlay — regulatory capital unavailable; using ROA/ROE proxies.",
    );
  }
  if (inputs.dataSource === "yahoo") {
    notes.push(
      "Fundamentals loaded via Yahoo fallback — v1.2 history fields may be sparse.",
    );
  }
  if (inputs.dataSource === "fmp") {
    notes.push("Fundamentals sourced from Financial Modeling Prep warehouse package.");
  }
  const period =
    inputs.fundamentalPeriod ?? inputs.statementPeriod ?? null;
  if (inputs.periodSourceNote) {
    notes.push(inputs.periodSourceNote);
  } else if (period === "ttm") {
    notes.push(
      "Fundamental Period: TTM — all pillars score on the same TTM snapshot.",
    );
  } else if (period === "annual") {
    notes.push(
      "Fundamental Period: Annual — all pillars score on the same annual snapshot.",
    );
  } else if (period === "quarter") {
    notes.push(
      "Fundamental Period: Quarter (last resort) — all pillars score on the same quarter snapshot.",
    );
  }
  if (inputs.periodSelectionReason && !inputs.periodSourceNote) {
    notes.push(inputs.periodSelectionReason);
  }
  if (inputs.periodCompleteness != null) {
    notes.push(
      `Selected-period core completeness: ${(inputs.periodCompleteness * 100).toFixed(0)}%.`,
    );
  }
  for (const tn of inputs.periodTrendNotes ?? []) {
    notes.push(tn);
  }
  if (
    inputs.ttmSource === "constructed" ||
    inputs.ttmSource === "hybrid"
  ) {
    const fields = inputs.constructedTtmFields ?? [];
    notes.push(
      fields.length
        ? `TTM source: ${inputs.ttmSource} — key constructed fields: ${fields.slice(0, 14).join(", ")}${fields.length > 14 ? "…" : ""}.`
        : `TTM source: ${inputs.ttmSource}.`,
    );
  } else if (inputs.fundamentalPeriod === "ttm" && inputs.ttmSource === "native") {
    notes.push("TTM source: native statement TTM endpoints.");
  }
  if (inputs.growthSourceNote) {
    notes.push(inputs.growthSourceNote);
  }
  if (inputs.cashFlowNote) {
    notes.push(inputs.cashFlowNote);
  }
  for (const n of inputs.statementQualityNotes ?? []) {
    notes.push(n);
  }
  if (inputs.statementMarginsDegraded) {
    notes.push(
      "Statement margin confidence reduced — inconsistent or incomplete same-period fields.",
    );
  }
  if (
    inputs.revenueGrowth == null &&
    inputs.earningsGrowth == null &&
    inputs.operatingIncomeGrowth == null
  ) {
    notes.push(
      "Trailing growth unavailable; forward estimates are not used (coverage-safe).",
    );
  } else if (inputs.revenueGrowth3y == null) {
    notes.push(
      "True 3Y revenue CAGR unavailable — Growth weighted to current period only.",
    );
  }
  if (
    strength.metrics.some(
      (m) =>
        m.id === "beneish" &&
        (m.note ?? "").toLowerCase().includes("manipulation risk"),
    )
  ) {
    notes.push(
      "Beneish M-Score flags elevated manipulation risk — confidence reduced.",
    );
  }
  if (
    strength.metricsUsed < 6 &&
    strength.metricsAvailable > 0
  ) {
    notes.push(
      "Financial Strength coverage is thin — several solvency metrics unavailable.",
    );
  }
  if (
    profitability.metricsUsed < 5 &&
    profitability.metricsAvailable > 0
  ) {
    notes.push(
      "Profitability coverage is thin — cash margins or ROIC history incomplete.",
    );
  }
  if (
    profitability.metrics.some((m) =>
      (m.note ?? "").toLowerCase().includes("capped — strong accrual") ||
      (m.note ?? "").toLowerCase().includes("distorted accrual") ||
      (m.note ?? "").toLowerCase().includes("cash losses dominate"),
    )
  ) {
    notes.push(
      "Profitability capped: accrual margins unreliable vs cash reality.",
    );
  }
  if (
    valuation.metricsUsed < 4 &&
    valuation.metricsAvailable > 0
  ) {
    notes.push(
      "Valuation coverage is thin — several price multiples unavailable.",
    );
  }
  if (
    valuation.metrics.some((m) =>
      (m.note ?? "").toLowerCase().includes("quality does not support"),
    )
  ) {
    notes.push(
      "Valuation cheapness limited by soft Financial Strength / Profitability.",
    );
  }
  if (model === "industry_peer") {
    notes.push(
      peerContext.basis === "none"
        ? `Assessed in ${inputs.industry ?? inputs.sector ?? "industry"} frame without enough peers — absolute thresholds.`
        : `Assessed vs ${peerContext.label} (not a generic standard bucket).`,
    );
  }

  notes.unshift(
    `Business profile: ${policy.profileLabel}`,
  );
  if (policy.reinvestmentSoftWeighting) {
    notes.splice(
      1,
      0,
      "Reinvestment soft-weighting applied — FCF/cash penalties tempered while solvency stays solid.",
    );
  }
  if (policy.hasCriticalFlags) {
    notes.splice(
      1,
      0,
      `Critical red flags (strict scoring): ${policy.criticalFlagLabels.join("; ")}.`,
    );
  }
  for (const reason of policy.reasons) {
    if (!notes.includes(reason)) notes.push(reason);
  }

  // Growth with collapsing quality should not look excellent overall
  let qualityHaircut = 0;
  if (
    policy.hasCriticalFlags &&
    growth.score != null &&
    growth.score >= 70 &&
    strength.score != null &&
    strength.score < 40
  ) {
    qualityHaircut = 8;
    notes.push(
      "Growth haircut — strong growth cannot rescue fragile balance sheet.",
    );
  }

  const outlookReason = `Outlook ${company.level} / Industry ${industry.level} (${adjustment >= 0 ? "+" : ""}${adjustment}) — company ${company.reason}; industry ${industry.reason}`;

  const base =
    weightedParts.length > 0
      ? weightedAverage(weightedParts)
      : average(pillarScores);
  const score =
    base == null
      ? null
      : round1(clamp(base + adjustment - qualityHaircut, 0, 100));

  return {
    available: score != null,
    score,
    version: "v1.2",
    pillars,
    outlook: {
      company: company.level,
      industry: industry.level,
      adjustment,
      reason: outlookReason,
    },
    classification: {
      businessModel: model,
      businessModelLabel: frameLabel,
      industry: inputs.industry,
      industryKey: inputs.industryKey,
      sector: inputs.sector,
      sectorKey: inputs.sectorKey,
      growthProfile: policy.profile,
      growthProfileLabel: policy.profileLabel,
      criticalFlags: policy.criticalFlagLabels,
      reinvestmentSoftWeighting: policy.reinvestmentSoftWeighting,
      fundamentalPeriod:
        inputs.fundamentalPeriod ?? inputs.statementPeriod ?? null,
      periodSelectionReason: inputs.periodSelectionReason ?? null,
      ttmSource: inputs.ttmSource ?? null,
      constructedTtmFields: inputs.constructedTtmFields ?? [],
    },
    peerContext,
    metricsUsed,
    metricsExpected,
    missingMetrics,
    dataAsOf: inputs.dataAsOf,
    notes,
  };
}
