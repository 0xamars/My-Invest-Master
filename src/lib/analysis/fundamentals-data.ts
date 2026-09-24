import type { FundamentalInputs } from "@/lib/analysis/rating/types";
import { isFmpConfigured } from "@/lib/market-data/config";
import { isFmpRateLimited } from "@/lib/market-data/fmp/client";
import { fetchFmpFundamentals } from "@/lib/market-data/fmp/fundamentals";

const CORE_FIELDS: Array<keyof FundamentalInputs> = [
  "debtToEquity",
  "currentRatio",
  "grossMargins",
  "operatingMargins",
  "profitMargins",
  "ebitdaMargin",
  "fcfMargin",
  "ocfMargin",
  "returnOnEquity",
  "returnOnAssets",
  "returnOnInvestedCapital",
  "revenueGrowth",
  "earningsGrowth",
  "trailingPE",
  "forwardPE",
  "enterpriseToEbitda",
  "priceToSales",
  "priceToFcf",
  "evToFcf",
  "evToSales",
  "priceToOcf",
  "freeCashflow",
  "totalDebt",
  "ebitda",
  "totalRevenue",
];

/** Count of core valuation / quality fields present. */
export function fundamentalsCoverage(inputs: FundamentalInputs): number {
  let n = 0;
  for (const key of CORE_FIELDS) {
    if (inputs[key] != null) n += 1;
  }
  return n;
}

/**
 * Equity fundamentals for InvestSalsa Rating.
 * Source: FMP Analysis Package (Supabase warehouse), then direct FMP.
 */
const fundamentalsCache = new Map<
  string,
  { expiresAt: number; value: FundamentalInputs | null }
>();
const fundamentalsInflight = new Map<
  string,
  Promise<FundamentalInputs | null>
>();
const FUNDAMENTALS_TTL_MS = 60 * 60_000;

export async function fetchStockFundamentals(
  symbol: string,
): Promise<FundamentalInputs | null> {
  const upper = symbol.toUpperCase();
  const cached = fundamentalsCache.get(upper);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = fundamentalsInflight.get(upper);
  if (existing) return existing;

  const run = (async () => {
    const value = await loadStockFundamentals(upper);
    fundamentalsCache.set(upper, {
      value,
      expiresAt: Date.now() + FUNDAMENTALS_TTL_MS,
    });
    if (fundamentalsCache.size > 200) {
      const first = fundamentalsCache.keys().next().value;
      if (first) fundamentalsCache.delete(first);
    }
    return value;
  })();

  fundamentalsInflight.set(upper, run);
  try {
    return await run;
  } finally {
    fundamentalsInflight.delete(upper);
  }
}

async function loadStockFundamentals(
  symbol: string,
): Promise<FundamentalInputs | null> {
  // Preferred path: shared FMP Analysis Package (warehouse-backed).
  try {
    const { getAnalysisPackage } = await import(
      "@/lib/market-data/warehouse/package"
    );
    const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
    if (pkg.fundamentals && fundamentalsCoverage(pkg.fundamentals) >= 4) {
      return pkg.fundamentals;
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[fundamentals] package load failed", err);
    }
  }

  // Direct FMP (memory-cached) if package incomplete
  if (isFmpConfigured() && !isFmpRateLimited()) {
    const fmp = await fetchFmpFundamentals(symbol);
    if (fmp && fundamentalsCoverage(fmp) >= 4) {
      return fmp;
    }
    return fmp;
  }

  return null;
}
