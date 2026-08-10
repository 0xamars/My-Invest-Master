/**
 * Low-level FMP endpoint fetchers for warehouse ingest.
 * Returns raw JSON rows; never called from the client.
 */
import { fmpFetch, num, str } from "@/lib/market-data/fmp/client";
import { fetchFmpQuote } from "@/lib/market-data/fmp/quote";
import { fetchFmpProfile } from "@/lib/market-data/fmp/profile";
import {
  fetchFmpDailyBars,
  fetchFmpHourlyBars,
} from "@/lib/market-data/fmp/history";
import type { JsonRow } from "@/lib/market-data/warehouse/types";

async function safeRows(
  path: string,
  query: Record<string, string | number | undefined | null>,
  revalidate: number,
): Promise<JsonRow[]> {
  try {
    const data = await fmpFetch<JsonRow[] | JsonRow>({
      path,
      query,
      revalidate,
    });
    if (Array.isArray(data)) return data.filter((r) => r && typeof r === "object");
    if (data && typeof data === "object") return [data as JsonRow];
    return [];
  } catch {
    return [];
  }
}

export async function fmpFetchProfileRaw(symbol: string) {
  return fetchFmpProfile(symbol);
}

export async function fmpFetchQuoteRaw(symbol: string) {
  return fetchFmpQuote(symbol);
}

export async function fmpFetchIncome(
  symbol: string,
  period: "annual" | "quarter",
  limit = 8,
) {
  return safeRows(
    "/income-statement",
    { symbol, period, limit },
    3600,
  );
}

export async function fmpFetchIncomeTtm(symbol: string) {
  return safeRows("/income-statement-ttm", { symbol }, 3600);
}

export async function fmpFetchBalance(
  symbol: string,
  period: "annual" | "quarter",
  limit = 8,
) {
  return safeRows(
    "/balance-sheet-statement",
    { symbol, period, limit },
    3600,
  );
}

export async function fmpFetchBalanceTtm(symbol: string) {
  return safeRows("/balance-sheet-statement-ttm", { symbol }, 3600);
}

export async function fmpFetchCashflow(
  symbol: string,
  period: "annual" | "quarter",
  limit = 8,
) {
  return safeRows(
    "/cash-flow-statement",
    { symbol, period, limit },
    3600,
  );
}

export async function fmpFetchCashflowTtm(symbol: string) {
  return safeRows("/cash-flow-statement-ttm", { symbol }, 3600);
}

export async function fmpFetchRatiosTtm(symbol: string) {
  return safeRows("/ratios-ttm", { symbol }, 3600);
}

export async function fmpFetchRatiosAnnual(symbol: string, limit = 5) {
  return safeRows("/ratios", { symbol, period: "annual", limit }, 3600);
}

export async function fmpFetchKeyMetricsTtm(symbol: string) {
  return safeRows("/key-metrics-ttm", { symbol }, 3600);
}

export async function fmpFetchKeyMetricsAnnual(symbol: string, limit = 5) {
  return safeRows("/key-metrics", { symbol, period: "annual", limit }, 3600);
}

export async function fmpFetchFinancialScores(symbol: string) {
  return safeRows("/financial-scores", { symbol }, 3600);
}

export async function fmpFetchEnterpriseValues(symbol: string, limit = 5) {
  return safeRows("/enterprise-values", { symbol, limit }, 3600);
}

export async function fmpFetchOwnerEarnings(symbol: string) {
  return safeRows("/owner-earnings", { symbol }, 3600);
}

export async function fmpFetchGrowth(symbol: string) {
  const [incomeGrowth, financialGrowth] = await Promise.all([
    safeRows("/income-statement-growth", { symbol, limit: 5 }, 3600),
    safeRows("/financial-growth", { symbol, limit: 5 }, 3600),
  ]);
  return { incomeGrowth, financialGrowth };
}

export type EstimatesPeriod = "annual" | "quarter";

async function fetchAnalystEstimatesPeriod(
  symbol: string,
  period: EstimatesPeriod,
  limit: number,
): Promise<JsonRow[]> {
  const data = await fmpFetch<JsonRow[] | JsonRow>({
    path: "/analyst-estimates",
    query: { symbol, period, limit },
    revalidate: 3600,
  });
  const rows = Array.isArray(data)
    ? data.filter((r) => r && typeof r === "object")
    : data && typeof data === "object"
      ? [data as JsonRow]
      : [];
  return rows.map((r) => ({ ...r, __period: period }));
}

/** FMP `/analyst-estimates` requires `period=annual|quarter`. */
export async function fmpFetchEstimates(
  symbol: string,
  period: EstimatesPeriod,
  limit = period === "annual" ? 10 : 8,
): Promise<JsonRow[]> {
  return fetchAnalystEstimatesPeriod(symbol, period, limit);
}

async function safeFirst(
  path: string,
  query: Record<string, string | number | undefined | null>,
  revalidate = 3600,
): Promise<JsonRow | null> {
  const rows = await safeRows(path, query, revalidate);
  const row = rows[0];
  if (!row || row.__empty === true) return null;
  return row;
}

export async function fmpFetchPriceTargetConsensus(symbol: string) {
  return safeFirst("/price-target-consensus", { symbol });
}

export async function fmpFetchPriceTargetSummary(symbol: string) {
  return safeFirst("/price-target-summary", { symbol });
}

export async function fmpFetchGradesConsensus(symbol: string) {
  return safeFirst("/grades-consensus", { symbol });
}

/**
 * Street consensus blob for Forecast: price-target consensus + summary + grades.
 * Empty / 404 endpoints become null fields; all-null → null (empty-cache).
 */
export async function fmpFetchStreetConsensusBundle(
  symbol: string,
): Promise<JsonRow | null> {
  const [consensus, summary, grades] = await Promise.all([
    fmpFetchPriceTargetConsensus(symbol),
    fmpFetchPriceTargetSummary(symbol),
    fmpFetchGradesConsensus(symbol),
  ]);
  const hasTarget =
    consensus != null &&
    (consensus.targetHigh != null ||
      consensus.targetLow != null ||
      consensus.targetConsensus != null);
  const hasGrades =
    grades != null &&
    (grades.strongBuy != null ||
      grades.buy != null ||
      grades.hold != null ||
      grades.sell != null ||
      grades.strongSell != null);
  const hasSummary =
    summary != null &&
    (summary.lastYearCount != null ||
      summary.lastQuarterCount != null ||
      summary.lastMonthCount != null);
  if (!hasTarget && !hasGrades && !hasSummary) return null;
  return {
    consensus: hasTarget ? consensus : null,
    summary: hasSummary || hasTarget ? summary : null,
    grades: hasGrades ? grades : null,
  };
}

/** Annual primary + optional quarter. Throws only if both periods fail. */
export async function fmpFetchEstimatesBundle(symbol: string): Promise<JsonRow[]> {
  const settled = await Promise.allSettled([
    fmpFetchEstimates(symbol, "annual", 10),
    fmpFetchEstimates(symbol, "quarter", 8),
  ]);
  const annual = settled[0].status === "fulfilled" ? settled[0].value : [];
  const quarter = settled[1].status === "fulfilled" ? settled[1].value : [];
  if (
    settled[0].status === "rejected" &&
    settled[1].status === "rejected"
  ) {
    throw settled[0].reason;
  }
  return [...annual, ...quarter];
}

export async function fmpFetchDcf(symbol: string) {
  const rows = await safeRows("/discounted-cash-flow", { symbol }, 3600);
  if (rows.length) return rows;
  return safeRows("/dcf", { symbol }, 3600);
}

export async function fmpFetchStockPeers(symbol: string): Promise<string[]> {
  try {
    const data = await fmpFetch<
      | { peersList?: string[]; peers?: string[] }
      | Array<{ symbol?: string; peersList?: string[] }>
      | string[]
    >({
      path: "/stock-peers",
      query: { symbol },
      revalidate: 3600,
    });
    if (Array.isArray(data)) {
      if (data.length && typeof data[0] === "string") {
        return (data as string[]).map((s) => s.toUpperCase());
      }
      const first = data[0] as { peersList?: string[]; symbol?: string };
      if (first?.peersList) {
        return first.peersList.map((s) => s.toUpperCase());
      }
      return [];
    }
    if (data && typeof data === "object") {
      const peers =
        (data as { peersList?: string[] }).peersList ??
        (data as { peers?: string[] }).peers ??
        [];
      return peers.map((s) => s.toUpperCase());
    }
    return [];
  } catch {
    return [];
  }
}

export async function fmpFetchInsiderTrading(
  symbol: string,
  limit = 100,
): Promise<JsonRow[]> {
  return safeRows(
    "/insider-trading/search",
    { symbol, page: 0, limit },
    3600,
  );
}

export async function fmpFetchMergersAcquisitions(
  name: string,
): Promise<JsonRow[]> {
  return safeRows(
    "/mergers-acquisitions-search",
    { name },
    3600,
  );
}

export async function fmpFetchDailyHistory(symbol: string) {
  return fetchFmpDailyBars(symbol);
}

export async function fmpFetchHourlyHistory(symbol: string) {
  return fetchFmpHourlyBars(symbol);
}

export function fiscalDateFromRow(row: JsonRow): string {
  const raw =
    str(row.date) ??
    str(row.fillingDate) ??
    str(row.filingDate) ??
    str(row.calendarYear) ??
    null;
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (raw && /^\d{4}$/.test(raw)) return `${raw}-12-31`;
  return "1970-01-01";
}

export function periodLabelFromRow(row: JsonRow): string | null {
  return (
    str(row.period) ??
    str(row.calendarYear) ??
    str(row.date)?.slice(0, 7) ??
    null
  );
}

export { num, str };
