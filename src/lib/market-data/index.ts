/**
 * Market-data provider facade.
 * Equities fundamentals/quotes/history: Financial Modeling Prep (primary).
 * Crypto: CoinGecko (via analysis adapters).
 */

export {
  allowYahooFallback,
  FMP_API_BASE,
  getFmpApiKey,
  isFmpConfigured,
} from "@/lib/market-data/config";
export {
  beginFmpCallScope,
  endFmpCallScope,
  isFmpRateLimited,
  markFmpRateLimited,
  runWithFmpCallScope,
} from "@/lib/market-data/fmp/client";
export { fetchFmpFundamentals } from "@/lib/market-data/fmp/fundamentals";
export {
  fetchFmpAth,
  fetchFmpDailyBars,
  fetchFmpHourlyBars,
} from "@/lib/market-data/fmp/history";
export { fetchFmpPeerBundle } from "@/lib/market-data/fmp/peers";
export { fetchFmpProfile } from "@/lib/market-data/fmp/profile";
export { fetchFmpQuote } from "@/lib/market-data/fmp/quote";
export {
  applyIndustryOverride,
  toIndustryKey,
} from "@/lib/market-data/industry-overrides";
export {
  getAnalysisPackage,
  packageNetworkSummary,
  isWarehouseWritable,
  DATASET_TTL_MS,
} from "@/lib/market-data/warehouse";
export type { AnalysisPackage } from "@/lib/market-data/warehouse";
