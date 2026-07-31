import type { FundamentalInputs } from "@/lib/analysis/rating/types";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function computeRoic(input: {
  totalRevenue: number | null;
  operatingMargins: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  totalDebt: number | null;
  totalCash: number | null;
}): number | null {
  const {
    totalRevenue,
    operatingMargins,
    bookValue,
    sharesOutstanding,
    totalDebt,
    totalCash,
  } = input;
  if (
    totalRevenue == null ||
    operatingMargins == null ||
    bookValue == null ||
    sharesOutstanding == null ||
    totalDebt == null ||
    totalCash == null ||
    totalRevenue <= 0 ||
    sharesOutstanding <= 0
  ) {
    return null;
  }

  const ebit = totalRevenue * operatingMargins;
  const nopat = ebit * 0.79; // statutory-tax approximation
  const equity = bookValue * sharesOutstanding;
  const invested = equity + totalDebt - totalCash;
  if (!Number.isFinite(invested) || invested <= 0) return null;
  const roic = nopat / invested;
  return Number.isFinite(roic) ? roic : null;
}

function trendGrowth(
  trend: Array<Record<string, unknown>> | undefined,
  period: string,
  field: "growth" | "revenue",
): number | null {
  if (!trend) return null;
  const row = trend.find((t) => t.period === period);
  if (!row) return null;
  if (field === "growth") return num(row.growth);
  const revenueEstimate = row.revenueEstimate as
    | Record<string, unknown>
    | undefined;
  return num(revenueEstimate?.growth);
}

export async function fetchStockFundamentals(
  symbol: string,
): Promise<FundamentalInputs | null> {
  try {
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
    const trend = (
      result.earningsTrend as { trend?: Array<Record<string, unknown>> } | undefined
    )?.trend;

    const freeCashflow = num(fd.freeCashflow);
    const marketCap = num(sd.marketCap) ?? num(ks.marketCap);
    const totalRevenue = num(fd.totalRevenue);
    const operatingMargins = num(fd.operatingMargins);
    const bookValue = num(ks.bookValue);
    const sharesOutstanding = num(ks.sharesOutstanding);
    const totalDebt = num(fd.totalDebt);
    const totalCash = num(fd.totalCash);
    const ebitda = num(fd.ebitda);

    const priceToFcf =
      freeCashflow != null &&
      freeCashflow > 0 &&
      marketCap != null &&
      marketCap > 0
        ? marketCap / freeCashflow
        : null;

    const returnOnInvestedCapital = computeRoic({
      totalRevenue,
      operatingMargins,
      bookValue,
      sharesOutstanding,
      totalDebt,
      totalCash,
    });

    return {
      debtToEquity: num(fd.debtToEquity),
      currentRatio: num(fd.currentRatio),
      quickRatio: num(fd.quickRatio),
      freeCashflow,
      operatingCashflow: num(fd.operatingCashflow),
      totalDebt,
      totalCash,
      ebitda,
      totalRevenue,
      bookValue,
      sharesOutstanding,
      grossMargins: num(fd.grossMargins),
      operatingMargins,
      profitMargins: num(fd.profitMargins) ?? num(ks.profitMargins),
      returnOnEquity: num(fd.returnOnEquity),
      returnOnAssets: num(fd.returnOnAssets),
      returnOnInvestedCapital,
      revenueGrowth: num(fd.revenueGrowth),
      earningsGrowth: num(fd.earningsGrowth),
      fcfGrowth: null,
      revenueEstimateGrowth:
        trendGrowth(trend, "0y", "revenue") ??
        trendGrowth(trend, "+1y", "revenue") ??
        trendGrowth(trend, "0q", "revenue"),
      earningsEstimateGrowth:
        trendGrowth(trend, "0y", "growth") ??
        trendGrowth(trend, "+1y", "growth"),
      trailingPE: num(sd.trailingPE) ?? num(ks.trailingPE),
      forwardPE: num(sd.forwardPE) ?? num(ks.forwardPE),
      enterpriseToEbitda: num(ks.enterpriseToEbitda),
      priceToSales:
        num(sd.priceToSalesTrailing12Months) ??
        num(ks.priceToSalesTrailing12Months),
      priceToFcf,
      pegRatio: num(ks.pegRatio),
      marketCap,
      recommendationKey: str(fd.recommendationKey),
      sector: str(ap.sectorDisp) ?? str(ap.sector),
      sectorKey: str(ap.sectorKey),
      industry: str(ap.industryDisp) ?? str(ap.industry),
      industryKey: str(ap.industryKey),
      dataAsOf: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
