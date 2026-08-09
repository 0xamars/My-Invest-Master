import { detectDigitalAssetTreasury } from "@/lib/analysis/rating/digital-asset-treasury";
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
  | "insurance_life"
  | "reit_utilities"
  | "early_growth"
  | "treasury_holding";

/** @deprecated Use CapitalProfile — kept as alias for existing imports. */
export type BusinessModel = CapitalProfile;

export type IndustryRef = {
  industryKey?: string | null;
  industry?: string | null;
  sectorKey?: string | null;
  sector?: string | null;
};

function norm(input: IndustryRef): { key: string; industry: string; sector: string } {
  return {
    key: (input.industryKey ?? "").toLowerCase().trim(),
    industry: (input.industry ?? "").toLowerCase().trim(),
    sector: (input.sectorKey ?? input.sector ?? "").toLowerCase().trim(),
  };
}

/** Payment networks / merchant acquirers / credit-card rails — operating companies, not deposit banks. */
export function isPaymentOrCreditRailIndustry(input: IndustryRef): boolean {
  const { key, industry } = norm(input);
  if (
    key.includes("payment") ||
    key === "credit-services" ||
    key === "financial-credit-services" ||
    key.includes("merchant-acquir")
  ) {
    return !industry.includes("bank") && !key.startsWith("banks");
  }
  if (industry.includes("bank") || industry.includes("thrift")) return false;
  return (
    industry.includes("payment processor") ||
    industry.includes("payment processing") ||
    industry.includes("payment network") ||
    industry.includes("merchant acquir") ||
    industry.includes("credit services") ||
    (industry.includes("credit card") && industry.includes("payment"))
  );
}

export function isInsuranceIndustry(input: IndustryRef): boolean {
  const { key, industry } = norm(input);
  if (
    key === "insurance-brokers" ||
    key.includes("insurance-broker") ||
    (industry.includes("broker") && industry.includes("insurance"))
  ) {
    return false;
  }
  if (
    key.startsWith("insurance") ||
    key.includes("reinsurance") ||
    key.includes("life-insurance") ||
    key.includes("life-assurance")
  ) {
    return true;
  }
  return (
    industry.includes("insurance") ||
    industry.includes("reinsurance") ||
    industry.includes("life assurance") ||
    industry.includes("property & casualty") ||
    industry.includes("property and casualty") ||
    /\bp\s*&\s*c\b/.test(industry) ||
    industry.includes("multi-line insurance") ||
    industry.includes("multiline insurance")
  );
}

export function isBankIndustry(input: IndustryRef): boolean {
  const { key, industry, sector } = norm(input);
  if (isInsuranceIndustry(input) || isPaymentOrCreditRailIndustry(input)) {
    return false;
  }
  if (industry.includes("reit") || key.startsWith("reit")) return false;
  if (key.startsWith("banks") || key.includes("thrift")) return true;
  if (
    key === "mortgage-finance" ||
    key === "thrifts-and-mortgage-finance" ||
    key === "savings-institutions"
  ) {
    return true;
  }
  if (/investment\s*-?\s*bank/.test(industry) || key.includes("investment-banking")) {
    return false;
  }
  if (
    /\bbanks?\b/.test(industry) ||
    industry.includes("thrift") ||
    industry.includes("savings & loan") ||
    industry.includes("savings and loan") ||
    industry.includes("money center")
  ) {
    return true;
  }
  if (industry.includes("consumer finance") || industry.includes("credit card")) {
    return !industry.includes("payment");
  }
  return (
    (sector === "financial-services" || sector === "financial") &&
    industry.includes("mortgage") &&
    !industry.includes("reit")
  );
}

/** Brokers, exchanges, asset managers, financial conglomerates — not payment rails or deposit banks. */
export function isBrokerageOrAssetManagerIndustry(input: IndustryRef): boolean {
  const { key, industry } = norm(input);
  if (isInsuranceIndustry(input) || isBankIndustry(input)) return false;
  if (isPaymentOrCreditRailIndustry(input)) return false;
  if (
    key === "capital-markets" ||
    key === "financial-capital-markets" ||
    key === "financial-data-stock-exchanges" ||
    key === "financial-data-and-stock-exchanges" ||
    key === "asset-management" ||
    key === "asset-management-cryptocurrency" ||
    key === "shell-companies" ||
    key === "financial-conglomerates" ||
    key === "investment-brokerage" ||
    key.includes("capital-market") ||
    key.includes("asset-management") ||
    key.includes("stock-exchange") ||
    key.includes("financial-conglomerat") ||
    key.includes("investment-broker") ||
    key.includes("wealth-management")
  ) {
    return true;
  }
  if (
    industry.includes("capital market") ||
    industry.includes("asset management") ||
    industry.includes("stock exchange") ||
    industry.includes("financial data") ||
    industry.includes("financial conglomerat") ||
    industry.includes("investment broker") ||
    industry.includes("wealth management") ||
    industry.includes("investment banking") ||
    industry.includes("investment - banking") ||
    industry.includes("securities")
  ) {
    return true;
  }
  return industry.includes("broker");
}

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
  "regulated-electric",
  "regulated-gas",
  "regulated-water",
  "independent-power-producers",
]);

export function isReitOrUtilityIndustry(input: IndustryRef): boolean {
  const { key, industry, sector } = norm(input);
  if (REIT_UTILITIES_KEYS.has(key)) return true;
  if (key.startsWith("reit") || key.startsWith("utilities")) return true;
  if (
    key.includes("regulated-electric") ||
    key.includes("regulated-gas") ||
    key.includes("regulated-water") ||
    key.includes("independent-power")
  ) {
    return true;
  }
  if (
    industry.includes("reit") ||
    industry.includes("utility") ||
    industry.includes("utilities") ||
    industry.includes("regulated electric") ||
    industry.includes("regulated gas") ||
    industry.includes("regulated water") ||
    industry.includes("independent power") ||
    industry.includes("independent power producer")
  ) {
    return true;
  }
  return sector === "utilities";
}

/** Banks, insurers, brokers, and asset managers — not payment networks. */
export function isFinancialIntermediaryIndustry(input: IndustryRef): boolean {
  return (
    isBankIndustry(input) ||
    isInsuranceIndustry(input) ||
    isBrokerageOrAssetManagerIndustry(input)
  );
}

export function isFinancialCapitalOverlay(
  profile: CapitalProfile,
): boolean {
  return profile === "bank_insurance" || profile === "insurance_life";
}

export function fsPolicyNote(profile: CapitalProfile): string {
  switch (profile) {
    case "insurance_life":
      return "Unscore CR/QR/cash-ST + Altman; insurer E/A bands; fragile only on true capital damage";
    case "bank_insurance":
      return "Unscore CR/QR/cash-ST + Altman; bank E/A bands; soft D/E";
    case "brokerage_capital_markets":
      return "Unscore CR/QR when 0/missing + Altman; soft D/E; bank-like E/A bands";
    case "reit_utilities":
      return "Unscore Altman; no industrial fragile CR/E/A; CR may still score";
    case "treasury_holding":
      return "Not software-elite FCF; peer blend off";
    case "early_growth":
      return "Liquidity emphasis; earnings/quality rules (not industry-only)";
    default:
      return "Full industrial FS metric set vs industry peers";
  }
}

/** Industry keys that typically require heavy invested capital. */
const CAPITAL_INTENSIVE_KEYS = new Set([
  "auto-manufacturers",
  "auto-parts",
  "auto-truck-dealerships",
  "aerospace-defense",
  "airlines",
  "airports-air-services",
  "railroads",
  "marine-shipping",
  "trucking",
  "integrated-freight-logistics",
  "farm-heavy-construction-machinery",
  "specialty-industrial-machinery",
  "industrial-distribution",
  "metal-fabrication",
  "steel",
  "aluminum",
  "copper",
  "other-industrial-metals-mining",
  "gold",
  "silver",
  "oil-gas-integrated",
  "oil-gas-ep",
  "oil-gas-midstream",
  "oil-gas-refining-marketing",
  "oil-gas-equipment-services",
  "uranium",
  "telecom-services",
  "entertainment",
  "building-materials",
  "building-products-equipment",
  "residential-construction",
  "packaging-containers",
  "paper-paper-products",
  "lumber-wood-production",
  "semiconductors",
  "semiconductor-equipment-materials",
  "solar",
  ...REIT_UTILITIES_KEYS,
]);

const CAPITAL_INTENSIVE_SECTORS = new Set([
  "industrials",
  "energy",
  "utilities",
  "basic-materials",
  "real-estate",
  "communication-services",
]);

export function isCapitalIntensiveIndustry(input: {
  industryKey: string | null;
  sectorKey: string | null;
  industry: string | null;
  sector: string | null;
}): boolean {
  const key = (input.industryKey ?? "").toLowerCase();
  const sectorKey = (input.sectorKey ?? "").toLowerCase();
  const industry = (input.industry ?? "").toLowerCase();
  const sector = (input.sector ?? "").toLowerCase();

  if (CAPITAL_INTENSIVE_KEYS.has(key)) return true;
  if (CAPITAL_INTENSIVE_SECTORS.has(sectorKey)) {
    if (sectorKey === "communication-services") {
      return (
        industry.includes("telecom") ||
        industry.includes("wireless") ||
        key.includes("telecom")
      );
    }
    return true;
  }

  return (
    industry.includes("auto manufacturer") ||
    industry.includes("automaker") ||
    industry.includes("airline") ||
    industry.includes("railroad") ||
    industry.includes("steel") ||
    industry.includes("mining") ||
    industry.includes("oil & gas") ||
    industry.includes("oil and gas") ||
    industry.includes("utility") ||
    industry.includes("utilities") ||
    industry.includes("telecom") ||
    industry.includes("semiconductor") ||
    industry.includes("heavy construction") ||
    industry.includes("industrial machinery") ||
    sector.includes("energy") ||
    sector.includes("utilities") ||
    sector.includes("industrials") ||
    sector.includes("basic materials")
  );
}

/** Software / internet names where equity comp is structurally higher. */
export function isHighEquityCompIndustry(input: IndustryRef): boolean {
  const { key, industry, sector } = norm(input);
  const blob = `${key} ${industry} ${sector}`;
  return (
    blob.includes("software") ||
    blob.includes("internet") ||
    blob.includes("interactive media") ||
    blob.includes("information technology") ||
    blob.includes("it services") ||
    blob.includes("semiconductor") ||
    blob.includes("application software") ||
    blob.includes("system software")
  );
}

export function classifyCapitalProfile(input: {
  industryKey: string | null;
  sectorKey: string | null;
  industry: string | null;
  sector?: string | null;
  name?: string | null;
  description?: string | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  freeCashflow: number | null;
  operatingCashflow?: number | null;
  totalRevenue?: number | null;
  ebitda?: number | null;
  revenueGrowth: number | null;
}): CapitalProfile {
  const ref: IndustryRef = {
    industryKey: input.industryKey,
    industry: input.industry,
    sectorKey: input.sectorKey,
    sector: input.sector,
  };

  const treasury = detectDigitalAssetTreasury({
    name: input.name,
    description: input.description,
    industry: input.industry,
    industryKey: input.industryKey,
    sector: input.sector,
    sectorKey: input.sectorKey,
    freeCashflow: input.freeCashflow,
    operatingCashflow: input.operatingCashflow,
    totalRevenue: input.totalRevenue,
    ebitda: input.ebitda,
  });
  if (treasury.isTreasury) {
    return "treasury_holding";
  }

  if (isInsuranceIndustry(ref)) return "insurance_life";
  if (isReitOrUtilityIndustry(ref)) return "reit_utilities";
  if (isBankIndustry(ref)) return "bank_insurance";
  if (isBrokerageOrAssetManagerIndustry(ref)) {
    return "brokerage_capital_markets";
  }

  const unprofitable =
    (input.profitMargins != null && input.profitMargins < 0) ||
    (input.operatingMargins != null && input.operatingMargins < 0) ||
    (input.freeCashflow != null && input.freeCashflow < 0);
  const growing = input.revenueGrowth != null && input.revenueGrowth >= 0.1;

  if (unprofitable && growing) {
    return "early_growth";
  }

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
      return "bank capital proxies";
    case "insurance_life":
      return "insurance capital proxies";
    case "reit_utilities":
      return "REIT / utilities leverage bands";
    case "early_growth":
      return "early-growth liquidity emphasis";
    case "treasury_holding":
      return "digital-asset treasury (not operating software peers)";
    default:
      return null;
  }
}

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
