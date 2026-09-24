import { fmpFetch, num, str } from "@/lib/market-data/fmp/client";

export type FmpQuote = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  week52Low: number | null;
  week52High: number | null;
  currency: string | null;
};

export type FmpQuoteRow = Record<string, unknown>;

/** Map one stable `/quote` or `/batch-quote` object. Null when price is missing. */
export function mapFmpQuoteRow(
  row: FmpQuoteRow,
  fallbackSymbol: string,
): FmpQuote | null {
  const price = num(row.price);
  if (price == null || price <= 0) return null;
  return {
    symbol: str(row.symbol)?.toUpperCase() ?? fallbackSymbol.toUpperCase(),
    name: str(row.name),
    price,
    change: num(row.change),
    changePercent:
      num(row.changesPercentage) ??
      num(row.changePercentage) ??
      num(row.changePercent),
    marketCap: num(row.marketCap) ?? num(row.mktCap),
    volume: num(row.volume),
    averageVolume: num(row.avgVolume) ?? num(row.avVolume),
    dayLow: num(row.dayLow),
    dayHigh: num(row.dayHigh),
    week52Low: num(row.yearLow) ?? num(row.week52Low),
    week52High: num(row.yearHigh) ?? num(row.week52High),
    currency: str(row.currency),
  };
}

export function mapFmpQuotePayload(
  data: unknown,
  fallbackSymbol: string,
): FmpQuote[] {
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const quotes: FmpQuote[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const quote = mapFmpQuoteRow(row as FmpQuoteRow, fallbackSymbol);
    if (quote) quotes.push(quote);
  }
  return quotes;
}

export async function fetchFmpQuote(symbol: string): Promise<FmpQuote | null> {
  const upper = symbol.toUpperCase();
  try {
    const data = await fmpFetch<FmpQuoteRow[] | FmpQuoteRow>({
      path: "/quote",
      query: { symbol: upper },
      revalidate: 30,
    });
    return mapFmpQuotePayload(data, upper)[0] ?? null;
  } catch {
    return null;
  }
}
