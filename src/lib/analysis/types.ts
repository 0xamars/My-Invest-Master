import type { WatchlistAssetType } from "@/types/watchlist";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisChartPoint } from "@/lib/analysis/history";

export type AnalysisAssetType = WatchlistAssetType;

export type AnalysisQuoteStat = {
  id: string;
  label: string;
  value: string;
};

export type AnalysisQuote = {
  symbol: string;
  name: string;
  type: AnalysisAssetType;
  priceId?: string;
  logoUrl?: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** Optional market stats — omit or null to hide in UI. */
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  week52Low: number | null;
  week52High: number | null;
  currency: string;
  fetchedAt: string;
  error?: string;
};

export type AnalysisRatingPayload = {
  quote: AnalysisQuote;
  rating: InvestSalsaRating;
  chart: {
    range: AnalysisChartRange;
    points: AnalysisChartPoint[];
  };
  meta: {
    yahooSymbol: string;
    ath: number | null;
    dailyBars: number;
    hourlyBars: number;
  };
};

export const ANALYSIS_CHART_RANGES = ["1D", "1W", "1M", "3M", "1Y", "5Y"] as const;
export type AnalysisChartRange = (typeof ANALYSIS_CHART_RANGES)[number];

export function buildAnalysisHref(
  symbol: string,
  type: AnalysisAssetType = "stock",
  priceId?: string,
): string {
  const params = new URLSearchParams({ type });
  if (priceId) params.set("priceId", priceId);
  return `/analysis/${encodeURIComponent(symbol.toUpperCase())}?${params.toString()}`;
}

export function parseAnalysisAssetType(
  value: string | null | undefined,
): AnalysisAssetType {
  return value === "crypto" ? "crypto" : "stock";
}
