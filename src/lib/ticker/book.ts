import { formatScoreMark, scoreAxis } from "@/lib/ticker/score";
import { formatTickerCacheAge, TICKER_UNKNOWN } from "@/lib/ticker/format";
import { investTickerPath, normalizeTickerSymbol } from "@/lib/ticker/symbol";
import type { TickerCacheStatus, TickerSnapshot } from "@/lib/ticker/types";
import type { PortfolioHolding } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

export type BookTickerQuote = {
  symbol: string;
  name: string | null;
  price: number | null;
  /** Dollar change versus the previous close. Null when the cache has no change. */
  change: number | null;
  healthMark: string;
  fetchedAt: string | null;
  cacheStatus: TickerCacheStatus | "miss";
};

export type BookRow = {
  id: string;
  name: string;
  ticker: string;
  type: PortfolioHolding["type"];
  quantity: number;
  price: number | null;
  value: number | null;
  weight: number | null;
  healthMark: string;
  href: string | null;
  change: number | null;
};

export function quoteFromSnapshot(
  symbol: string,
  snapshot: TickerSnapshot | null,
  status: TickerCacheStatus | "miss",
): BookTickerQuote {
  if (!snapshot) {
    return {
      symbol,
      name: null,
      price: null,
      change: null,
      healthMark: TICKER_UNKNOWN,
      fetchedAt: null,
      cacheStatus: "miss",
    };
  }
  return {
    symbol: snapshot.symbol,
    name: snapshot.profile.name,
    price: snapshot.quote.price,
    change: snapshot.quote.change,
    healthMark: formatScoreMark(scoreAxis(snapshot.score, "health")),
    fetchedAt: snapshot.fetchedAt,
    cacheStatus: status,
  };
}

function holdingPrice(
  holding: PortfolioHolding,
  quotes: Record<string, BookTickerQuote>,
): number | null {
  if (holding.type === "cash") return 1;
  if (holding.type === "custom") {
    return holding.manualCurrentPrice ?? null;
  }
  if (holding.type !== "stock") return null;
  const symbol = normalizeTickerSymbol(holding.symbol);
  if (!symbol) return null;
  const price = quotes[symbol]?.price;
  return price != null && Number.isFinite(price) ? price : null;
}

export function formatBookCacheLine(
  quotes: Iterable<BookTickerQuote>,
  options?: { isLoaded?: boolean },
): string | null {
  if (options?.isLoaded === false) return "Loading prices…";
  const list = [...quotes];
  if (!list.length) return null;
  const allMiss = list.every(
    (quote) => quote.cacheStatus === "miss" || !quote.fetchedAt,
  );
  if (allMiss) return "Prices · cache miss";
  const stale = list.some((quote) => quote.cacheStatus === "stale");
  const fetched = list
    .map((quote) => quote.fetchedAt)
    .filter((value): value is string => Boolean(value));
  const oldest = fetched.reduce((min, at) =>
    Date.parse(at) < Date.parse(min) ? at : min,
  );
  return `Prices cached ${formatTickerCacheAge(oldest)}${stale ? " · stale, refreshing" : ""}`;
}

export function buildBookRows(
  holdings: PortfolioHolding[],
  quotes: Record<string, BookTickerQuote>,
): BookRow[] {
  const priced = holdings.map((holding) => {
    const symbol = holding.symbol.toUpperCase();
    const quote = quotes[symbol];
    const price = holdingPrice(holding, quotes);
    const value =
      price != null && Number.isFinite(holding.quantity)
        ? price * holding.quantity
        : null;
    const href =
      holding.type === "stock" && normalizeTickerSymbol(holding.symbol)
        ? investTickerPath(holding.symbol)
        : null;
    const healthMark =
      holding.type === "stock"
        ? (quote?.healthMark ?? TICKER_UNKNOWN)
        : TICKER_UNKNOWN;
    const name =
      holding.type === "cash"
        ? `Cash (${getCashCurrency(holding)})`
        : holding.name || holding.symbol;
    const change =
      holding.type === "stock" &&
      quote?.change != null &&
      Number.isFinite(quote.change)
        ? quote.change
        : null;
    return {
      id: holding.id,
      name,
      ticker: symbol,
      type: holding.type,
      quantity: holding.quantity,
      price,
      value,
      weight: null as number | null,
      healthMark,
      href,
      change,
    };
  });

  const knownTotal = priced.reduce(
    (sum, row) => (row.value != null ? sum + row.value : sum),
    0,
  );

  return priced.map((row) => ({
    ...row,
    weight:
      row.value != null && knownTotal > 0 ? (row.value / knownTotal) * 100 : null,
  }));
}

/** Last price × shares for priced stock rows. Cash is excluded. Null when nothing is priced. */
export function pricedShareTotal(
  rows: readonly Pick<BookRow, "type" | "value">[],
): number | null {
  let total = 0;
  let priced = false;
  for (const row of rows) {
    if (row.type !== "stock") continue;
    if (row.value == null || !Number.isFinite(row.value) || row.value <= 0) continue;
    total += row.value;
    priced = true;
  }
  return priced ? total : null;
}

/** Grouped amount with no currency symbol. Mixed quote currencies are not converted. */
export function formatShareSum(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
