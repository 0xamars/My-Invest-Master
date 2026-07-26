export {
  fetchSp500Constituents,
  getStockMetadata as getSp500StockMetadata,
  normalizeSp500Sector,
  toYahooSymbol,
} from "@/lib/market/sp500-constituents";
export type { Sp500Constituent } from "@/lib/market/sp500-constituents";
export {
  fetchNasdaq100Constituents,
  getNasdaq100Metadata,
} from "@/lib/market/nasdaq100-constituents";

import { getNasdaq100Metadata } from "@/lib/market/nasdaq100-constituents";
import { getStockMetadata as getSp500StockMetadata } from "@/lib/market/sp500-constituents";

export function getStockMetadata(symbol: string): {
  sector: string;
  industry: string;
} {
  const sp500 = getSp500StockMetadata(symbol);
  if (sp500.sector !== "Other") return sp500;

  return getNasdaq100Metadata(symbol);
}
