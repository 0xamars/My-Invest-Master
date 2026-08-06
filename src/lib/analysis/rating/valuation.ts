import {
  EV_EBIT_BANDS,
  EV_EBITDA_BANDS,
  EV_FCF_BANDS,
  EV_SALES_BANDS,
  EARNINGS_YIELD_BANDS,
  FCF_YIELD_BANDS,
  PEG_BANDS,
  PE_BANDS,
  P_FCF_BANDS,
  P_OCF_BANDS,
  P_S_BANDS,
  scoreAscending,
  scoreDescending,
  type Band,
} from "@/lib/analysis/rating/bands";
import type { CapitalProfile } from "@/lib/analysis/rating/industry-model";
import type { BusinessProfilePolicy } from "@/lib/analysis/rating/business-profile";
import {
  clamp,
  formatMultiple,
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

function scoreMultiple(input: {
  id: string;
  label: string;
  value: number | null;
  bands: Band[];
  peers: number[];
  peerWeight: number;
  peerLabel: string;
  usePeers: boolean;
}): MetricScore {
  const { value } = input;
  if (value == null || value <= 0 || !Number.isFinite(value)) {
    return metric(input.id, input.label, value, null, null);
  }
  const abs = scoreDescending(value, input.bands);
  let score = abs;
  let note: string | null = null;
  if (input.usePeers && input.peers.length >= 3) {
    // lower multiple = better → higherIsBetter false
    const pct = percentileRank(value, input.peers, false);
    note = quartileNote(pct, input.peerLabel);
    score = blendAbsoluteAndPeer(abs, pct, input.peerWeight);
  }
  return metric(
    input.id,
    input.label,
    value,
    formatMultiple(value),
    score,
    note,
  );
}

function weightedFromMetrics(
  parts: Array<{ metric: MetricScore; weight: number }>,
): number | null {
  const scored = parts
    .filter((p) => p.metric.score != null)
    .map((p) => ({ weight: p.weight, value: p.metric.score! }));
  return scored.length ? weightedAverage(scored) : null;
}

/**
 * Valuation v1.2 — price vs earnings, cash flow, and quality context.
 * Weights: earnings 30%, cash-flow 30%, enterprise/sales 20%, relative/context 20%.
 */
export function computeValuationV12(input: {
  fundamentals: FundamentalInputs;
  capitalProfile: CapitalProfile;
  peers: PeerMetricRow[];
  peerContext: FundamentalPeerContext;
  financialStrengthScore: number | null;
  profitabilityScore: number | null;
  policy?: BusinessProfilePolicy;
}): PillarScore {
  const { fundamentals: f, capitalProfile: model } = input;
  const soft = input.policy?.reinvestmentSoftWeighting === true;
  const fragile =
    input.policy?.hasCriticalFlags === true ||
    input.policy?.profile === "low_quality_fragile";
  const usePeers =
    input.peerContext.basis !== "none" && input.peers.length >= 3;
  const peerLabel =
    input.peerContext.industry ?? input.peerContext.label ?? "peers";
  /** Heavier peer blend — prefer relative over global cutoffs. */
  const peerWeight = model === "industry_peer" ? 0.45 : 0.35;
  const peers = usePeers ? input.peers : [];

  const growthRate =
    f.earningsGrowth ?? f.revenueGrowth ?? f.earningsEstimateGrowth;
  const strongGrowth = growthRate != null && growthRate >= 0.15;
  const qualityGrowth =
    strongGrowth ||
    (f.revenueGrowth != null && f.revenueGrowth >= 0.12) ||
    soft;
  const softGrowth = growthRate != null && growthRate < 0.03;
  const negativeGrowth = growthRate != null && growthRate < 0;

  const fcfConversion =
    f.freeCashflow != null &&
    f.operatingCashflow != null &&
    f.operatingCashflow !== 0
      ? f.freeCashflow / f.operatingCashflow
      : null;
  const strongCashConversion = fcfConversion != null && fcfConversion >= 0.7;
  const weakCashConversion = fcfConversion != null && fcfConversion < 0.35;

  const reinvestingNegFcf =
    soft && f.freeCashflow != null && f.freeCashflow <= 0;

  const unprofitable =
    model === "early_growth" ||
    reinvestingNegFcf ||
    (f.profitMargins != null && f.profitMargins < 0) ||
    (f.operatingMargins != null &&
      f.operatingMargins < 0 &&
      (f.trailingPE == null || f.trailingPE <= 0));

  // Prefer EV when leverage differs across peers
  const peerDes = peerValues(peers, "debtToEquity");
  let leverageDispersion = false;
  if (peerDes.length >= 5) {
    const sorted = [...peerDes].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)]!;
    const p75 = sorted[Math.floor(sorted.length * 0.75)]!;
    leverageDispersion = p75 - p25 > 80;
  }

  // —— 1) Earnings multiples 30% ——
  const peTtm = scoreMultiple({
    id: "pe_ttm",
    label: "P/E (TTM)",
    value: f.trailingPE != null && f.trailingPE > 0 ? f.trailingPE : null,
    bands: PE_BANDS,
    peers: peerValues(peers, "trailingPE"),
    peerWeight,
    peerLabel,
    usePeers,
  });
  const forwardAvailable = f.forwardPE != null && f.forwardPE > 0;
  const peFwdRaw = scoreMultiple({
    id: "pe_forward",
    label: forwardAvailable ? "Forward P/E" : "Forward P/E (using TTM)",
    value: forwardAvailable
      ? f.forwardPE
      : f.trailingPE != null && f.trailingPE > 0
        ? f.trailingPE
        : null,
    bands: PE_BANDS,
    peers: [],
    peerWeight,
    peerLabel,
    usePeers: false,
  });
  const peFwd =
    !forwardAvailable && peFwdRaw.score != null
      ? {
          ...peFwdRaw,
          note: "Forward P/E unavailable — using trailing P/E with lower confidence",
          score: round1(peFwdRaw.score * 0.9),
        }
      : peFwdRaw;
  const peg =
    f.pegRatio != null && f.pegRatio > 0
      ? metric(
          "peg",
          "PEG",
          f.pegRatio,
          formatRatio(f.pegRatio),
          scoreDescending(f.pegRatio, PEG_BANDS),
          "Growth-adjusted earnings multiple",
        )
      : metric("peg", "PEG", f.pegRatio, null, null);

  const earningsMetrics = [peTtm, peFwd, peg];
  const earningsScore = unprofitable
    ? weightedFromMetrics([
        { metric: peg, weight: 1 }, // only PEG if meaningful; else null
      ])
    : weightedFromMetrics([
        { metric: peTtm, weight: 0.45 },
        { metric: peFwd, weight: 0.3 },
        { metric: peg, weight: 0.25 },
      ]);

  // —— 2) Cash-flow multiples 30% ——
  const cashReliable = f.cashFlowReliable !== false;
  const pFcf = scoreMultiple({
    id: "p_fcf",
    label: "P/FCF",
    value: f.priceToFcf,
    bands: P_FCF_BANDS,
    peers: peerValues(peers, "priceToFcf"),
    peerWeight,
    peerLabel,
    usePeers: cashReliable,
  });
  const evFcf = scoreMultiple({
    id: "ev_fcf",
    label: "EV/FCF",
    value: f.evToFcf,
    bands: EV_FCF_BANDS,
    peers: [],
    peerWeight,
    peerLabel,
    usePeers: false,
  });
  const pOcf = scoreMultiple({
    id: "p_ocf",
    label: "P/OCF",
    value: f.priceToOcf,
    bands: P_OCF_BANDS,
    peers: [],
    peerWeight,
    peerLabel,
    usePeers: false,
  });
  const fcfYieldMetric =
    f.fcfYield != null && f.fcfYield > 0
      ? metric(
          "fcf_yield",
          "FCF yield",
          f.fcfYield,
          formatRatio(f.fcfYield),
          scoreAscending(f.fcfYield, FCF_YIELD_BANDS),
          "Free cash flow / market cap",
        )
      : metric("fcf_yield", "FCF yield", f.fcfYield ?? null, null, null);
  const earningsYieldMetric =
    f.earningsYield != null && f.earningsYield > 0
      ? metric(
          "earnings_yield",
          "Earnings yield",
          f.earningsYield,
          formatRatio(f.earningsYield),
          scoreAscending(f.earningsYield, EARNINGS_YIELD_BANDS),
          "1 / trailing P/E",
        )
      : metric(
          "earnings_yield",
          "Earnings yield",
          f.earningsYield ?? null,
          null,
          null,
        );
  if (!cashReliable) {
    for (const m of [pFcf, evFcf, pOcf, fcfYieldMetric]) {
      m.score = null;
      m.skipped = true;
      m.note =
        f.cashFlowNote ??
        "Cash multiples skipped — OCF/FCF less reliable for this business type";
    }
  }
  const cashMetrics = [pFcf, evFcf, pOcf, fcfYieldMetric, earningsYieldMetric];
  const cashScore = cashReliable
    ? weightedFromMetrics([
        { metric: pFcf, weight: 0.4 },
        { metric: evFcf, weight: 0.3 },
        { metric: pOcf, weight: 0.15 },
        { metric: fcfYieldMetric, weight: 0.15 },
      ])
    : weightedFromMetrics([{ metric: earningsYieldMetric, weight: 1 }]);

  // —— 3) Enterprise / sales 20% ——
  const evEbitda = scoreMultiple({
    id: "ev_ebitda",
    label: "EV/EBITDA",
    value:
      f.enterpriseToEbitda != null &&
      f.enterpriseToEbitda > 0 &&
      (f.ebitda == null || f.ebitda > 0)
        ? f.enterpriseToEbitda
        : null,
    bands: EV_EBITDA_BANDS,
    peers: peerValues(peers, "enterpriseToEbitda"),
    peerWeight: leverageDispersion ? Math.min(peerWeight + 0.05, 0.5) : peerWeight,
    peerLabel,
    usePeers,
  });
  const evSales = scoreMultiple({
    id: "ev_sales",
    label: "EV/Sales",
    value: f.evToSales,
    bands: EV_SALES_BANDS,
    peers: [],
    peerWeight,
    peerLabel,
    usePeers: false,
  });
  const pS = scoreMultiple({
    id: "p_s",
    label: "P/S",
    value: f.priceToSales,
    bands: P_S_BANDS,
    peers: peerValues(peers, "priceToSales"),
    peerWeight,
    peerLabel,
    usePeers,
  });
  // Prefer EV/Sales over P/S when both exist
  const salesMetric =
    evSales.score != null
      ? evSales
      : pS;
  /**
   * EV/EBIT is often noisier vs external refs than EV/EBITDA / sales.
   * Use only when high-confidence: positive EBIT and consistent vs EV/EBITDA.
   */
  const evEbitConfident =
    f.evToEbit != null &&
    f.evToEbit > 0 &&
    f.ebit != null &&
    f.ebit > 0 &&
    (f.enterpriseToEbitda == null ||
      f.enterpriseToEbitda <= 0 ||
      (f.evToEbit >= f.enterpriseToEbitda * 0.9 &&
        f.evToEbit <= f.enterpriseToEbitda * 3.5));
  const evEbit = scoreMultiple({
    id: "ev_ebit",
    label: "EV/EBIT",
    value: f.evToEbit,
    bands: EV_EBIT_BANDS,
    peers: [],
    peerWeight,
    peerLabel,
    usePeers: false,
  });
  if (!evEbitConfident && evEbit.score != null) {
    evEbit.score = null;
    evEbit.skipped = true;
    evEbit.note =
      "EV/EBIT shown only when high-confidence (stable vs EV/EBITDA)";
  } else if (evEbitConfident && evEbit.score != null) {
    evEbit.note = "High-confidence EV/EBIT — low weight vs EV/EBITDA & sales";
  }
  const enterpriseMetrics = [evEbitda, salesMetric, evEbit].filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
  );
  // Always keep both EV/Sales and P/S in details when distinct
  if (evSales.score != null && pS.value != null) {
    enterpriseMetrics.push(pS);
  } else if (evSales.score == null && pS.score != null && !enterpriseMetrics.includes(pS)) {
    enterpriseMetrics.push(pS);
  }

  const enterpriseScore = unprofitable
    ? weightedFromMetrics([
        { metric: salesMetric, weight: 0.65 },
        { metric: evEbitda, weight: 0.3 },
        { metric: evEbit, weight: evEbitConfident ? 0.05 : 0 },
      ])
    : weightedFromMetrics([
        { metric: evEbitda, weight: 0.55 },
        { metric: salesMetric, weight: 0.4 },
        { metric: evEbit, weight: evEbitConfident ? 0.05 : 0 },
      ]);

  // —— 4) Relative / contextual 20% ——
  const contextNotes: string[] = [];
  let contextBase = 55;
  let contextSignals = 0;

  // Peer relative: average of available peer-aware multiple scores
  const peerAwareScores = [peTtm, pFcf, evEbitda, pS]
    .filter((m) => m.score != null && m.note)
    .map((m) => m.score!);
  if (peerAwareScores.length >= 2) {
    contextSignals += 1;
    const peerAvg =
      peerAwareScores.reduce((a, b) => a + b, 0) / peerAwareScores.length;
    contextBase = 0.4 * contextBase + 0.6 * peerAvg;
    contextNotes.push(
      usePeers
        ? `Peer-relative valuation vs ${peerLabel}`
        : "Absolute thresholds (thin peer set)",
    );
  } else if (!usePeers) {
    contextNotes.push("Absolute thresholds — peer set unavailable");
  }

  // vs own history
  let historyMetric: MetricScore = metric(
    "pe_vs_history",
    "P/E vs 5y median",
    null,
    null,
    null,
  );
  if (
    f.trailingPE != null &&
    f.trailingPE > 0 &&
    f.trailingPeMedian5y != null &&
    f.trailingPeMedian5y > 0
  ) {
    contextSignals += 1;
    const ratio = f.trailingPE / f.trailingPeMedian5y;
    // cheaper than own history → higher score
    const histScore =
      ratio <= 0.7
        ? 90
        : ratio <= 0.9
          ? 75
          : ratio <= 1.1
            ? 55
            : ratio <= 1.3
              ? 35
              : 18;
    contextBase = 0.7 * contextBase + 0.3 * histScore;
    const note =
      ratio < 0.9
        ? "Cheaper than own 5y median P/E"
        : ratio > 1.15
          ? "Richer than own 5y median P/E"
          : "Near own 5y median P/E";
    contextNotes.push(note);
    historyMetric = metric(
      "pe_vs_history",
      "P/E vs 5y median",
      ratio,
      `${formatMultiple(f.trailingPE)} vs ${formatMultiple(f.trailingPeMedian5y)}`,
      histScore,
      note,
    );
  }

  // Growth support for premium multiples
  const earningsExpensive = earningsScore != null && earningsScore < 40;
  const cashExpensive = cashScore != null && cashScore < 40;
  const earningsCheap = earningsScore != null && earningsScore > 70;
  const cashCheap = cashScore != null && cashScore > 70;

  if (earningsExpensive || cashExpensive) {
    contextSignals += 1;
    if (fragile) {
      contextBase -= 16;
      contextNotes.push(
        "Expensive multiples with weak quality / solvency — hard penalty",
      );
    } else if (qualityGrowth && strongCashConversion) {
      contextBase += 14;
      contextNotes.push(
        "Expensive, but growth quality is high (cash conversion supportive)",
      );
    } else if (qualityGrowth && soft) {
      contextBase += 12;
      contextNotes.push(
        "Expensive, but growth quality is high — reinvestment profile",
      );
    } else if (strongGrowth) {
      contextBase += 8;
      contextNotes.push("Growth softens expensive multiples");
    } else if (softGrowth || negativeGrowth) {
      contextBase -= 12;
      contextNotes.push("Expensive multiples without growth support");
    }
  }

  if ((earningsCheap || cashCheap) && (softGrowth || negativeGrowth)) {
    contextSignals += 1;
    contextBase -= 10;
    contextNotes.push("Cheap multiple with weak growth");
  }

  // Quality support — cheapness only fully rewarded when quality is acceptable
  const fs = input.financialStrengthScore;
  const prof = input.profitabilityScore;
  const weakQuality =
    fragile ||
    (fs != null && fs < 45) ||
    (prof != null && prof < 45);
  const strongQuality =
    !fragile &&
    (fs == null || fs >= 65) &&
    (prof == null || prof >= 65);

  if ((earningsCheap || cashCheap) && weakQuality) {
    contextSignals += 1;
    contextBase -= 14;
    contextNotes.push(
      "Cheap on paper, but quality does not support a value bid (possible value trap)",
    );
  } else if (
    (earningsExpensive || cashExpensive) &&
    strongQuality &&
    qualityGrowth
  ) {
    contextSignals += 1;
    contextBase += soft ? 8 : 6;
    contextNotes.push("Expensive, but growth quality is high");
  }

  if (leverageDispersion && (pFcf.score != null || peTtm.score != null) && evEbitda.score == null) {
    contextNotes.push(
      "Peer leverage differs widely — equity multiples less comparable",
    );
  }

  if (
    weakCashConversion &&
    !soft &&
    (earningsExpensive || (peTtm.score != null && peTtm.score < 45))
  ) {
    contextSignals += 1;
    contextBase -= 10;
    contextNotes.push("Expensive earnings with weak cash-flow conversion");
  }

  const contextScore =
    contextSignals > 0 ? round1(clamp(contextBase)) : usePeers ? round1(clamp(contextBase)) : null;

  const contextMetric = metric(
    "valuation_context",
    "Relative / context",
    contextScore,
    contextScore != null ? String(Math.round(contextScore)) : null,
    contextScore,
    contextNotes.length ? contextNotes.join("; ") : null,
  );

  // —— Combine components ——
  const parts: Array<{ weight: number; value: number }> = [];
  if (unprofitable) {
    if (earningsScore != null) parts.push({ weight: 0.1, value: earningsScore });
    if (cashScore != null) parts.push({ weight: 0.25, value: cashScore });
    if (enterpriseScore != null) {
      parts.push({
        weight: cashScore == null ? 0.55 : 0.4,
        value: enterpriseScore,
      });
    }
    if (contextScore != null) parts.push({ weight: 0.25, value: contextScore });
  } else {
    if (earningsScore != null) parts.push({ weight: 0.3, value: earningsScore });
    if (cashScore != null) parts.push({ weight: 0.3, value: cashScore });
    if (enterpriseScore != null) {
      parts.push({
        weight: cashScore == null ? 0.4 : 0.2,
        value: enterpriseScore,
      });
    }
    if (contextScore != null) parts.push({ weight: 0.2, value: contextScore });
  }

  let score =
    parts.length > 0
      ? round1(clamp(weightedAverage(parts) ?? 0))
      : null;

  // Hard penalty: expensive on earnings AND cash flow
  if (
    score != null &&
    earningsExpensive &&
    cashExpensive
  ) {
    if (fragile || weakQuality) {
      score = round1(Math.min(score, 28));
      contextNotes.push(
        "Hard penalty — expensive multiples with weak quality / solvency",
      );
    } else if (qualityGrowth && (strongCashConversion || soft)) {
      score = round1(Math.min(score, soft ? 58 : 52));
      contextNotes.push(
        "Expensive, but growth quality is high — premium partly justified",
      );
    } else {
      score = round1(Math.min(score, 32));
      contextNotes.push(
        "Hard penalty — expensive on both earnings and cash-flow multiples",
      );
    }
  }

  // Value-trap cap
  if (score != null && score >= 70 && weakQuality) {
    score = round1(Math.min(score, 58));
    contextNotes.push(
      "Limited cheapness reward — Financial Strength / Profitability soft (value trap risk)",
    );
  }

  // Refresh context metric note after final caps
  contextMetric.note = contextNotes.length
    ? contextNotes.join("; ")
    : contextMetric.note;
  if (contextMetric.score == null && contextNotes.length > 0) {
    // keep display-only context when we only have notes
  }

  const allMetrics = [
    ...earningsMetrics,
    ...cashMetrics,
    ...enterpriseMetrics.filter(
      (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
    ),
    historyMetric,
    contextMetric,
  ].filter((m) => m.value != null || (m.score != null && !m.skipped));

  return {
    id: "valuation",
    label: "Valuation",
    score,
    metrics: allMetrics,
    metricsUsed: allMetrics.filter((m) => m.score != null).length,
    metricsAvailable: allMetrics.length,
  };
}
