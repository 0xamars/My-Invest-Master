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
};

export type PlaidSyncPayload = {
  itemId: string;
  institutionName: string | null;
  syncedAt: string;
  accounts: PlaidLinkedAccount[];
  transactions: PlaidImportedTransaction[];
};

export type PlaidStatusResponse = {
  configured: boolean;
  storageReady: boolean;
  env: "sandbox" | "development" | "production";
  webhookUrl: string | null;
  items: PlaidItemSummary[];
};
