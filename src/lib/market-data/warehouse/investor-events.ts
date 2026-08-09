/**
 * Optional investor context from structured FMP rows (insiders + M&A).
 * Never invents events. Empty / missing endpoints → [] (Analysis still succeeds).
 */
import type {
  AnalysisRecentEvent,
} from "@/lib/analysis/recent-events";
import type { JsonRow } from "@/lib/market-data/warehouse/types";
import { str } from "@/lib/market-data/fmp/client";

export type { AnalysisRecentEvent, AnalysisRecentEventType } from "@/lib/analysis/recent-events";

const INSIDER_WINDOW_MS = 90 * 24 * 60 * 60_000;
const MA_WINDOW_MS = 24 * 30 * 24 * 60 * 60_000;

function parseDate(value: unknown): number | null {
  const s = str(value);
  if (!s) return null;
  const t = Date.parse(s.slice(0, 10));
  return Number.isFinite(t) ? t : null;
}

function isoDay(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function isOpenMarketPurchase(type: string): boolean {
  const t = type.toLowerCase();
  return t.startsWith("p-") || t.includes("purchase");
}

function isOpenMarketSale(type: string): boolean {
  const t = type.toLowerCase();
  return t.startsWith("s-") || (t.includes("sale") && !t.includes("purchase"));
}

/** Collapse Form-4 open-market P/S in the last 90 days into one context line. */
export function summarizeInsiderTrading(
  rows: JsonRow[],
  now = Date.now(),
): AnalysisRecentEvent | null {
  let purchases = 0;
  let sales = 0;
  let latest: number | null = null;
  const cutoff = now - INSIDER_WINDOW_MS;

  for (const row of rows) {
    const txType = str(row.transactionType) ?? "";
    const when =
      parseDate(row.transactionDate) ?? parseDate(row.filingDate);
    if (when == null || when < cutoff) continue;
    if (isOpenMarketPurchase(txType)) {
      purchases += 1;
      if (latest == null || when > latest) latest = when;
    } else if (isOpenMarketSale(txType)) {
      sales += 1;
      if (latest == null || when > latest) latest = when;
    }
  }

  if (purchases + sales === 0) return null;

  let summary: string;
  if (purchases > sales) {
    summary = `Net insider buying over the last 90 days (${purchases} open-market purchases vs ${sales} sales).`;
  } else if (sales > purchases) {
    summary = `Net insider selling over the last 90 days (${sales} open-market sales vs ${purchases} purchases).`;
  } else {
    summary = `Insider open-market activity was roughly balanced over the last 90 days (${purchases} purchases vs ${sales} sales).`;
  }

  return { type: "insider", summary, date: isoDay(latest) };
}

function namesMatchSymbol(row: JsonRow, symbol: string): boolean {
  const upper = symbol.toUpperCase();
  const acq = (str(row.symbol) ?? "").toUpperCase();
  const tgt = (str(row.targetedSymbol) ?? "").toUpperCase();
  return acq === upper || tgt === upper;
}

/** Keep only recent structured M&A rows tied to this ticker. */
export function summarizeMergers(
  rows: JsonRow[],
  symbol: string,
  now = Date.now(),
): AnalysisRecentEvent[] {
  const cutoff = now - MA_WINDOW_MS;
  const upper = symbol.toUpperCase();
  const out: AnalysisRecentEvent[] = [];

  for (const row of rows) {
    if (!namesMatchSymbol(row, upper)) continue;
    const when =
      parseDate(row.transactionDate) ?? parseDate(row.acceptedDate);
    if (when == null || when < cutoff) continue;

    const acq = (str(row.symbol) ?? "").toUpperCase();
    const target =
      str(row.targetedCompanyName) ?? str(row.targetedSymbol) ?? "another company";
    const acquirer = str(row.companyName) ?? str(row.symbol) ?? "a company";

    const summary =
      acq === upper
        ? `Agreed to acquire ${target}.`
        : `Was named as a target in a deal involving ${acquirer}.`;

    out.push({ type: "ma", summary, date: isoDay(when) });
    if (out.length >= 2) break;
  }

  return out;
}

/** Strip legal suffix so FMP name search is more likely to hit. */
export function mergerSearchName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const cleaned = name
    .replace(
      /,?\s+(inc\.?|incorporated|corp\.?|corporation|ltd\.?|llc\.?|plc\.?|co\.?|company)\.?$/i,
      "",
    )
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

