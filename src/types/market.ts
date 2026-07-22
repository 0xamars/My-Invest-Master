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
  changePercent: number;
  price: number;
  marketCap: number;
}

export interface HeatmapResponse {
  stocks: HeatmapStock[];
  fetchedAt: string;
}

export interface NewsResponse {
  stockNews: MarketNewsItem[];
  cryptoNews: MarketNewsItem[];
  fetchedAt: string;
}
