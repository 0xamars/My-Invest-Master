/**
 * Fundamental rating regression helpers — capture + deterministic sanity rules.
 * Used by scripts/run-fundamental-regression.mts. No ticker hardcoding in rules.
 */
import { pillarTakeaway } from "@/lib/analysis/fundamental-copy";
import { buildInvestSalsaRating } from "@/lib/analysis/rating";
import type {
  FundamentalInputs,
  FundamentalPeerContext,
  FundamentalResult,
  InvestSalsaRating,
  MetricScore,
  PeerMetricRow,
  PillarScore,
} from "@/lib/analysis/rating/types";

export type RegressionBucket =
  | "quality_cash"
  | "reinvesting_growth"
  | "capital_cyclical"
  | "financials"
  | "loss_speculative"
  | "weak_legacy";

export type UniverseEntry = {
  symbol: string;
  bucket: RegressionBucket;
};

/** Broad diversity set for automated Fundamental regression. */
export const FUNDAMENTAL_REGRESSION_UNIVERSE: UniverseEntry[] = [
  // Quality cash compounders
  { symbol: "MSFT", bucket: "quality_cash" },
  { symbol: "AAPL", bucket: "quality_cash" },
  { symbol: "V", bucket: "quality_cash" },
  { symbol: "UNH", bucket: "quality_cash" },
  // Reinvesting / growth compounders
  { symbol: "AMZN", bucket: "reinvesting_growth" },
  { symbol: "GOOGL", bucket: "reinvesting_growth" },
  { symbol: "META", bucket: "reinvesting_growth" },
  { symbol: "NVDA", bucket: "reinvesting_growth" },
  // Capital-intensive / cyclical
  { symbol: "TSLA", bucket: "capital_cyclical" },
  { symbol: "CAT", bucket: "capital_cyclical" },
  { symbol: "XOM", bucket: "capital_cyclical" },
  // Financials / brokerage-like
  { symbol: "HOOD", bucket: "financials" },
  { symbol: "JPM", bucket: "financials" },
  { symbol: "GS", bucket: "financials" },
  // Loss-making / speculative / thin-history
  { symbol: "INFQ", bucket: "loss_speculative" },
  { symbol: "ONDS", bucket: "loss_speculative" },
  { symbol: "IONQ", bucket: "loss_speculative" },
  { symbol: "SOUN", bucket: "loss_speculative" },
  { symbol: "PLTR", bucket: "loss_speculative" },
  // Weak / distressed-leaning (coverage dependent)
  { symbol: "SAVE", bucket: "weak_legacy" },
  { symbol: "WBA", bucket: "weak_legacy" },
];

export type SanityRuleId =
  | "takeaway_profitable_on_loss"
  | "takeaway_strong_cash_on_neg_cash"
  | "takeaway_solid_bs_on_distress"
  | "om_severity_mismatch"
  | "margin_statement_mismatch"
  | "mixed_fundamental_periods"
  | "quality_crushed_without_notes"
  | "loss_maker_high_profitability"
  | "fcf_conversion_rewarded_on_neg"
  | "extreme_accrual_vs_cash"
  | "growth_forward_used"
  | "growth_fake_3y"
  | "growth_extreme_ungated"
  | "valuation_extreme_high"
  | "anchor_msft"
  | "anchor_aapl"
  | "anchor_amzn"
  | "anchor_tsla"
  | "anchor_infq_onds"
  | "anchor_ionq"
  | "anchor_hood";

export type SanityFinding = {
  rule: SanityRuleId;
  severity: "fail" | "flag";
  message: string;
};

export type TickerCapture = {
  symbol: string;
  bucket: RegressionBucket;
  skipped: boolean;
  skipReason: string | null;
  period: string | null;
  profile: string | null;
  softWeighting: boolean;
  scores: {
    overall: number | null;
    financial_strength: number | null;
    profitability: number | null;
    growth: number | null;
    valuation: number | null;
  };
  metrics: {
    om: number | null;
    nm: number | null;
    gm: number | null;
    ebitdaM: number | null;
    ocfM: number | null;
    fcfM: number | null;
    roic: number | null;
    roe: number | null;
    roa: number | null;
    netDebtEbitda: number | null;
    interestCoverage: number | null;
    altman: number | null;
    piotroski: number | null;
    revGrowth: number | null;
    epsGrowth: number | null;
    opGrowth: number | null;
    fcfGrowth: number | null;
    revGrowth3y: number | null;
    epsGrowth3y: number | null;
    opGrowth3y: number | null;
    revEstGrowth: number | null;
    epsEstGrowth: number | null;
    ps: number | null;
    evSales: number | null;
    evEbitda: number | null;
    pOcf: number | null;
    pFcf: number | null;
  };
  /** Same-period statement quotients used as package ground truth. */
  packageTruth: {
    om: number | null;
    nm: number | null;
    gm: number | null;
    ocfM: number | null;
    fcfM: number | null;
  };
  growthAudit: {
    blendNote: string | null;
    rev3yNote: string | null;
    rev3yScored: boolean;
    epsExtremeGated: boolean;
    forwardEstimateUsed: boolean;
  };
  componentScores: Record<string, number | null>;
  statementOm: number | null;
  takeaways: Record<string, string>;
  degradedNotes: string[];
  omittedMetrics: string[];
  findings: SanityFinding[];
};

function pillarById(
  fundamental: FundamentalResult,
  id: string,
): PillarScore | undefined {
  return fundamental.pillars.find((p) => p.id === id);
}

function metricById(pillar: PillarScore | undefined, id: string): MetricScore | undefined {
  return pillar?.metrics.find((m) => m.id === id);
}

function saysProfitable(text: string): boolean {
  return (
    /\bProfitable\b/i.test(text) ||
    /\bHigh profitability\b/i.test(text) ||
    /\bSolid profitability\b/i.test(text) ||
    /\bHealthy profitability\b/i.test(text)
  );
}

function saysUnprofitable(text: string): boolean {
  return /\bUnprofitable\b/i.test(text) || /\bOperating losses continue\b/i.test(text);
}

function saysStrongCashConversion(text: string): boolean {
  return /strong cash conversion/i.test(text);
}

function saysSolidBalanceSheet(text: string): boolean {
  return /solid balance sheet|strong balance sheet|balance sheet looks solid|strong solvency/i.test(
    text,
  );
}

export function captureFromRating(input: {
  symbol: string;
  bucket: RegressionBucket;
  fundamentals: FundamentalInputs;
  peers: PeerMetricRow[];
  peerContext: FundamentalPeerContext;
  price: number | null;
}): TickerCapture {
  const { symbol, bucket, fundamentals: f } = input;
  const rating: InvestSalsaRating = buildInvestSalsaRating({
    assetType: "stock",
    price: input.price,
    ath: null,
    fundamentals: f,
    peers: input.peers,
    peerContext: input.peerContext,
    dailyBars: [],
    hourlyBars: [],
  });

  const fund = rating.fundamental;
  if (!fund.available || fund.score == null) {
    return skippedCapture(symbol, bucket, "Fundamental rating unavailable");
  }

  const fs = pillarById(fund, "financial_strength");
  const profit = pillarById(fund, "profitability");
  const growth = pillarById(fund, "growth");
  const valuation = pillarById(fund, "valuation");

  const takeaways: Record<string, string> = {};
  for (const p of fund.pillars) {
    takeaways[p.id] = pillarTakeaway(p, fund);
  }

  const statementOm =
    f.ebit != null && f.totalRevenue != null && f.totalRevenue !== 0
      ? f.ebit / f.totalRevenue
      : null;

  const rev = f.totalRevenue;
  const truthOm = statementOm;
  const truthGm =
    rev != null && rev !== 0 && f.grossProfit != null
      ? f.grossProfit / rev
      : null;
  const truthOcf =
    rev != null && rev !== 0 && f.operatingCashflow != null
      ? f.operatingCashflow / rev
      : null;
  const truthFcf =
    rev != null && rev !== 0 && f.freeCashflow != null
      ? f.freeCashflow / rev
      : null;

  const blendMetric = metricById(growth, "growth_blend");
  const rev3yMetric = metricById(growth, "revenue_growth_3y");
  const epsMetric = metricById(growth, "eps_growth");

  const componentScores: Record<string, number | null> = {};
  for (const p of fund.pillars) {
    for (const m of p.metrics) {
      componentScores[`${p.id}.${m.id}`] = m.score;
    }
  }

  const capture: TickerCapture = {
    symbol,
    bucket,
    skipped: false,
    skipReason: null,
    period: f.fundamentalPeriod ?? f.statementPeriod ?? null,
    profile: fund.classification.growthProfile,
    softWeighting: fund.classification.reinvestmentSoftWeighting,
    scores: {
      overall: fund.score,
      financial_strength: fs?.score ?? null,
      profitability: profit?.score ?? null,
      growth: growth?.score ?? null,
      valuation: valuation?.score ?? null,
    },
    metrics: {
      om: f.operatingMargins,
      nm: f.profitMargins,
      gm: f.grossMargins,
      ebitdaM: f.ebitdaMargin,
      ocfM: f.ocfMargin,
      fcfM: f.fcfMargin,
      roic: f.returnOnInvestedCapital,
      roe: f.returnOnEquity,
      roa: f.returnOnAssets,
      netDebtEbitda: f.netDebtToEbitda,
      interestCoverage: f.interestCoverage,
      altman: f.altmanZScore,
      piotroski: f.piotroskiScore,
      revGrowth: f.revenueGrowth,
      epsGrowth: f.earningsGrowth,
      opGrowth: f.operatingIncomeGrowth,
      fcfGrowth: f.fcfGrowth,
      revGrowth3y: f.revenueGrowth3y,
      epsGrowth3y: f.earningsGrowth3y,
      opGrowth3y: f.operatingGrowth3y,
      revEstGrowth: f.revenueEstimateGrowth,
      epsEstGrowth: f.earningsEstimateGrowth,
      ps: f.priceToSales,
      evSales: f.evToSales,
      evEbitda: f.enterpriseToEbitda,
      pOcf: f.priceToOcf,
      pFcf: f.priceToFcf,
    },
    packageTruth: {
      om: truthOm,
      nm: null, // filled via profitMargins when statement-built
      gm: truthGm,
      ocfM: truthOcf,
      fcfM: truthFcf,
    },
    growthAudit: {
      blendNote: blendMetric?.note ?? null,
      rev3yNote: rev3yMetric?.note ?? null,
      rev3yScored: rev3yMetric?.score != null,
      epsExtremeGated: (epsMetric?.note ?? "")
        .toLowerCase()
        .includes("extreme outlier"),
      forwardEstimateUsed:
        (f.revenueEstimateGrowth != null || f.earningsEstimateGrowth != null) &&
        (blendMetric?.note ?? "").toLowerCase().includes("forward") &&
        !(blendMetric?.note ?? "").toLowerCase().includes("no forward"),
    },
    componentScores,
    statementOm,
    takeaways,
    degradedNotes: [
      ...(f.statementQualityNotes ?? []),
      ...(f.cashFlowNote ? [f.cashFlowNote] : []),
      ...(f.statementMarginsDegraded
        ? ["statementMarginsDegraded=true"]
        : []),
      ...fund.notes.filter((n) =>
        /degraded|confidence|inconsistent|unreliable|omitting|distorted|both negative/i.test(
          n,
        ),
      ),
    ],
    omittedMetrics: fund.missingMetrics ?? [],
    findings: [],
  };

  // When profitMargins came from statement NI/rev, treat as package truth for NM
  if (f.profitMargins != null && truthOm != null) {
    capture.packageTruth.nm = f.profitMargins;
  }

  capture.findings = evaluateSanity(capture, f, fund, profit, fs, growth, valuation);
  return capture;
}

function emptyMetrics(): TickerCapture["metrics"] {
  return {
    om: null,
    nm: null,
    gm: null,
    ebitdaM: null,
    ocfM: null,
    fcfM: null,
    roic: null,
    roe: null,
    roa: null,
    netDebtEbitda: null,
    interestCoverage: null,
    altman: null,
    piotroski: null,
    revGrowth: null,
    epsGrowth: null,
    opGrowth: null,
    fcfGrowth: null,
    revGrowth3y: null,
    epsGrowth3y: null,
    opGrowth3y: null,
    revEstGrowth: null,
    epsEstGrowth: null,
    ps: null,
    evSales: null,
    evEbitda: null,
    pOcf: null,
    pFcf: null,
  };
}

function emptyPackageTruth(): TickerCapture["packageTruth"] {
  return { om: null, nm: null, gm: null, ocfM: null, fcfM: null };
}

function emptyGrowthAudit(): TickerCapture["growthAudit"] {
  return {
    blendNote: null,
    rev3yNote: null,
    rev3yScored: false,
    epsExtremeGated: false,
    forwardEstimateUsed: false,
  };
}

/** Build a skipped capture shell (shared by runner + capture). */
export function skippedCapture(
  symbol: string,
  bucket: RegressionBucket,
  reason: string,
): TickerCapture {
  return {
    symbol,
    bucket,
    skipped: true,
    skipReason: reason,
    period: null,
    profile: null,
    softWeighting: false,
    scores: {
      overall: null,
      financial_strength: null,
      profitability: null,
      growth: null,
      valuation: null,
    },
    metrics: emptyMetrics(),
    packageTruth: emptyPackageTruth(),
    growthAudit: emptyGrowthAudit(),
    componentScores: {},
    statementOm: null,
    takeaways: {},
    degradedNotes: [],
    omittedMetrics: [],
    findings: [],
  };
}

export function evaluateSanity(
  c: TickerCapture,
  f: FundamentalInputs,
  fund: FundamentalResult,
  profit: PillarScore | undefined,
  fs: PillarScore | undefined,
  growth?: PillarScore | undefined,
  valuation?: PillarScore | undefined,
): SanityFinding[] {
  const findings: SanityFinding[] = [];
  const m = c.metrics;
  const profitTakeaway = c.takeaways.profitability ?? "";
  const fsTakeaway = c.takeaways.financial_strength ?? "";

  // 1) Takeaway honesty — OM/NM/FCF < 0 must not say "Profitable…"
  //    Accrual-profitable with FCF-only weakness must not say "Unprofitable…"
  const accrualLoss =
    (m.om != null && m.om < 0) || (m.nm != null && m.nm < 0);
  const fcfLoss = m.fcfM != null && m.fcfM < 0;
  if ((accrualLoss || fcfLoss) && saysProfitable(profitTakeaway)) {
    findings.push({
      rule: "takeaway_profitable_on_loss",
      severity: "fail",
      message: `Profitability takeaway says profitable-like while OM/NM/FCF negative: "${profitTakeaway}"`,
    });
  }
  if (
    m.om != null &&
    m.om >= 0 &&
    (m.nm == null || m.nm >= 0) &&
    saysUnprofitable(profitTakeaway)
  ) {
    findings.push({
      rule: "takeaway_profitable_on_loss",
      severity: "fail",
      message: `Profitability takeaway says unprofitable while OM/NM non-negative: "${profitTakeaway}"`,
    });
  }

  const bothCashNeg =
    m.ocfM != null && m.ocfM < 0 && m.fcfM != null && m.fcfM < 0;
  if (bothCashNeg && saysStrongCashConversion(profitTakeaway)) {
    findings.push({
      rule: "takeaway_strong_cash_on_neg_cash",
      severity: "fail",
      message: `Strong cash conversion language with negative OCF & FCF margins: "${profitTakeaway}"`,
    });
  }

  const altmanDistress =
    m.altman != null && m.altman < 1.81;
  const extremeLeverage =
    m.netDebtEbitda != null && m.netDebtEbitda > 6;
  if (
    altmanDistress &&
    extremeLeverage &&
    saysSolidBalanceSheet(fsTakeaway) &&
    !/distress|elevated|weak|watch/i.test(fsTakeaway)
  ) {
    findings.push({
      rule: "takeaway_solid_bs_on_distress",
      severity: "fail",
      message: `Solid/strong BS language with Altman distress + extreme leverage: "${fsTakeaway}"`,
    });
  }

  // 2) Statement math vs package truth
  const checkMargin = (
    label: string,
    scored: number | null,
    truth: number | null,
  ) => {
    if (scored == null || truth == null) return;
    if (!Number.isFinite(scored) || !Number.isFinite(truth)) return;
    const gap = Math.abs(scored - truth);
    if (gap > 0.05) {
      findings.push({
        rule: "margin_statement_mismatch",
        severity: "fail",
        message: `${label} scored ${scored.toFixed(4)} vs statement ${truth.toFixed(4)} (gap ${gap.toFixed(4)})`,
      });
    }
  };
  checkMargin("OM", m.om, c.packageTruth.om ?? c.statementOm);
  checkMargin("GM", m.gm, c.packageTruth.gm);
  checkMargin("OCF margin", m.ocfM, c.packageTruth.ocfM);
  checkMargin("FCF margin", m.fcfM, c.packageTruth.fcfM);

  if (
    c.statementOm != null &&
    m.om != null &&
    Number.isFinite(c.statementOm) &&
    Number.isFinite(m.om)
  ) {
    const gap = Math.abs(c.statementOm - m.om);
    if (gap > 0.12 && (Math.abs(c.statementOm) > 0.2 || Math.abs(m.om) > 0.2)) {
      findings.push({
        rule: "om_severity_mismatch",
        severity: "fail",
        message: `OM ${m.om.toFixed(3)} vs statement ebit/revenue ${c.statementOm.toFixed(3)} (gap ${gap.toFixed(3)})`,
      });
    }
  }
  if (
    c.statementOm != null &&
    c.statementOm < -0.5 &&
    m.om != null &&
    m.om > -0.2
  ) {
    findings.push({
      rule: "om_severity_mismatch",
      severity: "fail",
      message: `Severe statement OM ${c.statementOm.toFixed(2)} understated as ${m.om.toFixed(3)}`,
    });
  }

  // 3) Period coherence
  const periodNotes = fund.notes.filter((n) =>
    /Fundamental Period|same-period|scoring on/i.test(n),
  );
  const periodMentions = new Set(
    periodNotes
      .map((n) => {
        const mm = n.match(/\b(TTM|Annual|Quarter)\b/i);
        return mm?.[1]?.toLowerCase() ?? null;
      })
      .filter(Boolean),
  );
  if (periodMentions.size > 1) {
    findings.push({
      rule: "mixed_fundamental_periods",
      severity: "fail",
      message: `Multiple periods referenced in notes: ${[...periodMentions].join(", ")}`,
    });
  }
  if (
    fund.classification.fundamentalPeriod != null &&
    f.fundamentalPeriod != null &&
    fund.classification.fundamentalPeriod !== f.fundamentalPeriod
  ) {
    findings.push({
      rule: "mixed_fundamental_periods",
      severity: "fail",
      message: "classification.fundamentalPeriod !== inputs.fundamentalPeriod",
    });
  }

  // 4) Growth coverage-safe
  const blendNote = (c.growthAudit.blendNote ?? "").toLowerCase();
  if (
    c.growthAudit.forwardEstimateUsed ||
    (blendNote.includes("forward") &&
      !blendNote.includes("no forward") &&
      (m.revEstGrowth != null || m.epsEstGrowth != null))
  ) {
    findings.push({
      rule: "growth_forward_used",
      severity: "fail",
      message: `Forward estimates appear to influence Growth blend: "${c.growthAudit.blendNote}"`,
    });
  }
  // Fake 3Y: scored 3Y while note admits filler / unavailable, or value present without geometric note
  const rev3yNote = (c.growthAudit.rev3yNote ?? "").toLowerCase();
  if (
    c.growthAudit.rev3yScored &&
    (rev3yNote.includes("avg") ||
      rev3yNote.includes("capped") ||
      rev3yNote.includes("fallback") ||
      rev3yNote.includes("filler"))
  ) {
    findings.push({
      rule: "growth_fake_3y",
      severity: "fail",
      message: `3Y revenue scored with non-CAGR filler note: "${c.growthAudit.rev3yNote}"`,
    });
  }
  // Extreme rates must be gated (score null) when |g| > 2.5
  const extreme = (g: number | null) =>
    g != null && Number.isFinite(g) && Math.abs(g) > 2.5;
  if (extreme(m.epsGrowth) && !c.growthAudit.epsExtremeGated) {
    const epsScore = metricById(growth, "eps_growth")?.score;
    if (epsScore != null) {
      findings.push({
        rule: "growth_extreme_ungated",
        severity: "fail",
        message: `Extreme EPS growth ${(m.epsGrowth! * 100).toFixed(0)}% still scored (${epsScore})`,
      });
    }
  }
  if (extreme(m.revGrowth)) {
    const revScore = metricById(growth, "revenue_growth")?.score;
    if (revScore != null) {
      findings.push({
        rule: "growth_extreme_ungated",
        severity: "fail",
        message: `Extreme revenue growth ${(m.revGrowth! * 100).toFixed(0)}% still scored (${revScore})`,
      });
    }
  }
  if (extreme(m.revGrowth3y) && c.growthAudit.rev3yScored) {
    findings.push({
      rule: "growth_extreme_ungated",
      severity: "fail",
      message: `Extreme 3Y revenue CAGR ${(m.revGrowth3y! * 100).toFixed(0)}% still scored`,
    });
  }

  // Quality compounder crushed without explanation
  const fortress =
    (m.om != null && m.om > 0.15) &&
    (m.ocfM != null && m.ocfM > 0.1) &&
    (m.altman == null || m.altman >= 2.99) &&
    (m.netDebtEbitda == null || m.netDebtEbitda < 2);
  if (
    fortress &&
    c.scores.financial_strength != null &&
    c.scores.financial_strength < 40 &&
    c.scores.profitability != null &&
    c.scores.profitability < 40 &&
    c.degradedNotes.length === 0
  ) {
    findings.push({
      rule: "quality_crushed_without_notes",
      severity: "flag",
      message: "Fortress-like metrics but FS & Profitability both < 40 without degraded notes",
    });
  }

  // Deep loss-maker with high profitability
  const deepLoss =
    (m.om != null && m.om < -0.3) ||
    (m.fcfM != null && m.fcfM < -0.3) ||
    (c.statementOm != null && c.statementOm < -0.3);
  if (
    deepLoss &&
    c.scores.profitability != null &&
    c.scores.profitability >= 55
  ) {
    findings.push({
      rule: "loss_maker_high_profitability",
      severity: "fail",
      message: `Deep loss-maker with Profitability ${c.scores.profitability}`,
    });
  }

  // FCF conversion rewarded on both negative
  const conv = metricById(profit, "fcf_conversion") ?? metricById(fs, "fcf_quality");
  if (
    bothCashNeg &&
    conv?.score != null &&
    conv.score >= 60 &&
    !(conv.note ?? "").toLowerCase().includes("both negative")
  ) {
    findings.push({
      rule: "fcf_conversion_rewarded_on_neg",
      severity: "fail",
      message: `FCF conversion score ${conv.score} while OCF & FCF margins negative`,
    });
  }
  if (
    f.freeCashflow != null &&
    f.freeCashflow < 0 &&
    f.operatingCashflow != null &&
    f.operatingCashflow < 0 &&
    conv?.score != null &&
    conv.score >= 60 &&
    !(conv.note ?? "").toLowerCase().includes("both negative")
  ) {
    findings.push({
      rule: "fcf_conversion_rewarded_on_neg",
      severity: "fail",
      message: `FCF conversion score ${conv.score} while absolute OCF & FCF negative`,
    });
  }

  // Extreme positive accrual vs deep cash
  if (
    bothCashNeg &&
    ((m.nm != null && m.nm > 0.5) || (m.ebitdaM != null && m.ebitdaM > 0.5)) &&
    !f.statementMarginsDegraded
  ) {
    findings.push({
      rule: "extreme_accrual_vs_cash",
      severity: "fail",
      message: "Extreme positive NI/EBITDA kept while OCF/FCF deeply negative without degraded flag",
    });
  }

  // Valuation honesty — extreme multiples should score low
  const extremeMultiple =
    (m.ps != null && m.ps > 40) ||
    (m.evSales != null && m.evSales > 40) ||
    (m.evEbitda != null && m.evEbitda > 80) ||
    (m.pFcf != null && m.pFcf > 80);
  if (
    extremeMultiple &&
    c.scores.valuation != null &&
    c.scores.valuation >= 55
  ) {
    findings.push({
      rule: "valuation_extreme_high",
      severity: "fail",
      message: `Extreme multiples with Valuation ${c.scores.valuation} (P/S=${m.ps} EV/S=${m.evSales} EV/EBITDA=${m.evEbitda} P/FCF=${m.pFcf})`,
    });
  }
  void valuation;

  // Anchors (symbol-specific pass criteria — not scoring branches)
  if (c.symbol === "MSFT") {
    if (
      (c.scores.financial_strength ?? 0) < 70 ||
      (c.scores.profitability ?? 0) < 75
    ) {
      findings.push({
        rule: "anchor_msft",
        severity: "fail",
        message: `MSFT anchor failed: FS=${c.scores.financial_strength} Profitability=${c.scores.profitability}`,
      });
    }
  }
  if (c.symbol === "AAPL") {
    if (
      (c.scores.financial_strength ?? 0) < 65 ||
      (c.scores.profitability ?? 0) < 70
    ) {
      findings.push({
        rule: "anchor_aapl",
        severity: "fail",
        message: `AAPL anchor failed: FS=${c.scores.financial_strength} Profitability=${c.scores.profitability}`,
      });
    }
  }
  if (c.symbol === "AMZN") {
    if (
      !c.softWeighting &&
      (c.scores.profitability ?? 0) < 50
    ) {
      findings.push({
        rule: "anchor_amzn",
        severity: "flag",
        message: `AMZN not soft-weighted and Profitability ${c.scores.profitability}`,
      });
    }
    if ((c.scores.profitability ?? 0) < 45) {
      findings.push({
        rule: "anchor_amzn",
        severity: "fail",
        message: `AMZN crushed: Profitability ${c.scores.profitability}`,
      });
    }
    if ((c.scores.financial_strength ?? 0) < 50) {
      findings.push({
        rule: "anchor_amzn",
        severity: "fail",
        message: `AMZN FS too weak: ${c.scores.financial_strength}`,
      });
    }
  }
  if (c.symbol === "TSLA") {
    if ((c.scores.financial_strength ?? 0) < 50) {
      findings.push({
        rule: "anchor_tsla",
        severity: "fail",
        message: `TSLA FS unexpectedly weak: ${c.scores.financial_strength}`,
      });
    }
    // Soft directional: if multiples extreme, valuation should not look cheap
    if (
      ((m.ps != null && m.ps > 10) || (m.evSales != null && m.evSales > 10)) &&
      (c.scores.valuation ?? 0) >= 70
    ) {
      findings.push({
        rule: "anchor_tsla",
        severity: "fail",
        message: `TSLA rich multiples with high Valuation ${c.scores.valuation}`,
      });
    }
  }
  if (c.symbol === "INFQ" || c.symbol === "ONDS") {
    if (
      (c.scores.profitability ?? 100) >= 40 ||
      saysProfitable(profitTakeaway)
    ) {
      findings.push({
        rule: "anchor_infq_onds",
        severity: "fail",
        message: `${c.symbol} should stay weak/unprofitable: Profitability=${c.scores.profitability} takeaway="${profitTakeaway}"`,
      });
    }
  }
  if (c.symbol === "IONQ") {
    if (
      (c.scores.profitability ?? 100) >= 45 ||
      saysProfitable(profitTakeaway)
    ) {
      findings.push({
        rule: "anchor_ionq",
        severity: "fail",
        message: `IONQ should stay weak: Profitability=${c.scores.profitability} takeaway="${profitTakeaway}"`,
      });
    }
  }
  if (c.symbol === "HOOD") {
    if (
      (c.scores.financial_strength ?? 100) >= 55 ||
      (c.scores.valuation ?? 100) >= 45
    ) {
      findings.push({
        rule: "anchor_hood",
        severity: "fail",
        message: `HOOD should stay weak FS / expensive: FS=${c.scores.financial_strength} Val=${c.scores.valuation}`,
      });
    }
  }

  return findings;
}

export type SuiteReport = {
  tested: number;
  skipped: { symbol: string; reason: string }[];
  captures: TickerCapture[];
  failures: { symbol: string; finding: SanityFinding }[];
  flags: { symbol: string; finding: SanityFinding }[];
  byRule: Record<string, number>;
  anchorsOk: boolean;
};

export function buildSuiteReport(captures: TickerCapture[]): SuiteReport {
  const skipped = captures
    .filter((c) => c.skipped)
    .map((c) => ({ symbol: c.symbol, reason: c.skipReason ?? "unknown" }));
  const tested = captures.filter((c) => !c.skipped);
  const failures: SuiteReport["failures"] = [];
  const flags: SuiteReport["flags"] = [];
  const byRule: Record<string, number> = {};

  for (const c of tested) {
    for (const f of c.findings) {
      byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
      if (f.severity === "fail") failures.push({ symbol: c.symbol, finding: f });
      else flags.push({ symbol: c.symbol, finding: f });
    }
  }

  const anchorSymbols = ["MSFT", "AAPL", "AMZN", "TSLA", "INFQ", "ONDS", "IONQ", "HOOD"];
  const anchorsOk = !failures.some(
    (f) =>
      anchorSymbols.includes(f.symbol) && f.finding.rule.startsWith("anchor_"),
  );

  return {
    tested: tested.length,
    skipped,
    captures,
    failures,
    flags,
    byRule,
    anchorsOk,
  };
}

export function formatSuiteReport(report: SuiteReport): string {
  const lines: string[] = [];
  lines.push("# Fundamental Metric Audit Report");
  lines.push("");
  lines.push(`Tested: ${report.tested} · Skipped: ${report.skipped.length}`);
  if (report.skipped.length) {
    for (const s of report.skipped) {
      lines.push(`  - SKIP ${s.symbol}: ${s.reason}`);
    }
  }
  lines.push("");
  lines.push(`Failures: ${report.failures.length} · Flags: ${report.flags.length}`);
  lines.push(`Anchors OK: ${report.anchorsOk ? "yes" : "NO"}`);
  lines.push("");
  if (Object.keys(report.byRule).length) {
    lines.push("## By rule");
    for (const [rule, n] of Object.entries(report.byRule).sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`  - ${rule}: ${n}`);
    }
    lines.push("");
  }
  if (report.failures.length) {
    lines.push("## Failures");
    for (const f of report.failures) {
      lines.push(`  - [${f.finding.rule}] ${f.symbol}: ${f.finding.message}`);
    }
    lines.push("");
  }
  if (report.flags.length) {
    lines.push("## Flags");
    for (const f of report.flags) {
      lines.push(`  - [${f.finding.rule}] ${f.symbol}: ${f.finding.message}`);
    }
    lines.push("");
  }
  lines.push("## Scores snapshot");
  for (const c of report.captures.filter((x) => !x.skipped)) {
    lines.push(
      `  ${c.symbol.padEnd(6)} FS=${fmt(c.scores.financial_strength)} P=${fmt(c.scores.profitability)} G=${fmt(c.scores.growth)} V=${fmt(c.scores.valuation)} | OM=${pct(c.metrics.om)} FCF=${pct(c.metrics.fcfM)} | ${c.takeaways.profitability ?? ""}`,
    );
  }
  lines.push("");
  lines.push("## Growth sleeve notes");
  for (const c of report.captures.filter((x) => !x.skipped)) {
    lines.push(
      `  ${c.symbol.padEnd(6)} rev3y=${pct(c.metrics.revGrowth3y)} scored=${c.growthAudit.rev3yScored} | ${c.growthAudit.blendNote ?? "—"}`,
    );
  }
  lines.push("");
  lines.push("## Known philosophy gaps vs GF/MS (not bugs)");
  lines.push(
    "  - Absolute score scales differ from GF Financial Strength / MS Moat ranks",
  );
  lines.push(
    "  - Peer-relative banding vs GF industry percentile can diverge without data error",
  );
  lines.push(
    "  - Reinvestment soft-weighting is intentional vs pure FCF-first screens",
  );
  lines.push(
    "  - Forward estimates unused until warehouse `/analyst-estimates` populates",
  );
  return lines.join("\n");
}

function fmt(n: number | null): string {
  return n == null ? "—" : String(Math.round(n));
}
function pct(n: number | null): string {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}
