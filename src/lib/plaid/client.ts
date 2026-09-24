import {
  plaidHost,
  readPlaidConfig,
  type PlaidConfig,
} from "@/lib/plaid/config";
import type {
  PlaidImportedTransaction,
  PlaidLinkedAccount,
} from "@/lib/plaid/types";

export class PlaidRequestError extends Error {
  status: number;
  errorCode: string | null;

  constructor(status: number, body: unknown) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      typeof record.error_message === "string"
        ? record.error_message
        : "Plaid request failed";
    super(message);
    this.status = status;
    this.errorCode =
      typeof record.error_code === "string" ? record.error_code : null;
  }
}

async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = readPlaidConfig();
  if (!config) {
    throw new Error("Bank linking is not configured");
  }
  const response = await fetch(`${plaidHost(config.env)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": config.clientId,
      "PLAID-SECRET": config.secret,
    },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PlaidRequestError(response.status, json);
  }
  return json as T;
}

export async function createPlaidLinkToken(input: {
  userId: string;
  config?: PlaidConfig | null;
  /** Update mode: omit products, pass the existing item access token. */
  accessToken?: string;
}): Promise<string> {
  const config = input.config ?? readPlaidConfig();
  if (!config) throw new Error("Bank linking is not configured");
  const body: Record<string, unknown> = {
    user: { client_user_id: input.userId },
    client_name: "InvestSalsa",
    country_codes: ["US", "CA"],
    language: "en",
  };
  if (input.accessToken) {
    body.access_token = input.accessToken;
  } else {
    body.products = ["transactions"];
  }
  if (config.webhookUrl) body.webhook = config.webhookUrl;
  if (config.redirectUri) body.redirect_uri = config.redirectUri;
  const data = await plaidPost<{ link_token: string }>(
    "/link/token/create",
    body,
  );
  return data.link_token;
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const data = await plaidPost<{ access_token: string; item_id: string }>(
    "/item/public_token/exchange",
    { public_token: publicToken },
  );
  return { accessToken: data.access_token, itemId: data.item_id };
}

export async function removePlaidItem(accessToken: string): Promise<void> {
  try {
    await plaidPost("/item/remove", { access_token: accessToken });
  } catch {
    // Item may already be gone in sandbox.
  }
}

/**
 * /item/remove errors that mean the token is already unusable.
 * ITEM_NOT_FOUND: previously removed, or the user revoked it.
 * INVALID_ACCESS_TOKEN: no matching token (already removed or otherwise invalid).
 * A partial account delete can retry past these instead of staying stuck.
 */
const PLAID_ITEM_ALREADY_GONE_CODES = new Set([
  "ITEM_NOT_FOUND",
  "INVALID_ACCESS_TOKEN",
]);

export function plaidItemRemoveAlreadyGone(error: unknown): boolean {
  return (
    error instanceof PlaidRequestError &&
    error.errorCode != null &&
    PLAID_ITEM_ALREADY_GONE_CODES.has(error.errorCode)
  );
}

/** Account deletion: /item/remove must succeed, or the token must already be gone, before rows are dropped. */
export async function removePlaidItemForDeletion(accessToken: string): Promise<void> {
  try {
    await plaidPost("/item/remove", { access_token: accessToken });
  } catch (error) {
    if (plaidItemRemoveAlreadyGone(error)) return;
    throw error;
  }
}

export async function fetchPlaidAccounts(
  accessToken: string,
): Promise<PlaidLinkedAccount[]> {
  const data = await plaidPost<{
    accounts?: Array<{
      account_id: string;
      name?: string;
      official_name?: string | null;
      mask?: string | null;
      type?: string;
      subtype?: string | null;
    }>;
  }>("/accounts/get", { access_token: accessToken });
  return (data.accounts ?? []).map((account) => ({
    plaidAccountId: account.account_id,
    name: account.name?.trim() || "Bank account",
    officialName: account.official_name ?? null,
    mask: account.mask ?? null,
    type: account.type ?? "other",
    subtype: account.subtype ?? null,
  }));
}

export async function syncPlaidTransactions(input: {
  accessToken: string;
  cursor: string | null;
}): Promise<{
  transactions: PlaidImportedTransaction[];
  nextCursor: string;
}> {
  let cursor = input.cursor ?? "";
  const added: PlaidImportedTransaction[] = [];
  let nextCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const data = await plaidPost<{
      added?: Array<{
        transaction_id: string;
        account_id: string;
        date: string;
        name?: string;
        merchant_name?: string | null;
        amount: number;
        pending?: boolean;
      }>;
      next_cursor?: string;
      has_more?: boolean;
    }>("/transactions/sync", {
      access_token: input.accessToken,
      cursor: cursor || undefined,
      count: 500,
    });
    for (const row of data.added ?? []) {
      added.push({
        transactionId: row.transaction_id,
        plaidAccountId: row.account_id,
        date: row.date,
        name: row.name ?? "Bank transaction",
        merchantName: row.merchant_name ?? null,
        amount: row.amount,
        pending: row.pending === true,
      });
    }
    nextCursor = data.next_cursor ?? nextCursor;
    cursor = nextCursor;
    hasMore = data.has_more === true;
  }

  return { transactions: added, nextCursor };
}
