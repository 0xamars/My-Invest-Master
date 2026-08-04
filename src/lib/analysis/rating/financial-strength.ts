import {
  CURRENT_RATIO_BANDS,
  DEBT_TO_EQUITY_BANDS,
  FCF_QUALITY_BANDS,
  QUICK_RATIO_BANDS,
  scoreAscending,
  scoreDescending,
  type Band,
} from "@/lib/analysis/rating/bands";
import type { CapitalProfile } from "@/lib/analysis/rating/industry-model";
import type { BusinessProfilePolicy } from "@/lib/analysis/rating/business-profile";
import { estimateCashRunwayYears } from "@/lib/analysis/rating/business-profile";
import {
  average,
  clamp,
  formatMultiple,
  formatPercentDecimal,
  formatRatio,
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
  MetricScore,
  PeerMetricRow,
  PillarScore,
} from "@/lib/analysis/rating/types";

const REIT_DE_BANDS: Band[] = [
  { max: 80, score: 90 },
  { max: 150, score: 78 },
  { max: 250, score: 62 },
  { max: 400, score: 45 },
  { max: 600, score: 28 },
  { max: Number.POSITIVE_INFINITY, score: 12 },
];

const BROKER_DE_BANDS: Band[] = [
  { max: 100, score: 80 },
  { max: 200, score: 70 },
  { max: 350, score: 58 },
  { max: 500, score: 45 },
  { max: Number.POSITIVE_INFINITY, score: 35 },
];

const NET_DEBT_EBITDA_BANDS: Band[] = [
  { max: 0, score: 95 },
  { max: 1, score: 85 },
  { max: 2, score: 70 },
  { max: 3.5, score: 50 },
  { max: 5, score: 30 },
  { max: Number.POSITIVE_INFINITY, score: 12 },
];

const INTEREST_COVERAGE_BANDS: Band[] = [
  { max: 1, score: 10 },
  { max: 2, score: 30 },
  { max: 4, score: 50 },
  { max: 8, score: 70 },
  { max: 15, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

const EQUITY_ASSETS_BANDS: Band[] = [
  { max: 0.15, score: 15 },
  { max: 0.25, score: 35 },
  { max: 0.35, score: 55 },
  { max: 0.5, score: 75 },
  { max: 0.65, score: 88 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

const CASH_TO_DEBT_BANDS: Band[] = [
  { max: 0.25, score: 15 },
  { max: 0.5, score: 35 },
  { max: 0.8, score: 55 },
  { max: 1.0, score: 70 },
  { max: 1.5, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

const FCF_TO_DEBT_BANDS: Band[] = [
  { max: 0, score: 10 },
  { max: 0.05, score: 30 },
  { max: 0.1, score: 50 },
  { max: 0.2, score: 70 },
  { max: 0.35, score: 85 },
  { max: Number.POSITIVE_INFINITY, score: 95 },
];

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

function componentScore(metrics: MetricScore[]): number | null {
  const scores = metrics
    .filter((m) => m.score != null)
    .map((m) => m.score!);
  return scores.length ? average(scores) : null;
}

function altmanBand(z: number): { label: string; score: number } {
  if (z >= 2.99) return { label: "Safe", score: 90 };
  if (z >= 1.81) return { label: "Grey", score: 55 };
  return { label: "Distress", score: 20 };
}

function piotroskiScoreMap(f: number): number {
  // 0–9 → 0–100-ish with mid at ~5
  return clamp((f / 9) * 100);
}

function beneishPenalty(m: number): { score: number; note: string } {
  // M > -1.78 often flagged as possible manipulator
  if (m > -1.78) {
    return {
      score: 25,
      note: "Elevated manipulation risk — confidence reduced",
    };
  }
  return { score: 80, note: "No elevated manipulation flag" };
}

function roicVsHurdleScore(
  roic: number | null,
  wacc: number | null,
  peerMedianRoic: number | null,
): { score: number | null; note: string | null; display: string | null } {
  if (roic == null) {
    return { score: null, note: null, display: null };
  }
  if (wacc != null) {
    const spread = roic - wacc;
    const score =
      spread >= 0.08
        ? 95
        : spread >= 0.04
          ? 85
          : spread >= 0.01
            ? 70
            : spread >= 0
              ? 55
              : spread >= -0.03
                ? 35
                : 15;
    return {
      score,
      note: "ROIC vs WACC",
      display: `${formatPercentDecimal(roic)} vs WACC ${formatPercentDecimal(wacc)}`,
    };
  }
  if (peerMedianRoic != null) {
    const spread = roic - peerMedianRoic;
    const score =
      spread >= 0.05
        ? 90
        : spread >= 0.02
          ? 75
          : spread >= -0.02
            ? 55
            : spread >= -0.05
              ? 35
              : 20;
    return {
      score,
      note: "ROIC vs peer median",
      display: `${formatPercentDecimal(roic)} vs peers ${formatPercentDecimal(peerMedianRoic)}`,
    };
  }
  // Industry hurdle fallback ~8%
  const hurdle = 0.08;
  const spread = roic - hurdle;
  const score =
    spread >= 0.08
      ? 90
      : spread >= 0.03
        ? 75
        : spread >= 0
          ? 55
          : spread >= -0.04
            ? 35
            : 15;
  return {
    score,
    note: "ROIC vs 8% industry hurdle",
    display: `${formatPercentDecimal(roic)} vs 8% hurdle`,
  };
}

/**
 * Financial Strength v1.2 — solvency & resilience engine.
 * Weights: leverage 35%, liquidity 20%, FCF quality 15%, distress 15%,
 * capital effectiveness 10%, quality flags 5%.
 * Reinvesting growth profiles soft-weight FCF penalties when no critical flags.
 */
export function computeFinancialStrengthV12(input: {
  fundamentals: FundamentalInputs;
  capitalProfile: CapitalProfile;
  peers: PeerMetricRow[];
  peerContext: FundamentalPeerContext;
  policy?: BusinessProfilePolicy;
}): PillarScore {
  const { fundamentals: f, capitalProfile: model } = input;
  const policy = input.policy;
  const soft = policy?.reinvestmentSoftWeighting === true;
  const strict = policy?.hasCriticalFlags === true;
  const usePeers =
    input.peerContext.basis !== "none" && input.peers.length >= 3;
  const peerLabel =
    input.peerContext.industry ?? input.peerContext.label ?? "peers";
  const peerWeight = model === "industry_peer" ? 0.4 : 0.3;

  const deBands =
    model === "reit_utilities"
      ? REIT_DE_BANDS
      : model === "brokerage_capital_markets"
        ? BROKER_DE_BANDS
        : DEBT_TO_EQUITY_BANDS;

  const leverageMetric = f.netDebtToEbitda ?? f.debtToEbitda;
  const netDebtAbs =
    leverageMetric != null
      ? scoreDescending(leverageMetric, NET_DEBT_EBITDA_BANDS)
      : null;

  const deAbs =
    f.debtToEquity != null
      ? scoreDescending(f.debtToEquity, deBands)
      : null;
  const deRel =
    usePeers && f.debtToEquity != null
      ? (() => {
          const pct = percentileRank(
            f.debtToEquity!,
            peerValues(input.peers, "debtToEquity"),
            false,
          );
          return {
            score:
              deAbs != null
                ? blendAbsoluteAndPeer(deAbs, pct, peerWeight)
                : deAbs,
            note: quartileNote(pct, peerLabel),
          };
        })()
      : {
          score: deAbs,
          note:
            model === "brokerage_capital_markets"
              ? "Leverage is less important for this business type"
              : model === "reit_utilities"
                ? "Higher leverage is common for this industry"
                : null,
        };

  const equityAssetsAbs =
    f.equityToAssets != null
      ? scoreAscending(f.equityToAssets, EQUITY_ASSETS_BANDS)
      : null;
  const interestAbs =
    f.interestCoverage != null
      ? scoreAscending(f.interestCoverage, INTEREST_COVERAGE_BANDS)
      : null;

  // Banks: de-emphasize corporate D/E; use equity/assets + coverage proxies
  const leverageMetrics: MetricScore[] = [];
  if (model === "bank_insurance") {
    leverageMetrics.push(
      metric(
        "equity_to_assets",
        "Equity / Assets",
        f.equityToAssets,
        formatPercentDecimal(f.equityToAssets),
        equityAssetsAbs,
        "Capital proxy for banks/insurers",
      ),
      metric(
        "roa_capital",
        "ROA (capital proxy)",
        f.returnOnAssets,
        formatPercentDecimal(f.returnOnAssets),
        f.returnOnAssets != null
          ? clamp(
              f.returnOnAssets >= 0.015
                ? 85
                : f.returnOnAssets >= 0.008
                  ? 65
                  : f.returnOnAssets >= 0
                    ? 45
                    : 20,
            )
          : null,
      ),
      metric(
        "debt_to_equity",
        "Debt / Equity (soft)",
        f.debtToEquity,
        f.debtToEquity != null ? `${formatRatio(f.debtToEquity, 1)}%` : null,
        deRel.score != null ? round1(deRel.score * 0.7 + 40 * 0.3) : null,
        "De-emphasized for financial intermediaries",
      ),
    );
  } else if (model === "brokerage_capital_markets") {
    leverageMetrics.push(
      metric(
        "debt_to_equity",
        "Debt / Equity",
        f.debtToEquity,
        f.debtToEquity != null ? `${formatRatio(f.debtToEquity, 1)}%` : null,
        deRel.score != null ? round1(Math.max(deRel.score, 40)) : null,
        "Leverage is less important for this business type",
      ),
      metric(
        "net_debt_ebitda",
        "Net Debt / EBITDA",
        leverageMetric,
        formatRatio(leverageMetric),
        netDebtAbs,
      ),
      metric(
        "equity_to_assets",
        "Equity / Assets",
        f.equityToAssets,
        formatPercentDecimal(f.equityToAssets),
        equityAssetsAbs,
      ),
    );
  } else if (model === "early_growth") {
    leverageMetrics.push(
      metric(
        "net_debt_ebitda",
        "Net Debt / EBITDA",
        leverageMetric,
        formatRatio(leverageMetric),
        netDebtAbs != null ? round1(Math.max(netDebtAbs, 35)) : null,
        "Earnings leverage soft-weighted for growth businesses",
      ),
      metric(
        "debt_to_equity",
        "Debt / Equity",
        f.debtToEquity,
        f.debtToEquity != null ? `${formatRatio(f.debtToEquity, 1)}%` : null,
        deRel.score,
        deRel.note,
      ),
      metric(
        "equity_to_assets",
        "Equity / Assets",
        f.equityToAssets,
        formatPercentDecimal(f.equityToAssets),
        equityAssetsAbs,
      ),
    );
  } else {
    leverageMetrics.push(
      metric(
        "net_debt_ebitda",
        "Net Debt / EBITDA",
        leverageMetric,
        formatRatio(leverageMetric),
        netDebtAbs,
      ),
      metric(
        "debt_to_equity",
        "Debt / Equity",
        f.debtToEquity,
        f.debtToEquity != null ? `${formatRatio(f.debtToEquity, 1)}%` : null,
        deRel.score,
        deRel.note,
      ),
      metric(
        "equity_to_assets",
        "Equity / Assets",
        f.equityToAssets,
        formatPercentDecimal(f.equityToAssets),
        equityAssetsAbs,
      ),
      metric(
        "interest_coverage",
        "Interest Coverage",
        f.interestCoverage,
        formatRatio(f.interestCoverage, 1),
        interestAbs,
      ),
    );
  }

  if (model !== "bank_insurance" && interestAbs != null) {
    // ensure interest coverage present for standard/reit if not already
    if (!leverageMetrics.some((m) => m.id === "interest_coverage")) {
      leverageMetrics.push(
        metric(
          "interest_coverage",
          "Interest Coverage",
          f.interestCoverage,
          formatRatio(f.interestCoverage, 1),
          interestAbs,
        ),
      );
    }
  }

  const leverage = componentScore(leverageMetrics);

  // Liquidity 20%
  const cashRatio = f.cashToShortTermDebt ?? f.cashToDebt;
  const crAbs =
    f.currentRatio != null
      ? scoreAscending(f.currentRatio, CURRENT_RATIO_BANDS)
      : null;
  const crRel =
    usePeers && f.currentRatio != null
      ? blendAbsoluteAndPeer(
          crAbs!,
          percentileRank(
            f.currentRatio,
            peerValues(input.peers, "currentRatio"),
            true,
          ),
          peerWeight,
        )
      : crAbs;

  const liquidityMetrics: MetricScore[] = [
    metric(
      "current_ratio",
      "Current Ratio",
      f.currentRatio,
      formatRatio(f.currentRatio),
      crRel,
      usePeers ? quartileNote(
        percentileRank(
          f.currentRatio ?? 0,
          peerValues(input.peers, "currentRatio"),
          true,
        ),
        peerLabel,
      ) : null,
    ),
    metric(
      "quick_ratio",
      "Quick Ratio",
      f.quickRatio,
      formatRatio(f.quickRatio),
      f.quickRatio != null
        ? scoreAscending(f.quickRatio, QUICK_RATIO_BANDS)
        : null,
    ),
    metric(
      "cash_to_debt",
      f.cashToShortTermDebt != null ? "Cash / ST Debt" : "Cash / Debt",
      cashRatio,
      formatRatio(cashRatio),
      cashRatio != null
        ? scoreAscending(cashRatio, CASH_TO_DEBT_BANDS)
        : null,
      model === "early_growth" || model === "brokerage_capital_markets"
        ? "Liquidity emphasized for this business type"
        : null,
    ),
  ];
  const liquidity = componentScore(liquidityMetrics);

  // Cash generation 15% (down-weighted for reinvesting growth without red flags)
  // Financial intermediaries: standard OCF/FCF often reflects float — skip/down-weight
  const cashReliable = f.cashFlowReliable !== false;
  const fcfQuality =
    cashReliable &&
    f.freeCashflow != null &&
    f.operatingCashflow != null &&
    f.operatingCashflow !== 0
      ? f.freeCashflow / f.operatingCashflow
      : cashReliable && f.freeCashflow != null && f.freeCashflow > 0
        ? 0.8
        : cashReliable && f.freeCashflow != null && f.freeCashflow <= 0
          ? -0.1
          : null;

  let fcfLevelScore: number | null = null;
  let fcfLevelNote: string | null = null;
  if (!cashReliable) {
    fcfLevelScore = null;
    fcfLevelNote =
      f.cashFlowNote ??
      "OCF/FCF less reliable for this business type — skipped in Financial Strength";
  } else if (f.freeCashflow != null) {
    if (f.freeCashflow > 0) {
      fcfLevelScore = 80;
    } else if (soft && !strict) {
      const runway = estimateCashRunwayYears(f);
      if (runway != null && runway < 1) {
        fcfLevelScore = 22;
        fcfLevelNote =
          "Severe burn vs cash runway — reinvestment soft-weighting limited";
      } else if (runway != null && runway < 2) {
        fcfLevelScore = 38;
        fcfLevelNote =
          "Reinvesting heavily; cash runway under 2 years — mild penalty retained";
      } else {
        fcfLevelScore = runway != null && runway >= 3 ? 55 : 48;
        fcfLevelNote =
          "Reinvesting heavily; balance sheet remains solid — FCF soft-weighted";
      }
    } else {
      fcfLevelScore = f.freeCashflow > -1e8 ? 40 : 15;
      if (strict) {
        fcfLevelNote = "Strict FCF scoring — critical red flags present";
      }
    }
  }

  let fcfConversionScore =
    fcfQuality != null
      ? scoreAscending(Math.max(fcfQuality, -0.5), FCF_QUALITY_BANDS)
      : null;
  let fcfConversionNote: string | null = null;
  const bothCashNegative =
    f.freeCashflow != null &&
    f.freeCashflow < 0 &&
    f.operatingCashflow != null &&
    f.operatingCashflow < 0;
  if (!cashReliable) {
    fcfConversionNote =
      f.cashFlowNote ??
      "OCF/FCF less reliable for this business type — skipped in Financial Strength";
  } else if (bothCashNegative) {
    fcfConversionScore = 12;
    fcfConversionNote =
      "FCF conversion not rewarded — OCF and FCF are both negative";
  } else if (
    soft &&
    !strict &&
    fcfConversionScore != null &&
    fcfConversionScore < 40
  ) {
    fcfConversionScore = round1(fcfConversionScore * 0.45 + 48 * 0.55);
    fcfConversionNote =
      "FCF conversion soft-weighted — reinvestment profile, not distress";
  }

  let fcfToDebtScore =
    cashReliable && f.fcfToDebt != null
      ? scoreAscending(f.fcfToDebt, FCF_TO_DEBT_BANDS)
      : null;
  if (
    cashReliable &&
    soft &&
    !strict &&
    fcfToDebtScore != null &&
    fcfToDebtScore < 35
  ) {
    fcfToDebtScore = round1(fcfToDebtScore * 0.5 + 42 * 0.5);
  }

  const cashMetrics: MetricScore[] = [
    metric(
      "fcf_level",
      "Free Cash Flow",
      f.freeCashflow,
      f.freeCashflow != null
        ? `${(f.freeCashflow / 1e9).toFixed(2)}B`
        : null,
      fcfLevelScore,
      fcfLevelNote,
    ),
    metric(
      "fcf_stability",
      "FCF Stability",
      f.fcfStability,
      f.fcfStability != null ? String(Math.round(f.fcfStability)) : null,
      !cashReliable
        ? null
        : soft && !strict && f.fcfStability != null && f.fcfStability < 40
          ? round1(f.fcfStability * 0.5 + 45 * 0.5)
          : f.fcfStability,
      !cashReliable
        ? f.cashFlowNote ??
          "FCF stability skipped — cash metrics unreliable for this business type"
        : soft && !strict
          ? "Multi-year FCF consistency soft-weighted for reinvestment"
          : "Multi-year FCF consistency",
    ),
    metric(
      "fcf_to_debt",
      "FCF / Debt",
      f.fcfToDebt,
      formatRatio(f.fcfToDebt),
      fcfToDebtScore,
      !cashReliable
        ? f.cashFlowNote
        : soft && !strict && f.fcfToDebt != null && f.fcfToDebt <= 0
          ? "FCF/Debt soft-weighted — reinvestment pressure"
          : null,
    ),
    metric(
      "fcf_quality",
      "FCF Conversion",
      fcfQuality,
      formatRatio(fcfQuality),
      fcfConversionScore,
      fcfConversionNote,
    ),
  ];
  const cashGen = cashReliable ? componentScore(cashMetrics) : null;

  // Distress / Altman 15%
  let altmanMetric: MetricScore;
  if (f.altmanZScore != null) {
    const band = altmanBand(f.altmanZScore);
    altmanMetric = metric(
      "altman_z",
      `Altman Z (${band.label})`,
      f.altmanZScore,
      formatRatio(f.altmanZScore, 2),
      band.score,
      `${band.label} zone`,
    );
  } else {
    altmanMetric = metric("altman_z", "Altman Z", null, null, null);
  }
  const distress = altmanMetric.score;

  // Capital effectiveness 10%
  const peerRoics = peerValues(input.peers, "returnOnInvestedCapital");
  const peerMedianRoic =
    peerRoics.length >= 3
      ? [...peerRoics].sort((a, b) => a - b)[Math.floor(peerRoics.length / 2)]!
      : null;
  const roicCmp = roicVsHurdleScore(
    f.returnOnInvestedCapital,
    f.wacc,
    peerMedianRoic,
  );
  const capitalMetric = metric(
    "roic_vs_wacc",
    "ROIC vs hurdle",
    f.returnOnInvestedCapital,
    roicCmp.display,
    roicCmp.score,
    roicCmp.note,
  );
  const capitalEff = capitalMetric.score;

  // Quality flags 5%
  const qualityMetrics: MetricScore[] = [];
  if (f.piotroskiScore != null) {
    qualityMetrics.push(
      metric(
        "piotroski",
        "Piotroski F-Score",
        f.piotroskiScore,
        `${Math.round(f.piotroskiScore)} / 9`,
        piotroskiScoreMap(f.piotroskiScore),
      ),
    );
  }
  if (f.beneishMScore != null) {
    const b = beneishPenalty(f.beneishMScore);
    qualityMetrics.push(
      metric(
        "beneish",
        "Beneish M-Score",
        f.beneishMScore,
        formatRatio(f.beneishMScore, 2),
        b.score,
        b.note,
      ),
    );
  }
  const quality = componentScore(qualityMetrics);

  const parts: Array<{ weight: number; value: number }> = [];
  if (leverage != null) {
    parts.push({
      weight: model === "brokerage_capital_markets" ? 0.2 : soft ? 0.32 : 0.35,
      value: leverage,
    });
  }
  if (liquidity != null) {
    parts.push({
      weight: !cashReliable
        ? 0.35
        : soft
          ? 0.3
          : model === "brokerage_capital_markets" || model === "early_growth"
            ? 0.3
            : 0.2,
      value: liquidity,
    });
  }
  if (cashGen != null) {
    parts.push({
      weight: soft
        ? 0.08
        : model === "reit_utilities"
          ? 0.2
          : model === "brokerage_capital_markets"
            ? 0.08
            : 0.15,
      value: cashGen,
    });
  }
  if (distress != null) {
    parts.push({ weight: soft ? 0.18 : 0.15, value: distress });
  }
  if (capitalEff != null) parts.push({ weight: 0.1, value: capitalEff });
  if (quality != null) parts.push({ weight: 0.05, value: quality });

  // Renormalize weights among available components
  const score =
    parts.length > 0
      ? round1(clamp(weightedAverage(parts) ?? 0))
      : null;

  const allMetrics = [
    ...leverageMetrics,
    ...liquidityMetrics,
    ...cashMetrics,
    altmanMetric,
    capitalMetric,
    ...qualityMetrics,
  ].filter((m) => m.value != null || (m.score != null && !m.skipped));

  return {
    id: "financial_strength",
    label: "Financial Strength",
    score,
    metrics: allMetrics,
    metricsUsed: allMetrics.filter((m) => m.score != null).length,
    metricsAvailable: allMetrics.length,
  };
}
