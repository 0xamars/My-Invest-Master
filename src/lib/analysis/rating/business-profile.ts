/**
 * Growth / disruption business-profile detection for InvestSalsa.
 * Separate from industry capital-structure overlays (banks, REITs, etc.).
 * No ticker hardcoding — package fundamentals only.
 */
import {
  isBrokerageOrAssetManagerIndustry,
  isFinancialIntermediaryIndustry,
  isInsuranceIndustry,
  isReitOrUtilityIndustry,
} from "@/lib/analysis/rating/industry-model";
import type { FundamentalInputs } from "@/lib/analysis/rating/types";

export type GrowthBusinessProfile =
  | "reinvesting_growth_compounder"
  | "cash_compounder"
  | "cyclical_mixed"
  | "low_quality_fragile";

export type CriticalRedFlag =
  | "altman_distress"
  | "dangerous_leverage"
  | "impaired_equity"
  | "severe_liquidity"
  | "manipulation_concern"
  | "operating_deterioration";

export type BusinessProfilePolicy = {
  profile: GrowthBusinessProfile;
  profileLabel: string;
  criticalFlags: CriticalRedFlag[];
  criticalFlagLabels: string[];
  hasCriticalFlags: boolean;
  /** True when FCF/cash penalties are softened for reinvestment (no critical flags). */
  reinvestmentSoftWeighting: boolean;
  reasons: string[];
};

const PROFILE_LABELS: Record<GrowthBusinessProfile, string> = {
  reinvesting_growth_compounder: "Reinvesting growth compounder",
  cash_compounder: "Cash compounder",
  cyclical_mixed: "Cyclical / mixed",
  low_quality_fragile: "Low-quality / fragile",
};

const FLAG_LABELS: Record<CriticalRedFlag, string> = {
  altman_distress: "Altman Z distress zone",
  dangerous_leverage: "Dangerous leverage",
  impaired_equity: "Impaired equity cushion",
  severe_liquidity: "Severe liquidity stress",
  manipulation_concern: "Earnings-quality / manipulation concern",
  operating_deterioration: "Clear operating deterioration",
};

function isFinancialIntermediary(f: FundamentalInputs): boolean {
  return isFinancialIntermediaryIndustry({
    industryKey: f.industryKey,
    industry: f.industry,
    sectorKey: f.sectorKey,
  });
}

function industryRef(f: FundamentalInputs) {
  return {
    industryKey: f.industryKey,
    industry: f.industry,
    sectorKey: f.sectorKey,
  };
}

/** High-return asset-light names (payments, buyback compounders) — thin book equity is not distress. */
function assetLightHealthy(f: FundamentalInputs): boolean {
  if (f.returnOnAssets != null && f.returnOnAssets >= 0.08) return true;
  const cashRatio = f.cashToShortTermDebt ?? f.cashToDebt;
  if (cashRatio != null && cashRatio >= 1) return true;
  if (
    f.operatingMargins != null &&
    f.operatingMargins >= 0.2 &&
    f.freeCashflow != null &&
    f.freeCashflow > 0
  ) {
    return true;
  }
  return false;
}

/** Detect critical red flags that force strict scoring across pillars. */
export function detectCriticalRedFlags(
  f: FundamentalInputs,
): CriticalRedFlag[] {
  const flags: CriticalRedFlag[] = [];
  const ref = industryRef(f);
  const intermediary = isFinancialIntermediary(f);
  const reitUtil = isReitOrUtilityIndustry(ref);
  const brokerAm = isBrokerageOrAssetManagerIndustry(ref);

  if (
    !intermediary &&
    !reitUtil &&
    f.altmanZScore != null &&
    f.altmanZScore < 1.81
  ) {
    flags.push("altman_distress");
  }

  const leverage = f.netDebtToEbitda ?? f.debtToEbitda;
  const cashRatio = f.cashToShortTermDebt ?? f.cashToDebt;
  if (!intermediary && !reitUtil) {
    const earningsLev = leverage != null && leverage > 5;
    const deExtreme = f.debtToEquity != null && f.debtToEquity > 300;
    const deWithRealLeverage =
      deExtreme &&
      (leverage == null || leverage > 3.5) &&
      (cashRatio == null || cashRatio < 0.5);
    if (earningsLev || deWithRealLeverage) {
      flags.push("dangerous_leverage");
    }
  }

  if (intermediary) {
    const eaFloor = isInsuranceIndustry(f)
      ? 0.02
      : brokerAm
        ? 0.03
        : 0.035;
    if (f.equityToAssets != null && f.equityToAssets < eaFloor) {
      flags.push("impaired_equity");
    }
  } else if (reitUtil) {
    if (f.equityToAssets != null && f.equityToAssets < 0.03) {
      flags.push("impaired_equity");
    }
  } else if (f.equityToAssets != null && f.equityToAssets < 0) {
    flags.push("impaired_equity");
  } else if (
    f.equityToAssets != null &&
    f.equityToAssets < 0.12 &&
    !assetLightHealthy(f)
  ) {
    flags.push("impaired_equity");
  }
  // Negative book equity proxy: D/E extreme with tiny equity/assets
  if (
    !intermediary &&
    !reitUtil &&
    !assetLightHealthy(f) &&
    f.debtToEquity != null &&
    f.debtToEquity > 500 &&
    f.equityToAssets != null &&
    f.equityToAssets < 0.2
  ) {
    if (!flags.includes("impaired_equity")) flags.push("impaired_equity");
  }

  if (!intermediary && !reitUtil) {
    if (
      (f.currentRatio != null && f.currentRatio < 0.8) &&
      (cashRatio == null || cashRatio < 0.35)
    ) {
      flags.push("severe_liquidity");
    }
    if (f.currentRatio != null && f.currentRatio < 0.6) {
      if (!flags.includes("severe_liquidity")) flags.push("severe_liquidity");
    }
  }

  if (f.beneishMScore != null && f.beneishMScore > -1.78) {
    flags.push("manipulation_concern");
  }

  // Operating collapse without a growth/reinvestment story
  const opCollapse =
    f.operatingMarginTrend != null && f.operatingMarginTrend <= -0.05;
  const revContracting =
    f.revenueGrowth == null || f.revenueGrowth < 0.02;
  const grossShrinking =
    f.grossProfit != null &&
    f.grossProfitPrior != null &&
    f.grossProfit < f.grossProfitPrior * 0.95;
  if (opCollapse && revContracting && (grossShrinking || f.revenueGrowth != null && f.revenueGrowth < 0)) {
    flags.push("operating_deterioration");
  }

  return flags;
}

function strongGrowthTrajectory(f: FundamentalInputs): boolean {
  const rev = f.revenueGrowth;
  const eps = f.earningsGrowth;
  if (rev != null && rev >= 0.12) return true;
  if (eps != null && eps >= 0.15) return true;
  if (rev != null && eps != null && rev >= 0.08 && eps >= 0.08) return true;
  // Scale signal: gross profit dollars rising with solid revenue growth
  if (
    rev != null &&
    rev >= 0.1 &&
    f.grossProfit != null &&
    f.grossProfitPrior != null &&
    f.grossProfit > f.grossProfitPrior
  ) {
    return true;
  }
  return false;
}

function healthyFcf(f: FundamentalInputs): boolean {
  if (f.cashFlowReliable === false) return false;
  if (f.freeCashflow != null && f.freeCashflow > 0) {
    if (f.fcfMargin == null || f.fcfMargin >= 0.03) return true;
    if (f.ocfMargin != null && f.ocfMargin >= 0.08) return true;
  }
  if (
    f.operatingCashflow != null &&
    f.operatingCashflow > 0 &&
    f.fcfMargin != null &&
    f.fcfMargin >= 0.08
  ) {
    return true;
  }
  return false;
}

function reinvestmentDepressedFcf(f: FundamentalInputs): boolean {
  if (f.cashFlowReliable === false) return false;
  if (f.freeCashflow != null && f.freeCashflow <= 0) return true;
  if (
    f.freeCashflow != null &&
    f.operatingCashflow != null &&
    f.operatingCashflow > 0 &&
    f.freeCashflow / f.operatingCashflow < 0.35
  ) {
    return true;
  }
  if (f.fcfMargin != null && f.fcfMargin < 0) return true;
  return false;
}

function solidSolvencyProxy(
  f: FundamentalInputs,
  flags: CriticalRedFlag[],
): boolean {
  if (flags.length > 0) return false;
  if (isFinancialIntermediary(f) || isReitOrUtilityIndustry(industryRef(f))) {
    if (f.equityToAssets != null && f.equityToAssets < 0) return false;
    if (f.returnOnAssets != null && f.returnOnAssets < -0.02) return false;
    return true;
  }
  if (assetLightHealthy(f)) {
    if (f.equityToAssets != null && f.equityToAssets < 0) return false;
    return true;
  }
  if (f.altmanZScore != null && f.altmanZScore < 1.81) return false;
  if (f.currentRatio != null && f.currentRatio < 1.0) return false;
  if (f.equityToAssets != null && f.equityToAssets < 0.2) return false;
  const leverage = f.netDebtToEbitda ?? f.debtToEbitda;
  if (leverage != null && leverage > 4) return false;
  // If we lack solvency metrics, require at least no distress signals + some cash
  if (
    f.altmanZScore == null &&
    f.currentRatio == null &&
    f.equityToAssets == null
  ) {
    return f.totalCash != null && f.totalCash > 0;
  }
  return true;
}

/**
 * Classify growth/disruption business profile from package fundamentals.
 * Critical flags force strict scoring even when a growth story exists.
 */
export function resolveBusinessProfilePolicy(
  f: FundamentalInputs,
): BusinessProfilePolicy {
  const criticalFlags = detectCriticalRedFlags(f);
  const hasCriticalFlags = criticalFlags.length > 0;
  const reasons: string[] = [];

  const growth = strongGrowthTrajectory(f);
  const fcfOk = healthyFcf(f);
  const reinvestFcf = reinvestmentDepressedFcf(f);
  const solid = solidSolvencyProxy(f, criticalFlags);

  let profile: GrowthBusinessProfile;

  if (hasCriticalFlags && !growth) {
    profile = "low_quality_fragile";
    reasons.push("Critical solvency/quality flags with weak growth trajectory");
  } else if (hasCriticalFlags && growth) {
    // Growth story present but fragile BS — still fragile for policy
    profile = "low_quality_fragile";
    reasons.push(
      "Critical red flags present — growth story does not override balance-sheet risk",
    );
  } else if (growth && reinvestFcf && solid) {
    profile = "reinvesting_growth_compounder";
    reasons.push("Strong growth with reinvestment-depressed FCF and solid solvency");
  } else if (growth && solid && !reinvestFcf) {
    // Growing and converting cash — still a growth compounder, cash-healthy variant
    if (fcfOk) {
      profile = "cash_compounder";
      reasons.push("Healthy FCF with solid growth and solvency");
    } else {
      profile = "reinvesting_growth_compounder";
      reasons.push("Strong growth trajectory with acceptable solvency");
    }
  } else if (fcfOk && solid && !growth) {
    profile = "cash_compounder";
    reasons.push("Healthy cash economics with moderate/stable growth");
  } else if (
    !solid ||
    (!isFinancialIntermediary(f) &&
      !isReitOrUtilityIndustry(industryRef(f)) &&
      f.altmanZScore != null &&
      f.altmanZScore < 2.0 &&
      !growth)
  ) {
    profile = "low_quality_fragile";
    reasons.push("Weak solvency or fragile cash/equity profile");
  } else {
    profile = "cyclical_mixed";
    reasons.push("Mixed earnings/cash profile without a clear compounder pattern");
  }

  // Float/OCF is not operating FCF — don't stamp compounder labels on banks/insurers.
  if (
    isFinancialIntermediary(f) &&
    f.cashFlowReliable === false &&
    !hasCriticalFlags &&
    (profile === "reinvesting_growth_compounder" || profile === "cash_compounder")
  ) {
    profile = "cyclical_mixed";
    reasons.push(
      "Financial intermediary — OCF/FCF unreliable, so compounder cash labels are not applied",
    );
  }

  // Soft-weighting only for true reinvesting growth without critical flags
  const reinvestmentSoftWeighting =
    profile === "reinvesting_growth_compounder" && !hasCriticalFlags;

  if (reinvestmentSoftWeighting) {
    reasons.push(
      "Reinvestment soft-weighting active — FCF penalties tempered while solvency stays solid",
    );
  }
  if (hasCriticalFlags) {
    reasons.push("Strict scoring enforced due to critical red flags");
  }

  return {
    profile,
    profileLabel: PROFILE_LABELS[profile],
    criticalFlags,
    criticalFlagLabels: criticalFlags.map((fl) => FLAG_LABELS[fl]),
    hasCriticalFlags,
    reinvestmentSoftWeighting,
    reasons,
  };
}

/** Cash runway in years when burning FCF (cash / |FCF|). */
export function estimateCashRunwayYears(
  f: FundamentalInputs,
): number | null {
  if (
    f.freeCashflow == null ||
    f.freeCashflow >= 0 ||
    f.totalCash == null ||
    f.totalCash <= 0
  ) {
    return null;
  }
  const years = f.totalCash / Math.abs(f.freeCashflow);
  return Number.isFinite(years) ? years : null;
}

/** Pillar weights for overall fundamental score (sums to 1). */
export function fundamentalPillarWeights(policy: BusinessProfilePolicy): {
  financial_strength: number;
  profitability: number;
  growth: number;
  valuation: number;
} {
  if (policy.hasCriticalFlags || policy.profile === "low_quality_fragile") {
    return {
      financial_strength: 0.35,
      profitability: 0.25,
      growth: 0.15,
      valuation: 0.25,
    };
  }
  if (
    policy.profile === "reinvesting_growth_compounder" ||
    policy.reinvestmentSoftWeighting
  ) {
    return {
      financial_strength: 0.22,
      profitability: 0.2,
      growth: 0.33,
      valuation: 0.25,
    };
  }
  if (policy.profile === "cash_compounder") {
    return {
      financial_strength: 0.26,
      profitability: 0.26,
      growth: 0.24,
      valuation: 0.24,
    };
  }
  return {
    financial_strength: 0.25,
    profitability: 0.25,
    growth: 0.25,
    valuation: 0.25,
  };
}
