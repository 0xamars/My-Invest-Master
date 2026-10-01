import { USER_OWNED_TABLES } from "@/lib/account/tables";

export type PlaidItemForRevoke = {
  itemId: string;
  accessToken: string;
};

export type AccountDeletePlan = {
  /** Call Plaid /item/remove with these tokens before deleting any rows. */
  revokeAccessTokens: string[];
  /**
   * False when linked banks exist but Plaid is not configured.
   * Dropping rows (or the auth user) would discard tokens without /item/remove.
   */
  dropRows: boolean;
  reason: "ok" | "plaid_not_configured";
};

export function planAccountDeletion(input: {
  plaidItems: readonly PlaidItemForRevoke[];
  plaidConfigured: boolean;
}): AccountDeletePlan {
  const tokens = input.plaidItems
    .map((item) => item.accessToken.trim())
    .filter((token) => token.length > 0);
  if (input.plaidItems.length > 0 && !input.plaidConfigured) {
    return {
      revokeAccessTokens: [],
      dropRows: false,
      reason: "plaid_not_configured",
    };
  }
  return {
    revokeAccessTokens: tokens,
    dropRows: true,
    reason: "ok",
  };
}

/**
 * Revoke every Plaid item, then drop rows. A remove failure skips the drop
 * so tokens stay available for a retry.
 */
export async function revokePlaidItemsBeforeDrop(input: {
  accessTokens: readonly string[];
  removeItem: (accessToken: string) => Promise<void>;
  dropRows: () => Promise<void>;
}): Promise<void> {
  for (const accessToken of input.accessTokens) {
    await input.removeItem(accessToken);
  }
  await input.dropRows();
}

export function userOwnedDeleteOrder(): readonly string[] {
  return USER_OWNED_TABLES;
}

const PLAID_OWNED_TABLES = new Set(["user_plaid_items", "user_plaid_accounts"]);

/**
 * PostgREST / Postgres report a table that was never created as 42P01
 * (undefined_table) or PGRST205 (not in the schema cache). Bank connect
 * ships behind a flag, so account deletion must treat that as no rows.
 */
export function isMissingPlaidTableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message ?? "").toLowerCase() : "";
  const missingRelation =
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache");
  if (!missingRelation) return false;
  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("user_plaid_items") || message.includes("user_plaid_accounts");
}

/**
 * A missing Plaid table is nothing to revoke. Bank connect stays off until
 * the flag is set, and that is when `user_plaid_items` often does not exist
 * yet. Any other lookup error still blocks deletion so live tokens are not
 * dropped without /item/remove. A disabled flag does not hide a real read
 * error on a table that is there.
 */
export function plaidLookupFailureIsNothingToRevoke(input: {
  error: unknown;
  bankConnectEnabled: boolean;
}): boolean {
  if (!isMissingPlaidTableError(input.error)) return false;
  if (!input.bankConnectEnabled) return true;
  // The table is missing even when the flag is on. Still nothing to revoke.
  return true;
}

/** Skip a delete only for a Plaid table that is not in this database. */
export function plaidTableDeleteIsSkippable(table: string, error: unknown): boolean {
  return PLAID_OWNED_TABLES.has(table) && isMissingPlaidTableError(error);
}
