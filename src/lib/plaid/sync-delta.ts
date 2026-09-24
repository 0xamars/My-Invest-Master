import type {
  PlaidImportedTransaction,
  PlaidLinkedAccount,
  PlaidSyncPayload,
} from "@/lib/plaid/types";

/** One page from Plaid `/transactions/sync`. Fields we do not read are ignored. */
export type PlaidSyncPage = {
  added?: PlaidRawTransaction[];
  modified?: PlaidRawTransaction[];
  removed?: Array<{ transaction_id?: string }>;
  next_cursor?: string;
  has_more?: boolean;
};

export type PlaidRawTransaction = {
  transaction_id?: string;
  account_id?: string;
  date?: string;
  name?: string;
  merchant_name?: string | null;
  amount?: number;
  pending?: boolean;
  pending_transaction_id?: string | null;
};

export type PlaidSyncDelta = {
  added: PlaidImportedTransaction[];
  modified: PlaidImportedTransaction[];
  removed: string[];
  nextCursor: string;
};

export function mapPlaidTransaction(
  row: PlaidRawTransaction,
): PlaidImportedTransaction | null {
  const transactionId = row.transaction_id?.trim() ?? "";
  const plaidAccountId = row.account_id?.trim() ?? "";
  const date = row.date?.trim() ?? "";
  if (!transactionId || !plaidAccountId || !date) return null;
  if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) return null;
  const pendingTransactionId = row.pending_transaction_id?.trim() || null;
  return {
    transactionId,
    plaidAccountId,
    date,
    name: row.name?.trim() || "Bank transaction",
    merchantName: row.merchant_name ?? null,
    amount: row.amount,
    pending: row.pending === true,
    pendingTransactionId,
  };
}

/**
 * Net one sync, including pages where `has_more` is set.
 * A transaction added and then removed in the same update is only removed,
 * so a retry after a saved add and a failed cursor commit still deletes it.
 * A modify of something added in this same update stays an add.
 */
export function foldPlaidSyncPages(
  pages: readonly PlaidSyncPage[],
  fallbackCursor = "",
): PlaidSyncDelta {
  const added = new Map<string, PlaidImportedTransaction>();
  const modified = new Map<string, PlaidImportedTransaction>();
  const removed = new Set<string>();
  let nextCursor = fallbackCursor;

  for (const page of pages) {
    if (typeof page.next_cursor === "string" && page.next_cursor) {
      nextCursor = page.next_cursor;
    }
    for (const raw of page.added ?? []) {
      const tx = mapPlaidTransaction(raw);
      if (!tx) continue;
      removed.delete(tx.transactionId);
      modified.delete(tx.transactionId);
      added.set(tx.transactionId, tx);
    }
    for (const raw of page.modified ?? []) {
      const tx = mapPlaidTransaction(raw);
      if (!tx) continue;
      removed.delete(tx.transactionId);
      if (added.has(tx.transactionId)) {
        added.set(tx.transactionId, tx);
      } else {
        modified.set(tx.transactionId, tx);
      }
    }
    for (const raw of page.removed ?? []) {
      const id = raw.transaction_id?.trim() ?? "";
      if (!id) continue;
      added.delete(id);
      modified.delete(id);
      removed.add(id);
    }
  }

  return {
    added: [...added.values()],
    modified: [...modified.values()],
    removed: [...removed],
    nextCursor,
  };
}

export function toPlaidSyncPayload(input: {
  itemId: string;
  institutionName: string | null;
  syncedAt: string;
  accounts: PlaidLinkedAccount[];
  delta: PlaidSyncDelta;
  previousCursor: string | null;
}): PlaidSyncPayload {
  const next = input.delta.nextCursor.trim();
  return {
    itemId: input.itemId,
    institutionName: input.institutionName,
    syncedAt: input.syncedAt,
    accounts: input.accounts,
    transactions: input.delta.added,
    modified: input.delta.modified,
    removedTransactionIds: input.delta.removed,
    cursor: next
      ? { previous: input.previousCursor, next }
      : undefined,
  };
}
