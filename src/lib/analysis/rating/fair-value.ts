import { clamp, round1 } from "@/lib/analysis/rating/math";
import type {
  FairValueLabel,
  FairValueResult,
  FundamentalInputs,
  FundamentalResult,
  RatingConfidence,
} from "@/lib/analysis/rating/types";

function pctFromTo(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

function emptyFairValue(
  notes: string[],
  confidence: RatingConfidence = "Low",
): FairValueResult {
  return {
    available: false,
    version: "v1.2",
    label: null,
    takeaway: null,
    confidence,
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
    notes,
    disruptiveEnabled: false,
    disruptiveDisabledReason: null,
  };
}

/**
 * Resolve diluted share count in absolute shares.
 * Prefer marketCap / price (same units as the live quote) — avoids FMP share-count unit bugs.
 */
export function resolveSharesOutstanding(
  f: FundamentalInputs,
  price: number | null,
): { shares: number | null; source: string | null } {
  if (price != null && price > 0 && f.marketCap != null && f.marketCap > 0) {
    const implied = f.marketCap / price;
    if (implied >= 1e7 && implied <= 5e11) {
      return { shares: implied, source: "marketCap / price" };
    }
  }

  const raw = f.sharesOutstanding;
  if (raw == null || raw <= 0) {
    return { shares: null, source: null };
  }

  if (raw >= 1e7 && raw <= 5e11) {
    return { shares: raw, source: "reported shares" };
  }

  if (raw >= 50 && raw < 1e7) {
    const scaled = raw * 1e6;
    if (scaled >= 1e7 && scaled <= 5e11) {
      return { shares: scaled, source: "reported shares (millions → absolute)" };
    }
  }

  return { shares: null, source: null };
}

type EarningsBasis = "fcf" | "earnings" | "operating";

type NormalizedPower = {
  value: number;
  basis: EarningsBasis;
  note: string;
  /** True when current FCF understates a reinvesting compounder */
  reinvestmentDepressed: boolean;
  /** True when growth + quality evidence supports growth-aware multiples */
  growthCompounder: boolean;
  debug: {
    fcf: number | null;
    netIncome: number | null;
    nopat: number | null;
    ocfProxy: number | null;
    lookThrough: number | null;
    rawChosen: number;
  };
};

function netIncomePower(f: FundamentalInputs): number | null {
  if (
    f.profitMargins != null &&
    f.totalRevenue != null &&
    f.totalRevenue > 0 &&
    f.profitMargins > 0
  ) {
    return f.profitMargins * f.totalRevenue;
  }
  return null;
}

function nopatPower(f: FundamentalInputs): number | null {
  const ebit =
    f.ebit != null && f.ebit > 0
      ? f.ebit
      : f.operatingMargins != null &&
          f.totalRevenue != null &&
          f.totalRevenue > 0 &&
          f.operatingMargins > 0
        ? f.operatingMargins * f.totalRevenue
        : null;
  if (ebit == null || ebit <= 0) return null;
  // Approximate after-tax operating earnings (NOPAT)
  return ebit * 0.79;
}

function isReinvestmentDepressed(f: FundamentalInputs, ni: number | null): boolean {
  const fcf = f.freeCashflow;
  const ocf = f.operatingCashflow;
  const capex = f.capitalExpenditure;
  const absCapex = capex != null ? Math.abs(capex) : null;

  // Heavy capex vs OCF while still generating operating cash
  if (ocf != null && ocf > 0 && absCapex != null && absCapex >= ocf * 0.4) {
    return true;
  }

  // Positive but thin FCF vs earnings — classic reinvestment trough
  if (fcf != null && fcf > 0 && ni != null && ni > 0 && fcf < ni * 0.5) {
    return true;
  }

  // Negative / zero FCF with positive earnings
  if ((fcf == null || fcf <= 0) && ni != null && ni > 0) {
    return true;
  }

  // FCF << OCF with sizeable reinvestment
  if (
    fcf != null &&
    fcf > 0 &&
    ocf != null &&
    ocf > 0 &&
    fcf < ocf * 0.35 &&
    absCapex != null &&
    absCapex > 0
  ) {
    return true;
  }

  return false;
}

function isGrowthCompounder(
  f: FundamentalInputs,
  fs: number | null,
  profitability: number | null,
): boolean {
  const g = Math.max(
    f.revenueGrowth ?? Number.NEGATIVE_INFINITY,
    f.earningsGrowth ?? Number.NEGATIVE_INFINITY,
    f.revenueEstimateGrowth ?? Number.NEGATIVE_INFINITY,
  );
  const growthOk = Number.isFinite(g) && g >= 0.08;
  const marginOk =
    (f.grossMargins != null && f.grossMargins >= 0.18) ||
    (f.operatingMargins != null && f.operatingMargins >= 0.05) ||
    (f.operatingMarginTrend != null && f.operatingMarginTrend >= 0.01);
  const fsOk = fs == null || fs >= 40;
  const profOk = profitability == null || profitability >= 35;
  const gpExpanding =
    f.grossProfit != null &&
    f.grossProfitPrior != null &&
    f.grossProfitPrior > 0 &&
    f.grossProfit / f.grossProfitPrior - 1 >= 0.08;

  return growthOk && (marginOk || gpExpanding) && fsOk && profOk;
}

/**
 * Normalize economic power. Prefer healthy FCF; for reinvesting compounders,
 * do not treat depressed FCF as steady-state — use operating/earnings look-through.
 */
function normalizeEconomicPower(
  f: FundamentalInputs,
  fs: number | null,
  profitability: number | null,
): NormalizedPower | null {
  const fcf = f.freeCashflow != null && f.freeCashflow > 0 ? f.freeCashflow : null;
  const ni = netIncomePower(f);
  const nopat = nopatPower(f);
  const ocfProxy =
    f.operatingCashflow != null && f.operatingCashflow > 0
      ? f.operatingCashflow * 0.65
      : null;

  const reinvestmentDepressed = isReinvestmentDepressed(f, ni);
  const growthCompounder = isGrowthCompounder(f, fs, profitability);
  const fcfHealthy =
    fcf != null &&
    (ni == null || fcf >= ni * 0.35) &&
    (f.fcfMargin == null || f.fcfMargin >= 0.04);

  // —— Path 1: healthy FCF always wins (AMZN / cash compounders) ——
  // High reinvestment alone must not displace strong steady-state FCF.
  if (fcfHealthy && fcf != null) {
    return {
      value: fcf,
      basis: "fcf",
      note: "Normalized free cash flow (healthy cash conversion)",
      reinvestmentDepressed: false,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: fcf,
      },
    };
  }

  // —— Path 2: reinvesting growth compounder — look through trough FCF ——
  if (reinvestmentDepressed && growthCompounder) {
    const currentCandidates = [fcf, ni, nopat, ocfProxy].filter(
      (v): v is number => v != null && v > 0,
    );
    if (!currentCandidates.length) return null;

    const rawChosen = Math.max(...currentCandidates);

    // Mid-cycle owner-earnings margin: between current economics and a capped run-rate
    const rev = f.totalRevenue;
    let lookThrough: number | null = null;
    if (rev != null && rev > 0) {
      const niMargin = ni != null ? ni / rev : 0;
      const opMargin =
        f.operatingMargins != null && f.operatingMargins > 0
          ? f.operatingMargins
          : nopat != null
            ? nopat / rev / 0.79
            : 0;
      const fcfMargin = f.fcfMargin != null && f.fcfMargin > 0 ? f.fcfMargin : 0;
      // Aspire toward sustainable mid-cycle FCF/earnings power — capped (not fantasy)
      const targetMargin = clamp(
        Math.max(fcfMargin, niMargin * 0.9, opMargin * 0.75, 0.05),
        0.05,
        0.14,
      );
      lookThrough = rev * targetMargin;

      // One-year growth look-through on the better of current vs mid-cycle
      const g = Math.max(
        f.revenueGrowth ?? 0,
        f.earningsGrowth ?? 0,
        f.revenueEstimateGrowth ?? 0,
        0,
      );
      const growthLift = 1 + Math.min(0.22, Math.max(0, g) * 0.7);
      lookThrough *= growthLift;
    }

    // Blend current observed power with look-through (never below current)
    let value = rawChosen;
    let note =
      "Reinvestment-depressed FCF — using operating/earnings power, not trough FCF alone";
    if (lookThrough != null && lookThrough > rawChosen) {
      value = rawChosen * 0.4 + lookThrough * 0.6;
      note =
        "Reinvestment-depressed FCF — blended look-through to mid-cycle earnings power";
    } else {
      // Still prefer operating/earnings over thin FCF
      const opPrefer = [ni, nopat, ocfProxy].filter(
        (v): v is number => v != null && v > 0,
      );
      if (opPrefer.length) {
        value = Math.max(...opPrefer);
      }
    }

    const basis: EarningsBasis =
      nopat != null && value >= (ni ?? 0) * 0.95 ? "operating" : "earnings";

    return {
      value,
      basis,
      note,
      reinvestmentDepressed: true,
      growthCompounder: true,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough,
        rawChosen,
      },
    };
  }

  // —— Path 3: thin FCF, not a growth compounder — prefer earnings ——
  if (fcf != null && ni != null && fcf < ni * 0.35) {
    return {
      value: ni,
      basis: "earnings",
      note: "FCF thin vs earnings — using normalized earnings power",
      reinvestmentDepressed: reinvestmentDepressed,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: ni,
      },
    };
  }

  if (fcf != null) {
    return {
      value: fcf,
      basis: "fcf",
      note: "Normalized free cash flow",
      reinvestmentDepressed,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: fcf,
      },
    };
  }

  if (ni != null && ni > 0) {
    return {
      value: ni,
      basis: "earnings",
      note: "Normalized earnings power (FCF unavailable or negative)",
      reinvestmentDepressed,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: ni,
      },
    };
  }

  if (nopat != null && nopat > 0) {
    return {
      value: nopat,
      basis: "operating",
      note: "Normalized operating earnings (NOPAT)",
      reinvestmentDepressed,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: nopat,
      },
    };
  }

  if (ocfProxy != null) {
    return {
      value: ocfProxy,
      basis: "fcf",
      note: "Operating cash flow × 0.65 (FCF/earnings unavailable)",
      reinvestmentDepressed,
      growthCompounder,
      debug: {
        fcf,
        netIncome: ni,
        nopat,
        ocfProxy,
        lookThrough: null,
        rawChosen: ocfProxy,
      },
    };
  }

  return null;
}

/**
 * Justified equity multiple — growth-aware, still capped (not a bull-case fantasy).
 */
function justifiedMultiple(input: {
  financialStrength: number | null;
  profitability: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  revenueEstimateGrowth: number | null;
  operatingMarginTrend: number | null;
  basis: EarningsBasis;
  earlyGrowth: boolean;
  growthCompounder: boolean;
  reinvestmentDepressed: boolean;
  fcfConversionWeak: boolean;
}): { multiple: number; note: string } {
  let m =
    input.basis === "fcf" ? 17 : input.basis === "operating" ? 16 : 15;

  const scores = [input.financialStrength, input.profitability].filter(
    (v): v is number => v != null,
  );
  if (scores.length) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg >= 80) m += 7;
    else if (avg >= 65) m += 4;
    else if (avg >= 50) m += 2;
    else if (avg >= 35) m += 0;
    else if (avg >= 25) m -= 3;
    else m -= 6;
  }

  const g = Math.max(
    input.revenueGrowth ?? Number.NEGATIVE_INFINITY,
    input.earningsGrowth ?? Number.NEGATIVE_INFINITY,
    input.revenueEstimateGrowth ?? Number.NEGATIVE_INFINITY,
  );
  if (Number.isFinite(g)) {
    if (g >= 0.25) m += 10;
    else if (g >= 0.15) m += 7;
    else if (g >= 0.1) m += 5;
    else if (g >= 0.06) m += 2;
    else if (g < 0) m -= 4;
  }

  if (
    input.operatingMarginTrend != null &&
    input.operatingMarginTrend >= 0.01
  ) {
    m += 2;
  }

  // Growth compounders earn a higher justified multiple; reinvestment alone is not punished
  if (input.growthCompounder) {
    m += 4;
    if (input.reinvestmentDepressed) m += 2;
  }

  // Poor cash conversion lowers multiple — but not when we already identified
  // reinvestment-driven depression with growth quality
  if (input.fcfConversionWeak && !input.growthCompounder) {
    m -= 3;
  } else if (input.fcfConversionWeak && input.growthCompounder) {
    m -= 1; // mild only
  }

  if (input.financialStrength != null && input.financialStrength < 35) {
    m -= 4;
  }

  // Caps: allow elite growth more room; keep mature/ex-growth grounded
  const cap = input.growthCompounder ? 40 : input.earlyGrowth ? 24 : 28;
  const floor = 8;
  m = clamp(m, floor, cap);

  const label =
    input.basis === "fcf"
      ? "P/FCF"
      : input.basis === "operating"
        ? "P/NOPAT"
        : "P/E";

  return {
    multiple: m,
    note: `Justified ${label} ${m.toFixed(1)}x`,
  };
}

/**
 * EV/Sales cross-check for reinvesting growth compounders only.
 * Provides a conservative sales-based equity value when earnings understate scale.
 */
function salesCrossCheckEquity(input: {
  revenue: number;
  growthCompounder: boolean;
  reinvestmentDepressed: boolean;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  financialStrength: number | null;
  netCash: number;
}): number | null {
  if (!input.growthCompounder || !input.reinvestmentDepressed) return null;
  if (input.financialStrength != null && input.financialStrength < 40) {
    return null;
  }

  const g = Math.max(
    input.revenueGrowth ?? 0,
    input.earningsGrowth ?? 0,
    0,
  );

  // Conservative EV/S: 2.5–6.5x (not market-peak multiples)
  let evSales = 2.5;
  if (g >= 0.25) evSales += 2.5;
  else if (g >= 0.15) evSales += 1.8;
  else if (g >= 0.1) evSales += 1.2;
  else if (g >= 0.08) evSales += 0.7;

  if (input.grossMargins != null && input.grossMargins >= 0.25) evSales += 0.6;
  if (input.operatingMargins != null && input.operatingMargins >= 0.08) {
    evSales += 0.4;
  }

  evSales = clamp(evSales, 2.5, 6.5);
  const enterpriseValue = input.revenue * evSales;
  return enterpriseValue + input.netCash;
}

/**
 * Growth-aware Fair Value — justified multiple on normalized economic power.
 */
export function computeFairValueAssessment(input: {
  assetType: "stock" | "crypto";
  price: number | null;
  fundamentals: FundamentalInputs | null;
  fundamental: FundamentalResult;
}): FairValueResult {
  if (input.assetType !== "stock") {
    return emptyFairValue([
      "Fair Value is not applicable for crypto assets.",
    ]);
  }

  const f = input.fundamentals;
  if (!f) {
    return emptyFairValue([
      "Fundamentals unavailable — Fair Value cannot be computed.",
    ]);
  }

  const price = input.price != null && input.price > 0 ? input.price : null;
  const fs =
    input.fundamental.pillars.find((p) => p.id === "financial_strength")
      ?.score ?? null;
  const profitability =
    input.fundamental.pillars.find((p) => p.id === "profitability")?.score ??
    null;
  const model = input.fundamental.classification.businessModel;
  const earlyGrowth = model === "early_growth";

  const inputsUsed: string[] = [];
  const missingInputs: string[] = [];
  const notes: string[] = [];

  const { shares, source: shareSource } = resolveSharesOutstanding(f, price);
  if (shares == null) {
    missingInputs.push("Shares outstanding");
    return {
      ...emptyFairValue([
        "Fair Value unavailable — could not resolve share count.",
      ]),
      price,
      missingInputs,
    };
  }
  inputsUsed.push(`Shares (${shareSource}: ${formatCompact(shares)})`);

  const owner = normalizeEconomicPower(f, fs, profitability);
  if (owner == null) {
    missingInputs.push("Normalized FCF / earnings");
    return {
      ...emptyFairValue([
        "Fair Value unavailable — no usable free cash flow or earnings power.",
      ]),
      price,
      inputsUsed,
      missingInputs,
    };
  }
  inputsUsed.push(owner.note);
  notes.push(owner.note);
  notes.push(
    `Debug power: FCF=${fmt(owner.debug.fcf)} NI=${fmt(owner.debug.netIncome)} NOPAT=${fmt(owner.debug.nopat)} OCF×0.65=${fmt(owner.debug.ocfProxy)} lookThrough=${fmt(owner.debug.lookThrough)} chosen=${formatCompact(owner.value)} (reinvestDepressed=${owner.reinvestmentDepressed}, growthCompounder=${owner.growthCompounder})`,
  );

  let earningsPower = owner.value;
  const fcfConv =
    f.freeCashflow != null &&
    f.operatingCashflow != null &&
    f.operatingCashflow !== 0
      ? f.freeCashflow / f.operatingCashflow
      : null;
  const fcfConversionWeak = fcfConv != null && fcfConv < 0.25;

  // Haircuts: weak FS always; weak conversion only when NOT a growth compounder
  // (reinvestment-driven thin FCF should not force deep-value on quality growers)
  if (fcfConversionWeak && !owner.growthCompounder && owner.basis === "earnings") {
    earningsPower *= 0.85;
    notes.push("Earnings haircut — weak FCF conversion.");
  }
  if (fs != null && fs < 35) {
    earningsPower *= 0.85;
    notes.push("Earnings haircut — weak Financial Strength.");
  }

  const { multiple, note: multNote } = justifiedMultiple({
    financialStrength: fs,
    profitability,
    revenueGrowth: f.revenueGrowth,
    earningsGrowth: f.earningsGrowth,
    revenueEstimateGrowth: f.revenueEstimateGrowth,
    operatingMarginTrend: f.operatingMarginTrend,
    basis: owner.basis,
    earlyGrowth,
    growthCompounder: owner.growthCompounder,
    reinvestmentDepressed: owner.reinvestmentDepressed,
    fcfConversionWeak,
  });
  inputsUsed.push(multNote);
  notes.push(multNote);

  const cash = f.totalCash ?? 0;
  const debt = f.totalDebt ?? 0;
  const netCash = cash - debt;
  const hasBalanceSheet = f.totalCash != null || f.totalDebt != null;

  // Earnings / FCF multiple → equity value
  let equityFromEarnings = earningsPower * multiple;
  if (hasBalanceSheet) {
    if (owner.basis === "fcf") {
      // Levered FCF: add cash only (interest already in FCF)
      if (cash > 0) {
        equityFromEarnings += cash;
        inputsUsed.push(`+ Cash ${formatCompact(cash)}`);
      }
    } else {
      // Operating / earnings: full net cash bridge
      equityFromEarnings += netCash;
      inputsUsed.push(
        netCash >= 0
          ? `Net cash ${formatCompact(netCash)}`
          : `Net debt ${formatCompact(-netCash)}`,
      );
    }
  }

  // Sales cross-check for reinvesting growth compounders
  let equityFromSales: number | null = null;
  if (f.totalRevenue != null && f.totalRevenue > 0) {
    equityFromSales = salesCrossCheckEquity({
      revenue: f.totalRevenue,
      growthCompounder: owner.growthCompounder,
      reinvestmentDepressed: owner.reinvestmentDepressed,
      revenueGrowth: f.revenueGrowth,
      earningsGrowth: f.earningsGrowth,
      grossMargins: f.grossMargins,
      operatingMargins: f.operatingMargins,
      financialStrength: fs,
      netCash: hasBalanceSheet ? netCash : 0,
    });
  }

  let equityValue = equityFromEarnings;
  if (
    equityFromSales != null &&
    equityFromSales > equityFromEarnings &&
    owner.growthCompounder
  ) {
    // Blend: keep earnings anchor, lift toward conservative sales cross-check
    // Cap sales lift at 1.75× earnings equity so Base stays explainable
    const cappedSales = Math.min(equityFromSales, equityFromEarnings * 1.75);
    equityValue = equityFromEarnings * 0.55 + cappedSales * 0.45;
    notes.push(
      `Sales cross-check EV: ${formatCompact(equityFromSales)} blended with earnings equity ${formatCompact(equityFromEarnings)} → ${formatCompact(equityValue)}.`,
    );
  }

  notes.push(
    `Debug bridge: power=${formatCompact(earningsPower)} × ${multiple.toFixed(1)} = earningsEquity ${formatCompact(equityFromEarnings)}; salesEquity=${fmt(equityFromSales)}; finalEquity=${formatCompact(equityValue)}; shares=${formatCompact(shares)}.`,
  );

  if (!(equityValue > 0)) {
    return {
      ...emptyFairValue([
        "Fair Value unavailable — equity value was non-positive after adjustments.",
      ]),
      price,
      inputsUsed,
      missingInputs,
      notes,
    };
  }

  const base = round1(equityValue / shares);

  // Sanity: reject absurd scale (unit bugs)
  if (price != null) {
    const ratio = base / price;
    if (ratio < 0.02 || ratio > 20) {
      return {
        ...emptyFairValue([
          `Fair Value unavailable — computed Base $${base.toFixed(2)} is outside a believable range vs price $${price.toFixed(2)} (possible data-scale issue).`,
          ...notes,
        ]),
        price,
        inputsUsed,
        missingInputs,
        notes,
      };
    }
  }

  // —— Growth-adjusted FV (automatic, capped) ——
  let upsidePremium = 0;
  const gMax = Math.max(
    f.revenueGrowth ?? 0,
    f.earningsGrowth ?? 0,
    f.revenueEstimateGrowth ?? 0,
    0,
  );
  if (owner.growthCompounder && (fs == null || fs >= 45)) {
    upsidePremium = Math.min(0.45, 0.12 + gMax * 0.9);
    if (owner.reinvestmentDepressed) {
      upsidePremium = Math.min(0.5, upsidePremium + 0.08);
    }
    notes.push(
      `Growth-adjusted FV +${(upsidePremium * 100).toFixed(0)}% — longer growth duration vs Base.`,
    );
  } else if (gMax >= 0.12 && (fs == null || fs >= 45)) {
    upsidePremium = Math.min(0.28, 0.08 + gMax * 0.5);
    notes.push(
      `Growth-adjusted FV +${(upsidePremium * 100).toFixed(0)}% from revenue/earnings growth.`,
    );
  } else if (
    f.operatingMarginTrend != null &&
    f.operatingMarginTrend >= 0.015 &&
    (fs == null || fs >= 45)
  ) {
    upsidePremium = 0.1;
    notes.push("Growth-adjusted FV +10% from margin expansion.");
  }
  if (fs != null && fs < 45) {
    upsidePremium = Math.min(upsidePremium, 0.05);
  }

  const upside =
    upsidePremium > 0 ? round1(base * (1 + upsidePremium)) : null;
  const mid =
    upside != null ? round1((base + upside) / 2) : base;

  // —— Labels (plain language) ——
  let label: FairValueLabel = "Fairly valued";
  let takeaway = "Price is near modeled fair value.";
  const qualityWeak =
    (fs != null && fs < 40) || (profitability != null && profitability < 35);
  const qualityOk =
    (fs == null || fs >= 45) &&
    (profitability == null || profitability >= 40);
  const strongGrowth =
    owner.growthCompounder ||
    (f.revenueGrowth != null && f.revenueGrowth >= 0.12) ||
    (f.earningsGrowth != null && f.earningsGrowth >= 0.15);

  if (price != null) {
    const cheapBand = base * 0.85;
    const richVsBase = base * 1.15;
    const growthRef = upside ?? base;

    if (price < cheapBand && qualityWeak) {
      label = "Cheap, but business quality is weak";
      takeaway =
        "Price is below Base Fair Value, but Financial Strength / Profitability look soft.";
    } else if (price < cheapBand && qualityOk) {
      label = "Undervalued";
      takeaway =
        "Price is meaningfully below Base Fair Value with acceptable quality.";
    } else if (
      price > richVsBase &&
      strongGrowth &&
      (fs == null || fs >= 50)
    ) {
      label = "Expensive today, strong growth potential";
      takeaway =
        upside != null && price > growthRef * 1.2
          ? "Well above Base and Growth-Adjusted Fair Value — rich today, with growth evidence that may support a premium over time."
          : "Above Base Fair Value on current economics, with growth evidence that may support a premium over time.";
    } else if (price > richVsBase) {
      label = "Overvalued";
      takeaway =
        "Price is above modeled fair value without enough quality/growth support.";
    } else {
      label = "Fairly valued";
      takeaway = "Price sits near Base Fair Value.";
    }
  }

  let confidence: RatingConfidence = "Medium";
  if (
    owner.basis === "fcf" &&
    !owner.reinvestmentDepressed &&
    shareSource?.includes("marketCap") &&
    fs != null &&
    profitability != null
  ) {
    confidence = "High";
  }
  if (owner.reinvestmentDepressed || owner.basis === "operating") {
    confidence = confidence === "High" ? "Medium" : confidence;
    notes.push(
      "Confidence tempered — Base uses look-through economics for a reinvesting growth profile.",
    );
  }
  if (shareSource?.includes("millions")) {
    confidence = confidence === "High" ? "Medium" : confidence;
  }
  if (f.dataSource === "yahoo") {
    notes.push("Yahoo fallback data — confidence tempered.");
    if (confidence === "High") confidence = "Medium";
  }

  const upsidePctVsBase =
    price != null ? round1(pctFromTo(price, base)) : null;

  notes.push(
    `Bridge: ${formatCompact(earningsPower)} × ${multiple.toFixed(1)} → equity ${formatCompact(equityValue)} / ${formatCompact(shares)} shares = $${base.toFixed(2)}${upside != null ? ` (growth-adj $${upside.toFixed(2)})` : ""}.`,
  );

  return {
    available: true,
    version: "v1.2",
    label,
    takeaway,
    confidence,
    price,
    scenarios: {
      base,
      upside,
      disruptive: null,
    },
    range: { low: base, mid, high: upside ?? base },
    bands: {
      plus30: round1(base * 1.3),
      plus10: round1(base * 1.1),
      fairLow: round1(base * 0.85),
      fairHigh: round1(base * 1.15),
      minus10: round1(base * 0.9),
      minus30: round1(base * 0.7),
    },
    upsidePctVsBase,
    downsidePctVsBase:
      price != null && price > base ? round1(pctFromTo(price, base)) : null,
    upsidePctVsMid: price != null ? round1(pctFromTo(price, mid)) : null,
    optionality: {
      score: null,
      label: null,
      reasons: [],
      reasonCodes: [],
    },
    inputsUsed,
    missingInputs,
    notes,
    disruptiveEnabled: false,
    disruptiveDisabledReason: "Simplified model — Disruptive scenario removed.",
  };
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(0);
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return formatCompact(n);
}
