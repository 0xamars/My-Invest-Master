import { createAdminClient } from "@/lib/supabase/admin";
import type { PlaidItemSummary, PlaidLinkedAccount } from "@/lib/plaid/types";

type ItemRow = {
  id: string;
  user_id: string;
  plan_id: string;
  item_id: string;
  access_token: string;
  institution_id: string | null;
  institution_name: string | null;
  transactions_cursor: string | null;
  status: string;
  last_synced_at: string | null;
};

function requireAdmin() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Bank linking needs a server database key");
  }
  return admin;
}

function toSummary(row: ItemRow): PlaidItemSummary {
  return {
    id: row.id,
    itemId: row.item_id,
    planId: row.plan_id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  };
}

export async function listPlaidItemsForPlan(
  userId: string,
  planId: string,
): Promise<PlaidItemSummary[]> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("user_plaid_items")
    .select(
      "id, user_id, plan_id, item_id, access_token, institution_id, institution_name, transactions_cursor, status, last_synced_at",
    )
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .neq("status", "disconnected")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemRow[]).map(toSummary);
}

export async function upsertPlaidItem(input: {
  userId: string;
  planId: string;
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
  accounts: PlaidLinkedAccount[];
}): Promise<PlaidItemSummary> {
  const admin = requireAdmin();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("user_plaid_items")
    .upsert(
      {
        user_id: input.userId,
        plan_id: input.planId,
        item_id: input.itemId,
        access_token: input.accessToken,
        institution_id: input.institutionId,
        institution_name: input.institutionName,
        status: "active",
        updated_at: now,
      },
      { onConflict: "user_id,item_id" },
    )
    .select(
      "id, user_id, plan_id, item_id, access_token, institution_id, institution_name, transactions_cursor, status, last_synced_at",
    )
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not store bank connection");
  }
  const row = data as ItemRow;
  if (input.accounts.length > 0) {
    const { error: accountError } = await admin.from("user_plaid_accounts").upsert(
      input.accounts.map((account) => ({
        user_id: input.userId,
        item_row_id: row.id,
        plaid_account_id: account.plaidAccountId,
        name: account.name,
        official_name: account.officialName,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
      })),
      { onConflict: "item_row_id,plaid_account_id" },
    );
    if (accountError) throw new Error(accountError.message);
  }
  return toSummary(row);
}

export async function loadPlaidItemForUser(input: {
  userId: string;
  itemId: string;
}): Promise<ItemRow | null> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("user_plaid_items")
    .select(
      "id, user_id, plan_id, item_id, access_token, institution_id, institution_name, transactions_cursor, status, last_synced_at",
    )
    .eq("user_id", input.userId)
    .eq("item_id", input.itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ItemRow | null) ?? null;
}

export async function loadPlaidItemByPlaidId(itemId: string): Promise<ItemRow | null> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("user_plaid_items")
    .select(
      "id, user_id, plan_id, item_id, access_token, institution_id, institution_name, transactions_cursor, status, last_synced_at",
    )
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ItemRow | null) ?? null;
}

/**
 * Advance the sync bookmark only when it is still the cursor this batch
 * was read from. A 0-row update means another save already moved it.
 */
export async function commitPlaidItemCursor(input: {
  id: string;
  userId: string;
  previousCursor: string | null;
  nextCursor: string;
  syncedAt: string;
}): Promise<{ advanced: boolean }> {
  const nextCursor = input.nextCursor.trim();
  if (!nextCursor) return { advanced: false };
  const admin = requireAdmin();
  let query = admin
    .from("user_plaid_items")
    .update({
      transactions_cursor: nextCursor,
      last_synced_at: input.syncedAt,
      status: "active",
      updated_at: input.syncedAt,
    })
    .eq("id", input.id)
    .eq("user_id", input.userId);
  query =
    input.previousCursor == null
      ? query.is("transactions_cursor", null)
      : query.eq("transactions_cursor", input.previousCursor);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return { advanced: (data?.length ?? 0) > 0 };
}

export async function markPlaidWebhook(itemId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("user_plaid_items")
    .update({ updated_at: new Date().toISOString() })
    .eq("item_id", itemId);
}

export async function markPlaidItemStatus(input: {
  id?: string;
  itemId?: string;
  status: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const patch = { status: input.status, updated_at: now };
  if (input.id) {
    const admin = requireAdmin();
    const { error } = await admin
      .from("user_plaid_items")
      .update(patch)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  if (!input.itemId) throw new Error("id or itemId is required");
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("user_plaid_items").update(patch).eq("item_id", input.itemId);
}

export async function deletePlaidItemRow(input: {
  userId: string;
  itemId: string;
}): Promise<ItemRow | null> {
  const existing = await loadPlaidItemForUser(input);
  if (!existing) return null;
  const admin = requireAdmin();
  const { error } = await admin
    .from("user_plaid_items")
    .delete()
    .eq("id", existing.id)
    .eq("user_id", input.userId);
  if (error) throw new Error(error.message);
  return existing;
}
