/**
 * Detect ETF / fund / trust vehicles that must not be scored as operating companies.
 * Uses FMP profile flags when present, plus industry/name/description heuristics.
 * No ticker hardcoding.
 */

export type NonOperatingVehicleKind =
  | "etf"
  | "fund"
  | "trust"
  | "closed_end_fund";

export type NonOperatingVehicleInfo = {
  isNonOperating: true;
  kind: NonOperatingVehicleKind;
  /** Short label for UI, e.g. "ETF/fund". */
  label: string;
  /** Why it was classified (deterministic explainability). */
  reason: string;
  /** Optional non-scored meta when present on profile. */
  meta: {
    name: string | null;
    category: string | null;
    provider: string | null;
  };
};

export type OperatingCompanyInfo = {
  isNonOperating: false;
};

export type VehicleDetection = NonOperatingVehicleInfo | OperatingCompanyInfo;

const INDUSTRY_VEHICLE_RE =
  /exchange\s*traded\s*fund|\betfs?\b|mutual\s*fund|closed[\s-]?end\s*fund|unit\s*investment\s*trust|\buit\b|money\s*market\s*fund|index\s*fund|trust\s*fund|asset\s*management\s*fund|investment\s*trust|exchange\s*traded\s*note|\betns?\b|exchange\s*traded\s*product|\betps?\b/i;

const NAME_VEHICLE_RE =
  /\b(ETF|ETN|ETP)\b|(Bitcoin|Ether|Ethereum|Crypto|Spot)\s+(Trust|ETF)|Trust\s+ETF|Index\s+Fund|Mutual\s+Fund|Closed[\s-]?End\s+Fund/i;

const DESCRIPTION_VEHICLE_RE =
  /\b(exchange[\s-]?traded\s+fund|this\s+etf|etf\s+seeks|fund\s+seeks\s+to\s+track|tracks\s+the\s+performance|unit\s+investment\s+trust)\b/i;

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export type VehicleProfileInput = {
  name?: string | null;
  industry?: string | null;
  industryKey?: string | null;
  sector?: string | null;
  sectorKey?: string | null;
  description?: string | null;
  exchange?: string | null;
  /** Explicit FMP flags when available. */
  isEtf?: boolean | null;
  isFund?: boolean | null;
  /** Raw FMP profile row (optional) for flags / category fields. */
  raw?: Record<string, unknown> | null;
};

function kindLabel(kind: NonOperatingVehicleKind): string {
  switch (kind) {
    case "etf":
      return "ETF";
    case "fund":
      return "fund";
    case "trust":
      return "trust";
    case "closed_end_fund":
      return "closed-end fund";
    default:
      return "fund vehicle";
  }
}

/**
 * Classify whether a symbol is a non-operating investment vehicle
 * (ETF / fund / trust) vs an operating company.
 */
export function detectNonOperatingVehicle(
  input: VehicleProfileInput | null | undefined,
): VehicleDetection {
  if (!input) return { isNonOperating: false };

  const raw = input.raw ?? null;
  const isEtf =
    asBool(input.isEtf) ??
    asBool(raw?.isEtf) ??
    asBool(raw?.isETF) ??
    null;
  const isFund =
    asBool(input.isFund) ??
    asBool(raw?.isFund) ??
    asBool(raw?.isMutualFund) ??
    null;

  const name = str(input.name) ?? str(raw?.companyName) ?? str(raw?.name);
  const industry =
    str(input.industry) ?? str(raw?.industry) ?? str(input.industryKey);
  const sector = str(input.sector) ?? str(raw?.sector) ?? str(input.sectorKey);
  const description =
    str(input.description) ?? str(raw?.description) ?? null;

  const category =
    str(raw?.category) ??
    str(raw?.fundCategory) ??
    str(raw?.etfCategory) ??
    industry;
  const provider =
    str(raw?.fundFamily) ??
    str(raw?.etfCompany) ??
    str(raw?.sponsor) ??
    str(raw?.issuer) ??
    null;

  const meta = {
    name,
    category,
    provider,
  };

  if (isEtf === true) {
    return {
      isNonOperating: true,
      kind: "etf",
      label: "ETF",
      reason: "Profile flag isEtf=true",
      meta,
    };
  }
  if (isFund === true) {
    return {
      isNonOperating: true,
      kind: "fund",
      label: "fund",
      reason: "Profile flag isFund=true",
      meta,
    };
  }

  if (industry && INDUSTRY_VEHICLE_RE.test(industry)) {
    const kind: NonOperatingVehicleKind = /closed[\s-]?end/i.test(industry)
      ? "closed_end_fund"
      : /trust/i.test(industry)
        ? "trust"
        : /etf|exchange\s*traded/i.test(industry)
          ? "etf"
          : "fund";
    return {
      isNonOperating: true,
      kind,
      label: kindLabel(kind),
      reason: `Industry classified as vehicle (${industry})`,
      meta,
    };
  }

  if (name && NAME_VEHICLE_RE.test(name)) {
    const kind: NonOperatingVehicleKind = /\bETF\b/i.test(name)
      ? "etf"
      : /Trust/i.test(name)
        ? "trust"
        : "fund";
    return {
      isNonOperating: true,
      kind,
      label: kindLabel(kind),
      reason: `Name indicates fund vehicle (${name})`,
      meta,
    };
  }

  if (description && DESCRIPTION_VEHICLE_RE.test(description)) {
    return {
      isNonOperating: true,
      kind: "etf",
      label: "ETF/fund",
      reason: "Description indicates an ETF/fund vehicle",
      meta,
    };
  }

  // Sector-only "Financial Services" is not enough (banks/insurers are operating).
  void sector;
  return { isNonOperating: false };
}

export function isNonOperatingVehicle(
  input: VehicleProfileInput | null | undefined,
): boolean {
  return detectNonOperatingVehicle(input).isNonOperating;
}

/** User-facing Fundamentals panel copy for fund vehicles. */
export function nonOperatingVehicleFundamentalsMessage(
  info: NonOperatingVehicleInfo,
  symbol?: string | null,
): string {
  const sym = symbol?.toUpperCase() ?? null;
  const example = sym ? ` like ${sym}` : "";
  return `This is an ${info.label}. InvestSalsa company fundamentals (Financial Strength, Profitability, Growth, Valuation) apply to operating companies, not fund vehicles${example}.`;
}
