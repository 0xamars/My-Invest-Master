/**
 * One parallel FMP batch for the ticker read. Never called from the client.
 */
import { fmpFetch, num as fmpNum } from "@/lib/market-data/fmp/client";
import type { TickerBundle } from "@/lib/ticker/types";

type Row = Record<string, unknown>;

async function safeRows(
  path: string,
  query: Record<string, string | number | undefined | null>,
  revalidate: number,
): Promise<Row[]> {
  try {
    const data = await fmpFetch<Row[] | Row>({
      path,
      query,
      revalidate,
    });
    if (Array.isArray(data)) {
      return data.filter((row) => row && typeof row === "object");
    }
    if (data && typeof data === "object") return [data];
    return [];
  } catch {
    return [];
  }
}

function first(rows: Row[]): Row | null {
  return rows[0] ?? null;
}

export async function fetchTickerBundle(symbol: string): Promise<TickerBundle> {
  const [
    profileRows,
    quoteRows,
    incomeAnnual,
    incomeQuarter,
    balanceAnnual,
    cashflowAnnual,
    keyMetricsRows,
    keyMetricsAnnual,
    ratioRows,
    incomeGrowth,
    growthRows,
    scoreRows,
    estimateRows,
  ] = await Promise.all([
    safeRows("/profile", { symbol }, 3600),
    safeRows("/quote", { symbol }, 30),
    safeRows("/income-statement", { symbol, period: "annual", limit: 8 }, 3600),
    safeRows("/income-statement", { symbol, period: "quarter", limit: 8 }, 3600),
    safeRows(
      "/balance-sheet-statement",
      { symbol, period: "annual", limit: 8 },
      3600,
    ),
    safeRows(
      "/cash-flow-statement",
      { symbol, period: "annual", limit: 8 },
      3600,
    ),
    safeRows("/key-metrics-ttm", { symbol }, 3600),
    safeRows("/key-metrics", { symbol, period: "annual", limit: 6 }, 3600),
    safeRows("/ratios-ttm", { symbol }, 3600),
    safeRows("/income-statement-growth", { symbol, limit: 8 }, 3600),
    safeRows("/financial-growth", { symbol, limit: 5 }, 3600),
    safeRows("/financial-scores", { symbol }, 3600),
    safeRows(
      "/analyst-estimates",
      { symbol, period: "annual", limit: 8 },
      3600,
    ),
  ]);

  return {
    profile: first(profileRows),
    quote: first(quoteRows),
    incomeAnnual,
    incomeQuarter,
    balanceAnnual,
    cashflowAnnual,
    keyMetricsTtm: first(keyMetricsRows),
    keyMetricsAnnual,
    ratiosTtm: first(ratioRows),
    incomeGrowth,
    growth: first(growthRows),
    financialScores: first(scoreRows),
    estimates: estimateRows,
  };
}

export function bundleLooksEmpty(bundle: TickerBundle): boolean {
  const price = bundle.quote ? fmpNum(bundle.quote.price) : null;
  return bundle.profile == null && (bundle.quote == null || price == null);
}
