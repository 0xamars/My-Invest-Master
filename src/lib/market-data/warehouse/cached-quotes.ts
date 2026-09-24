import { isFmpConfigured } from "@/lib/market-data/config";
import { fetchFmpBatchQuotes } from "@/lib/market-data/fmp/batch-quote";
import { isFmpRateLimited, num, str } from "@/lib/market-data/fmp/client";
import type { FmpQuote } from "@/lib/market-data/fmp/quote";
import {
  toFmpCryptoSymbol,
  toQuoteSymbol,
} from "@/lib/market-data/fmp/symbols";
import * as store from "@/lib/market-data/warehouse/store";
import {
  DATASET_TTL_MS,
  emptyRetryTtl,
  isFresh,
  isUsableStale,
  newestTimestamp,
} from "@/lib/market-data/warehouse/ttl";

export type QuoteAsset = "stock" | "crypto";

export type QuoteRequest = {
  symbol: string;
  asset: QuoteAsset;
};

export type QuoteCacheSnapshot = {
  updatedAt: string | null;
  price: number | null;
};

export type QuoteRefreshSnapshot = {
  status: string | null;
  errorMessage: string | null;
  checkedAt: string | null;
};

const QUOTE_DATASET = "quote" as const;

/**
 * Fresh warehouse row, a recent empty marker, or a refresh.
 * Mirrors Analysis Package `loadOrRefresh` for the quote dataset.
 */
export function classifyQuoteCache(input: {
  row: QuoteCacheSnapshot | null;
  refresh: QuoteRefreshSnapshot | null;
  ttlMs?: number;
  emptyTtlMs?: number;
}): "fresh" | "empty-cached" | "refresh" {
  const ttlMs = input.ttlMs ?? DATASET_TTL_MS.quote;
  const emptyTtlMs = input.emptyTtlMs ?? emptyRetryTtl("quote");
  const hasPrice =
    input.row != null && input.row.price != null && input.row.price > 0;

  if (hasPrice && isFresh(input.row?.updatedAt, ttlMs)) return "fresh";

  const emptyConfirmed =
    input.refresh?.status === "empty" ||
    input.refresh?.errorMessage === "fmp_empty" ||
    (input.refresh?.errorMessage?.startsWith("fmp_empty") ?? false);

  if (
    emptyConfirmed &&
    input.refresh?.checkedAt &&
    isFresh(input.refresh.checkedAt, emptyTtlMs)
  ) {
    return "empty-cached";
  }

  if (
    hasPrice &&
    input.refresh?.checkedAt &&
    isFresh(input.refresh.checkedAt, ttlMs)
  ) {
    return "fresh";
  }

  return "refresh";
}

export function fmpSymbolForRequest(request: QuoteRequest): string {
  const symbol = request.symbol.trim();
  if (request.asset === "crypto") return toFmpCryptoSymbol(symbol);
  return toQuoteSymbol(symbol);
}

function quoteFromStored(row: store.StoredQuoteRow): FmpQuote | null {
  const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
  const price = num(row.price) ?? num(raw.price);
  if (price == null || price <= 0) return null;
  return {
    symbol: row.symbol.toUpperCase(),
    name: str(raw.name),
    price,
    change: num(row.change) ?? num(raw.change),
    changePercent:
      num(row.change_percent) ??
      num(raw.changePercent) ??
      num(raw.changesPercentage),
    marketCap: num(row.market_cap) ?? num(raw.marketCap),
    volume: num(raw.volume),
    averageVolume: num(raw.averageVolume) ?? num(raw.avgVolume),
    dayLow: num(raw.dayLow),
    dayHigh: num(raw.dayHigh),
    week52Low: num(raw.week52Low) ?? num(raw.yearLow),
    week52High: num(raw.week52High) ?? num(raw.yearHigh),
    currency: str(raw.currency),
  };
}

type Resolved = {
  requestSymbol: string;
  fmpSymbol: string;
  asset: QuoteAsset;
};

const symbolInflight = new Map<string, Promise<FmpQuote | null>>();

function resolveRequests(requests: QuoteRequest[]): Resolved[] {
  const seen = new Set<string>();
  const resolved: Resolved[] = [];
  for (const request of requests) {
    const requestSymbol = request.symbol.trim().toUpperCase();
    const fmpSymbol = fmpSymbolForRequest({
      symbol: requestSymbol,
      asset: request.asset,
    });
    if (!requestSymbol || !fmpSymbol) continue;
    const key = `${request.asset}:${requestSymbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ requestSymbol, fmpSymbol, asset: request.asset });
  }
  return resolved;
}

async function fetchAndStore(
  symbols: string[],
  assetBySymbol: Map<string, QuoteAsset>,
  stale: Map<string, { quote: FmpQuote; updatedAt: string | null }>,
): Promise<Map<string, FmpQuote | null>> {
  const out = new Map<string, FmpQuote | null>();
  const ttl = DATASET_TTL_MS.quote;

  const serveStale = (symbol: string) => {
    const prev = stale.get(symbol);
    if (prev && isUsableStale(prev.updatedAt, ttl)) {
      out.set(symbol, prev.quote);
      return;
    }
    out.set(symbol, null);
  };

  if (!isFmpConfigured() || isFmpRateLimited()) {
    for (const symbol of symbols) serveStale(symbol);
    return out;
  }

  let quotes: FmpQuote[] = [];
  let failed = new Set<string>();
  try {
    const batch = await fetchFmpBatchQuotes(symbols);
    quotes = batch.quotes;
    failed = new Set(batch.failed.map((symbol) => symbol.toUpperCase()));
  } catch {
    for (const symbol of symbols) serveStale(symbol);
    return out;
  }

  const bySymbol = new Map<string, FmpQuote>();
  for (const quote of quotes) {
    const upper = quote.symbol.toUpperCase();
    bySymbol.set(upper, quote);
    bySymbol.set(toQuoteSymbol(upper), quote);
  }

  const writes: Array<{
    symbol: string;
    name: string | null;
    assetType: string;
    currency: string | null;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    marketCap: number | null;
    raw: FmpQuote;
  }> = [];
  const okStates: string[] = [];
  const emptyStates: string[] = [];

  for (const symbol of symbols) {
    if (failed.has(symbol)) {
      serveStale(symbol);
      continue;
    }
    const quote = bySymbol.get(symbol);
    if (quote) {
      out.set(symbol, quote);
      writes.push({
        symbol,
        name: quote.name,
        assetType: assetBySymbol.get(symbol) ?? "stock",
        currency: quote.currency,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        marketCap: quote.marketCap,
        raw: quote,
      });
      okStates.push(symbol);
      continue;
    }
    serveStale(symbol);
    emptyStates.push(symbol);
  }

  await store.writeQuotes(writes);
  await store.ensureMarketSymbols(
    emptyStates.map((symbol) => ({
      symbol,
      assetType: assetBySymbol.get(symbol) ?? "stock",
    })),
  );
  await store.writeRefreshStates([
    ...okStates.map((symbol) => ({
      symbol,
      dataset: QUOTE_DATASET,
      status: "ok" as const,
      success: true,
    })),
    ...emptyStates.map((symbol) => ({
      symbol,
      dataset: QUOTE_DATASET,
      status: "empty" as const,
      errorMessage: "fmp_empty",
      success: true,
    })),
  ]);

  return out;
}

/**
 * Shared quote cache. Reads `market_quotes` first (5 minute TTL) and
 * batch-quotes only the symbols that are missing or stale.
 * In-flight fetches for the same FMP symbol collapse across callers.
 */
export async function getCachedQuotes(
  requests: QuoteRequest[],
): Promise<Map<string, FmpQuote | null>> {
  const resolved = resolveRequests(requests);
  const result = new Map<string, FmpQuote | null>();
  if (resolved.length === 0) return result;

  const fmpSymbols = [...new Set(resolved.map((row) => row.fmpSymbol))];
  const [rows, refreshes] = await Promise.all([
    store.readQuotes(fmpSymbols),
    store.readRefreshStates(fmpSymbols, QUOTE_DATASET),
  ]);

  const rowBySymbol = new Map(rows.map((row) => [row.symbol.toUpperCase(), row]));
  const refreshBySymbol = new Map(
    refreshes.map((row) => [row.symbol.toUpperCase(), row]),
  );

  const fresh = new Map<string, FmpQuote | null>();
  const stale = new Map<string, { quote: FmpQuote; updatedAt: string | null }>();
  const need: string[] = [];
  const assetBySymbol = new Map<string, QuoteAsset>();

  for (const row of resolved) {
    assetBySymbol.set(row.fmpSymbol, row.asset);
  }

  for (const symbol of fmpSymbols) {
    const stored = rowBySymbol.get(symbol) ?? null;
    const refresh = refreshBySymbol.get(symbol) ?? null;
    const updatedAt = stored
      ? newestTimestamp(stored.as_of, stored.updated_at)
      : null;
    const quote = stored ? quoteFromStored(stored) : null;
    const kind = classifyQuoteCache({
      row: quote ? { updatedAt, price: quote.price } : { updatedAt, price: null },
      refresh: refresh
        ? {
            status: refresh.status,
            errorMessage: refresh.error_message,
            checkedAt: newestTimestamp(
              refresh.last_success_at,
              refresh.last_attempt_at,
            ),
          }
        : null,
    });

    if (kind === "fresh" && quote) {
      fresh.set(symbol, quote);
      continue;
    }
    if (kind === "empty-cached") {
      fresh.set(symbol, quote);
      continue;
    }
    if (quote && updatedAt) stale.set(symbol, { quote, updatedAt });
    need.push(symbol);
  }

  const fetched = new Map<string, FmpQuote | null>();
  const toFetch: string[] = [];
  const waiters: Array<Promise<void>> = [];

  for (const symbol of need) {
    const pending = symbolInflight.get(symbol);
    if (pending) {
      waiters.push(
        pending.then((quote) => {
          fetched.set(symbol, quote);
        }),
      );
      continue;
    }
    toFetch.push(symbol);
  }

  let batchPromise: Promise<Map<string, FmpQuote | null>> | null = null;
  if (toFetch.length > 0) {
    batchPromise = fetchAndStore(toFetch, assetBySymbol, stale);
    for (const symbol of toFetch) {
      const pending = batchPromise.then((map) => map.get(symbol) ?? null);
      symbolInflight.set(symbol, pending);
    }
  }

  try {
    if (batchPromise) {
      const map = await batchPromise;
      for (const [symbol, quote] of map) fetched.set(symbol, quote);
    }
    await Promise.all(waiters);
  } finally {
    for (const symbol of toFetch) symbolInflight.delete(symbol);
  }

  for (const row of resolved) {
    if (fresh.has(row.fmpSymbol)) {
      result.set(row.requestSymbol, fresh.get(row.fmpSymbol) ?? null);
      continue;
    }
    result.set(row.requestSymbol, fetched.get(row.fmpSymbol) ?? null);
  }

  return result;
}
