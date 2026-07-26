import type { MarketIndex } from "@/types/market";

export type { MarketIndex };

export interface IndexConstituent {
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: string;
  industry: string;
}

export interface IndexConfig {
  id: MarketIndex;
  label: string;
  shortLabel: string;
  heatmapTopN: number | null;
  description: string;
}

export const INDEX_CONFIG: Record<MarketIndex, IndexConfig> = {
  sp500: {
    id: "sp500",
    label: "S&P 500",
    shortLabel: "S&P 500",
    heatmapTopN: 120,
    description:
      "Top companies by market cap — one ticker per company, grouped by sector.",
  },
  nasdaq100: {
    id: "nasdaq100",
    label: "NASDAQ 100",
    shortLabel: "NASDAQ 100",
    heatmapTopN: null,
    description:
      "All NASDAQ 100 constituents — one ticker per company, grouped by sector.",
  },
};

export function parseMarketIndex(value: string | null): MarketIndex {
  return value === "nasdaq100" ? "nasdaq100" : "sp500";
}
