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
};

type FmpProfileRow = Record<string, unknown>;

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
    };
  } catch {
    return null;
  }
}
