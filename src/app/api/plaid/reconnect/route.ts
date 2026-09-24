import { NextResponse } from "next/server";
import {
  fetchPlaidAccounts,
  PlaidRequestError,
  syncPlaidTransactions,
} from "@/lib/plaid/client";
import { isPlaidConfigured, isPlaidStorageReady } from "@/lib/plaid/config";
import { plaidErrorNeedsReconnect } from "@/lib/plaid/item-status";
import { toPlaidSyncPayload } from "@/lib/plaid/sync-delta";
import { loadPlaidItemForUser, markPlaidItemStatus } from "@/lib/plaid/store";
import { jsonError, requirePlaidUser } from "@/lib/plaid/http";

/**
 * After Plaid Link update-mode success: do not re-exchange the public token.
 * Mark the existing item active and pull the latest transactions.
 */
export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  if (!isPlaidConfigured()) {
    return jsonError("Bank linking is not configured on this server.", 503);
  }
  if (!isPlaidStorageReady()) {
    return jsonError("Bank linking needs a server database key.", 503);
  }

  let body: { itemId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }
  const itemId = body.itemId?.trim() ?? "";
  if (!itemId) return jsonError("itemId is required", 400);

  try {
    const row = await loadPlaidItemForUser({
      userId: auth.user!.id,
      itemId,
    });
    if (!row) return jsonError("Bank connection not found", 404);

    const accounts = await fetchPlaidAccounts(row.access_token);
    const sync = await syncPlaidTransactions({
      accessToken: row.access_token,
      cursor: row.transactions_cursor,
    });
    const syncedAt = new Date().toISOString();
    await markPlaidItemStatus({ id: row.id, status: "active" });

    return NextResponse.json({
      payload: toPlaidSyncPayload({
        itemId: row.item_id,
        institutionName: row.institution_name,
        syncedAt,
        accounts,
        delta: sync,
        previousCursor: row.transactions_cursor,
      }),
    });
  } catch (error) {
    if (error instanceof PlaidRequestError) {
      if (plaidErrorNeedsReconnect(error.errorCode)) {
        try {
          await markPlaidItemStatus({
            itemId,
            status: "needs_reconnect",
          });
        } catch {
          // Status write is best-effort; the error still returns to the client.
        }
      }
      return jsonError(error.message, error.status || 502);
    }
    return jsonError(
      error instanceof Error ? error.message : "Could not reconnect bank",
      502,
    );
  }
}
