export type PlaidItemSummary = {
  id: string;
  itemId: string;
  planId: string;
  institutionId: string | null;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
};

export type PlaidLinkedAccount = {
  plaidAccountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
};

export type PlaidImportedTransaction = {
  transactionId: string;
  plaidAccountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  pending: boolean;
  /**
   * Set on a posted transaction that replaced a pending one.
   * The pending id is a different Plaid transaction id.
   */
  pendingTransactionId?: string | null;
};

export type PlaidSyncCursor = {
  /** Cursor this batch was read from. Null is the first sync. */
  previous: string | null;
  /** Store this only after the budget plan write succeeds. */
  next: string;
};

export type PlaidSyncPayload = {
  itemId: string;
  institutionName: string | null;
  syncedAt: string;
  accounts: PlaidLinkedAccount[];
  /** Transactions Plaid reported as added. */
  transactions: PlaidImportedTransaction[];
  /** Transactions Plaid reported as modified. */
  modified?: PlaidImportedTransaction[];
  /** Plaid transaction ids reported as removed. */
  removedTransactionIds?: string[];
  cursor?: PlaidSyncCursor;
};

export type PlaidStatusResponse = {
  configured: boolean;
  storageReady: boolean;
  env: "sandbox" | "development" | "production";
  webhookUrl: string | null;
  items: PlaidItemSummary[];
};
