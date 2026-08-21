import type {
  PortfolioHolding,
  PortfolioTransaction,
  TransactionType,
} from "@/types/portfolio";

export interface PositionFromTransactions {
  quantity: number;
  costPrice: number;
  totalCost: number;
}

export function getTodayDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function sortTransactions(
  transactions: PortfolioTransaction[],
): PortfolioTransaction[] {
  return [...transactions].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Average-cost method: buys increase basis; sells reduce qty at current avg cost. */
export function computePositionFromTransactions(
  transactions: PortfolioTransaction[],
): PositionFromTransactions {
  let quantity = 0;
  let totalCost = 0;

  for (const tx of sortTransactions(transactions)) {
    if (tx.type === "buy") {
      totalCost += tx.quantity * tx.pricePerUnit;
      quantity += tx.quantity;
      continue;
    }

    const sellQty = Math.min(tx.quantity, quantity);
    if (sellQty <= 0) continue;

    const avgCost = quantity > 0 ? totalCost / quantity : 0;
    totalCost -= sellQty * avgCost;
    quantity -= sellQty;
  }

  return {
    quantity,
    costPrice: quantity > 0 ? totalCost / quantity : 0,
    totalCost,
  };
}

export function syncHoldingFromTransactions(
  holding: PortfolioHolding,
): PortfolioHolding {
  const { quantity, costPrice } = computePositionFromTransactions(
    holding.transactions,
  );

  const firstTx = sortTransactions(holding.transactions)[0];

  return {
    ...holding,
    quantity,
    costPrice: holding.type === "cash" ? 1 : costPrice,
    addedAt: firstTx?.date
      ? new Date(`${firstTx.date}T12:00:00`).toISOString()
      : holding.addedAt,
  };
}

export function createTransaction(
  type: TransactionType,
  quantity: number,
  pricePerUnit: number,
  date: string,
  notes?: { why?: string; skipped?: string },
): PortfolioTransaction {
  const why = notes?.why?.trim();
  const skipped = notes?.skipped?.trim();
  return {
    id: crypto.randomUUID(),
    type,
    quantity,
    pricePerUnit,
    date,
    createdAt: new Date().toISOString(),
    ...(why ? { why: why.slice(0, 500) } : {}),
    ...(skipped ? { skipped: skipped.slice(0, 500) } : {}),
  };
}

export function withTransactionNotes(
  tx: PortfolioTransaction,
  notes: { why?: string; skipped?: string },
): PortfolioTransaction {
  const why = notes.why?.trim() ?? "";
  const skipped = notes.skipped?.trim() ?? "";
  const next: PortfolioTransaction = { ...tx };
  if (why) next.why = why.slice(0, 500);
  else delete next.why;
  if (skipped) next.skipped = skipped.slice(0, 500);
  else delete next.skipped;
  return next;
}

export function migrateHoldingToTransactions(
  holding: PortfolioHolding,
): PortfolioHolding {
  const quantity = Number(holding.quantity) || 0;
  const costPrice = Number(holding.costPrice) || 0;
  const normalized: PortfolioHolding = {
    ...holding,
    quantity,
    costPrice: holding.type === "cash" ? 1 : costPrice,
    transactions: Array.isArray(holding.transactions) ? holding.transactions : [],
  };

  if (normalized.transactions.length > 0) {
    const synced = syncHoldingFromTransactions(normalized);
    const hasSell = normalized.transactions.some((tx) => tx.type === "sell");

    if (synced.quantity <= 0 && quantity > 0 && !hasSell) {
      return seedLegacyTransactions(normalized, quantity, costPrice);
    }

    return synced;
  }

  if (quantity <= 0) {
    return { ...normalized, transactions: [] };
  }

  return seedLegacyTransactions(normalized, quantity, costPrice);
}

function seedLegacyTransactions(
  holding: PortfolioHolding,
  quantity: number,
  costPrice: number,
): PortfolioHolding {
  const date = holding.addedAt?.slice(0, 10) ?? getTodayDateString();
  const transactions = [
    createTransaction(
      "buy",
      quantity,
      holding.type === "cash" ? 1 : costPrice,
      date,
    ),
  ];

  return syncHoldingFromTransactions({ ...holding, transactions });
}

export function validateTransactionQuantity(
  holding: PortfolioHolding | undefined,
  type: TransactionType,
  quantity: number,
): string | null {
  if (quantity <= 0) return "Quantity must be greater than zero.";

  if (type === "sell") {
    const available = holding?.quantity ?? 0;
    if (quantity > available) {
      return `Cannot sell more than ${available} units.`;
    }
  }

  return null;
}

export function isHoldingVisible(holding: PortfolioHolding): boolean {
  return holding.quantity > 0;
}

export function isArchivedHolding(holding: PortfolioHolding): boolean {
  return (
    holding.quantity <= 0 &&
    Array.isArray(holding.transactions) &&
    holding.transactions.length > 0
  );
}
