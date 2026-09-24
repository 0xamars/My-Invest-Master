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
