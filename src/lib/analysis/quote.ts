import type { AnalysisAssetType, AnalysisQuote } from "@/lib/analysis/types";
import { resolvePriceId } from "@/lib/portfolio/asset-catalog";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

type YahooQuoteLike = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  displayName?: string;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  regularMarketDayLow?: number;
  regularMarketDayHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  currency?: string;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractPrice(quote: YahooQuoteLike): number | null {
  const price =
    quote.regularMarketPrice ??
    quote.postMarketPrice ??
    quote.preMarketPrice ??
    null;
  return typeof price === "number" && price > 0 ? price : null;
}

async function fetchStockAnalysisQuote(
  symbol: string,
): Promise<AnalysisQuote> {
  const upper = symbol.toUpperCase();
  try {
    const raw = await yahooFinance.quote(upper);
    const quote = (
      Array.isArray(raw) ? raw[0] : raw
    ) as YahooQuoteLike | undefined;

    if (!quote) {
      return {
        symbol: upper,
        name: upper,
        type: "stock",
        price: null,
        change: null,
        changePercent: null,
        marketCap: null,
        volume: null,
        averageVolume: null,
        dayLow: null,
        dayHigh: null,
        week52Low: null,
        week52High: null,
        currency: "USD",
        fetchedAt: new Date().toISOString(),
        error: "Quote not found",
      };
    }

    const price = extractPrice(quote);
    const name =
      quote.longName ?? quote.shortName ?? quote.displayName ?? upper;

    return {
      symbol: (quote.symbol ?? upper).toUpperCase(),
      name,
      type: "stock",
      price,
      change: num(quote.regularMarketChange),
      changePercent: num(quote.regularMarketChangePercent),
      marketCap: num(quote.marketCap),
      volume: num(quote.regularMarketVolume),
      averageVolume: num(quote.averageDailyVolume3Month),
      dayLow: num(quote.regularMarketDayLow),
      dayHigh: num(quote.regularMarketDayHigh),
      week52Low: num(quote.fiftyTwoWeekLow),
      week52High: num(quote.fiftyTwoWeekHigh),
      currency: quote.currency ?? "USD",
      fetchedAt: new Date().toISOString(),
      error: price == null ? "Price unavailable from Yahoo Finance" : undefined,
    };
  } catch {
    return {
      symbol: upper,
      name: upper,
      type: "stock",
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error: "Failed to fetch stock quote",
    };
  }
}

async function fetchCryptoAnalysisQuote(
  symbol: string,
  priceId?: string,
  nameHint?: string,
  logoUrl?: string,
): Promise<AnalysisQuote> {
  const upper = symbol.toUpperCase();
  const id = resolvePriceId(upper, "crypto", priceId);

  if (!id) {
    return {
      symbol: upper,
      name: nameHint ?? upper,
      type: "crypto",
      priceId,
      logoUrl,
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error: "Missing CoinGecko id for this crypto ticker",
    };
  }

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      {
        next: { revalidate: 30 },
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`CoinGecko error (${response.status})`);
    }

    const data = (await response.json()) as Record<
      string,
      {
        usd?: number;
        usd_24h_change?: number;
        usd_market_cap?: number;
        usd_24h_vol?: number;
      }
    >;

    const row = data[id];
    const price = num(row?.usd);
    const changePercent = num(row?.usd_24h_change);
    const change =
      price != null && changePercent != null
        ? (price * changePercent) / 100
        : null;

    return {
      symbol: upper,
      name: nameHint ?? upper,
      type: "crypto",
      priceId: id,
      logoUrl,
      price: price != null && price > 0 ? price : null,
      change,
      changePercent,
      marketCap: num(row?.usd_market_cap),
      volume: num(row?.usd_24h_vol),
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error:
        price == null || price <= 0
          ? "Price unavailable from CoinGecko"
          : undefined,
    };
  } catch {
    return {
      symbol: upper,
      name: nameHint ?? upper,
      type: "crypto",
      priceId: id,
      logoUrl,
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error: "Failed to fetch crypto quote",
    };
  }
}

export async function fetchAnalysisQuote(input: {
  symbol: string;
  type: AnalysisAssetType;
  priceId?: string;
  name?: string;
  logoUrl?: string;
}): Promise<AnalysisQuote> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) {
    return {
      symbol: "",
      name: "",
      type: input.type,
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      error: "Symbol is required",
    };
  }

  if (input.type === "crypto") {
    return fetchCryptoAnalysisQuote(
      symbol,
      input.priceId,
      input.name,
      input.logoUrl,
    );
  }

  return fetchStockAnalysisQuote(symbol);
}
