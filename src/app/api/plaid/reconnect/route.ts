import { NextResponse } from "next/server";
import {
  fetchPlaidAccounts,
  PlaidRequestError,
  syncPlaidTransactions,
} from "@/lib/plaid/client";
import { nextPlaidItemStatusAfterSyncFailure } from "@/lib/plaid/item-status";
import { toPlaidSyncPayload } from "@/lib/plaid/sync-delta";
import { loadPlaidItemForUser, markPlaidItemStatus } from "@/lib/plaid/store";
import { jsonError, plaidSetupError, requirePlaidUser } from "@/lib/plaid/http";

/**
 * After Plaid Link update-mode success: do not re-exchange the public token.
 * Pull the latest transactions. The connection stays as it is until
 * /api/plaid/sync/commit marks it active, after the budget save.
 */
export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const setup = plaidSetupError();
  if (setup) return setup;

  let body: { itemId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }
  const itemId = body.itemId?.trim() ?? "";
  if (!itemId) return jsonError("itemId is required", 400);

  let loadedId: string | null = null;
  let loadedStatus: string | null = null;
  try {
    const row = await loadPlaidItemForUser({
      userId: auth.user!.id,
      itemId,
    });
    if (!row) return jsonError("Bank connection not found", 404);
    loadedId = row.id;
    loadedStatus = row.status;

    const accounts = await fetchPlaidAccounts(row.access_token);
    const sync = await syncPlaidTransactions({
      accessToken: row.access_token,
      cursor: row.transactions_cursor,
    });
    const syncedAt = new Date().toISOString();

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
    if (loadedId) {
      try {
        await markPlaidItemStatus({
          id: loadedId,
          status: nextPlaidItemStatusAfterSyncFailure(
            loadedStatus,
            error instanceof PlaidRequestError ? error.errorCode : null,
          ),
        });
      } catch {
        // Status write is best-effort; the error still returns to the client.
      }
    }
    if (error instanceof PlaidRequestError) {
      return jsonError(error.message, error.status || 502);
    }
    return jsonError(
      error instanceof Error ? error.message : "Could not reconnect bank",
      502,
    );
  }
}
