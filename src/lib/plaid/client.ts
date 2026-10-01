import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";
import {
  plaidHost,
  readPlaidConfig,
  type PlaidConfig,
  type PlaidEnv,
} from "@/lib/plaid/config";
import {
  foldPlaidSyncPages,
  type PlaidSyncPage,
} from "@/lib/plaid/sync-delta";
import type {
  PlaidImportedTransaction,
  PlaidLinkedAccount,
} from "@/lib/plaid/types";

/** Link shows US and Canadian institutions. Sandbox enables both. */
export const PLAID_LINK_COUNTRY_CODES = [CountryCode.Us, CountryCode.Ca] as const;

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

function plaidBasePath(env: PlaidEnv): string {
  if (env === "production") return PlaidEnvironments.production;
  if (env === "sandbox") return PlaidEnvironments.sandbox;
  return plaidHost(env);
}

function headerRecord(
  headers: InternalAxiosRequestConfig["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const source =
    typeof (headers as AxiosHeaders).toJSON === "function"
      ? (headers as AxiosHeaders).toJSON()
      : headers;
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.map(String).join(", ") : String(value);
  }
  return out;
}

/**
 * The official SDK talks through axios. This adapter uses fetch so a test
 * can stub `globalThis.fetch` and still exercise /item/remove errors.
 */
function plaidAxios() {
  return axios.create({
    adapter: async (config) => {
      const response = await fetch(axios.getUri(config), {
        method: (config.method ?? "POST").toUpperCase(),
        headers: headerRecord(config.headers),
        body:
          config.data == null
            ? undefined
            : typeof config.data === "string"
              ? config.data
              : JSON.stringify(config.data),
      });
      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = { error_message: "Plaid request failed" };
        }
      }
      const axiosResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: {},
        config,
      } as AxiosResponse;
      if (response.status >= 400) {
        throw new AxiosError(
          `Request failed with status code ${response.status}`,
          AxiosError.ERR_BAD_REQUEST,
          config,
          null,
          axiosResponse,
        );
      }
      return axiosResponse;
    },
  });
}

let cached: { key: string; api: PlaidApi } | null = null;

export function getPlaidApi(config: PlaidConfig = requiredConfig()): PlaidApi {
  const key = `${config.env}:${config.clientId}:${config.secret}`;
  if (cached?.key === key) return cached.api;
  const configuration = new Configuration({
    basePath: plaidBasePath(config.env),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": config.clientId,
        "PLAID-SECRET": config.secret,
      },
    },
  });
  const api = new PlaidApi(
    configuration,
    configuration.basePath,
    plaidAxios(),
  );
  cached = { key, api };
  return api;
}

function requiredConfig(): PlaidConfig {
  const config = readPlaidConfig();
  if (!config) throw new Error("Bank linking is not configured");
  return config;
}

function toPlaidRequestError(error: unknown): Error {
  if (error instanceof PlaidRequestError) return error;
  if (axios.isAxiosError(error)) {
    return new PlaidRequestError(
      error.response?.status ?? 502,
      error.response?.data ?? {},
    );
  }
  if (error instanceof Error) return error;
  return new Error("Plaid request failed");
}

async function plaidCall<T>(
  run: (api: PlaidApi) => Promise<{ data: T }>,
): Promise<T> {
  try {
    const response = await run(getPlaidApi());
    return response.data;
  } catch (error) {
    throw toPlaidRequestError(error);
  }
}

/** Low-level SDK dispatch. Webhook key fetch and the sync loop use this. */
export async function plaidPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  switch (path) {
    case "/link/token/create":
      return plaidCall((api) =>
        api.linkTokenCreate(body as unknown as LinkTokenCreateRequest),
      ) as Promise<T>;
    case "/item/public_token/exchange":
      return plaidCall((api) =>
        api.itemPublicTokenExchange({
          public_token: String(body.public_token ?? ""),
        }),
      ) as Promise<T>;
    case "/item/remove":
      return plaidCall((api) =>
        api.itemRemove({ access_token: String(body.access_token ?? "") }),
      ) as Promise<T>;
    case "/accounts/get":
      return plaidCall((api) =>
        api.accountsGet({ access_token: String(body.access_token ?? "") }),
      ) as Promise<T>;
    case "/transactions/sync":
      return plaidCall((api) =>
        api.transactionsSync({
          access_token: String(body.access_token ?? ""),
          cursor: typeof body.cursor === "string" ? body.cursor : undefined,
          count: typeof body.count === "number" ? body.count : undefined,
        }),
      ) as Promise<T>;
    case "/webhook_verification_key/get":
      return plaidCall((api) =>
        api.webhookVerificationKeyGet({ key_id: String(body.key_id ?? "") }),
      ) as Promise<T>;
    default:
      throw new Error("Plaid request failed");
  }
}

export async function createPlaidLinkToken(input: {
  userId: string;
  config?: PlaidConfig | null;
  /** Update mode: omit products, pass the existing item access token. */
  accessToken?: string;
}): Promise<string> {
  const config = input.config ?? readPlaidConfig();
  if (!config) throw new Error("Bank linking is not configured");
  const request: LinkTokenCreateRequest = {
    user: { client_user_id: input.userId },
    client_name: "InvestSalsa",
    country_codes: [...PLAID_LINK_COUNTRY_CODES],
    language: "en",
  };
  if (input.accessToken) {
    request.access_token = input.accessToken;
  } else {
    request.products = [Products.Transactions];
  }
  if (config.webhookUrl) request.webhook = config.webhookUrl;
  if (config.redirectUri) request.redirect_uri = config.redirectUri;
  const data = await plaidCall((api) => api.linkTokenCreate(request));
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

/** Stop a runaway `has_more` loop. The last page's cursor is still returned. */
const MAX_PLAID_SYNC_PAGES = 20;

export type PlaidTransactionSync = {
  /** New transactions. Same array as `added`. */
  transactions: PlaidImportedTransaction[];
  added: PlaidImportedTransaction[];
  modified: PlaidImportedTransaction[];
  removed: string[];
  nextCursor: string;
};

export async function syncPlaidTransactions(input: {
  accessToken: string;
  cursor: string | null;
  /** Test seam. Production uses the Plaid SDK. */
  post?: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
}): Promise<PlaidTransactionSync> {
  const post = input.post ?? plaidPost;
  let cursor = input.cursor ?? "";
  const pages: PlaidSyncPage[] = [];
  const seenCursors = new Set<string>();

  while (pages.length < MAX_PLAID_SYNC_PAGES) {
    if (seenCursors.has(cursor)) break;
    seenCursors.add(cursor);
    const data = await post<PlaidSyncPage>("/transactions/sync", {
      access_token: input.accessToken,
      cursor: cursor || undefined,
      count: 500,
    });
    pages.push(data);
    const next = data.next_cursor ?? cursor;
    cursor = next;
    if (data.has_more !== true) break;
  }

  const delta = foldPlaidSyncPages(pages, input.cursor ?? "");
  return {
    transactions: delta.added,
    added: delta.added,
    modified: delta.modified,
    removed: delta.removed,
    nextCursor: delta.nextCursor,
  };
}
