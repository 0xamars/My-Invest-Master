import { formatScoreMark, scoreAxis } from "@/lib/ticker/score";
import { TICKER_UNKNOWN } from "@/lib/ticker/format";
import { investTickerPath, normalizeTickerSymbol } from "@/lib/ticker/symbol";
import type { TickerCacheStatus, TickerSnapshot } from "@/lib/ticker/types";
import type { PortfolioHolding } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

export type BookTickerQuote = {
  symbol: string;
  name: string | null;
  price: number | null;
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
      healthMark: TICKER_UNKNOWN,
      fetchedAt: null,
      cacheStatus: "miss",
    };
  }
  return {
    symbol: snapshot.symbol,
    name: snapshot.profile.name,
    price: snapshot.quote.price,
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
