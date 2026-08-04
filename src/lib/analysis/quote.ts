import type { AnalysisAssetType, AnalysisQuote } from "@/lib/analysis/types";
import { resolvePriceId } from "@/lib/portfolio/asset-catalog";
import { allowYahooFallback, isFmpConfigured } from "@/lib/market-data/config";
import { isFmpRateLimited } from "@/lib/market-data/fmp/client";
import { fetchFmpQuote } from "@/lib/market-data/fmp/quote";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchStockAnalysisQuote(
  symbol: string,
): Promise<AnalysisQuote> {
  const upper = symbol.toUpperCase();

  if (isFmpConfigured() && !isFmpRateLimited()) {
    // Quote only — skip extra /profile call to conserve FMP rate limit.
    const quote = await fetchFmpQuote(upper);
    if (quote?.price != null) {
      return {
        symbol: quote.symbol,
        name: quote.name ?? upper,
        type: "stock",
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        marketCap: quote.marketCap,
        volume: quote.volume,
        averageVolume: quote.averageVolume,
        dayLow: quote.dayLow,
        dayHigh: quote.dayHigh,
        week52Low: quote.week52Low,
        week52High: quote.week52High,
        currency: quote.currency ?? "USD",
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  if (allowYahooFallback()) {
    try {
      const YahooFinance = (await import("yahoo-finance2")).default;
      const yahooFinance = new YahooFinance({
        suppressNotices: ["yahooSurvey"],
      });
      const raw = await yahooFinance.quote(upper);
      const q = (Array.isArray(raw) ? raw[0] : raw) as
        | Record<string, unknown>
        | undefined;
      if (q) {
        const price =
          num(q.regularMarketPrice) ??
          num(q.postMarketPrice) ??
          num(q.preMarketPrice);
        return {
          symbol: upper,
          name:
            (typeof q.longName === "string" && q.longName) ||
            (typeof q.shortName === "string" && q.shortName) ||
            upper,
          type: "stock",
          price,
          change: num(q.regularMarketChange),
          changePercent: num(q.regularMarketChangePercent),
          marketCap: num(q.marketCap),
          volume: num(q.regularMarketVolume),
          averageVolume: num(q.averageDailyVolume3Month),
          dayLow: num(q.regularMarketDayLow),
          dayHigh: num(q.regularMarketDayHigh),
          week52Low: num(q.fiftyTwoWeekLow),
          week52High: num(q.fiftyTwoWeekHigh),
          currency:
            typeof q.currency === "string" ? q.currency : "USD",
          fetchedAt: new Date().toISOString(),
          error: price == null ? "Price unavailable" : undefined,
        };
      }
    } catch {
      // fall through
    }
  }

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
    error: isFmpConfigured()
      ? "Quote unavailable from FMP"
      : "FMP_API_KEY is not configured",
  };
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
