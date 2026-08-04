import {
  EBITDA_MARGIN_BANDS,
  FCF_MARGIN_BANDS,
  FCF_QUALITY_BANDS,
  GROSS_MARGIN_BANDS,
  OCF_MARGIN_BANDS,
  OPERATING_MARGIN_BANDS,
  PROFIT_MARGIN_BANDS,
  ROE_BANDS,
  ROIC_BANDS,
  scoreAscending,
} from "@/lib/analysis/rating/bands";
import type { CapitalProfile } from "@/lib/analysis/rating/industry-model";
import {
  isCapitalIntensiveIndustry,
} from "@/lib/analysis/rating/industry-model";
import type { BusinessProfilePolicy } from "@/lib/analysis/rating/business-profile";
import {
  clamp,
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

/**
 * Accrual margins look extreme vs cash reality (one-offs / tiny bases).
 * Ticker-agnostic — used to down-weight net/EBITDA and lean on cash/operating.
 */
function hasDistortedAccrualMargins(f: FundamentalInputs): boolean {
  const nm = f.profitMargins;
  const eb = f.ebitdaMargin;
  const om = f.operatingMargins;
  const ocf = f.ocfMargin;
  const fcf = f.fcfMargin;
  const cashDeepNeg =
    (ocf != null && ocf < -0.1) || (fcf != null && fcf < -0.15);
  if (!cashDeepNeg) {
    // Still flag absurd absolute accrual levels without cash confirmation
    if (nm != null && Math.abs(nm) > 0.9) return true;
    if (eb != null && Math.abs(eb) > 1.2) return true;
    return false;
  }
  if (nm != null && nm > 0.2) return true;
  if (eb != null && eb > 0.35) return true;
  if (nm != null && ocf != null && nm - ocf > 0.35) return true;
  if (eb != null && ocf != null && eb - ocf > 0.45) return true;
  // Positive accrual operating/net while cash hemorrhaging
  if (om != null && om > 0.05 && cashDeepNeg) return true;
  return false;
}

function peerBlend(
  absolute: number | null,
  value: number | null,
  peers: number[],
  peerWeight: number,
  peerLabel: string,
): { score: number | null; note: string | null } {
  if (absolute == null || value == null) {
    return { score: absolute, note: null };
  }
  if (peers.length < 5) {
    return { score: absolute, note: null };
  }
  const pct = percentileRank(value, peers, true);
  return {
    score: blendAbsoluteAndPeer(absolute, pct, peerWeight),
    note: quartileNote(pct, peerLabel),
  };
}

/**
 * Quality / trend modifier score (0–100).
 * Starts at 55 (neutral) and applies documented boosts/penalties.
 * Reinvestment profiles soften margin-compression / FCF-conversion penalties when scale is growing.
 */
function qualityModifierScore(
  f: FundamentalInputs,
  policy?: BusinessProfilePolicy,
): {
  score: number | null;
  notes: string[];
  metrics: MetricScore[];
} {
  const notes: string[] = [];
  const metrics: MetricScore[] = [];
  let base = 55;
  let signals = 0;
  const soft = policy?.reinvestmentSoftWeighting === true;
  const grossRising =
    f.grossProfit != null &&
    f.grossProfitPrior != null &&
    f.grossProfit > f.grossProfitPrior;
  const strongRev = f.revenueGrowth != null && f.revenueGrowth >= 0.1;

  const opTrend = f.operatingMarginTrend;
  if (opTrend != null) {
    signals += 1;
    if (opTrend >= 0.02) {
      base += 12;
      notes.push("Operating margin expansion");
    } else if (opTrend >= 0.005) {
      base += 6;
      notes.push("Modest operating margin expansion");
    } else if (opTrend <= -0.02) {
      if (soft && strongRev && grossRising) {
        base -= 5;
        notes.push(
          "Operating margin compression soft-weighted — scale investment with rising gross profit",
        );
      } else if (soft && strongRev) {
        base -= 8;
        notes.push(
          "Operating margin compression tempered — reinvestment with strong revenue growth",
        );
      } else {
        base -= 14;
        notes.push("Operating margin compression");
      }
    } else if (opTrend <= -0.005) {
      if (soft && strongRev) {
        base -= 2;
        notes.push("Mild margin pressure under reinvestment soft-weighting");
      } else {
        base -= 7;
        notes.push("Modest operating margin compression");
      }
    } else {
      notes.push("Stable operating margins");
    }
    metrics.push(
      metric(
        "op_margin_trend",
        "Op. margin trend",
        opTrend,
        formatPercentDecimal(opTrend),
        opTrend >= 0.02
          ? 85
          : opTrend >= 0.005
            ? 70
            : opTrend <= -0.02
              ? soft && strongRev
                ? 45
                : 25
              : opTrend <= -0.005
                ? soft && strongRev
                  ? 50
                  : 40
                : 55,
        notes[notes.length - 1] ?? null,
      ),
    );
  }

  const roicTrend = f.roicTrend;
  if (roicTrend != null) {
    signals += 1;
    if (roicTrend <= -0.03) {
      base -= soft && strongRev ? 8 : 16;
      notes.push(
        soft && strongRev
          ? "ROIC softening tempered — growth reinvestment profile"
          : "ROIC declining over multi-year window",
      );
    } else if (roicTrend <= -0.01) {
      base -= soft && strongRev ? 3 : 8;
      notes.push("ROIC softening");
    } else if (roicTrend >= 0.02) {
      base += 10;
      notes.push("ROIC improving");
    }
    metrics.push(
      metric(
        "roic_trend",
        "ROIC trend",
        roicTrend,
        formatPercentDecimal(roicTrend),
        roicTrend <= -0.03
          ? soft && strongRev
            ? 40
            : 20
          : roicTrend <= -0.01
            ? 35
            : roicTrend >= 0.02
              ? 85
              : 55,
        notes[notes.length - 1] ?? null,
      ),
    );
  }

  const fcfConv =
    f.freeCashflow != null &&
    f.operatingCashflow != null &&
    f.operatingCashflow !== 0
      ? f.freeCashflow / f.operatingCashflow
      : null;
  if (fcfConv != null) {
    signals += 1;
    const bothNegative =
      f.freeCashflow != null &&
      f.freeCashflow < 0 &&
      f.operatingCashflow != null &&
      f.operatingCashflow < 0;
    let convScore = bothNegative
      ? 12
      : scoreAscending(Math.max(fcfConv, -0.5), FCF_QUALITY_BANDS);
    if (bothNegative) {
      base -= 10;
      notes.push(
        "FCF conversion not rewarded — OCF and FCF are both negative",
      );
    } else if (fcfConv >= 0.75) {
      base += 12;
      notes.push("Strong FCF conversion");
    } else if (fcfConv >= 0.55) {
      base += 5;
      notes.push("Solid FCF conversion");
    } else if (fcfConv < 0.2) {
      if (soft && strongRev) {
        base -= 5;
        convScore = round1(Math.max(convScore, 42));
        notes.push(
          "Weak FCF conversion soft-weighted — reinvestment-driven, not structural decay",
        );
      } else {
        base -= 14;
        notes.push("Weak FCF conversion");
      }
    } else if (fcfConv < 0.4) {
      if (soft && strongRev) {
        base -= 2;
        convScore = round1(Math.max(convScore, 48));
        notes.push("Soft FCF conversion tempered for reinvestment profile");
      } else {
        base -= 7;
        notes.push("Soft FCF conversion");
      }
    }
    metrics.push(
      metric(
        "fcf_conversion",
        "FCF conversion",
        fcfConv,
        formatRatio(fcfConv),
        convScore,
        notes[notes.length - 1] ?? null,
      ),
    );
  }

  if (signals === 0) {
    return { score: null, notes: [], metrics };
  }

  const score = round1(clamp(base));
  metrics.unshift(
    metric(
      "quality_modifier",
      "Quality / trend",
      score,
      String(Math.round(score)),
      score,
      notes.length ? notes.join("; ") : "Neutral quality overlay",
    ),
  );

  return { score, notes, metrics };
}

/**
 * Profitability v1.2 — operating + cash profitability engine.
 * Weights: core margins 40%, cash profitability 25%, returns on capital 25%,
 * quality/trend modifiers 10%.
 */
export function computeProfitabilityV12(input: {
  fundamentals: FundamentalInputs;
  capitalProfile: CapitalProfile;
  peers: PeerMetricRow[];
  peerContext: FundamentalPeerContext;
  policy?: BusinessProfilePolicy;
}): PillarScore {
  const { fundamentals: f, capitalProfile: model } = input;
  const soft = input.policy?.reinvestmentSoftWeighting === true;
  const strict = input.policy?.hasCriticalFlags === true;
  const capitalIntensive = isCapitalIntensiveIndustry({
    industryKey: f.industryKey,
    sectorKey: f.sectorKey,
    industry: f.industry,
    sector: f.sector,
  });
  /** Margins/OCF-led scoring for capital-heavy or reinvesting growth (no red flags). */
  const returnsTempered = (capitalIntensive || soft) && !strict;
  const cashReliable = f.cashFlowReliable !== false;
  const distortedAccruals = hasDistortedAccrualMargins(f);
  const accrualUnprofitable =
    (f.operatingMargins != null && f.operatingMargins < 0) ||
    (f.profitMargins != null && f.profitMargins < 0);
  const severeCashBurn = f.fcfMargin != null && f.fcfMargin < -0.15;
  const lossMaking = accrualUnprofitable || severeCashBurn;
  const thinOrDegraded =
    f.statementMarginsDegraded === true ||
    (f.periodCompleteness != null && f.periodCompleteness < 0.7);
  const usePeers =
    input.peerContext.basis !== "none" && input.peers.length >= 3;
  const peerLabel =
    input.peerContext.industry ?? input.peerContext.label ?? "peers";
  const peerWeight = model === "industry_peer" ? 0.4 : 0.3;
  const peers = usePeers ? input.peers : [];

  // —— 1) Core margins 40% (GM down-weighted so it cannot dominate) ——
  const gmAbs =
    f.grossMargins != null
      ? scoreAscending(f.grossMargins, GROSS_MARGIN_BANDS)
      : null;
  const omAbs =
    f.operatingMargins != null
      ? scoreAscending(f.operatingMargins, OPERATING_MARGIN_BANDS)
      : null;
  const nmAbs =
    f.profitMargins != null
      ? scoreAscending(f.profitMargins, PROFIT_MARGIN_BANDS)
      : null;
  const ebitdaAbs =
    f.ebitdaMargin != null
      ? scoreAscending(f.ebitdaMargin, EBITDA_MARGIN_BANDS)
      : null;

  const gm = peerBlend(
    gmAbs,
    f.grossMargins,
    peerValues(peers, "grossMargins"),
    peerWeight * 0.7, // lighter peer pull on gross
    peerLabel,
  );
  const om = peerBlend(
    omAbs,
    f.operatingMargins,
    peerValues(peers, "operatingMargins"),
    peerWeight,
    peerLabel,
  );
  const nm = peerBlend(
    nmAbs,
    f.profitMargins,
    peerValues(peers, "profitMargins"),
    peerWeight,
    peerLabel,
  );

  // Early cash scores needed for distorted-accrual caps
  const fcfMAbs =
    f.fcfMargin != null
      ? scoreAscending(f.fcfMargin, FCF_MARGIN_BANDS)
      : null;
  const ocfMAbs =
    f.ocfMargin != null
      ? scoreAscending(f.ocfMargin, OCF_MARGIN_BANDS)
      : null;
  const cashFloor =
    ocfMAbs != null || fcfMAbs != null
      ? Math.min(ocfMAbs ?? 100, fcfMAbs ?? 100)
      : 22;

  // Soft-floor weak margin scores only when still accrual-profitable
  const softenNeg = (s: number | null) =>
    !accrualUnprofitable &&
    (model === "early_growth" || soft) &&
    s != null &&
    s < 30
      ? round1(s * 0.65 + 35 * 0.35)
      : s;

  const capDistorted = (s: number | null): number | null => {
    if (s == null || !distortedAccruals) return s;
    return round1(Math.min(s, Math.max(cashFloor, 12)));
  };

  const marginMetrics: MetricScore[] = [
    metric(
      "gross_margin",
      "Gross margin",
      f.grossMargins,
      formatPercentDecimal(f.grossMargins),
      gm.score,
      gm.note,
    ),
    metric(
      "operating_margin",
      "Operating margin",
      f.operatingMargins,
      formatPercentDecimal(f.operatingMargins),
      softenNeg(om.score),
      om.note,
    ),
    metric(
      "net_margin",
      "Net margin",
      f.profitMargins,
      formatPercentDecimal(f.profitMargins),
      capDistorted(softenNeg(nm.score)),
      distortedAccruals
        ? "Net margin down-weighted — extreme vs cash reality"
        : nm.note,
    ),
    metric(
      "ebitda_margin",
      "EBITDA margin",
      f.ebitdaMargin,
      formatPercentDecimal(f.ebitdaMargin),
      capDistorted(softenNeg(ebitdaAbs)),
      distortedAccruals
        ? "EBITDA margin down-weighted — extreme vs cash reality"
        : null,
    ),
  ];

  // Weighted average within core margins: OM 35%, NM 25%, EBITDA 25%, GM 15%
  // Distorted accruals: lean on operating margin; shrink net/EBITDA influence
  const marginParts: Array<{ weight: number; value: number }> = [];
  const gmM = marginMetrics.find((m) => m.id === "gross_margin")!;
  const omM = marginMetrics.find((m) => m.id === "operating_margin")!;
  const nmM = marginMetrics.find((m) => m.id === "net_margin")!;
  const ebM = marginMetrics.find((m) => m.id === "ebitda_margin")!;
  if (gmM.score != null) {
    marginParts.push({
      weight: distortedAccruals ? 0.1 : 0.15,
      value: gmM.score,
    });
  }
  if (omM.score != null) {
    marginParts.push({
      weight: distortedAccruals ? 0.55 : 0.35,
      value: omM.score,
    });
  }
  if (nmM.score != null) {
    marginParts.push({
      weight: distortedAccruals ? 0.15 : 0.25,
      value: nmM.score,
    });
  }
  if (ebM.score != null) {
    marginParts.push({
      weight: distortedAccruals ? 0.2 : 0.25,
      value: ebM.score,
    });
  }
  const coreMargins =
    marginParts.length > 0 ? weightedAverage(marginParts) : null;

  // —— 2) Cash profitability ——
  const cashMetrics: MetricScore[] = cashReliable
    ? [
        metric(
          "fcf_margin",
          "FCF margin",
          f.fcfMargin,
          formatPercentDecimal(f.fcfMargin),
          soft && fcfMAbs != null && fcfMAbs < 35
            ? round1(fcfMAbs * 0.5 + 45 * 0.5)
            : fcfMAbs,
          soft && f.fcfMargin != null && f.fcfMargin < 0
            ? "FCF margin soft-weighted — reinvestment profile"
            : null,
        ),
        metric(
          "ocf_margin",
          "OCF margin",
          f.ocfMargin,
          formatPercentDecimal(f.ocfMargin),
          ocfMAbs,
          returnsTempered
            ? "Cash from operations emphasized for this business type"
            : null,
        ),
      ]
    : [
        metric(
          "fcf_margin",
          "FCF margin",
          f.fcfMargin,
          formatPercentDecimal(f.fcfMargin),
          null,
          f.cashFlowNote ??
            "OCF/FCF less reliable for this business type — skipped in Profitability",
        ),
        metric(
          "ocf_margin",
          "OCF margin",
          f.ocfMargin,
          formatPercentDecimal(f.ocfMargin),
          null,
          f.cashFlowNote ??
            "OCF/FCF less reliable for this business type — skipped in Profitability",
        ),
      ];
  const cashParts: Array<{ weight: number; value: number }> = [];
  const fcfMScore = cashMetrics[0]!.score;
  if (fcfMScore != null) {
    cashParts.push({
      weight: returnsTempered ? 0.3 : soft ? 0.35 : 0.55,
      value: fcfMScore,
    });
  }
  if (cashReliable && ocfMAbs != null) {
    cashParts.push({
      weight: returnsTempered ? 0.7 : soft ? 0.65 : 0.45,
      value: ocfMAbs,
    });
  }
  const cashProfit =
    cashParts.length > 0 ? weightedAverage(cashParts) : null;

  // —— 3) Returns on capital ——
  const marginsHealthy =
    (omM.score != null && omM.score >= 55) ||
    (!distortedAccruals && ebM.score != null && ebM.score >= 55) ||
    (coreMargins != null && coreMargins >= 55);
  const ocfHealthy = cashReliable && ocfMAbs != null && ocfMAbs >= 55;

  /** Temper absolute return scores when capital-intensive / reinvesting and cash/margins hold up. */
  const temperReturnScore = (
    score: number | null,
    label: string,
    rawReturn: number | null,
  ): { score: number | null; note: string | null } => {
    if (score == null) return { score: null, note: null };
    // Deeply negative returns stay harsh — do not pull toward neutral
    if (rawReturn != null && rawReturn < -0.05) {
      return { score, note: null };
    }
    if (lossMaking) {
      return { score, note: null };
    }
    if (!returnsTempered || score >= 50) {
      return { score, note: null };
    }
    if (!(marginsHealthy || ocfHealthy)) {
      return { score, note: null };
    }
    // Keep as caution, not collapse — pull toward mid-40s/low-50s
    const softened = round1(score * 0.4 + 50 * 0.6);
    return {
      score: softened,
      note: capitalIntensive
        ? `${label} tempered — capital-intensive industry; margins/OCF take priority`
        : `${label} tempered — reinvestment profile; margins/OCF take priority`,
    };
  };

  const hasRoic = f.returnOnInvestedCapital != null;
  const roicAbs = hasRoic
    ? scoreAscending(f.returnOnInvestedCapital!, ROIC_BANDS)
    : null;
  const roicPeer = peerBlend(
    roicAbs,
    f.returnOnInvestedCapital,
    peerValues(peers, "returnOnInvestedCapital"),
    // Heavier peer blend for capital-intensive — relative context matters more
    returnsTempered ? Math.min(peerWeight + 0.15, 0.55) : peerWeight,
    peerLabel,
  );
  const roicTempered = temperReturnScore(
    roicPeer.score,
    "ROIC",
    f.returnOnInvestedCapital,
  );

  let roeAbs =
    f.returnOnEquity != null
      ? scoreAscending(f.returnOnEquity, ROE_BANDS)
      : null;
  const roePeer = peerBlend(
    roeAbs,
    f.returnOnEquity,
    peerValues(peers, "returnOnEquity"),
    returnsTempered ? Math.min(peerWeight + 0.1, 0.5) : peerWeight,
    peerLabel,
  );
  let roeScore = roePeer.score;
  let roeNote = roePeer.note;

  if (
    hasRoic &&
    roicTempered.score != null &&
    roeScore != null &&
    roeScore > roicTempered.score + 15
  ) {
    roeScore = round1(Math.min(roeScore, roicTempered.score + 15));
    roeNote = "ROE limited — ROIC is the primary return signal";
  }
  const roeTempered = temperReturnScore(roeScore, "ROE", f.returnOnEquity);
  if (roeTempered.note) {
    roeNote = roeNote ? `${roeNote}; ${roeTempered.note}` : roeTempered.note;
  }
  roeScore = roeTempered.score;

  const roaAbs =
    f.returnOnAssets != null
      ? scoreAscending(f.returnOnAssets, ROIC_BANDS)
      : null;
  const roaPeer = peerBlend(
    roaAbs,
    f.returnOnAssets,
    peerValues(peers, "returnOnAssets"),
    peerWeight * 0.8,
    peerLabel,
  );
  const roaTempered = temperReturnScore(
    roaPeer.score,
    "ROA",
    f.returnOnAssets,
  );

  const roic3yAbs =
    f.returnOnInvestedCapital3y != null
      ? scoreAscending(f.returnOnInvestedCapital3y, ROIC_BANDS)
      : null;
  const roic3yTempered = temperReturnScore(
    roic3yAbs,
    "3Y ROIC",
    f.returnOnInvestedCapital3y,
  );

  const returnsMetrics: MetricScore[] = [];
  if (model === "bank_insurance") {
    if (f.returnOnEquity != null && roePeer.score != null) {
      returnsMetrics.push(
        metric(
          "roe",
          "ROE",
          f.returnOnEquity,
          formatPercentDecimal(f.returnOnEquity),
          roePeer.score,
          roePeer.note ?? "Primary return metric for banks/insurers",
        ),
      );
    }
    if (f.returnOnAssets != null && roaPeer.score != null) {
      returnsMetrics.push(
        metric(
          "roa",
          "ROA",
          f.returnOnAssets,
          formatPercentDecimal(f.returnOnAssets),
          roaPeer.score,
          "Capital-efficiency proxy for financials",
        ),
      );
    }
    if (f.returnOnInvestedCapital != null && roicTempered.score != null) {
      returnsMetrics.push(
        metric(
          "roic",
          "ROIC",
          f.returnOnInvestedCapital,
          formatPercentDecimal(f.returnOnInvestedCapital),
          roicTempered.score,
          "Secondary for banks/insurers",
        ),
      );
    }
  } else {
    if (f.returnOnInvestedCapital != null && roicTempered.score != null) {
      returnsMetrics.push(
        metric(
          "roic",
          "ROIC",
          f.returnOnInvestedCapital,
          formatPercentDecimal(f.returnOnInvestedCapital),
          roicTempered.score,
          roicTempered.note ??
            roicPeer.note ??
            "Primary return-on-capital signal",
        ),
      );
    }
    if (f.returnOnEquity != null && roeScore != null) {
      returnsMetrics.push(
        metric(
          "roe",
          "ROE",
          f.returnOnEquity,
          formatPercentDecimal(f.returnOnEquity),
          roeScore,
          roeNote ?? (hasRoic ? "Secondary to ROIC" : null),
        ),
      );
    }
    if (f.returnOnAssets != null && roaTempered.score != null) {
      returnsMetrics.push(
        metric(
          "roa",
          "ROA",
          f.returnOnAssets,
          formatPercentDecimal(f.returnOnAssets),
          roaTempered.score,
          roaTempered.note ?? "Supportive capital-efficiency metric",
        ),
      );
    }
    if (f.returnOnInvestedCapital3y != null && roic3yTempered.score != null) {
      returnsMetrics.push(
        metric(
          "roic_3y",
          "3-Year ROIC",
          f.returnOnInvestedCapital3y,
          formatPercentDecimal(f.returnOnInvestedCapital3y),
          roic3yTempered.score,
          roic3yTempered.note ?? "Multi-year ROIC persistence",
        ),
      );
    }
  }

  const returnsParts: Array<{ weight: number; value: number }> = [];
  if (model === "bank_insurance") {
    const roeM = returnsMetrics.find((m) => m.id === "roe");
    const roaM = returnsMetrics.find((m) => m.id === "roa");
    const roicM = returnsMetrics.find((m) => m.id === "roic");
    if (roeM?.score != null) returnsParts.push({ weight: 0.55, value: roeM.score });
    if (roaM?.score != null) returnsParts.push({ weight: 0.35, value: roaM.score });
    if (roicM?.score != null) returnsParts.push({ weight: 0.1, value: roicM.score });
  } else if (hasRoic) {
    const roicM = returnsMetrics.find((m) => m.id === "roic");
    const roeM = returnsMetrics.find((m) => m.id === "roe");
    const roaM = returnsMetrics.find((m) => m.id === "roa");
    const r3 = returnsMetrics.find((m) => m.id === "roic_3y");
    // 3y trend secondary; current ROIC primary within returns bucket
    if (roicM?.score != null) returnsParts.push({ weight: 0.6, value: roicM.score });
    if (roeM?.score != null) returnsParts.push({ weight: 0.2, value: roeM.score });
    if (roaM?.score != null) returnsParts.push({ weight: 0.1, value: roaM.score });
    if (r3?.score != null) {
      returnsParts.push({
        weight: returnsTempered ? 0.08 : 0.15,
        value: r3.score,
      });
    }
  } else {
    const roeM = returnsMetrics.find((m) => m.id === "roe");
    const roaM = returnsMetrics.find((m) => m.id === "roa");
    if (roeM?.score != null) returnsParts.push({ weight: 0.6, value: roeM.score });
    if (roaM?.score != null) returnsParts.push({ weight: 0.4, value: roaM.score });
  }
  const capitalReturns =
    returnsParts.length > 0 ? weightedAverage(returnsParts) : null;

  // —— 4) Quality / trend (secondary to current same-period level) ——
  const quality = qualityModifierScore(f, input.policy);

  const parts: Array<{ weight: number; value: number }> = [];
  if (coreMargins != null) {
    parts.push({
      weight: distortedAccruals
        ? 0.25
        : returnsTempered
          ? 0.45
          : model === "early_growth" || soft
            ? 0.3
            : 0.4,
      value: coreMargins,
    });
  }
  if (cashProfit != null) {
    parts.push({
      weight: distortedAccruals
        ? 0.45
        : !cashReliable
          ? 0
          : returnsTempered
            ? 0.35
            : soft
              ? 0.2
              : model === "early_growth"
                ? 0.3
                : 0.25,
      value: cashProfit,
    });
  }
  if (capitalReturns != null) {
    parts.push({
      weight: !cashReliable
        ? model === "bank_insurance"
          ? 0.4
          : 0.35
        : model === "bank_insurance"
          ? 0.35
          : returnsTempered
            ? 0.12
            : soft
              ? 0.3
              : 0.25,
      value: capitalReturns,
    });
  }
  if (quality.score != null) {
    parts.push({
      weight: returnsTempered ? 0.08 : soft ? 0.2 : 0.1,
      value: quality.score,
    });
  }

  let score =
    parts.length > 0
      ? round1(clamp(weightedAverage(parts) ?? 0))
      : null;

  // Cap: strong accrual margins with weak cash profitability
  if (
    score != null &&
    coreMargins != null &&
    coreMargins >= 70 &&
    cashProfit != null &&
    cashProfit <= 35
  ) {
    if (soft && !distortedAccruals) {
      score = round1(Math.min(score, 68));
      quality.notes.push(
        "Cash conversion soft-weighted — reinvestment profile (accrual cap eased)",
      );
    } else {
      score = round1(Math.min(score, distortedAccruals ? 42 : 55));
      quality.notes.push(
        distortedAccruals
          ? "Capped — distorted accrual margins with weak cash profitability"
          : "Capped — strong accrual margins with weak cash profitability",
      );
    }
  }

  // Distorted accruals + deep cash losses: keep true profitability weak
  if (
    score != null &&
    distortedAccruals &&
    cashProfit != null &&
    cashProfit <= 25
  ) {
    score = round1(Math.min(score, 38));
    quality.notes.push(
      "Cash losses dominate — accrual margins treated as unreliable",
    );
  }

  if (!cashReliable && f.cashFlowNote) {
    quality.notes.push(f.cashFlowNote);
  }

  // Loss-making: keep Profitability honest — no soft elite scores
  if (score != null && lossMaking) {
    const severe =
      (f.operatingMargins != null && f.operatingMargins < -0.2) ||
      (f.profitMargins != null && f.profitMargins < -0.2) ||
      (f.fcfMargin != null && f.fcfMargin < -0.2);
    score = round1(Math.min(score, severe ? 32 : 48));
    quality.notes.push(
      severe
        ? "Unprofitable profile — severe negative margins constrain Profitability"
        : "Unprofitable profile — negative margins constrain Profitability",
    );
  }

  // Thin / inconsistent statements: fewer metrics, lower confidence ceiling
  if (score != null && thinOrDegraded) {
    score = round1(Math.min(score, lossMaking ? 36 : 58));
    quality.notes.push(
      "Profitability confidence reduced — incomplete or inconsistent statements",
    );
  }
  for (const n of f.statementQualityNotes ?? []) {
    if (!quality.notes.includes(n)) quality.notes.push(n);
  }

  // Soften elite scores driven mostly by gross margin alone
  if (
    score != null &&
    score >= 80 &&
    omM.score == null &&
    nmM.score == null &&
    gmM.score != null &&
    gmM.score >= 80
  ) {
    score = round1(Math.min(score, 62));
    quality.notes.push("Gross margin alone cannot produce an elite score");
  }

  const allMetrics = [
    ...marginMetrics,
    ...cashMetrics,
    ...returnsMetrics,
    ...quality.metrics,
  ].filter((m) => m.value != null || (m.score != null && !m.skipped));

  // Ensure quality summary note lands on the quality_modifier metric
  const qMetric = allMetrics.find((m) => m.id === "quality_modifier");
  if (qMetric && quality.notes.length) {
    qMetric.note = quality.notes.join("; ");
  }

  return {
    id: "profitability",
    label: "Profitability",
    score,
    metrics: allMetrics,
    metricsUsed: allMetrics.filter((m) => m.score != null).length,
    metricsAvailable: allMetrics.length,
  };
}
