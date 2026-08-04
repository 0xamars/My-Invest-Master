import { fmpFetch, num, str } from "@/lib/market-data/fmp/client";
import {
  applyIndustryOverride,
  toIndustryKey,
} from "@/lib/market-data/industry-overrides";

export type FmpProfile = {
  symbol: string;
  name: string | null;
  price: number | null;
  marketCap: number | null;
  beta: number | null;
  sector: string | null;
  sectorKey: string | null;
  industry: string | null;
  industryKey: string | null;
  currency: string | null;
  exchange: string | null;
  description: string | null;
  /** FMP vehicle flags when present on /profile. */
  isEtf: boolean | null;
  isFund: boolean | null;
  /** Original FMP profile row for vehicle/meta detection. */
  raw: Record<string, unknown> | null;
};

type FmpProfileRow = Record<string, unknown>;

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

export async function fetchFmpProfile(symbol: string): Promise<FmpProfile | null> {
  const upper = symbol.toUpperCase();
  try {
    const data = await fmpFetch<FmpProfileRow[] | FmpProfileRow>({
      path: "/profile",
      query: { symbol: upper },
      revalidate: 3600,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return null;

    const industry = str(row.industry);
    const sector = str(row.sector);
    const classified = applyIndustryOverride(
      upper,
      industry,
      toIndustryKey(industry),
      sector,
      toIndustryKey(sector),
    );

    return {
      symbol: str(row.symbol)?.toUpperCase() ?? upper,
      name: str(row.companyName) ?? str(row.name),
      price: num(row.price),
      marketCap: num(row.mktCap) ?? num(row.marketCap),
      beta: num(row.beta),
      sector: classified.sector,
      sectorKey: classified.sectorKey,
      industry: classified.industry,
      industryKey: classified.industryKey,
      currency: str(row.currency),
      exchange: str(row.exchangeShortName) ?? str(row.exchange),
      description: str(row.description),
      isEtf: asBool(row.isEtf) ?? asBool(row.isETF),
      isFund: asBool(row.isFund) ?? asBool(row.isMutualFund),
      raw: row as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
