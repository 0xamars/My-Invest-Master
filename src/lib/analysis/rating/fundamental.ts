import {
  CURRENT_RATIO_BANDS,
  DEBT_TO_EQUITY_BANDS,
  EV_EBITDA_BANDS,
  FCF_QUALITY_BANDS,
  GROWTH_BANDS,
  GROSS_MARGIN_BANDS,
  OPERATING_MARGIN_BANDS,
  OUTLOOK_POINTS,
  PEG_BANDS,
  PE_BANDS,
  PROFIT_MARGIN_BANDS,
  P_FCF_BANDS,
  P_S_BANDS,
  QUICK_RATIO_BANDS,
  ROE_BANDS,
  ROIC_BANDS,
  scoreAscending,
  scoreDescending,
  type Band,
} from "@/lib/analysis/rating/bands";
import {
  comparisonFrameLabel,
  classifyCapitalProfile,
} from "@/lib/analysis/rating/industry-model";
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
  growthAwareValuationScore,
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

/** Wider leverage bands for REITs / utilities. */
const REIT_DE_BANDS: Band[] = [
  { max: 80, score: 90 },
  { max: 150, score: 78 },
  { max: 250, score: 62 },
  { max: 400, score: 45 },
  { max: 600, score: 28 },
  { max: Number.POSITIVE_INFINITY, score: 12 },
];

/** Softer D/E bands for brokerage / capital markets (not primary risk). */
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

const CASH_TO_DEBT_BANDS: Band[] = [
  { max: 0.25, score: 15 },
  { max: 0.5, score: 35 },
  { max: 0.8, score: 55 },
  { max: 1.0, score: 70 },
  { max: 1.5, score: 85 },
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

function pillarFromWeighted(
  id: PillarScore["id"],
  label: string,
  parts: Array<{ metric: MetricScore; weight: number }>,
): PillarScore {
  const metrics = parts.map((p) => p.metric);
  const scored = parts
    .filter((p) => p.metric.score != null)
    .map((p) => ({ weight: p.weight, value: p.metric.score! }));
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
    version: "v1.1",
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
    peers.length >= 5 ? quartileNote(pct, peerLabel) : null;
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
  inputs: FundamentalInputs | null,
  options?: {
    applicable?: boolean;
    peers?: PeerMetricRow[];
    peerContext?: FundamentalPeerContext;
  },
): FundamentalResult {
  if (options?.applicable === false || !inputs) {
    return emptyFundamental([
      "Fundamental scoring is not applicable for this asset type.",
    ]);
  }

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
    peerContext.basis !== "none" && peers.length >= 5;

  const model = classifyCapitalProfile({
    industryKey: inputs.industryKey,
    sectorKey: inputs.sectorKey,
    industry: inputs.industry,
    profitMargins: inputs.profitMargins,
    operatingMargins: inputs.operatingMargins,
    freeCashflow: inputs.freeCashflow,
    revenueGrowth: inputs.revenueGrowth,
  });
  const frameLabel = comparisonFrameLabel({
    industry: inputs.industry,
    sector: inputs.sector,
    capitalProfile: model,
    peerBasis: peerContext.basis,
  });
  /** Heavier peer blend for industry-framed names (TSLA vs autos, etc.). */
  const strengthPeerWeight = model === "industry_peer" ? 0.45 : 0.3;

  const fcfQuality =
    inputs.freeCashflow != null &&
    inputs.operatingCashflow != null &&
    inputs.operatingCashflow !== 0
      ? inputs.freeCashflow / inputs.operatingCashflow
      : inputs.freeCashflow != null && inputs.freeCashflow > 0
        ? 0.8
        : inputs.freeCashflow != null && inputs.freeCashflow <= 0
          ? -0.1
          : null;

  const netDebtEbitda =
    inputs.totalDebt != null &&
    inputs.totalCash != null &&
    inputs.ebitda != null &&
    inputs.ebitda !== 0
      ? (inputs.totalDebt - inputs.totalCash) / inputs.ebitda
      : null;

  const cashToDebt =
    inputs.totalCash != null &&
    inputs.totalDebt != null &&
    inputs.totalDebt > 0
      ? inputs.totalCash / inputs.totalDebt
      : inputs.totalCash != null &&
          inputs.totalCash > 0 &&
          (inputs.totalDebt == null || inputs.totalDebt <= 0)
        ? 2
        : null;

  // —— Financial Strength (model-aware weights) ——
  const deBands =
    model === "reit_utilities"
      ? REIT_DE_BANDS
      : model === "brokerage_capital_markets"
        ? BROKER_DE_BANDS
        : DEBT_TO_EQUITY_BANDS;

  const deAbs =
    inputs.debtToEquity != null
      ? scoreDescending(inputs.debtToEquity, deBands)
      : null;

  const strengthParts: Array<{ metric: MetricScore; weight: number }> = [];

  if (model === "brokerage_capital_markets") {
    strengthParts.push(
      {
        weight: 0.15,
        metric: metric(
          "debt_to_equity",
          "Debt / Equity (de-emphasized)",
          inputs.debtToEquity,
          inputs.debtToEquity != null
            ? `${formatRatio(inputs.debtToEquity, 1)}%`
            : null,
          deAbs,
          "Brokerage/capital-markets model — D/E is not primary risk",
        ),
      },
      {
        weight: 0.3,
        metric: metric(
          "cash_to_debt",
          "Cash / Debt",
          cashToDebt,
          formatRatio(cashToDebt),
          cashToDebt != null
            ? scoreAscending(cashToDebt, CASH_TO_DEBT_BANDS)
            : null,
        ),
      },
      {
        weight: 0.25,
        metric: metric(
          "current_ratio",
          "Current ratio",
          inputs.currentRatio,
          formatRatio(inputs.currentRatio),
          inputs.currentRatio != null
            ? scoreAscending(inputs.currentRatio, CURRENT_RATIO_BANDS)
            : null,
        ),
      },
      {
        weight: 0.3,
        metric: metric(
          "fcf_quality",
          "FCF quality",
          fcfQuality,
          formatRatio(fcfQuality),
          fcfQuality != null
            ? scoreAscending(fcfQuality, FCF_QUALITY_BANDS)
            : null,
        ),
      },
    );
  } else if (model === "bank_insurance") {
    strengthParts.push(
      {
        weight: 0.35,
        metric: metric(
          "roa_capital",
          "ROA (capital proxy)",
          inputs.returnOnAssets,
          formatPercentDecimal(inputs.returnOnAssets),
          inputs.returnOnAssets != null
            ? scoreAscending(inputs.returnOnAssets, ROIC_BANDS)
            : null,
          "Bank/insurance — ROA used as capital-efficiency proxy; regulatory capital N/A",
        ),
      },
      {
        weight: 0.3,
        metric: metric(
          "roe_stability",
          "ROE",
          inputs.returnOnEquity,
          formatPercentDecimal(inputs.returnOnEquity),
          inputs.returnOnEquity != null
            ? scoreAscending(inputs.returnOnEquity, ROE_BANDS)
            : null,
        ),
      },
      {
        weight: 0.2,
        metric: metric(
          "cash_to_debt",
          "Cash / Debt",
          cashToDebt,
          formatRatio(cashToDebt),
          cashToDebt != null
            ? scoreAscending(cashToDebt, CASH_TO_DEBT_BANDS)
            : null,
        ),
      },
      {
        weight: 0.15,
        metric: metric(
          "fcf_quality",
          "FCF / cash quality",
          fcfQuality,
          formatRatio(fcfQuality),
          fcfQuality != null
            ? scoreAscending(fcfQuality, FCF_QUALITY_BANDS)
            : null,
        ),
      },
    );
  } else if (model === "early_growth") {
    strengthParts.push(
      {
        weight: 0.35,
        metric: metric(
          "cash_to_debt",
          "Cash / Debt (runway)",
          cashToDebt,
          formatRatio(cashToDebt),
          cashToDebt != null
            ? scoreAscending(cashToDebt, CASH_TO_DEBT_BANDS)
            : null,
          "Early-growth — liquidity over earnings",
        ),
      },
      {
        weight: 0.25,
        metric: metric(
          "current_ratio",
          "Current ratio",
          inputs.currentRatio,
          formatRatio(inputs.currentRatio),
          inputs.currentRatio != null
            ? scoreAscending(inputs.currentRatio, CURRENT_RATIO_BANDS)
            : null,
        ),
      },
      {
        weight: 0.2,
        metric: metric(
          "quick_ratio",
          "Quick ratio",
          inputs.quickRatio,
          formatRatio(inputs.quickRatio),
          inputs.quickRatio != null
            ? scoreAscending(inputs.quickRatio, QUICK_RATIO_BANDS)
            : null,
        ),
      },
      {
        weight: 0.2,
        metric: metric(
          "fcf_burn",
          "FCF quality / burn",
          fcfQuality,
          formatRatio(fcfQuality),
          fcfQuality != null
            ? scoreAscending(Math.max(fcfQuality, -0.5), FCF_QUALITY_BANDS)
            : null,
          "Negative FCF not fatal when liquidity is strong",
        ),
      },
    );
  } else {
    // industry_peer (default) + reit_utilities: score vs own industry/sector peers
    const deRel = usePeers
      ? peerAwareScore(
          deAbs,
          inputs.debtToEquity,
          peerValues(peers, "debtToEquity"),
          false,
          peerLabel,
          strengthPeerWeight,
        )
      : {
          score: deAbs,
          note:
            model === "reit_utilities"
              ? "Higher structural leverage allowed for REIT/utilities"
              : peerContext.basis === "none"
                ? "No industry peers — absolute D/E bands only"
                : null,
        };
    const crAbs =
      inputs.currentRatio != null
        ? scoreAscending(inputs.currentRatio, CURRENT_RATIO_BANDS)
        : null;
    const crRel = usePeers
      ? peerAwareScore(
          crAbs,
          inputs.currentRatio,
          peerValues(peers, "currentRatio"),
          true,
          peerLabel,
          strengthPeerWeight,
        )
      : { score: crAbs, note: null };
    const fcfAbs =
      fcfQuality != null
        ? scoreAscending(fcfQuality, FCF_QUALITY_BANDS)
        : null;
    const ndAbs =
      netDebtEbitda != null
        ? scoreDescending(netDebtEbitda, NET_DEBT_EBITDA_BANDS)
        : null;

    strengthParts.push(
      {
        weight: model === "reit_utilities" ? 0.2 : 0.25,
        metric: metric(
          "debt_to_equity",
          model === "reit_utilities"
            ? "Debt / Equity (infra bands)"
            : "Debt / Equity",
          inputs.debtToEquity,
          inputs.debtToEquity != null
            ? `${formatRatio(inputs.debtToEquity, 1)}%`
            : null,
          deRel.score,
          deRel.note ??
            (model === "reit_utilities"
              ? "Higher structural leverage allowed for REIT/utilities"
              : usePeers
                ? `Scored vs ${peerLabel}`
                : null),
        ),
      },
      {
        weight: 0.25,
        metric: metric(
          "net_debt_ebitda",
          "Net Debt / EBITDA",
          netDebtEbitda,
          formatRatio(netDebtEbitda),
          ndAbs,
          usePeers ? `Industry frame: ${peerLabel}` : null,
        ),
      },
      {
        weight: 0.25,
        metric: metric(
          "current_ratio",
          "Current ratio",
          inputs.currentRatio,
          formatRatio(inputs.currentRatio),
          crRel.score,
          crRel.note,
        ),
      },
      {
        weight: model === "reit_utilities" ? 0.3 : 0.25,
        metric: metric(
          "fcf_quality",
          "FCF quality",
          fcfQuality,
          formatRatio(fcfQuality),
          fcfAbs,
          usePeers ? `Industry frame: ${peerLabel}` : null,
        ),
      },
    );
  }

  const strength = pillarFromWeighted(
    "financial_strength",
    "Financial Strength",
    strengthParts,
  );

  // —— Profitability (peer-aware margins + honest ROIC/ROE/ROA) ——
  const gmAbs =
    inputs.grossMargins != null
      ? scoreAscending(inputs.grossMargins, GROSS_MARGIN_BANDS)
      : null;
  const omAbs =
    inputs.operatingMargins != null
      ? scoreAscending(inputs.operatingMargins, OPERATING_MARGIN_BANDS)
      : null;
  const pmAbs =
    inputs.profitMargins != null
      ? scoreAscending(inputs.profitMargins, PROFIT_MARGIN_BANDS)
      : null;

  const gm = usePeers
    ? peerAwareScore(
        gmAbs,
        inputs.grossMargins,
        peerValues(peers, "grossMargins"),
        true,
        peerLabel,
      )
    : { score: gmAbs, note: null };
  const om = usePeers
    ? peerAwareScore(
        omAbs,
        inputs.operatingMargins,
        peerValues(peers, "operatingMargins"),
        true,
        peerLabel,
      )
    : { score: omAbs, note: null };
  const pm = usePeers
    ? peerAwareScore(
        pmAbs,
        inputs.profitMargins,
        peerValues(peers, "profitMargins"),
        true,
        peerLabel,
      )
    : { score: pmAbs, note: null };

  const hasRoic = inputs.returnOnInvestedCapital != null;
  const roicAbs = hasRoic
    ? scoreAscending(inputs.returnOnInvestedCapital!, ROIC_BANDS)
    : null;
  const roeAbs =
    inputs.returnOnEquity != null
      ? scoreAscending(inputs.returnOnEquity, ROE_BANDS)
      : null;
  const roaAbs =
    inputs.returnOnAssets != null
      ? scoreAscending(inputs.returnOnAssets, ROIC_BANDS)
      : null;

  const returnsBlend =
    !hasRoic && roeAbs != null && roaAbs != null
      ? round1(clamp(0.6 * roeAbs + 0.4 * roaAbs))
      : !hasRoic && roeAbs != null
        ? roeAbs
        : !hasRoic && roaAbs != null
          ? roaAbs
          : null;

  const profitability = pillarFromWeighted("profitability", "Profitability", [
    {
      weight: 0.2,
      metric: metric(
        "gross_margin",
        "Gross margin",
        inputs.grossMargins,
        formatPercentDecimal(inputs.grossMargins),
        gm.score,
        gm.note,
      ),
    },
    {
      weight: 0.25,
      metric: metric(
        "operating_margin",
        "Operating margin",
        inputs.operatingMargins,
        formatPercentDecimal(inputs.operatingMargins),
        om.score,
        om.note,
      ),
    },
    {
      weight: 0.2,
      metric: metric(
        "profit_margin",
        "Net margin",
        inputs.profitMargins,
        formatPercentDecimal(inputs.profitMargins),
        pm.score,
        pm.note,
      ),
    },
    ...(hasRoic
      ? [
          {
            weight: 0.35,
            metric: metric(
              "roic",
              "ROIC",
              inputs.returnOnInvestedCapital,
              formatPercentDecimal(inputs.returnOnInvestedCapital),
              roicAbs,
              "Computed ROIC (NOPAT / invested capital)",
            ),
          },
        ]
      : [
          {
            weight: 0.2,
            metric: metric(
              "roe",
              "ROE",
              inputs.returnOnEquity,
              formatPercentDecimal(inputs.returnOnEquity),
              roeAbs,
              usePeers
                ? peerAwareScore(
                    roeAbs,
                    inputs.returnOnEquity,
                    peerValues(peers, "returnOnEquity"),
                    true,
                    peerLabel,
                  ).note
                : "ROIC unavailable — ROE shown separately",
            ),
          },
          {
            weight: 0.15,
            metric: metric(
              "roa",
              "ROA",
              inputs.returnOnAssets,
              formatPercentDecimal(inputs.returnOnAssets),
              roaAbs,
              "ROIC unavailable — ROA shown separately (not labeled as ROIC)",
            ),
          },
          {
            weight: 0.0,
            metric: metric(
              "returns_blend",
              "ROE+ROA blend (no ROIC)",
              returnsBlend,
              returnsBlend != null ? String(Math.round(returnsBlend)) : null,
              returnsBlend,
              "Used only when ROIC cannot be computed",
            ),
          },
        ]),
  ]);

  // Fix profitability weights when no ROIC: include blend properly
  let profitabilityFixed = profitability;
  if (!hasRoic) {
    profitabilityFixed = pillarFromWeighted("profitability", "Profitability", [
      {
        weight: 0.2,
        metric: profitability.metrics.find((m) => m.id === "gross_margin")!,
      },
      {
        weight: 0.25,
        metric: profitability.metrics.find((m) => m.id === "operating_margin")!,
      },
      {
        weight: 0.2,
        metric: profitability.metrics.find((m) => m.id === "profit_margin")!,
      },
      {
        weight: 0.2,
        metric: profitability.metrics.find((m) => m.id === "roe")!,
      },
      {
        weight: 0.15,
        metric: profitability.metrics.find((m) => m.id === "roa")!,
      },
    ]);
  }

  // —— Growth ——
  const growth = pillarFromWeighted("growth", "Growth", [
    {
      weight: 0.4,
      metric: (() => {
        const abs =
          inputs.revenueGrowth != null
            ? scoreAscending(inputs.revenueGrowth, GROWTH_BANDS)
            : null;
        const rel = usePeers
          ? peerAwareScore(
              abs,
              inputs.revenueGrowth,
              peerValues(peers, "revenueGrowth"),
              true,
              peerLabel,
              0.3,
            )
          : { score: abs, note: null };
        return metric(
          "revenue_growth",
          "Revenue growth",
          inputs.revenueGrowth,
          formatPercentDecimal(inputs.revenueGrowth),
          rel.score,
          rel.note,
        );
      })(),
    },
    {
      weight: 0.4,
      metric: (() => {
        const abs =
          inputs.earningsGrowth != null
            ? scoreAscending(inputs.earningsGrowth, GROWTH_BANDS)
            : null;
        const rel = usePeers
          ? peerAwareScore(
              abs,
              inputs.earningsGrowth,
              peerValues(peers, "earningsGrowth"),
              true,
              peerLabel,
              0.3,
            )
          : { score: abs, note: null };
        return metric(
          "eps_growth",
          "EPS growth",
          inputs.earningsGrowth,
          formatPercentDecimal(inputs.earningsGrowth),
          rel.score,
          rel.note,
        );
      })(),
    },
    {
      weight: 0.2,
      metric: metric(
        "fcf_growth",
        "FCF growth",
        inputs.fcfGrowth,
        formatPercentDecimal(inputs.fcfGrowth),
        inputs.fcfGrowth != null
          ? scoreAscending(inputs.fcfGrowth, GROWTH_BANDS)
          : null,
      ),
    },
  ]);

  // —— Valuation (growth-aware + peer) ——
  const pe =
    inputs.trailingPE != null && inputs.trailingPE > 0
      ? inputs.trailingPE
      : inputs.forwardPE != null && inputs.forwardPE > 0
        ? inputs.forwardPE
        : null;
  const growthForVal =
    inputs.earningsGrowth ??
    inputs.revenueGrowth ??
    inputs.earningsEstimateGrowth;
  const pegRatio = inputs.pegRatio;

  function valued(
    id: string,
    label: string,
    value: number | null,
    absBands: Band[],
    peerKey: keyof PeerMetricRow,
  ): MetricScore {
    if (value == null || value <= 0) {
      return metric(id, label, value, null, null);
    }
    const abs = scoreDescending(value, absBands);
    const pegAbs =
      pegRatio != null && pegRatio > 0
        ? scoreDescending(pegRatio, PEG_BANDS)
        : null;
    let score = growthAwareValuationScore(abs, growthForVal, pegAbs);
    let note: string | null = null;
    if (usePeers) {
      const pct = percentileRank(
        value,
        peerValues(peers, peerKey),
        false,
      );
      note = quartileNote(pct, peerLabel);
      score = blendAbsoluteAndPeer(score, pct, 0.3);
    }
    if (growthForVal != null && growthForVal >= 0.15 && abs < 45) {
      note = [note, "Growth softens expensive multiple"].filter(Boolean).join(" · ");
    }
    if (growthForVal != null && growthForVal < 0 && abs > 65) {
      note = [note, "Cheap multiple with weak growth"].filter(Boolean).join(" · ");
    }
    return metric(id, label, value, formatMultiple(value), score, note);
  }

  const valuation = pillarFromWeighted("valuation", "Valuation", [
    { weight: 0.25, metric: valued("pe", "P/E", pe, PE_BANDS, "trailingPE") },
    {
      weight: 0.25,
      metric: valued(
        "ev_ebitda",
        "EV/EBITDA",
        inputs.enterpriseToEbitda,
        EV_EBITDA_BANDS,
        "enterpriseToEbitda",
      ),
    },
    {
      weight: 0.2,
      metric: valued(
        "p_fcf",
        "P/FCF",
        inputs.priceToFcf,
        P_FCF_BANDS,
        "priceToFcf",
      ),
    },
    {
      weight: 0.15,
      metric: valued(
        "p_s",
        "P/S",
        inputs.priceToSales,
        P_S_BANDS,
        "priceToSales",
      ),
    },
    {
      weight: 0.15,
      metric: metric(
        "peg",
        "PEG",
        inputs.pegRatio,
        formatRatio(inputs.pegRatio),
        inputs.pegRatio != null && inputs.pegRatio > 0
          ? scoreDescending(inputs.pegRatio, PEG_BANDS)
          : null,
        "Growth-adjusted valuation",
      ),
    },
  ]);

  const pillars = [strength, profitabilityFixed, growth, valuation];
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

  const notes: string[] = [];
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
  if (model === "industry_peer") {
    notes.push(
      peerContext.basis === "none"
        ? `Assessed in ${inputs.industry ?? inputs.sector ?? "industry"} frame without enough peers — absolute thresholds.`
        : `Assessed vs ${peerContext.label} (not a generic standard bucket).`,
    );
  }

  const outlookReason = `Outlook ${company.level} / Industry ${industry.level} (${adjustment >= 0 ? "+" : ""}${adjustment}) — company ${company.reason}; industry ${industry.reason}`;

  const base = average(pillarScores);
  const score =
    base == null ? null : round1(clamp(base + adjustment, 0, 100));

  return {
    available: score != null,
    score,
    version: "v1.1",
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
    },
    peerContext,
    metricsUsed,
    metricsExpected,
    missingMetrics,
    dataAsOf: inputs.dataAsOf,
    notes,
  };
}
