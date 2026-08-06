/**
 * Resolve missing FundamentalInputs fields with package-internal substitutes.
 * Never invents values; records what was substituted for explainability.
 */
import type { FundamentalInputs } from "@/lib/analysis/rating/types";

export type MetricSubstitution = {
  field: keyof FundamentalInputs | string;
  used: string;
  insteadOf: string;
  confidencePenalty: "none" | "mild" | "moderate";
};

export type ResolvedFundamentals = {
  inputs: FundamentalInputs;
  substitutions: MetricSubstitution[];
  missing: string[];
  confidencePenalty: number;
};

function pushMissing(missing: string[], label: string) {
  if (!missing.includes(label)) missing.push(label);
}

/**
 * Fill gaps using related package fields only. Applies mild confidence penalties
 * when a weaker proxy replaces the preferred metric.
 */
export function resolveFundamentalInputs(
  raw: FundamentalInputs,
): ResolvedFundamentals {
  const inputs: FundamentalInputs = { ...raw };
  const substitutions: MetricSubstitution[] = [];
  const missing: string[] = [];
  let confidencePenalty = 0;

  const sub = (
    field: keyof FundamentalInputs,
    value: number | null | undefined,
    used: string,
    insteadOf: string,
    penalty: MetricSubstitution["confidencePenalty"],
  ) => {
    if (inputs[field] != null) return;
    if (value == null || !Number.isFinite(value as number)) return;
    (inputs as Record<string, unknown>)[field] = value;
    substitutions.push({ field, used, insteadOf, confidencePenalty: penalty });
    if (penalty === "mild") confidencePenalty += 1;
    if (penalty === "moderate") confidencePenalty += 2;
  };

  // —— Leverage ——
  if (inputs.netDebtToEbitda == null) {
    if (inputs.debtToEbitda != null) {
      sub(
        "netDebtToEbitda",
        inputs.debtToEbitda,
        "Debt / EBITDA",
        "Net Debt / EBITDA",
        "mild",
      );
    } else if (
      inputs.totalDebt != null &&
      inputs.ebitda != null &&
      inputs.ebitda > 0
    ) {
      const v =
        (inputs.totalDebt - (inputs.totalCash ?? 0)) / inputs.ebitda;
      sub(
        "netDebtToEbitda",
        v,
        "Computed (Debt−Cash)/EBITDA",
        "Net Debt / EBITDA",
        "mild",
      );
    } else {
      pushMissing(missing, "Net Debt / EBITDA");
    }
  }

  if (inputs.debtToEbitda == null) {
    if (inputs.totalDebt != null && inputs.ebitda != null && inputs.ebitda > 0) {
      sub(
        "debtToEbitda",
        inputs.totalDebt / inputs.ebitda,
        "Computed Debt / EBITDA",
        "Debt / EBITDA",
        "mild",
      );
    } else if (inputs.debtToEquity != null) {
      // Weaker structural proxy — do not copy into debtToEbitda numerically
      // (different units). Leave missing; FS already scores D/E separately.
      pushMissing(missing, "Debt / EBITDA");
    } else {
      pushMissing(missing, "Debt / EBITDA");
    }
  }

  if (inputs.debtToEquity == null) {
    if (
      inputs.totalDebt != null &&
      inputs.totalAssets != null &&
      inputs.equityToAssets != null &&
      inputs.equityToAssets > 0
    ) {
      const equity = inputs.totalAssets * inputs.equityToAssets;
      if (equity > 0) {
        sub(
          "debtToEquity",
          (inputs.totalDebt / equity) * 100,
          "Computed Debt / Equity",
          "Debt / Equity",
          "mild",
        );
      }
    } else {
      pushMissing(missing, "Debt / Equity");
    }
  }

  // —— Cash conversion / margins ——
  if (inputs.fcfMargin == null) {
    if (
      inputs.freeCashflow != null &&
      inputs.totalRevenue != null &&
      inputs.totalRevenue > 0
    ) {
      sub(
        "fcfMargin",
        inputs.freeCashflow / inputs.totalRevenue,
        "FCF / Revenue",
        "FCF margin",
        "none",
      );
    } else if (inputs.ocfMargin != null && inputs.ocfMargin >= 0) {
      sub(
        "fcfMargin",
        inputs.ocfMargin * 0.85,
        "OCF margin × 0.85",
        "FCF margin",
        "moderate",
      );
    } else {
      pushMissing(missing, "FCF margin");
    }
  }

  if (inputs.ocfMargin == null) {
    if (
      inputs.operatingCashflow != null &&
      inputs.totalRevenue != null &&
      inputs.totalRevenue > 0
    ) {
      sub(
        "ocfMargin",
        inputs.operatingCashflow / inputs.totalRevenue,
        "OCF / Revenue",
        "OCF margin",
        "none",
      );
    } else {
      pushMissing(missing, "OCF margin");
    }
  }

  if (inputs.freeCashflow == null) {
    if (
      inputs.operatingCashflow != null &&
      inputs.capitalExpenditure != null
    ) {
      sub(
        "freeCashflow",
        inputs.operatingCashflow + inputs.capitalExpenditure,
        "OCF + CapEx",
        "Free cash flow",
        "mild",
      );
    } else {
      pushMissing(missing, "Free cash flow");
    }
  }

  if (inputs.fcfToDebt == null) {
    if (
      inputs.freeCashflow != null &&
      inputs.totalDebt != null &&
      inputs.totalDebt > 0
    ) {
      sub(
        "fcfToDebt",
        inputs.freeCashflow / inputs.totalDebt,
        "FCF / Debt",
        "FCF / Debt",
        "none",
      );
    } else if (
      inputs.operatingCashflow != null &&
      inputs.totalDebt != null &&
      inputs.totalDebt > 0
    ) {
      sub(
        "fcfToDebt",
        inputs.operatingCashflow / inputs.totalDebt,
        "OCF / Debt",
        "FCF / Debt",
        "moderate",
      );
    } else {
      pushMissing(missing, "FCF / Debt");
    }
  }

  // —— Returns ——
  if (inputs.returnOnInvestedCapital == null) {
    if (inputs.returnOnInvestedCapital3y != null) {
      sub(
        "returnOnInvestedCapital",
        inputs.returnOnInvestedCapital3y,
        "3y avg ROIC",
        "ROIC",
        "mild",
      );
    } else if (inputs.returnOnEquity != null) {
      sub(
        "returnOnInvestedCapital",
        inputs.returnOnEquity * 0.75,
        "ROE × 0.75 (weaker proxy)",
        "ROIC",
        "moderate",
      );
    } else if (inputs.returnOnAssets != null) {
      sub(
        "returnOnInvestedCapital",
        inputs.returnOnAssets,
        "ROA (weaker proxy)",
        "ROIC",
        "moderate",
      );
    } else {
      pushMissing(missing, "ROIC");
    }
  }

  // —— Coverage ——
  if (inputs.interestCoverage == null) {
    if (
      inputs.ebit != null &&
      inputs.totalDebt != null &&
      inputs.totalDebt > 0
    ) {
      // Rough proxy: EBIT / (debt × 5% assumed coupon) — only if ebit positive
      // Too invented — skip. Prefer skip + reweight.
      pushMissing(missing, "Interest coverage");
    } else {
      pushMissing(missing, "Interest coverage");
    }
  }

  if (inputs.cashToDebt == null) {
    if (inputs.totalCash != null && inputs.totalDebt != null) {
      if (inputs.totalDebt > 0) {
        sub(
          "cashToDebt",
          inputs.totalCash / inputs.totalDebt,
          "Cash / Debt",
          "Cash / Debt",
          "none",
        );
      } else if (inputs.totalCash > 0) {
        sub("cashToDebt", 10, "Unlevered + cash", "Cash / Debt", "mild");
      }
    } else {
      pushMissing(missing, "Cash / Debt");
    }
  }

  // —— Valuation ——
  if (inputs.forwardPE == null && inputs.trailingPE != null) {
    // Don't copy trailing into forward field — valuation engine should fall back.
    pushMissing(missing, "Forward P/E");
  }

  if (inputs.priceToFcf == null) {
    if (
      inputs.marketCap != null &&
      inputs.freeCashflow != null &&
      inputs.freeCashflow > 0
    ) {
      sub(
        "priceToFcf",
        inputs.marketCap / inputs.freeCashflow,
        "Market cap / FCF",
        "P/FCF",
        "none",
      );
    } else if (
      inputs.freeCashflow != null &&
      inputs.freeCashflow <= 0
    ) {
      // Known non-positive FCF — never invent a cheap P/FCF from OCF.
      pushMissing(missing, "P/FCF (FCF ≤ 0)");
    } else if (inputs.priceToOcf != null && inputs.priceToOcf > 0) {
      sub(
        "priceToFcf",
        inputs.priceToOcf * 1.15,
        "P/OCF × 1.15",
        "P/FCF",
        "moderate",
      );
    } else {
      pushMissing(missing, "P/FCF");
    }
  }

  if (inputs.priceToOcf == null) {
    if (
      inputs.marketCap != null &&
      inputs.operatingCashflow != null &&
      inputs.operatingCashflow > 0
    ) {
      sub(
        "priceToOcf",
        inputs.marketCap / inputs.operatingCashflow,
        "Market cap / OCF",
        "P/OCF",
        "none",
      );
    }
  }

  if (inputs.evToFcf == null) {
    if (
      inputs.enterpriseValue != null &&
      inputs.freeCashflow != null &&
      inputs.freeCashflow > 0
    ) {
      sub(
        "evToFcf",
        inputs.enterpriseValue / inputs.freeCashflow,
        "EV / FCF",
        "EV/FCF",
        "none",
      );
    } else {
      pushMissing(missing, "EV/FCF");
    }
  }

  if (inputs.enterpriseValue == null && inputs.marketCap != null) {
    sub(
      "enterpriseValue",
      inputs.marketCap + (inputs.totalDebt ?? 0) - (inputs.totalCash ?? 0),
      "Market cap + debt − cash",
      "Enterprise value",
      "mild",
    );
  }

  if (inputs.enterpriseToEbitda == null) {
    if (
      inputs.enterpriseValue != null &&
      inputs.ebitda != null &&
      inputs.ebitda > 0
    ) {
      sub(
        "enterpriseToEbitda",
        inputs.enterpriseValue / inputs.ebitda,
        "EV / EBITDA",
        "EV/EBITDA",
        "none",
      );
    } else {
      pushMissing(missing, "EV/EBITDA");
    }
  }

  if (inputs.ebitdaMargin == null) {
    if (
      inputs.ebitda != null &&
      inputs.totalRevenue != null &&
      inputs.totalRevenue > 0
    ) {
      sub(
        "ebitdaMargin",
        inputs.ebitda / inputs.totalRevenue,
        "EBITDA / Revenue",
        "EBITDA margin",
        "none",
      );
    } else {
      // Never proxy operating margin as EBITDA margin — different economics.
      pushMissing(missing, "EBITDA margin");
    }
  }

  // Shares for FV path
  if (inputs.sharesOutstanding == null) {
    pushMissing(missing, "Shares outstanding");
  }

  return {
    inputs,
    substitutions,
    missing,
    confidencePenalty,
  };
}

export function formatSubstitutionNotes(
  resolved: ResolvedFundamentals,
): string[] {
  const notes: string[] = [];
  for (const s of resolved.substitutions) {
    notes.push(`Used ${s.used} instead of ${s.insteadOf}.`);
  }
  if (resolved.missing.length > 0) {
    notes.push(
      `Unavailable metrics (skipped / reweighted): ${resolved.missing.slice(0, 12).join(", ")}${resolved.missing.length > 12 ? "…" : ""}.`,
    );
  }
  if (resolved.confidencePenalty >= 4) {
    notes.push("Multiple metric substitutes — fundamental confidence reduced.");
  } else if (resolved.confidencePenalty >= 2) {
    notes.push("Some metric substitutes applied — confidence tempered.");
  }
  return notes;
}
