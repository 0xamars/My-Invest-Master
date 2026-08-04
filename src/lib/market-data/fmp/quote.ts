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

type FmpQuoteRow = Record<string, unknown>;

export async function fetchFmpQuote(symbol: string): Promise<FmpQuote | null> {
  const upper = symbol.toUpperCase();
  try {
    const data = await fmpFetch<FmpQuoteRow[] | FmpQuoteRow>({
      path: "/quote",
      query: { symbol: upper },
      revalidate: 30,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return null;

    const price = num(row.price);
    if (price == null) return null;

    return {
      symbol: str(row.symbol)?.toUpperCase() ?? upper,
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
      week52Low: num(row.yearLow),
      week52High: num(row.yearHigh),
      currency: str(row.currency),
    };
  } catch {
    return null;
  }
}
