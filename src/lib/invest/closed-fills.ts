import { sortTransactions } from "@/lib/portfolio/transactions";
import { normalizeIsoDate, returnPercent } from "@/lib/invest/vs-spy";
import type {
  AssetType,
  PortfolioHolding,
  PortfolioTransaction,
} from "@/types/portfolio";

export type ClosedFill = {
  id: string;
  holdingId: string;
  sellTxId: string;
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number | null;
  why: string | null;
  skipped: string | null;
};

type OpenLot = {
  qty: number;
  price: number;
  date: string;
};

const JOURNAL_TYPES: AssetType[] = ["stock", "crypto"];

export function isJournalAssetType(type: AssetType): boolean {
  return JOURNAL_TYPES.includes(type);
}

function noteOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * One journal row per sell. Entry is the FIFO-weighted lots that sell consumed.
 * Cash leftover buys are not journal names.
 */
export function closedFillsFromHolding(
  holding: Pick<
    PortfolioHolding,
    "id" | "symbol" | "name" | "type" | "transactions"
  >,
): ClosedFill[] {
  if (!isJournalAssetType(holding.type)) return [];
  const lots: OpenLot[] = [];
  const fills: ClosedFill[] = [];

  for (const tx of sortTransactions(holding.transactions ?? [])) {
    if (tx.type === "buy") {
      lots.push({ qty: tx.quantity, price: tx.pricePerUnit, date: tx.date });
      continue;
    }
    const fill = consumeSell(holding, tx, lots);
    if (fill) fills.push(fill);
  }

  return fills;
}

export function closedFillsFromHoldings(
  holdings: Array<
    Pick<PortfolioHolding, "id" | "symbol" | "name" | "type" | "transactions">
  >,
): ClosedFill[] {
  return holdings
    .flatMap(closedFillsFromHolding)
    .sort((a, b) => {
      const exit = b.exitDate.localeCompare(a.exitDate);
      if (exit !== 0) return exit;
      return a.symbol.localeCompare(b.symbol);
    });
}

function consumeSell(
  holding: Pick<PortfolioHolding, "id" | "symbol" | "name" | "type">,
  tx: PortfolioTransaction,
  lots: OpenLot[],
): ClosedFill | null {
  let remaining = tx.quantity;
  let cost = 0;
  let qty = 0;
  let entryDate: string | null = null;

  for (const lot of lots) {
    if (remaining <= 0) break;
    if (lot.qty <= 0) continue;
    const take = Math.min(lot.qty, remaining);
    cost += take * lot.price;
    qty += take;
    remaining -= take;
    lot.qty -= take;
    if (!entryDate) entryDate = lot.date;
  }

  if (qty <= 0 || !entryDate) return null;

  const entryPrice = cost / qty;
  return {
    id: `${holding.id}:${tx.id}`,
    holdingId: holding.id,
    sellTxId: tx.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    quantity: qty,
    entryDate,
    exitDate: tx.date,
    entryPrice,
    exitPrice: tx.pricePerUnit,
    returnPercent: returnPercent(entryPrice, tx.pricePerUnit),
    why: noteOrNull(tx.why),
    skipped: noteOrNull(tx.skipped),
  };
}

export function firstBoughtDate(holding: {
  addedAt?: string;
  transactions?: PortfolioTransaction[];
}): string | null {
  const firstBuy = sortTransactions(holding.transactions ?? []).find(
    (tx) => tx.type === "buy",
  );
  return (
    normalizeIsoDate(firstBuy?.date) ??
    normalizeIsoDate(holding.addedAt?.slice(0, 10))
  );
}

export function earliestFillDate(fills: ClosedFill[]): string | null {
  let earliest: string | null = null;
  for (const fill of fills) {
    if (!earliest || fill.entryDate < earliest) earliest = fill.entryDate;
  }
  return earliest;
}
