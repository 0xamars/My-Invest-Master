import type { PeerBasis } from "@/lib/analysis/rating/types";

/**
 * Capital-structure scoring profile.
 * Most equities use `industry_peer` — scored against their own industry/sector peers.
 * Named overlays only adjust leverage/liquidity interpretation for structurally different models.
 */
export type CapitalProfile =
  | "industry_peer"
  | "brokerage_capital_markets"
  | "bank_insurance"
  | "reit_utilities"
  | "early_growth";

/** @deprecated Use CapitalProfile — kept as alias for existing imports. */
export type BusinessModel = CapitalProfile;

const BROKERAGE_KEYS = new Set([
  "capital-markets",
  "financial-data-stock-exchanges",
  "asset-management",
  "shell-companies",
]);

const BANK_INSURANCE_KEYS = new Set([
  "banks-diversified",
  "banks-regional",
  "banks-foreign",
  "mortgage-finance",
  "insurance-diversified",
  "insurance-life",
  "insurance-property-casualty",
  "insurance-reinsurance",
  "insurance-specialty",
  "credit-services",
]);

const REIT_UTILITIES_KEYS = new Set([
  "reit-specialty",
  "reit-industrial",
  "reit-retail",
  "reit-residential",
  "reit-office",
  "reit-healthcare-facilities",
  "reit-hotel-motel",
  "reit-diversified",
  "reit-mortgage",
  "utilities-regulated-electric",
  "utilities-regulated-gas",
  "utilities-regulated-water",
  "utilities-diversified",
  "utilities-renewable",
  "utilities-independent-power-producers",
]);

export function classifyCapitalProfile(input: {
  industryKey: string | null;
  sectorKey: string | null;
  industry: string | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  freeCashflow: number | null;
  revenueGrowth: number | null;
}): CapitalProfile {
  const key = (input.industryKey ?? "").toLowerCase();
  const industry = (input.industry ?? "").toLowerCase();
  const sector = (input.sectorKey ?? "").toLowerCase();

  if (
    BROKERAGE_KEYS.has(key) ||
    industry.includes("capital market") ||
    industry.includes("broker") ||
    industry.includes("exchange")
  ) {
    return "brokerage_capital_markets";
  }

  if (
    BANK_INSURANCE_KEYS.has(key) ||
    industry.includes("bank") ||
    industry.includes("insurance") ||
    (sector === "financial-services" &&
      (industry.includes("credit") || industry.includes("mortgage")))
  ) {
    return "bank_insurance";
  }

  if (
    REIT_UTILITIES_KEYS.has(key) ||
    industry.includes("reit") ||
    industry.startsWith("utilities") ||
    sector === "utilities" ||
    sector === "real-estate"
  ) {
    return "reit_utilities";
  }

  const unprofitable =
    (input.profitMargins != null && input.profitMargins < 0) ||
    (input.operatingMargins != null && input.operatingMargins < 0) ||
    (input.freeCashflow != null && input.freeCashflow < 0);
  const growing = input.revenueGrowth != null && input.revenueGrowth >= 0.1;

  if (unprofitable && growing) {
    return "early_growth";
  }

  // Default: industry/sector peer frame — never a generic "standard" bucket.
  return "industry_peer";
}

/** @deprecated Prefer classifyCapitalProfile */
export function classifyBusinessModel(
  input: Parameters<typeof classifyCapitalProfile>[0],
): CapitalProfile {
  return classifyCapitalProfile(input);
}

function capitalProfileOverlay(profile: CapitalProfile): string | null {
  switch (profile) {
    case "brokerage_capital_markets":
      return "brokerage / capital-markets leverage rules";
    case "bank_insurance":
      return "bank / insurance capital proxies";
    case "reit_utilities":
      return "REIT / utilities leverage bands";
    case "early_growth":
      return "early-growth liquidity emphasis";
    default:
      return null;
  }
}

/**
 * Human label for how this ticker is assessed — always anchored to industry/sector.
 * Example: "Auto Manufacturers (peer-relative)" rather than "Standard operating".
 */
export function comparisonFrameLabel(input: {
  industry: string | null;
  sector: string | null;
  capitalProfile: CapitalProfile;
  peerBasis: PeerBasis;
}): string {
  const frame =
    input.industry?.trim() ||
    input.sector?.trim() ||
    "Unclassified industry";

  const basisNote =
    input.peerBasis === "sub_industry"
      ? "sub-industry peers"
      : input.peerBasis === "industry"
        ? "industry-group peers"
        : input.peerBasis === "sector"
          ? "sector peers"
          : "absolute thresholds (peers unavailable)";

  const overlay = capitalProfileOverlay(input.capitalProfile);
  if (overlay) {
    return `${frame} · ${basisNote} · ${overlay}`;
  }
  return `${frame} · ${basisNote}`;
}

/** @deprecated Prefer comparisonFrameLabel */
export function businessModelLabel(model: CapitalProfile): string {
  return comparisonFrameLabel({
    industry: null,
    sector: null,
    capitalProfile: model,
    peerBasis: model === "industry_peer" ? "none" : "none",
  });
}
