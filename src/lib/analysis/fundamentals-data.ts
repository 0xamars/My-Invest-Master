import type { FundamentalInputs } from "@/lib/analysis/rating/types";
import { allowYahooFallback, isFmpConfigured } from "@/lib/market-data/config";
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
 * Primary: FMP Analysis Package (Supabase warehouse). Yahoo only as last-resort fallback.
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
  let fmp: FundamentalInputs | null = null;
  if (isFmpConfigured() && !isFmpRateLimited()) {
    fmp = await fetchFmpFundamentals(symbol);
    if (fmp && fundamentalsCoverage(fmp) >= 4) {
      return fmp;
    }
  }

  // Yahoo is last resort only — never primary for equities fundamentals
  if (!allowYahooFallback()) {
    return fmp;
  }

  const yahoo = await fetchYahooFundamentalsFallback(symbol);
  if (!yahoo) return fmp;
  if (!fmp) return yahoo;
  return mergeFundamentals(fmp, yahoo);
}

function mergeFundamentals(
  primary: FundamentalInputs,
  fill: FundamentalInputs,
): FundamentalInputs {
  const out = { ...fill, ...primary };
  for (const key of CORE_FIELDS) {
    if (out[key] == null && fill[key] != null) {
      (out as Record<string, unknown>)[key] = fill[key];
    }
  }
  // Keep richer classification when FMP missing industry
  if (!out.industry && fill.industry) {
    out.industry = fill.industry;
    out.industryKey = fill.industryKey;
  }
  if (!out.sector && fill.sector) {
    out.sector = fill.sector;
    out.sectorKey = fill.sectorKey;
  }
  out.dataSource =
    fundamentalsCoverage(primary) >= fundamentalsCoverage(fill)
      ? primary.dataSource ?? "fmp"
      : "yahoo";
  if (
    fundamentalsCoverage(primary) < 4 &&
    fundamentalsCoverage(fill) >= fundamentalsCoverage(primary)
  ) {
    out.dataSource = "yahoo";
  }
  return out;
}

/** Thin Yahoo fallback — used when FMP is missing, sparse, or rate-limited. */
async function fetchYahooFundamentalsFallback(
  symbol: string,
): Promise<FundamentalInputs | null> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
    });
    const result = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: [
        "financialData",
        "defaultKeyStatistics",
        "summaryDetail",
        "assetProfile",
        "earningsTrend",
      ],
    });

    const fd = (result.financialData ?? {}) as Record<string, unknown>;
    const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
    const ap = (result.assetProfile ?? {}) as Record<string, unknown>;

    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const str = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : null;

    const freeCashflow = num(fd.freeCashflow);
    const marketCap = num(sd.marketCap) ?? num(ks.marketCap);
    const totalDebt = num(fd.totalDebt);
    const totalCash = num(fd.totalCash);
    const ebitda = num(fd.ebitda);
    const { toIndustryKey, applyIndustryOverride } = await import(
      "@/lib/market-data/industry-overrides"
    );
    const industry = str(ap.industryDisp) ?? str(ap.industry);
    const sector = str(ap.sectorDisp) ?? str(ap.sector);
    const classified = applyIndustryOverride(
      symbol,
      industry,
      toIndustryKey(industry),
      sector,
      toIndustryKey(sector),
    );

    return {
      debtToEquity: num(fd.debtToEquity),
      currentRatio: num(fd.currentRatio),
      quickRatio: num(fd.quickRatio),
      freeCashflow,
      operatingCashflow: num(fd.operatingCashflow),
      totalDebt,
      totalCash,
      ebitda,
      totalRevenue: num(fd.totalRevenue),
      bookValue: num(ks.bookValue),
      sharesOutstanding: num(ks.sharesOutstanding),
      grossMargins: num(fd.grossMargins),
      operatingMargins: num(fd.operatingMargins),
      profitMargins: num(fd.profitMargins) ?? num(ks.profitMargins),
      returnOnEquity: num(fd.returnOnEquity),
      returnOnAssets: num(fd.returnOnAssets),
      returnOnInvestedCapital: null,
      revenueGrowth: num(fd.revenueGrowth),
      earningsGrowth: num(fd.earningsGrowth),
      fcfGrowth: null,
      operatingIncomeGrowth: null,
      revenueGrowth3y: null,
      earningsGrowth3y: null,
      operatingGrowth3y: null,
      revenueEstimateGrowth: null,
      earningsEstimateGrowth: null,
      trailingPE: num(sd.trailingPE) ?? num(ks.trailingPE),
      forwardPE: num(sd.forwardPE) ?? num(ks.forwardPE),
      enterpriseToEbitda: num(ks.enterpriseToEbitda),
      priceToSales:
        num(sd.priceToSalesTrailing12Months) ??
        num(ks.priceToSalesTrailing12Months),
      priceToFcf:
        freeCashflow != null &&
        freeCashflow > 0 &&
        marketCap != null &&
        marketCap > 0
          ? marketCap / freeCashflow
          : null,
      pegRatio: num(ks.pegRatio),
      marketCap,
      recommendationKey: str(fd.recommendationKey),
      sector: classified.sector,
      sectorKey: classified.sectorKey,
      industry: classified.industry,
      industryKey: classified.industryKey,
      dataAsOf: new Date().toISOString(),
      equityToAssets: null,
      interestCoverage: null,
      netDebtToEbitda:
        totalDebt != null &&
        totalCash != null &&
        ebitda != null &&
        ebitda > 0
          ? (totalDebt - totalCash) / ebitda
          : null,
      debtToEbitda: null,
      cashToDebt:
        totalCash != null && totalDebt != null && totalDebt > 0
          ? totalCash / totalDebt
          : null,
      cashToShortTermDebt: null,
      fcfToDebt:
        freeCashflow != null && totalDebt != null && totalDebt > 0
          ? freeCashflow / totalDebt
          : null,
      ocfToDebt:
        num(fd.operatingCashflow) != null &&
        totalDebt != null &&
        totalDebt > 0
          ? num(fd.operatingCashflow)! / totalDebt
          : null,
      debtToRevenue:
        totalDebt != null &&
        num(fd.totalRevenue) != null &&
        num(fd.totalRevenue)! > 0
          ? totalDebt / num(fd.totalRevenue)!
          : null,
      fcfStability: null,
      altmanZScore: null,
      piotroskiScore: null,
      beneishMScore: null,
      wacc: null,
      ebit: null,
      totalAssets: null,
      workingCapital: null,
      ebitdaMargin:
        ebitda != null &&
        num(fd.totalRevenue) != null &&
        num(fd.totalRevenue)! !== 0
          ? ebitda / num(fd.totalRevenue)!
          : null,
      fcfMargin:
        freeCashflow != null &&
        num(fd.totalRevenue) != null &&
        num(fd.totalRevenue)! !== 0
          ? freeCashflow / num(fd.totalRevenue)!
          : null,
      ocfMargin:
        num(fd.operatingCashflow) != null &&
        num(fd.totalRevenue) != null &&
        num(fd.totalRevenue)! !== 0
          ? num(fd.operatingCashflow)! / num(fd.totalRevenue)!
          : null,
      cashFlowReliable: true,
      cashFlowNote: null,
      returnOnInvestedCapital3y: null,
      operatingMarginTrend: null,
      grossMarginTrend: null,
      netMarginTrend: null,
      roicTrend: null,
      enterpriseValue:
        marketCap != null
          ? marketCap + (totalDebt ?? 0) - (totalCash ?? 0)
          : null,
      evToFcf:
        marketCap != null &&
        freeCashflow != null &&
        freeCashflow > 0
          ? (marketCap + (totalDebt ?? 0) - (totalCash ?? 0)) / freeCashflow
          : null,
      evToSales:
        marketCap != null &&
        num(fd.totalRevenue) != null &&
        num(fd.totalRevenue)! > 0
          ? (marketCap + (totalDebt ?? 0) - (totalCash ?? 0)) /
            num(fd.totalRevenue)!
          : null,
      priceToOcf:
        marketCap != null &&
        num(fd.operatingCashflow) != null &&
        num(fd.operatingCashflow)! > 0
          ? marketCap / num(fd.operatingCashflow)!
          : null,
      evToEbit: null,
      fcfYield:
        freeCashflow != null &&
        freeCashflow > 0 &&
        marketCap != null &&
        marketCap > 0
          ? freeCashflow / marketCap
          : null,
      earningsYield:
        num(sd.trailingPE) != null && num(sd.trailingPE)! > 0
          ? 1 / num(sd.trailingPE)!
          : null,
      trailingPeMedian5y: null,
      capitalExpenditure: null,
      researchAndDevelopment: null,
      grossProfit: null,
      grossProfitPrior: null,
      dataSource: "yahoo",
    };
  } catch {
    return null;
  }
}
