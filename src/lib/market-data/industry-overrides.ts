/**
 * Manual industry/sector overrides for known FMP (or legacy) misclassifications.
 * Keys are uppercase ticker symbols.
 */
export const INDUSTRY_OVERRIDES: Record<
  string,
  {
    industry: string;
    industryKey: string;
    sector?: string;
    sectorKey?: string;
  }
> = {
  // Crypto miners — often miscategorized; keep peer frame coherent
  MARA: {
    industry: "Crypto Mining",
    industryKey: "crypto-mining",
    sector: "Financial Services",
    sectorKey: "financial-services",
  },
  RIOT: {
    industry: "Crypto Mining",
    industryKey: "crypto-mining",
    sector: "Financial Services",
    sectorKey: "financial-services",
  },
  CLSK: {
    industry: "Crypto Mining",
    industryKey: "crypto-mining",
    sector: "Financial Services",
    sectorKey: "financial-services",
  },
  HUT: {
    industry: "Crypto Mining",
    industryKey: "crypto-mining",
    sector: "Financial Services",
    sectorKey: "financial-services",
  },
  BITF: {
    industry: "Crypto Mining",
    industryKey: "crypto-mining",
    sector: "Financial Services",
    sectorKey: "financial-services",
  },
};

export function applyIndustryOverride(
  symbol: string,
  industry: string | null,
  industryKey: string | null,
  sector: string | null,
  sectorKey: string | null,
): {
  industry: string | null;
  industryKey: string | null;
  sector: string | null;
  sectorKey: string | null;
} {
  const override = INDUSTRY_OVERRIDES[symbol.toUpperCase()];
  if (!override) {
    return { industry, industryKey, sector, sectorKey };
  }
  return {
    industry: override.industry,
    industryKey: override.industryKey,
    sector: override.sector ?? sector,
    sectorKey: override.sectorKey ?? sectorKey,
  };
}

export function toIndustryKey(industry: string | null | undefined): string | null {
  if (!industry?.trim()) return null;
  return industry
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
