import type { AnalysisQuote } from "@/lib/analysis/types";
import type {
  FundamentalInputs,
  FundamentalPeerContext,
  OhlcBar,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";
import type { EstimateOutlook } from "@/lib/market-data/warehouse/estimate-outlook";
import type { WarehouseDataset } from "@/lib/market-data/warehouse/ttl";

export type JsonRow = Record<string, unknown>;

export type StatementPeriod = "annual" | "quarter" | "ttm";

export type PackageDatasetStatus = {
  dataset: WarehouseDataset;
  source: "supabase" | "fmp" | "stale" | "missing";
  updatedAt: string | null;
  error?: string;
};

/**
 * Normalized Analysis Package — shared market data for rating engines.
 * Built from Supabase warehouse (refreshing via FMP when stale).
 */
export type AnalysisPackage = {
  symbol: string;
  assetType: "stock";
  asOf: string;
  /** True when any critical dataset was served past TTL due to FMP failure. */
  degraded: boolean;
  confidenceNote: string | null;
  quote: AnalysisQuote | null;
  profile: {
    name: string | null;
    sector: string | null;
    sectorKey: string | null;
    industry: string | null;
    industryKey: string | null;
    country: string | null;
    exchange: string | null;
    currency: string | null;
    description: string | null;
    marketCap: number | null;
    isEtf: boolean | null;
    isFund: boolean | null;
    /** Raw FMP/profile payload for vehicle detection & optional fund meta. */
    raw: JsonRow | null;
  } | null;
  /** Raw statement rows (latest-first) by type × period. */
  statements: {
    income: Record<StatementPeriod, JsonRow[]>;
    balance: Record<StatementPeriod, JsonRow[]>;
    cashflow: Record<StatementPeriod, JsonRow[]>;
  };
  ratiosTtm: JsonRow | null;
  ratiosAnnual: JsonRow[];
  keyMetricsTtm: JsonRow | null;
  keyMetricsAnnual: JsonRow[];
  financialScores: JsonRow | null;
  enterpriseValues: JsonRow[];
  ownerEarnings: JsonRow[];
  growth: JsonRow[];
  estimates: JsonRow[];
  /** FY1/FQ1 + forward P/E helpers — not wired into rating scores this pass. */
  estimateOutlook: EstimateOutlook;
  dcf: JsonRow | null;
  peers: PeerMetricRow[];
  peerContext: FundamentalPeerContext;
  dailyBars: OhlcBar[];
  hourlyBars: OhlcBar[];
  ath: number | null;
  /** Derived inputs for FS / Profitability / Valuation / Fair Value. */
  fundamentals: FundamentalInputs | null;
  datasetStatus: PackageDatasetStatus[];
};
