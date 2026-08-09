import type { WatchlistAssetType } from "@/types/watchlist";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisChartPoint } from "@/lib/analysis/history";
import type { EstimateOutlook } from "@/lib/analysis/street-outlook";
import type { AnalysisRecentEvent } from "@/lib/analysis/recent-events";

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
  /** Brief company description from FMP profile when available. */
  description?: string | null;
  error?: string;
};

export type AnalysisRatingPayload = {
  quote: AnalysisQuote;
  rating: InvestSalsaRating;
  /** Consensus estimates — display only; omit on older/crypto responses. */
  estimateOutlook?: EstimateOutlook | null;
  /** Structured insider / M&A context — omit when empty. */
  recentEvents?: AnalysisRecentEvent[];
  chart: {
    range: AnalysisChartRange;
    points: AnalysisChartPoint[];
  };
  meta: {
    yahooSymbol: string;
    ath: number | null;
    dailyBars: number;
    hourlyBars: number;
    peerBasis?: string;
    peerCount?: number;
    businessModel?: string;
    cache?: "cold" | "warm";
    fmpRateLimited?: boolean;
    dataSource?: "fmp-warehouse" | "crypto" | string;
    packageDegraded?: boolean;
    packageConfidenceNote?: string | null;
    warehouse?: {
      fromFmp: number;
      fromCache: number;
      stale: number;
      missing: number;
    };
    datasetStatus?: Array<{
      dataset: string;
      source: string;
      updatedAt: string | null;
      error?: string;
    }>;
    fmp?: {
      networkCalls: number;
      cacheHits: number;
      coalesced: number;
      byCategory: Record<string, number>;
      fmpMemory?: { networkCalls: number; cacheHits: number };
      warehouse?: {
        fromFmp: number;
        fromCache: number;
        stale: number;
        missing: number;
      } | null;
    };
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
