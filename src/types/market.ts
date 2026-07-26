export interface MarketNewsItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  thumbnailUrl?: string;
  relatedTickers?: string[];
}

export interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  changePercent: number;
  change: number;
  price: number;
  marketCap: number;
}

export type MarketIndex = "sp500" | "nasdaq100";

export interface HeatmapResponse {
  index: MarketIndex;
  stocks: HeatmapStock[];
  gainers: HeatmapStock[];
  losers: HeatmapStock[];
  fetchedAt: string;
  totalConstituents: number;
  displayedCount: number;
}

export interface NewsResponse {
  stockNews: MarketNewsItem[];
  cryptoNews: MarketNewsItem[];
  fetchedAt: string;
}
